import { getServerUser } from '@/lib/database/get-user'
import { createClient } from '@/lib/database/supabase-server'
import ActivitiesClient from './ActivitiesClient'
import type { ActivityRow } from '@/components/ui/ActivityCard'

export default async function ActivitiesPage() {
  const user = await getServerUser()
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('activities')
    .select('id, name, sport_type, start_time, ces, distance_m, elevation_gain_m, moving_time_sec, manual_sport_type, manual_intensity, manual_distance_m, manual_moving_time_sec, manual_elevation_gain_m')
    .eq('user_id', user!.id)
    .is('deleted_at', null)
    .order('start_time', { ascending: false })
    .limit(200)

  const activities = (rows ?? []) as ActivityRow[]

  return <ActivitiesClient activities={activities} />
}
