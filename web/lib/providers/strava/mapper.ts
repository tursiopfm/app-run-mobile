export type Provider = 'strava' | 'garmin' | 'polar' | 'suunto' | 'coros' | 'fit_file'

export type NormalizedActivity = {
  userId: string
  provider: Provider
  providerActivityId: string
  sportType: string
  name: string
  startTime: string
  durationSec: number
  movingTimeSec: number
  distanceM: number
  elevationGainM: number
  avgHr: number | null
  maxHr: number | null
  avgPower: number | null
  calories: number | null
  externalTrainingLoad: number | null
  rawPayload: unknown
}

export type StravaActivity = {
  id: number
  name: string
  type: string
  sport_type: string
  start_date: string
  start_date_local?: string
  moving_time: number
  elapsed_time: number
  distance: number
  total_elevation_gain: number
  average_heartrate?: number
  max_heartrate?: number
  average_watts?: number
  weighted_average_watts?: number
  suffer_score?: number
  kilojoules?: number
  calories?: number
}

export function stravaToNormalized(userId: string, a: StravaActivity): NormalizedActivity {
  return {
    userId,
    provider: 'strava',
    providerActivityId: String(a.id),
    sportType: a.sport_type ?? a.type,
    name: a.name,
    startTime: a.start_date_local ?? a.start_date,
    durationSec: a.elapsed_time,
    movingTimeSec: a.moving_time,
    distanceM: a.distance,
    elevationGainM: a.total_elevation_gain,
    avgHr: a.average_heartrate != null ? Math.round(a.average_heartrate) : null,
    maxHr: a.max_heartrate != null ? Math.round(a.max_heartrate) : null,
    avgPower: a.weighted_average_watts != null ? Math.round(a.weighted_average_watts) : a.average_watts != null ? Math.round(a.average_watts) : null,
    calories: a.calories ?? null,
    externalTrainingLoad: a.suffer_score ?? null,
    rawPayload: a,
  }
}
