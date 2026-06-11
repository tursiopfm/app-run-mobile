// Recherche + résolution de l'URL d'une course depuis les infos de la fiche.
// Fiabilité : on ne fait pas confiance à l'URL "devinée" — on parse chaque
// candidat (parsers existants) et on compare distance/D+ aux valeurs saisies.
import 'server-only'
import OpenAI from 'openai'
import { findParserForUrl } from './sources'
import { listLivetrailRaces } from './sources/livetrail'
import { fetchRaceHtml } from './fetch-url'
import { extractWaypoints } from './extract'
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
const MAX_GENERIC = 2

// Extraction LLM générique d'URLs non-parsables (site officiel / roadbook).
async function extractGenericCandidates(urls: string[]): Promise<ParsedCandidate[]> {
  const results = await Promise.all(urls.map(async (url): Promise<ParsedCandidate | null> => {
    try {
      const html = await fetchRaceHtml(url)
      const data = await extractWaypoints({ html })
      const wps = data.waypoints
      if (wps.length === 0) return null
      const last = wps[wps.length - 1]
      return {
        url, parserId: 'generic', raceName: data.raceName,
        totalKm: last.km, totalDplus: last.dPlus, nbPoints: wps.length, waypoints: wps,
      }
    } catch {
      return null
    }
  }))
  return results.filter((c): c is ParsedCandidate => c != null)
}

// Recherche web OpenAI → liste d'URLs candidates (citations + filet regex).
// Note : web_search_options / annotations ne sont pas toujours typés selon la
// version du SDK → cast `any` localisés.
export async function searchRaceUrls(target: RaceTarget): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY absente côté serveur')
  const year = target.date.slice(0, 4)
  const client = new OpenAI({ apiKey })
  const prompt =
    `Trouve les pages web de la course de trail « ${target.name} » ` +
    `(édition ${year}, environ ${target.distance} km et ${target.elevation} m de D+). ` +
    `Donne en priorité : (1) sa page de chronométrage LiveTrail ` +
    `(livetrail.net / livetrail.run) ou UTMB (utmb.world), ET (2) son site officiel ` +
    `ou sa page de résultats. Liste toutes les URLs directes pertinentes.`
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

function dedupCandidates(list: ParsedCandidate[]): ParsedCandidate[] {
  const seen = new Set<string>()
  return list.filter((c) => {
    const k = `${c.parserId}|${c.totalKm}|${c.totalDplus}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// URLs → candidats parsés (filtrés/parsés/dédupliqués) → classés.
export async function resolveCandidates(target: RaceTarget, rawUrls: string[]): Promise<RaceCandidate[]> {
  const urls = harvestRaceUrls(rawUrls)
  const utmbUrls = urls.filter((u) => findParserForUrl(u)?.id === 'utmb').slice(0, MAX_PARSE)
  const livetrailUrls = urls.filter((u) => findParserForUrl(u)?.id === 'livetrail')

  const parsed: ParsedCandidate[] = []

  // UTMB : 1 candidat par URL.
  const utmbParsed = (await Promise.all(utmbUrls.map(parseCandidate)))
    .filter((c): c is ParsedCandidate => c != null)
  parsed.push(...utmbParsed)

  // LiveTrail : toutes les courses de l'événement (dédup par slug → 1 fetch/événement).
  const slugsSeen = new Set<string>()
  for (const u of livetrailUrls) {
    let slug: string
    try { slug = new URL(u).hostname.split('.')[0] } catch { continue }
    if (slugsSeen.has(slug)) continue
    slugsSeen.add(slug)
    try {
      const races = await listLivetrailRaces(u)
      for (const r of races) {
        const wps = r.data.waypoints
        if (wps.length === 0) continue
        const last = wps[wps.length - 1]
        parsed.push({
          url: u, parserId: 'livetrail', raceName: r.raceName,
          totalKm: last.km, totalDplus: last.dPlus, nbPoints: wps.length, waypoints: wps,
        })
      }
    } catch { /* événement livetrail injoignable → ignoré */ }
  }

  let ranked = rankRaceCandidates(target, dedupCandidates(parsed))

  // Fallback générique : seulement si aucune candidate confidente via UTMB/LiveTrail.
  if (ranked.length === 0 || !ranked[0].confident) {
    const otherUrls = urls.filter((u) => findParserForUrl(u) == null).slice(0, MAX_GENERIC)
    if (otherUrls.length > 0) {
      const generic = await extractGenericCandidates(otherUrls)
      if (generic.length > 0) {
        ranked = rankRaceCandidates(target, dedupCandidates([...parsed, ...generic]))
      }
    }
  }
  return ranked
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
