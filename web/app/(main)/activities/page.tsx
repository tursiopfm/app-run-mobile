import { getServerUser } from '@/lib/database/get-user'
import { createClient } from '@/lib/database/supabase-server'
import ActivitiesClient from './ActivitiesClient'
import type { ActivityRow } from '@/components/ui/ActivityCard'

export default async function ActivitiesPage() {
  const user = await getServerUser()
  const supabase = await createClient()

  // PostgREST plafonne à 1000 lignes par requête : on pagine pour récupérer
  // l'historique complet (utilisateurs avec plusieurs milliers d'activités).
  const PAGE_SIZE = 1000
  const activities: ActivityRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: rows, error } = await supabase
      .from('activities')
      .select('id, name, sport_type, start_time, ces, avg_hr, distance_m, elevation_gain_m, moving_time_sec, manual_sport_type, manual_intensity, manual_distance_m, manual_moving_time_sec, manual_elevation_gain_m')
      .eq('user_id', user!.id)
      .is('deleted_at', null)
      .order('start_time', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (error || !rows || rows.length === 0) break
    activities.push(...(rows as ActivityRow[]))
    if (rows.length < PAGE_SIZE) break
  }

  return <ActivitiesClient activities={activities} />
}
