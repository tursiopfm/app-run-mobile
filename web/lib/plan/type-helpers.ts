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

export function isRunningType(type: SessionType): boolean {
  return RUNNING_TYPES.has(type)
}

export function getDefaultIntensityMode(type: SessionType): IntensityMode {
  return isRunningType(type) ? 'pace' : 'level'
}
