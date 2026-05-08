import { createServiceClient } from '@/lib/database/supabase-server'
import { computeCesResult } from '@/lib/analytics/effort-score'
import type { UserProfileForCes, ActivityInput } from '@/lib/analytics/types'

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

export async function recalculateUserEffortScores(
  userId: string,
): Promise<{ recalculated: number; errors: number }> {
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

  let recalculated = 0
  let errors       = 0
  const now        = new Date().toISOString()

  for (const act of activities) {
    try {
      const result = computeCesResult(toActivityInput(act), profile)

      await supabase
        .from('activities')
        .update({ ces: result.ces, effort_score_version: result.version, effort_score_updated_at: now })
        .eq('id', act.id)

      await supabase
        .from('activity_metrics')
        .upsert([
          { activity_id: act.id, metric_key: 'cardio_load',      metric_value: result.cardioLoad,      computed_at: now },
          { activity_id: act.id, metric_key: 'muscle_load',      metric_value: result.muscleLoad,      computed_at: now },
          { activity_id: act.id, metric_key: 'intensity_factor', metric_value: result.intensityFactor, computed_at: now },
        ], { onConflict: 'activity_id,metric_key' })

      recalculated++
    } catch {
      errors++
    }
  }

  return { recalculated, errors }
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

  // Aggregate stored CES values by day
  const map = new Map<string, number>()
  for (const a of activities) {
    const date = String(a.start_time).split('T')[0]
    map.set(date, (map.get(date) ?? 0) + Number(a.ces ?? 0))
  }
  const dailyLoads = Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, ces]) => ({ date, ces }))

  const metrics = buildDailyMetrics(dailyLoads)
  const now     = new Date().toISOString()

  for (const m of metrics) {
    await supabase
      .from('daily_metrics')
      .upsert({
        user_id:     userId,
        metric_date: m.date,
        atl:         m.atl,
        ctl:         m.ctl,
        tsb:         m.tsb,
        daily_load:  m.dailyLoad,
        computed_at: now,
      }, { onConflict: 'user_id,metric_date' })
  }
}
