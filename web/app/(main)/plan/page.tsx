import PlanClient from './PlanClient'
import { MissionPlan } from '@/components/mission/MissionPlan'
import { getServerAppMode } from '@/lib/preferences/server'
import { getServerUser } from '@/lib/database/get-user'
import { createClient } from '@/lib/database/supabase-server'

export default async function PlanPage({
  searchParams,
}: { searchParams?: { full?: string } }) {
  const mode = await getServerAppMode()
  if (mode === 'mission' && searchParams?.full !== '1') return <MissionPlan />
  // onboarding_mission pilote la curation de la bibliothèque de séances
  // (BibliothequeSeancesBlock), dans TOUS les modes qui rendent PlanClient.
  const user = await getServerUser()
  let mission: string | null = null
  if (user) {
    const supabase = await createClient()
    const { data } = await supabase.from('profiles').select('onboarding_mission').eq('id', user.id).maybeSingle()
    mission = data?.onboarding_mission ?? null
  }
  return <PlanClient mode="expert" mission={mission} />
}
