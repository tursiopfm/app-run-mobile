import { createServiceClient } from '@/lib/database/supabase-server'
import { getValidStravaToken } from './token'
import { fetchStravaStreams, downsampleStreams, packStreams } from './streams'
import { computeStreamMetrics } from '@/lib/activities/stream-metrics'

type MissingRow = { id: string; user_id: string; provider_activity_id: string }

export type StreamsBackfillResult = {
  processed: number
  stored: number
  rateLimited: boolean
  errors: number
}

export async function processStreamsBackfillBatch(
  maxActivities = 40,
): Promise<StreamsBackfillResult> {
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('activities_missing_streams', {
    p_limit: maxActivities,
  })
  if (error) throw new Error(`activities_missing_streams: ${error.message}`)

  const rows = (data ?? []) as MissingRow[]
  const byUser = new Map<string, MissingRow[]>()
  for (const r of rows) {
    const arr = byUser.get(r.user_id) ?? []
    arr.push(r)
    byUser.set(r.user_id, arr)
  }

  let processed = 0, stored = 0, errors = 0, rateLimited = false

  for (const [userId, acts] of Array.from(byUser.entries())) {
    let token: string
    try {
      token = await getValidStravaToken(userId)
    } catch {
      errors += acts.length
      continue
    }

    for (const act of acts) {
      processed++
      try {
        const raw = await fetchStravaStreams(token, act.provider_activity_id)
        const ds = downsampleStreams(raw, 5)

        // Toujours écrire une ligne (même 0 point) pour ne pas re-fetcher indéfiniment.
        await supabase.from('activity_streams').upsert(
          {
            activity_id: act.id,
            user_id: userId,
            downsample_s: 5,
            point_count: ds.time?.length ?? 0,
            streams_gz: packStreams(ds),
            source: 'strava',
          },
          { onConflict: 'activity_id' },
        )

        const m = computeStreamMetrics(ds)
        const metricRows: { activity_id: string; metric_key: string; metric_value: number }[] = []
        if (m.elevationLossM != null)
          metricRows.push({ activity_id: act.id, metric_key: 'elevation_loss_m', metric_value: m.elevationLossM })
        if (m.decouplingPct != null)
          metricRows.push({ activity_id: act.id, metric_key: 'decoupling_pct', metric_value: m.decouplingPct })
        if (m.gradeAdjustedPaceS != null)
          metricRows.push({ activity_id: act.id, metric_key: 'grade_adjusted_pace_s', metric_value: m.gradeAdjustedPaceS })
        if (metricRows.length)
          await supabase.from('activity_metrics').upsert(metricRows, { onConflict: 'activity_id,metric_key' })

        stored++
      } catch (err) {
        if ((err as { rateLimited?: boolean }).rateLimited) { rateLimited = true; break }
        errors++
      }
    }
    if (rateLimited) break
  }

  return { processed, stored, rateLimited, errors }
}
