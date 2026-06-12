import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/database/get-user'
import { DashboardGrid } from '@/components/cockpit/DashboardGrid'
import { FirstActivityBanner } from '@/components/cockpit/FirstActivityBanner'
import { MorningReportAutoOpen } from '@/components/morning-report/MorningReportAutoOpen'
import { MissionCockpit } from '@/components/mission/MissionCockpit'
import { getDashboardData } from '@/lib/data/dashboard'
import { getChargePageData } from '@/lib/data/charge'
import { getServerAppMode } from '@/lib/preferences/server'
import { createClient } from '@/lib/database/supabase-server'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { SPORT_TYPE_MAP, type SportKey } from '@/lib/design/sports'

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

async function fetchLatestPerSport(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<Record<SportKey, ActivityRow | null>> {
  const keys: SportKey[] = ['run', 'ride', 'swim', 'all']
  const results = await Promise.all(keys.map(async (k) => {
    const types = SPORT_TYPE_MAP[k]
    let q = supabase
      .from('activities')
      .select(ACTIVITY_CARD_FIELDS)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('start_time', { ascending: false })
      .limit(1)
    if (types) q = q.in('sport_type', types as unknown as string[])
    const { data } = await q.maybeSingle()
    return [k, (data ?? null) as ActivityRow | null] as const
  }))
  return Object.fromEntries(results) as Record<SportKey, ActivityRow | null>
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
    latestPerSport,
    { data: weekRows },
    { data: athleteProfile },
    { count: activityCount },
  ] = await Promise.all([
    getDashboardData(user.id),
    fetchLatestPerSport(supabase, user.id),
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
      .select('max_hr, resting_hr, aerobic_threshold_hr, threshold_hr, birth_year, onboarding_completed_at, hr_zone_method, hr_zones_custom, onboarding_discipline, onboarding_mission')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('activities')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('deleted_at', null),
  ])

  if (!athleteProfile?.onboarding_completed_at) {
    redirect('/onboarding')
  }

  const weekActivities = (weekRows ?? []) as ActivityRow[]

  // Mode Mission : on importe le bloc Fraîcheur sur le Cockpit. La donnée de
  // charge (~1 an d'activités) n'est récupérée QUE dans ce mode → l'Expert
  // garde exactement son coût/comportement actuel.
  const mode = await getServerAppMode()
  let freshnessPayload: ChargeSportPayload | null = null
  if (mode === 'mission') {
    try {
      const charge = await getChargePageData(user.id)
      // Fraîcheur basée sur la course ; repli sur le global si aucune activité
      // running (ex. profil vélo/natation uniquement).
      freshnessPayload = charge.perSport.run.historyDays > 0
        ? charge.perSport.run
        : charge.perSport.all
    } catch { freshnessPayload = null }
  }

  return (
    <div className="px-2 py-2 max-w-lg mx-auto md:max-w-none md:px-6">
      <MorningReportAutoOpen createdAt={user.created_at} />
      {activityCount === 0 && <FirstActivityBanner />}
      {mode === 'mission' ? (
        <div className="max-w-lg mx-auto">
          <MissionCockpit
            sportOverviews={sportOverviews}
            freshnessPayload={freshnessPayload}
            discipline={athleteProfile?.onboarding_discipline ?? null}
          />
        </div>
      ) : (
        <DashboardGrid
          sportOverviews={sportOverviews}
          weekSessions={weekSessions}
          latestPerSport={latestPerSport}
          weekActivities={weekActivities}
          athleteProfile={athleteProfile ?? null}
          discipline={athleteProfile?.onboarding_discipline ?? null}
        />
      )}
    </div>
  )
}
