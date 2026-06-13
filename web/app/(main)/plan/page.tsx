import PlanClient from './PlanClient'
import { MissionPlan } from '@/components/mission/MissionPlan'
import { getServerAppMode } from '@/lib/preferences/server'
import { getServerUser } from '@/lib/database/get-user'
import { createClient } from '@/lib/database/supabase-server'
import { getChargePageData } from '@/lib/data/charge'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'

const ACTIVITY_CARD_FIELDS =
  'id, name, sport_type, start_time, ces, avg_hr, max_hr, distance_m, elevation_gain_m, moving_time_sec, manual_sport_type, manual_intensity, manual_workout_type, manual_distance_m, manual_moving_time_sec, manual_elevation_gain_m'

export default async function PlanPage({
  searchParams,
}: { searchParams?: { full?: string; new?: string } }) {
  const mode = await getServerAppMode()

  // Mode Mission (vue par défaut) : héros + semaine + suggestions.
  if (mode === 'mission' && searchParams?.full !== '1') {
    const user = await getServerUser()
    let freshnessPayload: ChargeSportPayload | null = null
    let recentActivities: ActivityRow[] = []
    if (user) {
      const supabase = await createClient()
      const since = new Date()
      since.setDate(since.getDate() - 28)
      // Activités (28 j, pour le réalisé + le rythme) et charge (fraîcheur) en parallèle.
      const [{ data: rows }, charge] = await Promise.all([
        supabase
          .from('activities')
          .select(ACTIVITY_CARD_FIELDS)
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .gte('start_time', since.toISOString())
          .order('start_time', { ascending: false }),
        getChargePageData(user.id).catch(() => null),
      ])
      recentActivities = (rows ?? []) as ActivityRow[]
      // Fraîcheur basée sur la course ; repli sur le global si pas d'historique running.
      if (charge) {
        freshnessPayload = charge.perSport.run.historyDays > 0 ? charge.perSport.run : charge.perSport.all
      }
    }
    return <MissionPlan freshnessPayload={freshnessPayload} recentActivities={recentActivities} />
  }

  // Plan expert (inchangé). onboarding_mission pilote la curation de la
  // bibliothèque de séances (BibliothequeSeancesBlock).
  const user = await getServerUser()
  let mission: string | null = null
  if (user) {
    const supabase = await createClient()
    const { data } = await supabase.from('profiles').select('onboarding_mission').eq('id', user.id).maybeSingle()
    mission = data?.onboarding_mission ?? null
  }
  return <PlanClient mode="expert" mission={mission} />
}
