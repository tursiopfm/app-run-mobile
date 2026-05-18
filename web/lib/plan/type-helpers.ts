import type { IntensityMode, SessionType } from '@/types/plan'

const RUNNING_TYPES: ReadonlySet<SessionType> = new Set<SessionType>([
  'course',
  'sortie_longue',
  'fractionne',
  'seuil_tempo',
  'cotes',
  'footing',
  'runtaf',
])

const BIKE_TYPES: ReadonlySet<SessionType> = new Set<SessionType>([
  'velo',
  'velotaf',
])

export function isRunningType(type: SessionType): boolean {
  return RUNNING_TYPES.has(type)
}

export function isBikeType(type: SessionType): boolean {
  return BIKE_TYPES.has(type)
}

export function getDefaultIntensityMode(type: SessionType): IntensityMode {
  return isRunningType(type) ? 'pace' : 'level'
}

// Extrapole la durée (min) à partir de la distance (km) si non saisie :
// - running : allure 6 min/km
// - vélo    : 20 km/h → 3 min/km
// Autres types (natation, renfo, musculation) : pas d'extrapolation, retourne 0.
export function estimateDurationMin(type: SessionType, distanceKm: number): number {
  if (distanceKm <= 0) return 0
  if (isRunningType(type)) return distanceKm * 6
  if (isBikeType(type))    return distanceKm * 3
  return 0
}
