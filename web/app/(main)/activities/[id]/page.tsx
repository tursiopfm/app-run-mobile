import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/database/supabase-server'
import { getValidStravaToken } from '@/lib/providers/strava/token'
import { fetchStravaActivity } from '@/lib/providers/strava/api'
import { ActivityDetailClient, type ActivityDetail } from './ActivityDetailClient'
import type { StravaSplit, StravaLap } from '@/lib/activities/detail'

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch activity from DB
  const { data: row } = await supabase
    .from('activities')
    .select('id, sport_type, manual_sport_type, name, start_time, ces, manual_intensity, distance_m, manual_distance_m, elevation_gain_m, manual_elevation_gain_m, moving_time_sec, manual_moving_time_sec, duration_sec, avg_hr, max_hr, calories, raw_payload, provider, provider_activity_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single()

  if (!row) notFound()

  const activity = row as ActivityDetail & { provider: string; provider_activity_id: string | null }

  // Fetch splits and laps if needed
  let splits: StravaSplit[] | null = null
  let laps: StravaLap[] | null = null

  const rawPayload = activity.raw_payload as Record<string, unknown> | null
  const existingSplits = rawPayload?.splits_metric
  const existingLaps = rawPayload?.laps

  if (Array.isArray(existingSplits)) splits = existingSplits as StravaSplit[]
  if (Array.isArray(existingLaps)) laps = existingLaps as StravaLap[]

  if ((!splits || !laps) && activity.provider === 'strava' && activity.provider_activity_id) {
    try {
      const token = await getValidStravaToken(user.id)
      const detail = await fetchStravaActivity(token, Number(activity.provider_activity_id))
      const stravaDetail = detail as unknown as {
        splits_metric?: unknown[]
        laps?: unknown[]
        calories?: number
      }

      if (activity.calories == null && stravaDetail.calories != null) {
        await supabase
          .from('activities')
          .update({ calories: stravaDetail.calories })
          .eq('id', id)
          .eq('user_id', user.id)
        activity.calories = stravaDetail.calories
      }

      const payloadPatch: Record<string, unknown> = {}

      if (!splits && Array.isArray(stravaDetail.splits_metric)) {
        splits = stravaDetail.splits_metric as unknown as StravaSplit[]
        payloadPatch.splits_metric = stravaDetail.splits_metric
      }

      if (!laps && Array.isArray(stravaDetail.laps)) {
        laps = stravaDetail.laps as unknown as StravaLap[]
        payloadPatch.laps = stravaDetail.laps
      }

      if (Object.keys(payloadPatch).length > 0) {
        await supabase
          .from('activities')
          .update({
            raw_payload: { ...(rawPayload as object ?? {}), ...payloadPatch },
          })
          .eq('id', id)
          .eq('user_id', user.id)
      }
    } catch {
      // Token expired or rate limited — show page without splits/laps
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('max_hr, resting_hr, aerobic_threshold_hr, threshold_hr, birth_year')
    .eq('id', user.id)
    .single()

  return <ActivityDetailClient activity={activity} splits={splits} laps={laps} athleteProfile={profile} />
}
