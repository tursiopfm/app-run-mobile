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
