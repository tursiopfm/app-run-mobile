import type {
  ActivityInput, CesResult, CesConfidence, CesModel,
  EffortLabel, SportCategory, SportConfig, UserProfileForCes, CesStreamMetrics,
} from './types'

const MUSCLE_LOAD_RATIO = 0.6
const CES_VERSION = 'v2.0'
const KCARDIO_BETA = 0.01   // gonflement par % de découplage positif
const KCARDIO_CAP  = 1.15   // plafond du correctif cardio
const KDESCENT_CAP = 0.5

function calcDescentFactor(a: ActivityInput, cfg: SportConfig, sm?: CesStreamMetrics): number | null {
  if (sm?.elevationLossM == null || cfg.descentSensitivity <= 0 || !a.distanceMeters || a.distanceMeters <= 0) return null
  const per100m = (sm.elevationLossM / a.distanceMeters) * 100
  return 1 + Math.min(KDESCENT_CAP, per100m * cfg.descentSensitivity * 0.01)
}

const SPORT_CONFIGS = {
  run:          { sportBase: 100, sportFactor: 1.00, defaultIF: 0.75, minIF: 0.4, maxIF: 1.3, elevationSensitivity: 8,  descentSensitivity: 6,  thresholdPaceSecPerKm: 300, thresholdPower: null },
  trail_run:    { sportBase: 100, sportFactor: 1.15, defaultIF: 0.75, minIF: 0.4, maxIF: 1.3, elevationSensitivity: 12, descentSensitivity: 14, thresholdPaceSecPerKm: 330, thresholdPower: null },
  walk:         { sportBase:  60, sportFactor: 0.50, defaultIF: 0.50, minIF: 0.3, maxIF: 0.8, elevationSensitivity: 10, descentSensitivity: 8,  thresholdPaceSecPerKm: null, thresholdPower: null },
  hike:         { sportBase:  60, sportFactor: 0.65, defaultIF: 0.55, minIF: 0.3, maxIF: 0.9, elevationSensitivity: 14, descentSensitivity: 16, thresholdPaceSecPerKm: null, thresholdPower: null },
  road_ride:    { sportBase:  80, sportFactor: 0.75, defaultIF: 0.70, minIF: 0.3, maxIF: 1.2, elevationSensitivity: 5,  descentSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: 220 },
  gravel_ride:  { sportBase:  80, sportFactor: 0.85, defaultIF: 0.70, minIF: 0.3, maxIF: 1.2, elevationSensitivity: 7,  descentSensitivity: 4,  thresholdPaceSecPerKm: null, thresholdPower: 220 },
  mountain_bike:{ sportBase:  90, sportFactor: 1.00, defaultIF: 0.75, minIF: 0.4, maxIF: 1.3, elevationSensitivity: 9,  descentSensitivity: 10, thresholdPaceSecPerKm: null, thresholdPower: 220 },
  indoor_ride:  { sportBase:  80, sportFactor: 0.70, defaultIF: 0.70, minIF: 0.3, maxIF: 1.2, elevationSensitivity: 0,  descentSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: 220 },
  swim:         { sportBase: 120, sportFactor: 1.10, defaultIF: 0.75, minIF: 0.4, maxIF: 1.2, elevationSensitivity: 0,  descentSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: null },
  strength:     { sportBase:  80, sportFactor: 0.90, defaultIF: 0.70, minIF: 0.4, maxIF: 1.1, elevationSensitivity: 0,  descentSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: null },
  mobility:     { sportBase:  40, sportFactor: 0.40, defaultIF: 0.50, minIF: 0.2, maxIF: 0.7, elevationSensitivity: 0,  descentSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: null },
  cardio_other: { sportBase:  80, sportFactor: 0.80, defaultIF: 0.65, minIF: 0.3, maxIF: 1.1, elevationSensitivity: 0,  descentSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: null },
  other:        { sportBase:  70, sportFactor: 0.70, defaultIF: 0.60, minIF: 0.3, maxIF: 1.0, elevationSensitivity: 0,  descentSensitivity: 0,  thresholdPaceSecPerKm: null, thresholdPower: null },
} as const satisfies Record<SportCategory, SportConfig>

