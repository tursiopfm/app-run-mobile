// web/lib/design/sports.ts
import { colors } from './colors'

export type SportKey = 'run' | 'ride' | 'swim' | 'walk' | 'all'

export const SPORT_TYPE_MAP = {
  run:  ['Run', 'TrailRun'],
  ride: ['Ride', 'VirtualRide'],
  swim: ['Swim'],
  walk: ['Walk', 'Hike'],
  all:  null,
} as const

export const SPORT_CONFIG = {
  run:  { label: 'Course',   shortLabel: 'RUN', emoji: '🏃', color: colors.chargeOrange },
  ride: { label: 'Vélo',     shortLabel: 'VÉL', emoji: '🚴', color: colors.bikeGreen   },
  swim: { label: 'Natation', shortLabel: 'NAT', emoji: '🏊', color: colors.swimBlue    },
  walk: { label: 'Marche',   shortLabel: 'MAR', emoji: '🚶', color: colors.walkViolet  },
  all:  { label: 'Toutes',   shortLabel: 'ALL', emoji: '🌎', color: colors.seriesYellow },
} as const

export const ALL_SPORT_KEYS: SportKey[] = ['run', 'ride', 'swim', 'walk', 'all']
