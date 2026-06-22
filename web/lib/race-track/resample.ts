import type { TrackSample } from './parse-gpx-track'

export interface DenseProfile {
  d: number[]  // distances cumulées (km), scalées sur la distance officielle
  e: number[]  // altitudes (m)
}

const STEP_M = 75
const MAX_POINTS = 800

// Comble les altitudes nulles par interpolation linéaire entre voisins connus.
// Précondition (garantie par parseGpxTrack) : au moins une altitude non nulle.
function fillEle(points: TrackSample[]): { distM: number; ele: number }[] {
  const known = points
    .map((p, i) => ({ i, distM: p.distM, ele: p.ele }))
    .filter((p): p is { i: number; distM: number; ele: number } => p.ele != null)
  return points.map((p, i) => {
    if (p.ele != null) return { distM: p.distM, ele: p.ele }
    let prev: typeof known[number] | null = null, next: typeof known[number] | null = null
    for (const k of known) { if (k.i <= i) prev = k; if (k.i >= i) { next = k; break } }
    if (prev && next && prev.i !== next.i) {
      const t = (p.distM - prev.distM) / ((next.distM - prev.distM) || 1)
      return { distM: p.distM, ele: prev.ele + (next.ele - prev.ele) * t }
    }
    return { distM: p.distM, ele: (prev ?? next)!.ele }
  })
}

function eleAt(filled: { distM: number; ele: number }[], target: number): number {
  if (target <= filled[0].distM) return filled[0].ele
  const last = filled[filled.length - 1]
  if (target >= last.distM) return last.ele
  for (let i = 1; i < filled.length; i++) {
    if (filled[i].distM >= target) {
      const a = filled[i - 1], b = filled[i]
      const t = (target - a.distM) / ((b.distM - a.distM) || 1)
      return a.ele + (b.ele - a.ele) * t
    }
  }
  return last.ele
}

// Ré-échantillonne à pas fixe (~75 m, borné à MAX_POINTS) et scale l'axe distance
// de [0, distanceGpx] vers [0, officialDistanceKm] (pour aligner les ravitos au km).
// Aucun calcul de D+/D-.
export function resampleProfile(points: TrackSample[], officialDistanceKm: number): DenseProfile {
  const filled = fillEle(points)
  const totalM = filled[filled.length - 1].distM
  const n = Math.min(MAX_POINTS, Math.max(2, Math.round(totalM / STEP_M)))
  const d: number[] = [], e: number[] = []
  for (let k = 0; k <= n; k++) {
    const frac = k / n
    d.push(Math.round(officialDistanceKm * frac * 1000) / 1000)
    e.push(Math.round(eleAt(filled, frac * totalM)))
  }
  return { d, e }
}
