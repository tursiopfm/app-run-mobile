import { createServiceClient } from '@/lib/database/supabase-server'
import { computeCesResult } from '@/lib/analytics/effort-score'
import type { NormalizedActivity } from '@/lib/providers/strava/mapper'
import type { ActivityInput, CesResult, UserProfileForCes } from '@/lib/analytics/types'

export type ImportResult = { saved: number }

function toActivityInput(act: NormalizedActivity): ActivityInput {
  return {
    id: act.providerActivityId,
    rawSportType: act.sportType,
    name: act.name,
    startDate: act.startTime,
    movingTimeSeconds: act.movingTimeSec,
    elapsedTimeSeconds: act.durationSec,
    distanceMeters: act.distanceM,
    elevationGainMeters: act.elevationGainM,
    averageHeartrate: act.avgHr ?? undefined,
    maxHeartrate: act.maxHr ?? undefined,
    averageWatts: act.avgPower ?? undefined,
    calories: act.calories ?? undefined,
  }
}

export async function importActivities(
  activities: NormalizedActivity[],
  profile: UserProfileForCes = {},
): Promise<ImportResult> {
  if (activities.length === 0) return { saved: 0 }

  const supabase = createServiceClient()

  const cesMap = new Map<string, CesResult>(
    activities.map((act) => [act.providerActivityId, computeCesResult(toActivityInput(act), profile)])
  )

  const records = activities.map((act) => ({
    user_id: act.userId,
    provider: act.provider,
    provider_activity_id: act.providerActivityId,
    sport_type: act.sportType,
    name: act.name,
    start_time: act.startTime,
    duration_sec: act.durationSec,
    moving_time_sec: act.movingTimeSec,
    distance_m: act.distanceM,
    elevation_gain_m: act.elevationGainM,
    avg_hr: act.avgHr,
    max_hr: act.maxHr,
    avg_power: act.avgPower,
    calories: act.calories,
    external_training_load: act.externalTrainingLoad,
    ces:                     cesMap.get(act.providerActivityId)!.ces,
    effort_score_version:    cesMap.get(act.providerActivityId)!.version,
    effort_score_updated_at: new Date().toISOString(),
    raw_payload:             act.rawPayload,
  }))

  const { data: savedRows, error: actError } = await supabase
    .from('activities')
    .upsert(records, { onConflict: 'user_id,provider,provider_activity_id' })
    .select('id, provider_activity_id')

  if (actError) throw new Error(`Activity upsert failed: ${actError.message}`)
  if (!savedRows || savedRows.length === 0) return { saved: 0 }

  const typedRows = savedRows as { id: string; provider_activity_id: string }[]
  const metricRows = typedRows.flatMap((row) => {
    const ces = cesMap.get(row.provider_activity_id)!
    return [
      { activity_id: row.id, metric_key: 'ces',              metric_value: ces.ces },
      { activity_id: row.id, metric_key: 'cardio_load',      metric_value: ces.cardioLoad },
      { activity_id: row.id, metric_key: 'muscle_load',      metric_value: ces.muscleLoad },
      { activity_id: row.id, metric_key: 'intensity_factor', metric_value: ces.intensityFactor },
    ]
  })

  const { error: metricError } = await supabase
    .from('activity_metrics')
    .upsert(metricRows, { onConflict: 'activity_id,metric_key' })

  if (metricError) throw new Error(`Metrics upsert failed: ${metricError.message}`)

  return { saved: typedRows.length }
}
