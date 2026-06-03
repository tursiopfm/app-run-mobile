import { createServiceClient } from '@/lib/database/supabase-server'
import { computeCesResult } from '@/lib/analytics/effort-score'
import type { UserProfileForCes, ActivityInput, CesStreamMetrics } from '@/lib/analytics/types'
import { unpackStreams } from '@/lib/providers/strava/streams'
import { computeStreamMetrics } from '@/lib/activities/stream-metrics'

function toActivityInput(row: Record<string, unknown>): ActivityInput {
  return {
    id:                   String(row.id),
    rawSportType:         String(row.sport_type ?? ''),
    name:                 row.name ? String(row.name) : undefined,
    startDate:            String(row.start_time ?? ''),
    movingTimeSeconds:    Number(row.moving_time_sec ?? row.duration_sec ?? 0),
    elapsedTimeSeconds:   row.duration_sec ? Number(row.duration_sec) : undefined,
    distanceMeters:       row.distance_m ? Number(row.distance_m) : undefined,
    elevationGainMeters:  row.elevation_gain_m ? Number(row.elevation_gain_m) : undefined,
    averageHeartrate:     row.avg_hr ? Number(row.avg_hr) : undefined,
    maxHeartrate:         row.max_hr ? Number(row.max_hr) : undefined,
    averageWatts:         row.avg_power ? Number(row.avg_power) : undefined,
  }
}

export async function recalculateUserEffortScores(userId: string): Promise<{ recalculated: number; errors: number }> {
  const supabase = createServiceClient()

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('max_hr, resting_hr, threshold_hr, aerobic_threshold_hr, ftp_watts, threshold_pace_run_sec_per_km, threshold_pace_trail_sec_per_km')
    .eq('id', userId)
    .single()

  const profile: UserProfileForCes = profileRow ?? {}

  const { data: activities } = await supabase
    .from('activities')
    .select('id, sport_type, name, start_time, duration_sec, moving_time_sec, distance_m, elevation_gain_m, avg_hr, max_hr, avg_power')
    .eq('user_id', userId)

  if (!activities?.length) return { recalculated: 0, errors: 0 }

  // Charger les streams stockés (raw gz) pour appliquer SP-2 ; re-dérive les métriques en local.
  const { data: streamRows } = await supabase
    .from('activity_streams')
    .select('activity_id, streams_gz')
    .eq('user_id', userId)

  const smByActivity = new Map<string, CesStreamMetrics>()
  for (const sr of streamRows ?? []) {
    try {
      const row = sr as { activity_id: string; streams_gz: string }
      const m = computeStreamMetrics(unpackStreams(String(row.streams_gz)))
      smByActivity.set(String(row.activity_id), {
        gradeAdjustedPaceS: m.gradeAdjustedPaceS,
        decouplingPct:      m.decouplingPct,
        elevationLossM:     m.elevationLossM,
      })
    } catch { /* stream illisible → fallback (pas de sm) */ }
  }

  const now = new Date().toISOString()
  const activityUpdates: Array<{ id: string; ces: number; effort_score_version: string; effort_score_updated_at: string }> = []
  const metricUpdates:   Array<{ activity_id: string; metric_key: string; metric_value: number; computed_at: string }> = []

  let errors = 0
  for (const act of activities) {
    try {
      const sm = smByActivity.get(String(act.id))
      const result = computeCesResult(toActivityInput(act), profile, sm)
      activityUpdates.push({
        id: String(act.id),
        ces: result.ces,
        effort_score_version: result.version,
        effort_score_updated_at: now,
      })
      metricUpdates.push(
        { activity_id: String(act.id), metric_key: 'cardio_load',      metric_value: result.cardioLoad,      computed_at: now },
        { activity_id: String(act.id), metric_key: 'muscle_load',      metric_value: result.muscleLoad,      computed_at: now },
        { activity_id: String(act.id), metric_key: 'intensity_factor', metric_value: result.intensityFactor, computed_at: now },
      )
      if (sm?.gradeAdjustedPaceS != null) metricUpdates.push({ activity_id: String(act.id), metric_key: 'grade_adjusted_pace_s', metric_value: sm.gradeAdjustedPaceS, computed_at: now })
      if (sm?.decouplingPct != null)      metricUpdates.push({ activity_id: String(act.id), metric_key: 'decoupling_pct',        metric_value: sm.decouplingPct,      computed_at: now })
      if (sm?.elevationLossM != null)     metricUpdates.push({ activity_id: String(act.id), metric_key: 'elevation_loss_m',      metric_value: sm.elevationLossM,     computed_at: now })
    } catch (e) {
      console.error('[recalculateUserEffortScores] activity', act.id, e)
      errors++
    }
  }

  // Two batched writes instead of N round-trips
  if (activityUpdates.length > 0) {
    const { error: actError } = await supabase
      .from('activities')
      .upsert(activityUpdates, { onConflict: 'id' })
    if (actError) {
      console.error('[recalculateUserEffortScores] batch activities upsert', actError)
      errors += activityUpdates.length
      return { recalculated: 0, errors }
    }
  }
  if (metricUpdates.length > 0) {
    const { error: mError } = await supabase
      .from('activity_metrics')
      .upsert(metricUpdates, { onConflict: 'activity_id,metric_key' })
    if (mError) {
      console.error('[recalculateUserEffortScores] batch metrics upsert', mError)
      // Activities were saved but metrics failed — partial success
    }
  }

  return { recalculated: activityUpdates.length, errors }
}

export async function recalculateUserFatigue(userId: string): Promise<void> {
  const supabase = createServiceClient()

  const { data: activities } = await supabase
    .from('activities')
    .select('start_time, ces')
    .eq('user_id', userId)
    .order('start_time', { ascending: true })

  if (!activities?.length) return

  const { buildDailyMetrics } = await import('@/lib/analytics/fatigue')

  const map = new Map<string, number>()
  for (const a of activities) {
    const date = String(a.start_time).split('T')[0]
    map.set(date, (map.get(date) ?? 0) + Number(a.ces ?? 0))
  }
  const dailyLoads = Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, ces]) => ({ date, ces }))

  const metrics = buildDailyMetrics(dailyLoads)
  if (metrics.length === 0) return

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('daily_metrics')
    .upsert(
      metrics.map(m => ({
        user_id:    userId,
        metric_date: m.date,
        atl:        m.atl,
        ctl:        m.ctl,
        tsb:        m.tsb,
        daily_load: m.dailyLoad,
        computed_at: now,
      })),
      { onConflict: 'user_id,metric_date' },
    )
  if (error) {
    console.error('[recalculateUserFatigue] batch upsert', error)
  }
}
