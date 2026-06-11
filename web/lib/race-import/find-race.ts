// Recherche + résolution de l'URL d'une course depuis les infos de la fiche.
// Fiabilité : on ne fait pas confiance à l'URL "devinée" — on parse chaque
// candidat (parsers existants) et on compare distance/D+ aux valeurs saisies.
import 'server-only'
import { findParserForUrl } from './sources'
import { searchRaceUrls } from './search-openai'
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

// Résout une liste d'URLs en candidats via les parsers UTMB / LiveTrail.
async function resolveParsableUrls(urls: string[]): Promise<ParsedCandidate[]> {
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
    if (slugsSeen.size >= MAX_PARSE) break
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
  return parsed
}

const MAX_DISCOVER_PAGES = 2  // pages « autres » (site officiel) qu'on explore
const MAX_SUBLINKS = 4        // sous-liens live/résultats suivis par page

// URLs livetrail/utmb présentes dans un HTML.
function harvestTimingUrls(html: string): string[] {
  const re = /https?:\/\/[a-z0-9.-]+\.(?:livetrail\.(?:net|run)|utmb\.world)[^\s"'<>)]*/gi
  return Array.from(new Set(Array.from(html.matchAll(re)).map((m) => m[0])))
}

// Liens internes (même domaine) ressemblant à une page live / résultats / parcours.
function findRaceSubLinks(html: string, baseUrl: string): string[] {
  let origin: string
  try { origin = new URL(baseUrl).origin } catch { return [] }
  const kw = /ledirect|sultat|suivi|direct|parcours|tracking|chrono|result|\blive\b/i
  const out = new Set<string>()
  for (const m of Array.from(html.matchAll(/href="([^"]+)"/gi))) {
    if (!kw.test(m[1])) continue
    try {
      const abs = new URL(m[1], baseUrl)
      if (abs.origin === origin) out.add(abs.toString())
    } catch { /* href invalide */ }
  }
  return Array.from(out)
}

// Depuis des pages « autres » (site officiel), découvre les URLs de chronométrage
// (livetrail/utmb) : d'abord dans la page, sinon en suivant 1 saut les liens
// live/résultats du même domaine. Déterministe (aucun LLM).
async function discoverTimingUrls(otherUrls: string[]): Promise<string[]> {
  const found = new Set<string>()
  for (const url of otherUrls.slice(0, MAX_DISCOVER_PAGES)) {
    try {
      const html = await fetchRaceHtml(url)
      const direct = harvestTimingUrls(html)
      if (direct.length > 0) {
        direct.forEach((u) => found.add(u))
        continue
      }
      for (const sub of findRaceSubLinks(html, url).slice(0, MAX_SUBLINKS)) {
        try {
          const h2 = await fetchRaceHtml(sub)
          harvestTimingUrls(h2).forEach((u) => found.add(u))
        } catch { /* sous-page injoignable */ }
      }
    } catch { /* page injoignable */ }
  }
  return Array.from(found)
}

// URLs → candidats classés. Cascade : UTMB/LiveTrail directs → (si rien de fiable)
// liens de chronométrage découverts sur le site officiel → (en dernier) LLM.
export async function resolveCandidates(target: RaceTarget, rawUrls: string[]): Promise<RaceCandidate[]> {
  const urls = harvestRaceUrls(rawUrls)
  const parsed = await resolveParsableUrls(urls)
  let ranked = rankRaceCandidates(target, dedupCandidates(parsed))
  if (ranked.length > 0 && ranked[0].confident) return ranked

  const otherUrls = urls.filter((u) => findParserForUrl(u) == null)

  // 1) Suivre les liens du site officiel vers le chronométrage (livetrail/utmb).
  const timingUrls = await discoverTimingUrls(otherUrls)
  if (timingUrls.length > 0) {
    parsed.push(...(await resolveParsableUrls(timingUrls)))
    ranked = rankRaceCandidates(target, dedupCandidates(parsed))
    if (ranked.length > 0 && ranked[0].confident) return ranked
  }

  // 2) Dernier recours : extraction LLM générique de la page « autre ».
  if (otherUrls.length > 0) {
    const generic = await extractGenericCandidates(otherUrls.slice(0, MAX_GENERIC))
    if (generic.length > 0) {
      parsed.push(...generic)
      ranked = rankRaceCandidates(target, dedupCandidates(parsed))
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
