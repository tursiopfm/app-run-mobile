import type { ActivityInput, CesResult, EffortLabel, SportCategory, SportConfig } from './types'

const SPORT_CONFIGS: Record<SportCategory, SportConfig> = {
  run:          { sportBase: 100, sportFactor: 1.00, defaultIF: 0.75, minIF: 0.4, maxIF: 1.3, elevationSensitivity: 8,  thresholdPaceSecPerKm: 300, thresholdPower: null },
  trail_run:    { sportBase: 100, sportFactor: 1.15, defaultIF: 0.75, minIF: 0.4, maxIF: 1.3, elevationSensitivity: 12, thresholdPaceSecPerKm: 330, thresholdPower: null },
  walk:         { sportBase:  60, sportFactor: 0.50, defaultIF: 0.50, minIF: 0.3, maxIF: 0.8, elevationSensitivity: 10, thresholdPaceSecPerKm: null, thresholdPower: null },
  hike:         { sportBase:  60, sportFactor: 0.65, defaultIF: 0.55, minIF: 0.3, maxIF: 0.9, elevationSensitivity: 14, thresholdPaceSecPerKm: null, thresholdPower: null },
  road_ride:    { sportBase:  80, sportFactor: 0.75, defaultIF: 0.70, minIF: 0.3, maxIF: 1.2, elevationSensitivity: 5,  thresholdPaceSecPerKm: null, thresholdPower: 220 },
  gravel_ride:  { sportBase:  80, sportFactor: 0.85, defaultIF: 0.70, minIF: 0.3, maxIF: 1.2, elevationSensitivity: 7,  thresholdPaceSecPerKm: null, thresholdPower: 220 },
  mountain_bike:{ sportBase:  90, sportFactor: 1.00, defaultIF: 0.75, minIF: 0.4, maxIF: 1.3, elevationSensitivity: 9,  thresholdPaceSecPerKm: null, thresholdPower: 220 },
  indoor_ride:  { sportBase:  80, sportFactor: 0.70, defaultIF: 0.70, minIF: 0.3, maxIF: 1.2, elevationSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: 220 },
  swim:         { sportBase: 120, sportFactor: 1.10, defaultIF: 0.75, minIF: 0.4, maxIF: 1.2, elevationSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: null },
  strength:     { sportBase:  80, sportFactor: 0.90, defaultIF: 0.70, minIF: 0.4, maxIF: 1.1, elevationSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: null },
  mobility:     { sportBase:  40, sportFactor: 0.40, defaultIF: 0.50, minIF: 0.2, maxIF: 0.7, elevationSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: null },
  cardio_other: { sportBase:  80, sportFactor: 0.80, defaultIF: 0.65, minIF: 0.3, maxIF: 1.1, elevationSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: null },
  other:        { sportBase:  70, sportFactor: 0.70, defaultIF: 0.60, minIF: 0.3, maxIF: 1.0, elevationSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: null },
}

export function normalizeSportType(rawSportType: string, name?: string): SportCategory {
  const raw   = rawSportType.toLowerCase()
  const title = (name ?? '').toLowerCase()
  if (raw.includes('trail'))                                                    return 'trail_run'
  if (raw.includes('run'))       return title.includes('trail') ? 'trail_run' : 'run'
  if (raw.includes('walk'))                                                     return 'walk'
  if (raw.includes('hike'))                                                     return 'hike'
  if (raw.includes('gravel'))                                                   return 'gravel_ride'
  if (raw.includes('mountain') || raw.includes('mtb'))                          return 'mountain_bike'
  if (raw.includes('virtualride') || raw.includes('indoor') || raw.includes('trainer')) return 'indoor_ride'
  if (raw.includes('ride') || raw.includes('bike') || raw.includes('cycling'))  return 'road_ride'
  if (raw.includes('swim'))                                                     return 'swim'
  if (raw.includes('strength') || raw.includes('weight') || raw.includes('muscu')) return 'strength'
  if (raw.includes('yoga') || raw.includes('mobility') || raw.includes('stretch')) return 'mobility'
  return 'other'
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

function effortLabel(ces: number): EffortLabel {
  if (ces <= 30)  return 'recovery'
  if (ces <= 60)  return 'endurance'
  if (ces <= 90)  return 'steady'
  if (ces <= 130) return 'intense'
  if (ces <= 180) return 'very_hard'
  return 'extreme'
}

function calcIF(a: ActivityInput, cfg: SportConfig): number {
  if (cfg.thresholdPaceSecPerKm && a.distanceMeters && a.distanceMeters > 200 && a.movingTimeSeconds > 0) {
    const paceSecPerKm = a.movingTimeSeconds / (a.distanceMeters / 1000)
    return clamp(cfg.thresholdPaceSecPerKm / paceSecPerKm, cfg.minIF, cfg.maxIF)
  }
  if (cfg.thresholdPower && a.normalizedPowerWatts) {
    return clamp(a.normalizedPowerWatts / cfg.thresholdPower, cfg.minIF, cfg.maxIF)
  }
  if (cfg.thresholdPower && a.averageWatts) {
    return clamp(a.averageWatts / cfg.thresholdPower, cfg.minIF, cfg.maxIF)
  }
  return cfg.defaultIF
}

function calcElevationFactor(a: ActivityInput, cfg: SportConfig): number {
  if (cfg.elevationSensitivity <= 0 || !a.distanceMeters || a.distanceMeters <= 0) return 1.0
  const gain    = a.elevationGainMeters ?? 0
  const per100m = (gain / a.distanceMeters) * 100
  return 1.0 + per100m * cfg.elevationSensitivity * 0.01
}

export function computeCesResult(a: ActivityInput): CesResult {
  const durationHours = Math.max(a.movingTimeSeconds / 3600, 0.01)
  const sport         = normalizeSportType(a.rawSportType, a.name)
  const cfg           = SPORT_CONFIGS[sport]
  const IF            = calcIF(a, cfg)
  const elevFactor    = calcElevationFactor(a, cfg)
  const baseScore     = durationHours * cfg.sportBase * (IF * IF)
  const finalScore    = baseScore * cfg.sportFactor * elevFactor
  return {
    ces:             Math.round(finalScore),
    cardioLoad:      Math.round(baseScore * cfg.sportFactor),
    muscleLoad:      Math.round(finalScore * 0.6),
    label:           effortLabel(finalScore),
    intensityFactor: Math.round(IF * 100) / 100,
  }
}

export function computeCes(a: ActivityInput): number {
  return computeCesResult(a).ces
}

export type { ActivityInput, CesResult, EffortLabel, SportCategory }
