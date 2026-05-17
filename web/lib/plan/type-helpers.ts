import type { SessionType } from '@/types/plan'

const RUNNING_TYPES: ReadonlySet<SessionType> = new Set([
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

export type IntensityMode = 'level' | 'pace'

export function getDefaultIntensityMode(type: SessionType): IntensityMode {
  return isRunningType(type) ? 'pace' : 'level'
}
