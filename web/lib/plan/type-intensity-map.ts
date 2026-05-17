import type { IntensityLevel, SessionType } from '@/types/plan'

export const TYPE_DEFAULT_INTENSITY: Record<SessionType, IntensityLevel> = {
  sortie_longue: 2,
  fractionne:    5,
  seuil_tempo:   4,
  cotes:         3,
  footing:       2,
  course:        2,
  runtaf:        2,
  velotaf:       2,
  velo:          2,
  natation:      2,
  renfo:         1,
  musculation:   1,
}

// Utilisable pour les types custom user (Phase 2) : fallback Endurance (2).
export function getDefaultIntensityForType(type: SessionType): IntensityLevel {
  return TYPE_DEFAULT_INTENSITY[type] ?? 2
}
