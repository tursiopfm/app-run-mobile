// Mode « barrières » : quand l'objectif total égale la barrière d'arrivée (zéro
// marge), la colonne Objectif doit reproduire EXACTEMENT les barrières horaires —
// pas de répartition effort-km/fade, qui projetterait un passage au-delà d'une
// barrière intermédiaire. Logique pure, dérivée : rien n'est persisté.

import { parseClockToElapsed } from '@/lib/plan/waypoint-view'
import { estimatePassageTimes } from '@/lib/plan/pacing'

export interface LockWaypoint {
  km: number
  dPlus: number | null
  targetOverrideSec: number | null
  cutoffRaw: string | null
  cutoffKind: 'clock_time' | 'elapsed' | 'unknown' | null
}

const TOLERANCE_SEC = 60

// Écoulé (s depuis le départ) de la barrière de chaque point, null si absente.
// Parcours monotone (chaque barrière ≥ la précédente) → lève l'ambiguïté du jour.
export function barrierElapsedSeries(
  waypoints: LockWaypoint[],
  startTime?: string,
): (number | null)[] {
  const out: (number | null)[] = new Array(waypoints.length).fill(null)
  let prev = 0
  for (let i = 0; i < waypoints.length; i++) {
    const raw = waypoints[i].cutoffRaw
    if (!raw) continue
    const m = /(\d{1,2})[:h](\d{2})/.exec(raw)
    if (!m) continue
    let e: number | null
    if (waypoints[i].cutoffKind === 'elapsed') {
      e = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60
    } else {
      if (!startTime) continue
      e = parseClockToElapsed(startTime, `${m[1]}:${m[2]}`, prev)
    }
    if (e == null) continue
    out[i] = e
    prev = e
  }
  return out
}

// Écoulé de la barrière d'arrivée (dernier point), null si absente.
export function arrivalBarrierSec(
  waypoints: LockWaypoint[],
  startTime?: string,
): number | null {
  if (waypoints.length === 0) return null
  const series = barrierElapsedSeries(waypoints, startTime)
  return series[series.length - 1]
}

// Vrai quand l'objectif total ≈ la barrière d'arrivée (à la minute près).
export function isBarrierLocked(
  waypoints: LockWaypoint[],
  startTime: string | undefined,
  targetDurationMin: number | null | undefined,
): boolean {
  if (targetDurationMin == null) return false
  const arr = arrivalBarrierSec(waypoints, startTime)
  if (arr == null) return false
  return Math.abs(arr - targetDurationMin * 60) <= TOLERANCE_SEC
}

// Heures de passage (s écoulées) + indicateur de mode. Point d'entrée UNIQUE de
// l'UI (tableau + PDF) : décide barrières vs répartition effort-km.
export function resolveElapsed(
  waypoints: LockWaypoint[],
  startTime: string | undefined,
  targetDurationMin: number | null | undefined,
  fade: number,
): { elapsed: number[] | null; locked: boolean } {
  if (targetDurationMin == null) return { elapsed: null, locked: false }
  const totalSec = targetDurationMin * 60

  if (!isBarrierLocked(waypoints, startTime, targetDurationMin)) {
    const elapsed = estimatePassageTimes(
      waypoints.map((w) => ({ km: w.km, dPlus: w.dPlus, targetOverrideSec: w.targetOverrideSec })),
      { totalDurationSec: totalSec, fade },
    )
    return { elapsed, locked: false }
  }

  // Mode barrières : ancres = override ?? barrière (départ 0, arrivée objectif),
  // trous interpolés au prorata de la distance.
  const n = waypoints.length
  const series = barrierElapsedSeries(waypoints, startTime)
  const elapsed: number[] = new Array(n).fill(0)

  const anchorVal = (i: number): number | null => {
    if (i === 0) return 0
    if (i === n - 1) return totalSec
    if (waypoints[i].targetOverrideSec != null) return waypoints[i].targetOverrideSec
    return series[i]
  }

  const anchors: number[] = []
  for (let i = 0; i < n; i++) {
    const v = anchorVal(i)
    if (v != null) { elapsed[i] = v; anchors.push(i) }
  }

  for (let a = 0; a < anchors.length - 1; a++) {
    const ia = anchors[a]
    const ib = anchors[a + 1]
    const span = elapsed[ib] - elapsed[ia]
    const dist = waypoints[ib].km - waypoints[ia].km
    for (let k = ia + 1; k < ib; k++) {
      const frac = dist > 0 ? (waypoints[k].km - waypoints[ia].km) / dist : (k - ia) / (ib - ia)
      elapsed[k] = elapsed[ia] + span * frac
    }
  }

  return { elapsed: elapsed.map((s) => Math.round(s)), locked: true }
}
