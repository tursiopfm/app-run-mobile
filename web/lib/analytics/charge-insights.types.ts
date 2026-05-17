import type { DailyMetrics, DailyLoad } from './fatigue'

export type SportCategoryKey = 'run' | 'ride' | 'swim' | 'other'

export type CesActivity = {
  id:               string
  rawSportType:     string                  // 'Run', 'TrailRun', 'Ride', etc.
  name:             string
  startDate:        string                  // ISO 8601
  ces:              number                  // peut être 0 ou NaN si absent
  movingTimeSec:    number | null
  distanceMeters:   number | null
  elevationGainM:   number | null
  avgHr:            number | null
  manualIntensity:  string | null
  workoutType:      string | null
}

export type WeeklyLoadByCategory = {
  weekLabel: string          // 'DD/MM'
  weekStart: string          // ISO date du lundi
  run:       number
  ride:      number
  swim:      number
  other:     number
  total:     number
  avg4w:     number          // moyenne CES des 4 semaines glissantes incluant celle-ci
}

export type FreshnessZone = 'very-fresh' | 'fresh' | 'balanced' | 'normal-fatigue' | 'high-fatigue'

export type FreshnessResult = {
  tsb:              number
  deltaVsWeekAgo:   number    // tsb - tsb(7j avant)
  zone:             FreshnessZone
}

export type LoadBalanceResult = {
  ewmaRatio:      number      // ATL / CTL
  sumRatio7vs28:  number      // sum7d / (sum28d / 4)
}

export type SportDistribution = {
  run:    number
  ride:   number
  swim:   number
  other:  number
  total:  number
}

export type IntensityLabel =
  | 'Récupération'
  | 'Endurance Fondamentale'
  | 'Endurance active'
  | 'Seuil'
  | 'VMA'
  | 'Non déterminée'

export type IntensityShareCes = {
  label:  IntensityLabel
  ces:    number
}

export type TopActivity = {
  id:               string
  date:             string      // ISO
  sport:            string      // sportLabel humain
  name:             string
  ces:              number
  durationSec:      number
  intensityLabel:   IntensityLabel | null
  typeLabel:        string | null      // workoutType ou null
  share7dPct:       number              // 0..100
}

export type RampRateLabel =
  | 'fast-rise'
  | 'controlled-rise'
  | 'stable'
  | 'progressive-resume'
  | 'declining'
  | 'sharp-decline'

export type RampRateResult = {
  deltaWeekPct:  number         // (curWeek - prevWeek) / prevWeek (ou 0 si prevWeek === 0)
  label:         RampRateLabel
  prevWeekZero:  boolean
}

export type StatusId =
  | 'insufficient'
  | 'overloaded'
  | 'peak'
  | 'loaded'
  | 'under-trained'
  | 'very-fresh'
  | 'light'
  | 'progressing'
  | 'balanced'

export type InsightsResult = {
  status:    StatusId
  headline:  string
  notes:     string[]
}

export type ChargeSportPayload = {
  dailyMetrics:           DailyMetrics[]
  dailyLoads:             DailyLoad[]
  weeklyLoadByCategory:   WeeklyLoadByCategory[]
  sportDistribution:      { '7': SportDistribution; '28': SportDistribution; '70': SportDistribution }
  intensityDistribution:  { '7': IntensityShareCes[]; '28': IntensityShareCes[]; '70': IntensityShareCes[] }
  top:                    TopActivity[]
  monotony7d:             number
  strain7d:               number
  activeDays7d:           number
  peakDay7d:              { date: string; ces: number } | null
  rampRate:               RampRateResult
  insights:               InsightsResult
  noCesActivities7d:      number
  noCesActivities28d:     number
  historyDays:            number
}
