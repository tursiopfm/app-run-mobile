// Répartition pure du temps cible sur chaque tronçon d'une course.
// v1 : effort-km (distance + D+/100) + fade (2e moitié plus lente) + ancres
// (départ, overrides, arrivée). Conçu pour être remplacé par un moteur avancé
// (VAP réel + indice UTMB/Betrail + historique) SANS changer la signature.

export interface PacingWaypoint {
  km: number                       // cumulé depuis le départ (point 0 = 0)
  dPlus: number | null             // D+ CUMULÉ au point
  targetOverrideSec: number | null // si non-null : heure figée (s écoulées)
}

export interface PacingOptions {
  totalDurationSec: number // temps cible total (arrivée)
  fade: number             // >= 0 ; 0 = répartition pure effort
}

// Retourne les secondes écoulées depuis le départ pour chaque point (aligné par
// index). Point 0 = 0 ; dernier point = arrivée (override prioritaire).
export function estimatePassageTimes(
  waypoints: PacingWaypoint[],
  opts: PacingOptions,
): number[] {
  const n = waypoints.length
  if (n === 0) return []
  if (n === 1) return [0]

  // 1) Effort-km par tronçon i (du point i-1 au point i), i = 1..n-1.
  const effort: number[] = new Array(n).fill(0)
  for (let i = 1; i < n; i++) {
    const dist = Math.max(0, waypoints[i].km - waypoints[i - 1].km)
    const dPlusSeg = Math.max(0, (waypoints[i].dPlus ?? 0) - (waypoints[i - 1].dPlus ?? 0))
    effort[i] = dist + dPlusSeg / 100
  }
  let totalEffort = effort.reduce((s, e) => s + e, 0)
  // Garde-fou : route sans géométrie exploitable → poids uniformes.
  if (totalEffort <= 0) {
    for (let i = 1; i < n; i++) effort[i] = 1
    totalEffort = n - 1
  }

  // 2) Poids temps avec fade, centré sur 0.5 (le total reste ≈ cible).
  const weight: number[] = new Array(n).fill(0)
  let cumBefore = 0
  for (let i = 1; i < n; i++) {
    const midFrac = (cumBefore + effort[i] / 2) / totalEffort
    const factor = Math.max(0.05, 1 + opts.fade * (midFrac - 0.5))
    weight[i] = effort[i] * factor
    cumBefore += effort[i]
  }

  // 3) Ancres : index 0 = 0, dernier = override ?? cible, + overrides internes.
  const elapsed: number[] = new Array(n).fill(0)
  const anchors: number[] = [0]
  for (let i = 1; i < n - 1; i++) {
    if (waypoints[i].targetOverrideSec != null) anchors.push(i)
  }
  anchors.push(n - 1)
  elapsed[0] = 0
  elapsed[n - 1] = waypoints[n - 1].targetOverrideSec ?? opts.totalDurationSec
  for (let i = 1; i < n - 1; i++) {
    if (waypoints[i].targetOverrideSec != null) elapsed[i] = waypoints[i].targetOverrideSec as number
  }

  // 4) Répartir le temps de chaque intervalle entre ancres au prorata des poids.
  for (let a = 0; a < anchors.length - 1; a++) {
    const ia = anchors[a]
    const ib = anchors[a + 1]
    const span = elapsed[ib] - elapsed[ia]
    let spanWeight = 0
    for (let k = ia + 1; k <= ib; k++) spanWeight += weight[k]
    for (let k = ia + 1; k < ib; k++) {
      const w = spanWeight > 0 ? weight[k] / spanWeight : 1 / (ib - ia)
      elapsed[k] = elapsed[k - 1] + span * w
    }
  }

  return elapsed.map((s) => Math.round(s))
}
