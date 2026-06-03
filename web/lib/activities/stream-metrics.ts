import { gradeAdjustmentFactor } from '@/lib/activities/vap'

export type StreamSet = {
  time?:      number[]   // secondes cumulées
  altitude?:  number[]   // m
  heartrate?: number[]   // bpm
  velocity?:  number[]   // m/s (velocity_smooth)
  distance?:  number[]   // m cumulés
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
    if (v == null || g == null || v <= 0) continue
    sum += v * gradeAdjustmentFactor(g / 100)
    n++
  }
  if (n === 0) return null
  const meanGaV = sum / n
  if (meanGaV <= 0) return null
  return Math.round(1000 / meanGaV)
}
