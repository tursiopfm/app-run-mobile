import PlanClient from './PlanClient'
import { MissionPlan } from '@/components/mission/MissionPlan'
import { getServerAppMode } from '@/lib/preferences/server'
import { getServerUser } from '@/lib/database/get-user'
import { createClient } from '@/lib/database/supabase-server'
import { getChargePageData } from '@/lib/data/charge'
import { calculateHrZones, getRecommendedHeartRateZoneMode, type HrZone, type HrZoneMethod, type CustomZoneInput } from '@/lib/health/hr-zones'
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
    let hrZones: HrZone[] = []
    if (user) {
      const supabase = await createClient()
      const since = new Date()
      since.setDate(since.getDate() - 28)
      // Activités (28 j), charge (fraîcheur) et profil FC (zones cibles) en parallèle.
      const [{ data: rows }, charge, { data: profile }] = await Promise.all([
        supabase
          .from('activities')
          .select(ACTIVITY_CARD_FIELDS)
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .gte('start_time', since.toISOString())
          .order('start_time', { ascending: false }),
        getChargePageData(user.id).catch(() => null),
        supabase
          .from('profiles')
          .select('max_hr, resting_hr, aerobic_threshold_hr, threshold_hr, birth_year, hr_zone_method, hr_zones_custom')
          .eq('id', user.id)
          .maybeSingle(),
      ])
      recentActivities = (rows ?? []) as ActivityRow[]
      // Fraîcheur basée sur la course ; repli sur le global si pas d'historique running.
      if (charge) {
        freshnessPayload = charge.perSport.run.historyDays > 0 ? charge.perSport.run : charge.perSport.all
      }
      // Zones FC pour personnaliser la cible des séances (méthode choisie, sinon recommandée).
      if (profile) {
        const method = (profile.hr_zone_method as HrZoneMethod | null) ?? getRecommendedHeartRateZoneMode(profile).mode
        hrZones = calculateHrZones({
          method,
          maxHr: profile.max_hr, restingHr: profile.resting_hr,
          aerobicThresholdHr: profile.aerobic_threshold_hr, thresholdHr: profile.threshold_hr,
          birthYear: profile.birth_year,
          customZones: (profile.hr_zones_custom as CustomZoneInput[] | null) ?? null,
        }).zones
      }
    }
    return <MissionPlan freshnessPayload={freshnessPayload} recentActivities={recentActivities} hrZones={hrZones} />
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
