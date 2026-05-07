import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/database/supabase-server'
import { getValidStravaToken } from '@/lib/providers/strava/token'
import { fetchStravaActivity } from '@/lib/providers/strava/api'
import { ActivityDetailClient, type ActivityDetail } from './ActivityDetailClient'
import type { StravaSplit } from '@/lib/activities/detail'

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

  // Fetch splits if needed
  let splits: StravaSplit[] | null = null

  const existingSplits = (activity.raw_payload as Record<string, unknown> | null)?.splits_metric
  if (Array.isArray(existingSplits)) {
    splits = existingSplits as StravaSplit[]
  } else if (activity.provider === 'strava' && activity.provider_activity_id) {
    try {
      const token = await getValidStravaToken(user.id)
      const detail = await fetchStravaActivity(token, Number(activity.provider_activity_id))
      const stravaDetail = detail as unknown as { splits_metric?: unknown[]; calories?: number }

      if (activity.calories == null && stravaDetail.calories != null) {
        await supabase
          .from('activities')
          .update({ calories: stravaDetail.calories })
          .eq('id', id)
          .eq('user_id', user.id)
        activity.calories = stravaDetail.calories
      }

      if (Array.isArray(stravaDetail.splits_metric)) {
        splits = stravaDetail.splits_metric as unknown as StravaSplit[]
        // Cache splits in raw_payload for future requests
        await supabase
          .from('activities')
          .update({
            raw_payload: {
              ...(activity.raw_payload as object ?? {}),
              splits_metric: stravaDetail.splits_metric,
            },
          })
          .eq('id', id)
          .eq('user_id', user.id)
      }
    } catch {
      // Token expired or rate limited — show page without splits
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('max_hr, resting_hr, aerobic_threshold_hr, threshold_hr, birth_year')
    .eq('id', user.id)
    .single()

  return <ActivityDetailClient activity={activity} splits={splits} athleteProfile={profile} />
}
