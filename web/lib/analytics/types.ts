export type SportCategory =
  | 'run' | 'trail_run' | 'walk' | 'hike'
  | 'road_ride' | 'gravel_ride' | 'mountain_bike' | 'indoor_ride'
  | 'swim' | 'strength' | 'mobility' | 'cardio_other' | 'other'

export type EffortLabel =
  | 'recovery' | 'endurance' | 'steady' | 'intense' | 'very_hard' | 'extreme'

export type CesModel =
  | 'power'
  | 'pace_gap'
  | 'pace_threshold'
  | 'pace_effort_distance'
  | 'hr_proxy'
  | 'legacy'

export type CesConfidence = 'high' | 'medium' | 'low'

export type ActivityInput = {
  id:                    string
  rawSportType:          string
  name?:                 string
  startDate:             string
  movingTimeSeconds:     number
  elapsedTimeSeconds?:   number
  distanceMeters?:       number
  elevationGainMeters?:  number
  averageHeartrate?:     number
  maxHeartrate?:         number
  averageWatts?:         number
  normalizedPowerWatts?: number
  calories?:             number
  perceivedEffort?:      number
}

export type UserProfileForCes = {
  max_hr?:                          number | null
  resting_hr?:                      number | null
  threshold_hr?:                    number | null
  aerobic_threshold_hr?:            number | null
  ftp_watts?:                       number | null
  threshold_pace_run_sec_per_km?:   number | null
  threshold_pace_trail_sec_per_km?: number | null
}

// Métriques dérivées des streams (SP-1), passées optionnellement au calcul CES.
export type CesStreamMetrics = {
  gradeAdjustedPaceS?: number | null
  decouplingPct?:      number | null
  elevationLossM?:     number | null
}

export type CesResult = {
  // Champs originaux (compatibilité)
  ces:             number
  cardioLoad:      number
  muscleLoad:      number
  label:           EffortLabel
  intensityFactor: number
  // Champs v2
  model:           CesModel
  confidence:      CesConfidence
  components: {
    durationHours:    number
    intensityFactor:  number
    thresholdSource:  string
    elevationFactor:  number
    sportFactor:      number
  }
  warnings:        string[]
  version:         string
}

export type SportConfig = {
  sportBase:             number
  sportFactor:           number
  defaultIF:             number
  minIF:                 number
  maxIF:                 number
  elevationSensitivity:  number
  descentSensitivity:    number
  thresholdPaceSecPerKm: number | null
  thresholdPower:        number | null
}
