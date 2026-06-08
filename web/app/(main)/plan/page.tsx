import PlanClient from './PlanClient'
import { getServerAppMode } from '@/lib/preferences/server'
import { getServerUser } from '@/lib/database/get-user'
import { createClient } from '@/lib/database/supabase-server'

export default async function PlanPage() {
  const mode = await getServerAppMode()
  const user = await getServerUser()
  let mission: string | null = null
  if (user) {
    const supabase = await createClient()
    const { data } = await supabase.from('profiles').select('onboarding_mission').eq('id', user.id).maybeSingle()
    mission = data?.onboarding_mission ?? null
  }
  return <PlanClient mode={mode} mission={mission} />
}
