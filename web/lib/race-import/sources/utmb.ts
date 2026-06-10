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
  async parse(): Promise<ExtractedRaceData> {
    throw new UtmbError('not implemented') // complété en Task 4
  },
}

// (registerParser ajouté en Task 4, une fois parse() réel.)

// Les symboles ci-dessous sont utilisés dans les Tasks 3-4 ; on les exporte
// pour éviter les erreurs TS « unused import » sans les supprimer.
export { validateExtractedRaceData, registerParser, FETCH_TIMEOUT_MS, MAX_BYTES }
export type { WaypointType }
