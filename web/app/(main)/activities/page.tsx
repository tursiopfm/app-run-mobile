import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/database/get-user'
import { createClient } from '@/lib/database/supabase-server'
import { getServerAppMode } from '@/lib/preferences/server'
import ActivitiesClient from './ActivitiesClient'
import { MissionActivities } from '@/components/mission/MissionActivities'
import type { ActivityRow } from '@/components/ui/ActivityCard'

const INITIAL_LIMIT = 300

export default async function ActivitiesPage({
  searchParams,
}: { searchParams?: { full?: string } }) {
  const user = await getServerUser()
  if (!user) redirect('/login')
  const supabase = await createClient()

  const [{ data: rows }, { data: profile }, mode] = await Promise.all([
    supabase
      .from('activities')
      .select('id, name, sport_type, start_time, ces, avg_hr, max_hr, distance_m, elevation_gain_m, moving_time_sec, manual_sport_type, manual_intensity, manual_workout_type, manual_distance_m, manual_moving_time_sec, manual_elevation_gain_m')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('start_time', { ascending: false })
      .limit(INITIAL_LIMIT),
    supabase
      .from('profiles')
      .select('max_hr, resting_hr, aerobic_threshold_hr, threshold_hr, birth_year, hr_zone_method, hr_zones_custom')
      .eq('id', user.id)
      .single(),
    getServerAppMode(),
  ])

  const initial = (rows ?? []) as ActivityRow[]
  const hasMore = initial.length === INITIAL_LIMIT

  if (mode === 'mission' && searchParams?.full !== '1') {
    return <MissionActivities activities={initial} />
  }
  return <ActivitiesClient initial={initial} hasMore={hasMore} athleteProfile={profile} />
}
