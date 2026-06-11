// Recherche + résolution de l'URL d'une course depuis les infos de la fiche.
// Fiabilité : on ne fait pas confiance à l'URL "devinée" — on parse chaque
// candidat (parsers existants) et on compare distance/D+ aux valeurs saisies.
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

// "Ultra du Saint-Jacques !" → ['ultra','du','saint','jacques']
export function normalizeTokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // retire les accents
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

// Similarité de noms (Jaccard sur tokens) ∈ [0,1].
export function nameSimilarity(a: string, b: string): number {
  const ta = normalizeTokens(a)
  const tb = normalizeTokens(b)
  if (ta.length === 0 || tb.length === 0) return 0
  const setA = new Set(ta)
  const setB = new Set(tb)
  const inter = ta.filter((t) => setB.has(t)).length
  const union = new Set(ta.concat(tb)).size
  return inter / union
}

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

// Classe les candidats : écart distance + écart D+ − bonus de nom (plus bas = mieux).
export function rankRaceCandidates(target: RaceTarget, parsed: ParsedCandidate[]): RaceCandidate[] {
  const scored = parsed.map((c) => {
    const errKm = Math.abs(c.totalKm - target.distance) / Math.max(target.distance, 1)
    const errD = target.elevation > 0 && c.totalDplus != null
      ? Math.abs(c.totalDplus - target.elevation) / target.elevation
      : 0.5
    const nameSim = nameSimilarity(target.name, c.raceName ?? '')
    const score = errKm + errD - 0.3 * nameSim
    const confident = errKm <= TOL_KM && errD <= TOL_D
    return { c, score, confident }
  })
  scored.sort((a, b) => a.score - b.score)
  return scored.map(({ c, confident }) => ({ ...c, confident }))
}
