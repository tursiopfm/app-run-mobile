// Recherche + résolution de l'URL d'une course depuis les infos de la fiche.
// Fiabilité : on ne fait pas confiance à l'URL "devinée" — on parse chaque
// candidat (parsers existants) et on compare distance/D+ aux valeurs saisies.
import 'server-only'
import OpenAI from 'openai'
import { findParserForUrl } from './sources'
import type { ExtractedRaceData } from '@/types/plan'

export interface RaceTarget {
  name: string
  date: string          // ISO YYYY-MM-DD
  distance: number      // km
  elevation: number     // m D+
}

// Candidat AVANT scoring (sortie du parsing).
export interface ParsedCandidate {
  url: string
  parserId: string
  raceName: string | null
  totalKm: number
  totalDplus: number | null
  nbPoints: number
  waypoints: ExtractedRaceData['waypoints']
}

// Candidat APRÈS scoring (renvoyé à l'UI).
export interface RaceCandidate extends ParsedCandidate {
  confident: boolean
}

const TOL_KM = 0.12   // 12 % d'écart de distance toléré
const TOL_D = 0.20    // 20 % d'écart de D+ toléré

// Dédup + validation syntaxique des URLs (fragment ignoré pour le dédoublonnage).
export function harvestRaceUrls(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of urls) {
    try { new URL(raw) } catch { continue }
    const key = raw.split('#')[0]
    if (seen.has(key)) continue
    seen.add(key)
    out.push(raw)
  }
  return out
}

const MAX_PARSE = 5

// Recherche web OpenAI → liste d'URLs candidates (citations + filet regex).
// Note : web_search_options / annotations ne sont pas toujours typés selon la
// version du SDK → cast `any` localisés.
export async function searchRaceUrls(target: RaceTarget): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY absente côté serveur')
  const year = target.date.slice(0, 4)
  const client = new OpenAI({ apiKey })
  const prompt =
    `Trouve la ou les page(s) officielle(s) LiveTrail (livetrail.net / livetrail.run) ` +
    `ou UTMB (utmb.world) du parcours de la course de trail « ${target.name} » ` +
    `(édition ${year}, environ ${target.distance} km et ${target.elevation} m de D+). ` +
    `Donne les URLs directes de la page "parcours / race" de cette course.`
  const res = await client.chat.completions.create({
    model: 'gpt-4o-search-preview',
    web_search_options: {},
    messages: [{ role: 'user', content: prompt }],
  } as any)
  const msg: any = res.choices[0]?.message
  const urls: string[] = []
  for (const a of msg?.annotations ?? []) {
    if (a?.type === 'url_citation' && a.url_citation?.url) urls.push(a.url_citation.url)
  }
  const content: string = msg?.content ?? ''
  for (const m of Array.from(content.matchAll(/https?:\/\/[^\s)\]"'<>]+/g))) urls.push(m[0])
  return urls
}

// Parse un candidat via le parser enregistré (null si pas de parser / échec).
async function parseCandidate(url: string): Promise<ParsedCandidate | null> {
  const parser = findParserForUrl(url)
  if (!parser) return null
  try {
    const data = await parser.parse(url)
    const wps = data.waypoints
    if (wps.length === 0) return null
    const last = wps[wps.length - 1]
    return {
      url,
      parserId: parser.id,
      raceName: data.raceName,
      totalKm: last.km,
      totalDplus: last.dPlus,
      nbPoints: wps.length,
      waypoints: wps,
    }
  } catch {
    return null
  }
}

// URLs → candidats parsés (filtrés/parsés/dédupliqués) → classés.
export async function resolveCandidates(target: RaceTarget, rawUrls: string[]): Promise<RaceCandidate[]> {
  const urls = harvestRaceUrls(rawUrls)
    .filter((u) => findParserForUrl(u) != null)
    .slice(0, MAX_PARSE)
  const parsed = (await Promise.all(urls.map(parseCandidate)))
    .filter((c): c is ParsedCandidate => c != null)
  // dédup d'une même course atteinte par 2 URLs (ex. fr/en)
  const seen = new Set<string>()
  const uniq = parsed.filter((c) => {
    const k = `${c.parserId}|${c.totalKm}|${c.totalDplus}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return rankRaceCandidates(target, uniq)
}

// Orchestrateur complet : recherche → résolution.
export async function findRaceCandidates(target: RaceTarget): Promise<RaceCandidate[]> {
  const rawUrls = await searchRaceUrls(target)
  return resolveCandidates(target, rawUrls)
}

// Classe les candidats : écart distance + écart D+ (plus bas = mieux).
export function rankRaceCandidates(target: RaceTarget, parsed: ParsedCandidate[]): RaceCandidate[] {
  const scored = parsed.map((c) => {
    const errKm = Math.abs(c.totalKm - target.distance) / Math.max(target.distance, 1)
    const errD = target.elevation > 0 && c.totalDplus != null
      ? Math.abs(c.totalDplus - target.elevation) / target.elevation
      : 0.5
    const score = errKm + errD
    const confident = errKm <= TOL_KM && errD <= TOL_D
    return { c, score, confident }
  })
  scored.sort((a, b) => a.score - b.score)
  return scored.map(({ c, confident }) => ({ ...c, confident }))
}
