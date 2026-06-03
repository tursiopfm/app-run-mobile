import { gradeAdjustmentFactor } from '@/lib/activities/vap'

export type StreamSet = {
  time?:      number[]   // secondes cumulées
  altitude?:  number[]   // m
  heartrate?: number[]   // bpm
  velocity?:  number[]   // m/s (velocity_smooth)
  distance?:  number[]   // m cumulés — persisté dans le payload brut, pas (encore) consommé par les métriques
  grade?:     number[]   // % (grade_smooth)
}

// D- : somme des deltas négatifs d'altitude, avec hystérésis anti-jitter GPS.
export function elevationLoss(altitude: number[], minDelta = 1): number {
  if (!altitude || altitude.length < 2) return 0
  let loss = 0
  let ref = altitude[0]
  for (let i = 1; i < altitude.length; i++) {
    const d = altitude[i] - ref
    if (d <= -minDelta) { loss += -d; ref = altitude[i] }
    else if (d >= minDelta) { ref = altitude[i] }
  }
  return Math.round(loss)
}

// Découplage aérobie (%) : chute de l'efficience EF = output/FC entre la 1re et
// la 2e moitié. Positif = la FC a dérivé vers le haut. null si pas de FC ou < minDurationSec.
export function decouplingPct(
  output: number[],
  hr: number[],
  time: number[],
  minDurationSec = 1200,
): number | null {
  if (!output || !hr || output.length === 0 || hr.length !== output.length) return null
  // Durée = bornes du stream time ; fallback = nb d'échantillons (≈ secondes pour un stream 1 Hz, défaut Strava).
  const dur = time && time.length >= 2 ? time[time.length - 1] - time[0] : output.length
  if (dur < minDurationSec) return null

  const ef = (o: number[], h: number[]): number | null => {
    let so = 0, sh = 0, n = 0
    for (let i = 0; i < o.length; i++) {
      if (o[i] > 0 && h[i] > 0) { so += o[i]; sh += h[i]; n++ }
    }
    if (n === 0) return null
    return (so / n) / (sh / n)
  }

  const mid = Math.floor(output.length / 2)
  const ef1 = ef(output.slice(0, mid), hr.slice(0, mid))
  const ef2 = ef(output.slice(mid), hr.slice(mid))
  if (ef1 == null || ef2 == null || ef1 === 0) return null
  return Math.round(((ef1 - ef2) / ef1) * 1000) / 10
}

// Allure plate équivalente (sec/km) : chaque pas, vitesse × facteur Minetti
// (pente en %, convertie en décimal), moyennée puis inversée.
export function gradeAdjustedPaceSec(velocity: number[], grade: number[]): number | null {
  if (!velocity || !grade || velocity.length === 0 || grade.length === 0) return null
  let sum = 0
  let n = 0
  const len = Math.min(velocity.length, grade.length)
  for (let i = 0; i < len; i++) {
    const v = velocity[i]
    const g = grade[i]
    if (v == null || g == null || Number.isNaN(v) || Number.isNaN(g) || v <= 0) continue
    sum += v * gradeAdjustmentFactor(g / 100)
    n++
  }
  if (n === 0) return null
  const meanGaV = sum / n
  if (meanGaV <= 0) return null
  return Math.round(1000 / meanGaV)
}

export type StreamMetrics = {
  elevationLossM:    number | null
  decouplingPct:     number | null
  gradeAdjustedPaceS: number | null
}

export function computeStreamMetrics(s: StreamSet): StreamMetrics {
  return {
    elevationLossM: s.altitude && s.altitude.length >= 2 ? elevationLoss(s.altitude) : null,
    decouplingPct:
      s.velocity && s.heartrate && s.time
        ? decouplingPct(s.velocity, s.heartrate, s.time)
        : null,
    gradeAdjustedPaceS:
      s.velocity && s.grade ? gradeAdjustedPaceSec(s.velocity, s.grade) : null,
  }
}
