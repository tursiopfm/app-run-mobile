export type SportCategory =
  | 'run' | 'trail_run' | 'walk' | 'hike'
  | 'road_ride' | 'gravel_ride' | 'mountain_bike' | 'indoor_ride'
  | 'swim' | 'strength' | 'mobility' | 'cardio_other' | 'other'

export type EffortLabel =
  | 'recovery' | 'endurance' | 'steady' | 'intense' | 'very_hard' | 'extreme'

export type ActivityInput = {
  id: string
  rawSportType: string
  name?: string
  startDate: string
  movingTimeSeconds: number
  elapsedTimeSeconds?: number
  distanceMeters?: number
  elevationGainMeters?: number
  averageHeartrate?: number
  maxHeartrate?: number
  averageWatts?: number
  normalizedPowerWatts?: number
  calories?: number
  perceivedEffort?: number
}

export type CesResult = {
  ces: number
  cardioLoad: number
  muscleLoad: number
  label: EffortLabel
  intensityFactor: number
}

export type SportConfig = {
  sportBase: number
  sportFactor: number
  defaultIF: number
  minIF: number
  maxIF: number
  elevationSensitivity: number
  thresholdPaceSecPerKm: number | null
  thresholdPower: number | null
}
