// web/lib/design/sports.ts
import { colors } from './colors'

export type SportKey = 'run' | 'ride' | 'swim' | 'all'

export const SPORT_TYPE_MAP: Record<SportKey, string[] | null> = {
  run:  ['Run', 'TrailRun'],
  ride: ['Ride', 'VirtualRide'],
  swim: ['Swim'],
  all:  null,
}

export const SPORT_CONFIG: Record<SportKey, {
  label:      string
  shortLabel: string
  emoji:      string
  color:      string
}> = {
  run:  { label: 'Course',   shortLabel: 'RUN', emoji: '🏃', color: colors.chargeOrange },
  ride: { label: 'Vélo',     shortLabel: 'VÉL', emoji: '🚴', color: colors.seriesBlue   },
  swim: { label: 'Natation', shortLabel: 'NAT', emoji: '🏊', color: colors.seriesGreen  },
  all:  { label: 'Toutes',   shortLabel: 'ALL', emoji: '⚡', color: colors.seriesYellow },
}

export const ALL_SPORT_KEYS: SportKey[] = ['run', 'ride', 'swim', 'all']