export function normalizeSportType(rawSportType: string, name?: string): SportCategory {
  const raw   = rawSportType.toLowerCase()
  const title = (name ?? '').toLowerCase()
  if (raw.includes('trail'))                                                           return 'trail_run'
  if (raw.includes('run'))        return title.includes('trail') ? 'trail_run' : 'run'
  if (raw.includes('walk'))                                                            return 'walk'
  if (raw.includes('hike'))                                                            return 'hike'
  if (raw.includes('gravel'))                                                          return 'gravel_ride'
  if (raw.includes('mountain') || raw.includes('mtb'))                                 return 'mountain_bike'
  if (raw.includes('virtualride') || raw.includes('indoor') || raw.includes('trainer')) return 'indoor_ride'
  if (raw.includes('ride') || raw.includes('bike') || raw.includes('cycling'))         return 'road_ride'
  if (raw.includes('swim'))                                                            return 'swim'
  if (raw.includes('strength') || raw.includes('weight') || raw.includes('muscu'))    return 'strength'
  if (raw.includes('yoga') || raw.includes('mobility') || raw.includes('stretch'))    return 'mobility'
  if (raw.includes('cardio'))                                                          return 'cardio_other'
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

function calcKCardio(sm?: CesStreamMetrics): number {
  if (sm?.decouplingPct == null) return 1.0
  return clamp(1 + KCARDIO_BETA * Math.max(0, sm.decouplingPct), 1.0, KCARDIO_CAP)
}

type IFResult = {
  value:  number
  source: string
  model:  CesModel
}

function calcIF(
  a:       ActivityInput,
  cfg:     SportConfig,
  sport:   SportCategory,
  profile: UserProfileForCes,
  sm?:     CesStreamMetrics,
): IFResult {
  // Cycling : FTP (inchangé)
  if (profile.ftp_watts && cfg.thresholdPower !== null) {
    const ftp = profile.ftp_watts
    if (a.normalizedPowerWatts != null)
      return { value: clamp(a.normalizedPowerWatts / ftp, cfg.minIF, cfg.maxIF), source: `FTP utilisateur ${ftp}W (NP)`, model: 'power' }
    if (a.averageWatts != null)
      return { value: clamp(a.averageWatts / ftp, cfg.minIF, cfg.maxIF), source: `FTP utilisateur ${ftp}W (avg)`, model: 'power' }
  }
  if (cfg.thresholdPower !== null) {
    if (a.normalizedPowerWatts != null)
      return { value: clamp(a.normalizedPowerWatts / cfg.thresholdPower, cfg.minIF, cfg.maxIF), source: `FTP défaut ${cfg.thresholdPower}W (NP)`, model: 'power' }
    if (a.averageWatts != null)
      return { value: clamp(a.averageWatts / cfg.thresholdPower, cfg.minIF, cfg.maxIF), source: `FTP défaut ${cfg.thresholdPower}W (avg)`, model: 'power' }
  }

  // Run / Trail : seuil utilisateur ou défaut du sport
  const runThreshold =
    sport === 'run'       ? (profile.threshold_pace_run_sec_per_km ?? cfg.thresholdPaceSecPerKm)
  : sport === 'trail_run' ? (profile.threshold_pace_trail_sec_per_km ?? cfg.thresholdPaceSecPerKm)
  : null

  if (runThreshold && sm?.gradeAdjustedPaceS != null && sm.gradeAdjustedPaceS > 0) {
    return { value: clamp(runThreshold / sm.gradeAdjustedPaceS, cfg.minIF, cfg.maxIF), source: `GAP vs seuil ${runThreshold}s/km`, model: 'pace_gap' }
  }

  const hasPace = a.distanceMeters != null && a.distanceMeters > 200 && a.movingTimeSeconds > 0
  if (runThreshold && hasPace) {
    const pace = a.movingTimeSeconds / (a.distanceMeters! / 1000)
    const userSet = (sport === 'run' && profile.threshold_pace_run_sec_per_km) || (sport === 'trail_run' && profile.threshold_pace_trail_sec_per_km)
    return { value: clamp(runThreshold / pace, cfg.minIF, cfg.maxIF), source: `Allure seuil ${userSet ? 'utilisateur' : 'défaut'} ${runThreshold}s/km`, model: 'pace_threshold' }
  }

  // Fallback FC pur (sports sans allure seuil ni puissance) : % de réserve cardiaque.
  if (a.averageHeartrate != null && profile.max_hr && profile.resting_hr && profile.max_hr > profile.resting_hr) {
    const hrRel = (a.averageHeartrate - profile.resting_hr) / (profile.max_hr - profile.resting_hr)
    return { value: clamp(hrRel / 0.85, cfg.minIF, cfg.maxIF), source: 'FC relative (réserve)', model: 'hr_proxy' }
  }
  return { value: cfg.defaultIF, source: 'Facteur par défaut', model: 'legacy' }
}

function calcElevationFactor(a: ActivityInput, cfg: SportConfig): number {
  if (cfg.elevationSensitivity <= 0 || !a.distanceMeters || a.distanceMeters <= 0) return 1.0
  const gain    = a.elevationGainMeters ?? 0
  const per100m = (gain / a.distanceMeters) * 100
  return 1.0 + per100m * cfg.elevationSensitivity * 0.01
}

function buildConfidenceAndWarnings(
  sport:     SportCategory,
  ifResult:  IFResult,
  a:         ActivityInput,
  profile:   UserProfileForCes,
): { confidence: CesConfidence; warnings: string[] } {
  const warnings: string[] = []
  let confidence: CesConfidence = 'high'

  // Pas d'allure seuil personnalisée pour run/trail
  if (sport === 'run' && !profile.threshold_pace_run_sec_per_km) {
    warnings.push("Score calculé avec une allure seuil par défaut. Renseigne ton allure seuil pour améliorer la précision.")
    confidence = 'low'
  } else if (sport === 'trail_run' && !profile.threshold_pace_trail_sec_per_km) {
    warnings.push("Score trail calculé avec une allure seuil par défaut. Renseigne ton allure seuil trail pour plus de précision.")
    confidence = 'medium'
  }

  // Trail avec D+ uniquement
  if (sport === 'trail_run' && (a.elevationGainMeters ?? 0) > 0) {
    warnings.push("Le score trail utilise uniquement le D+. La descente et la technicité ne sont pas encore prises en compte.")
    if (confidence === 'high') confidence = 'medium'
  }

  // Vélo sans puissance (utilise IF par défaut)
  if (ifResult.model === 'legacy' && (sport === 'road_ride' || sport === 'gravel_ride' || sport === 'mountain_bike' || sport === 'indoor_ride')) {
    warnings.push("Score vélo calculé sans données de puissance. Renseigne ton FTP pour améliorer la précision.")
    confidence = 'low'
  }

  return { confidence, warnings }
}

export function computeCesResult(a: ActivityInput, profile: UserProfileForCes = {}, streamMetrics?: CesStreamMetrics): CesResult {
  const durationHours = Math.max(a.movingTimeSeconds / 3600, 0.01)
  const sport         = normalizeSportType(a.rawSportType, a.name)
  const cfg           = SPORT_CONFIGS[sport]
  const ifResult      = calcIF(a, cfg, sport, profile, streamMetrics)
  const elevFactor    = ifResult.model === 'pace_gap' ? 1.0 : calcElevationFactor(a, cfg)
  const kCardio       = calcKCardio(streamMetrics)
  const baseScore     = durationHours * cfg.sportBase * (ifResult.value * ifResult.value)
  const finalScore    = baseScore * cfg.sportFactor * elevFactor * kCardio
  const ces           = Math.round(finalScore)

  const { confidence, warnings } = buildConfidenceAndWarnings(sport, ifResult, a, profile)

  return {
    ces,
    cardioLoad:      Math.round(baseScore * cfg.sportFactor * kCardio),
    muscleLoad:      (() => {
                       const kDescent = calcDescentFactor(a, cfg, streamMetrics)
                       return kDescent != null
                         ? Math.round(baseScore * cfg.sportFactor * kDescent)
                         : Math.round(finalScore * MUSCLE_LOAD_RATIO)
                     })(),
    label:           effortLabel(ces),
    intensityFactor: Math.round(ifResult.value * 100) / 100,
    model:           ifResult.model,
    confidence,
    components: {
      durationHours,
      intensityFactor: ifResult.value,
      thresholdSource: ifResult.source,
      elevationFactor: elevFactor,
      sportFactor:     cfg.sportFactor,
    },
    warnings,
    version: CES_VERSION,
  }
}

export function computeCes(a: ActivityInput, profile?: UserProfileForCes): number {
  return computeCesResult(a, profile).ces
}

export type { ActivityInput, CesResult, EffortLabel, SportCategory, UserProfileForCes }
