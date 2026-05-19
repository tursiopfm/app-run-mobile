import type { ActivityType } from '@/types/activity-types'
import { isBuiltinSessionType, type IntensityLevel, type SessionType } from '@/types/plan'
import { SESSION_TYPE_COLORS, SESSION_TYPE_LABELS } from '@/lib/activities/indicators'

export type SessionCategory = 'run' | 'bike' | 'swim' | 'other'

export interface SessionMeta {
  label: string
  color: string
  category: SessionCategory
  isRunning: boolean
  defaultIntensity: IntensityLevel
}

const FALLBACK_COLOR = '#6B7280'

const BUILTIN_CATEGORY: Record<string, SessionCategory> = {
  course: 'run',
  sortie_longue: 'run',
  fractionne: 'run',
  seuil_tempo: 'run',
  cotes: 'run',
  footing: 'run',
  runtaf: 'run',
  velo: 'bike',
  velotaf: 'bike',
  natation: 'swim',
  renfo: 'other',
  musculation: 'other',
}

const BUILTIN_DEFAULT_INTENSITY: Record<string, IntensityLevel> = {
  course: 4,
  sortie_longue: 2,
  fractionne: 5,
  seuil_tempo: 4,
  cotes: 3,
  footing: 2,
  runtaf: 2,
  velotaf: 2,
  velo: 2,
  natation: 2,
  renfo: 1,
  musculation: 1,
}

export function resolveSessionMeta(
  type: SessionType,
  catalog: ActivityType[],
): SessionMeta {
  if (isBuiltinSessionType(type)) {
    const cat = BUILTIN_CATEGORY[type]
    return {
      label: SESSION_TYPE_LABELS[type as keyof typeof SESSION_TYPE_LABELS],
      color: SESSION_TYPE_COLORS[type as keyof typeof SESSION_TYPE_COLORS],
      category: cat,
      isRunning: cat === 'run',
      defaultIntensity: BUILTIN_DEFAULT_INTENSITY[type] ?? 2,
    }
  }

  const custom = catalog.find(t => t.slug === type)
  if (custom) {
    const cat = (custom.category ?? 'other') as SessionCategory
    return {
      label: custom.label,
      color: FALLBACK_COLOR,
      category: cat,
      isRunning: cat === 'run',
      defaultIntensity: custom.defaultIntensity,
    }
  }

  return {
    label: type,
    color: FALLBACK_COLOR,
    category: 'other',
    isRunning: false,
    defaultIntensity: 2,
  }
}
