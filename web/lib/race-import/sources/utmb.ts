// Parser UTMB World Series : la page course ({slug}.utmb.world/.../races/{code})
// embarque un JSON "points":[…] dans son HTML serveur. On le lit directement
// (déterministe, 0 LLM). Dépendance : noms de champs UTMB (supplies, isAssistance,
// hasBag, distance, gainElevation, lossElevation, name, cutoff). Si UTMB change sa
// structure → le parser lève → la route retombe sur le fallback LLM.
import 'server-only'
import type { ExtractedRaceData, WaypointSupply, WaypointType } from '@/types/plan'
import { validateExtractedRaceData } from '../schema'
import { type RaceParser, registerParser } from './index'

const FETCH_TIMEOUT_MS = 10_000
const MAX_BYTES = 4_000_000

export class UtmbError extends Error {}

// Champs du JSON embarqué qu'on lit (la page en contient bien d'autres).
export interface UtmbPoint {
  name: string
  distance: number                 // mètres
  gainElevation: number | null     // D+ cumulé
  lossElevation: number | null     // D- cumulé
  supplies: 'none' | 'drink' | 'food' | 'hotFood' | string  // hiérarchique
  isAssistance: boolean
  hasBag: boolean                  // sac d'allègement → base de vie
  cutoff: string | null            // ex "sam. 07:20" ou ""
}

// supplies UTMB (drink ⊂ food ⊂ hotFood) + flags → nos 5 catégories, ordre canonique.
export function mapUtmbSupplies(p: UtmbPoint): WaypointSupply[] {
  const out: WaypointSupply[] = []
  const s = p.supplies
  if (s === 'drink' || s === 'food' || s === 'hotFood') out.push('liquid')
  if (s === 'food' || s === 'hotFood') out.push('solid')
  if (s === 'hotFood') out.push('hot')
  if (p.hasBag) out.push('base_vie')
  if (p.isAssistance) out.push('assistance')
  return out
}

// Isole le tableau JSON "points":[…] du HTML. Scanner d'appariement de crochets
// CONSCIENT DES CHAÎNES : ignore [ ] { } à l'intérieur des strings JSON (sinon un
// nom de point contenant un crochet couperait l'extraction).
export function extractPointsJson(html: string): UtmbPoint[] {
  const marker = '"points":['
  const at = html.indexOf(marker)
  if (at === -1) throw new UtmbError('Bloc "points" introuvable dans la page')
  const start = at + marker.length - 1 // index du '['
  let depth = 0
  let inStr = false
  let esc = false
  let end = -1
  for (let i = start; i < html.length; i++) {
    const c = html[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) { end = i + 1; break }
    }
  }
  if (end === -1) throw new UtmbError('Tableau "points" non terminé')
  let arr: unknown
  try {
    arr = JSON.parse(html.slice(start, end))
  } catch {
    throw new UtmbError('Tableau "points" non parsable')
  }
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new UtmbError('Aucun point de passage')
  }
  return arr as UtmbPoint[]
}

// Point UTMB → waypoint (sans id/raceId). type pointage si aucun ravito.
export function mapUtmbPoint(p: UtmbPoint, idx: number) {
  const supplies = mapUtmbSupplies(p)
  const cutoffRaw = p.cutoff && p.cutoff.length > 0 ? p.cutoff : null
  const type: WaypointType = supplies.length > 0 ? 'ravito' : 'pointage'
  return {
    orderIndex: idx,
    name: p.name.trim(),
    km: p.distance / 1000,
    kmInter: null,
    dPlus: p.gainElevation,
    dMoins: p.lossElevation,
    altitude: null,
    cutoffRaw,
    cutoffKind: cutoffRaw === null ? null : ('clock_time' as const),
    type,
    supplies,
    targetOverrideSec: null,
  }
}

// Date d'édition depuis le JSON embarqué (startDateIso prioritaire, sinon startDate).
// Renvoie la partie date ISO (YYYY-MM-DD) ou null.
export function extractUtmbEditionDate(html: string): string | null {
  const m =
    html.match(/"startDateIso"\s*:\s*"(\d{4}-\d{2}-\d{2})/) ??
    html.match(/"startDate"\s*:\s*"(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

// Garde un point s'il est utile : extrémités, ou ravito / assistance / barrière.
export function isUsefulPoint(p: UtmbPoint, idx: number, total: number): boolean {
  if (idx === 0 || idx === total - 1) return true
  if (p.supplies && p.supplies !== 'none') return true
  if (p.isAssistance) return true
  if (p.cutoff && p.cutoff.length > 0) return true
  return false
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'TrailCockpitBot/1.0' },
    })
    if (!res.ok) throw new UtmbError(`HTTP ${res.status} sur ${url}`)
    const text = await res.text()
    if (text.length > MAX_BYTES) throw new UtmbError('Page > 4 Mo')
    return text
  } finally {
    clearTimeout(timer)
  }
}

export const utmbParser: RaceParser = {
  id: 'utmb',
  match(url: string): boolean {
    try {
      const u = new URL(url)
      return u.hostname.endsWith('.utmb.world') && u.pathname.includes('/races/')
    } catch {
      return false
    }
  },
  async parse(url: string): Promise<ExtractedRaceData> {
    const html = await fetchHtml(url)
    const points = extractPointsJson(html)
    const total = points.length
    const waypoints = points
      .filter((p, i) => isUsefulPoint(p, i, total))
      .map((p, i) => mapUtmbPoint(p, i))
    // validate : trie par km, force depart/arrivee, réindexe order_index.
    const editionDate = extractUtmbEditionDate(html)
    const editionYear = editionDate ? Number(editionDate.slice(0, 4)) : null
    return validateExtractedRaceData({ raceName: null, editionYear, editionDate, dateExplicit: editionDate != null, startDayOfMonth: null, startTimeRaw: null, waypoints })
  },
}

registerParser(utmbParser)
