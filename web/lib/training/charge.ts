// Estimation de la charge (TSS approximatif) d'une séance planifiée.
// Formule : duration * intensityFactor[intensity] * (1 + (elevation/1000) * 0.15)
// Le facteur 0.15 majore la charge de 15 % par 1000 m de D+.

import type { IntensityLevel } from '@/lib/activities/indicators'

const INTENSITY_FACTOR: Record<IntensityLevel, number> = {
  1: 0.5,
  2: 0.8,
  3: 1.2,
  4: 1.8,
  5: 2.5,
}

export function estimateCharge(
  durationMin: number,
  intensity: IntensityLevel,
  elevationM?: number,
): number {
  const factor = INTENSITY_FACTOR[intensity]
  const elevationBonus = 1 + ((elevationM ?? 0) / 1000) * 0.15
  return Math.round(durationMin * factor * elevationBonus)
}
