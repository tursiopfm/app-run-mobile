import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/database/get-user'
import { DashboardGrid } from '@/components/cockpit/DashboardGrid'
import { getDashboardData } from '@/lib/data/dashboard'
import { createClient } from '@/lib/database/supabase-server'
import type { ActivityRow } from '@/components/ui/ActivityCard'

const ACTIVITY_CARD_FIELDS =
  'id, name, sport_type, start_time, ces, avg_hr, max_hr, distance_m, elevation_gain_m, moving_time_sec, manual_sport_type, manual_intensity, manual_workout_type, manual_distance_m, manual_moving_time_sec, manual_elevation_gain_m'

function mondayOfCurrentWeek(): Date {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(now)
  mon.setDate(now.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return mon
}

export default async function DashboardPage() {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const monday = mondayOfCurrentWeek()
  const nextMonday = new Date(monday)
  nextMonday.setDate(nextMonday.getDate() + 7)

  const [
    { sportOverviews, weekSessions },
    { data: latestRow },
    { data: weekRows },
    { data: athleteProfile },
  ] = await Promise.all([
    getDashboardData(user.id),
    supabase
      .from('activities')
      .select(ACTIVITY_CARD_FIELDS)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('start_time', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('activities')
      .select(ACTIVITY_CARD_FIELDS)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .gte('start_time', monday.toISOString())
      .lt('start_time', nextMonday.toISOString())
      .order('start_time', { ascending: false }),
    supabase
      .from('profiles')
      .select('max_hr, resting_hr, aerobic_threshold_hr, threshold_hr, birth_year')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  const lastActivity = (latestRow ?? null) as ActivityRow | null
  const weekActivities = (weekRows ?? []) as ActivityRow[]

  return (
    <div className="px-2 py-2 max-w-lg mx-auto">
      <DashboardGrid
        sportOverviews={sportOverviews}
        weekSessions={weekSessions}
        lastActivity={lastActivity}
        weekActivities={weekActivities}
        athleteProfile={athleteProfile ?? null}
      />
    </div>
  )
}
