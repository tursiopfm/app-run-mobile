// web/app/onboarding/page.tsx
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/database/get-user'
import { createClient } from '@/lib/database/supabase-server'
import { MissionSetupFlow } from '@/components/onboarding/mission-setup/MissionSetupFlow'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: { strava?: string }
}) {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed_at, onboarding_discipline, onboarding_mission, onboarding_mode, onboarding_data_source')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.onboarding_completed_at) redirect('/dashboard')

  return (
    <MissionSetupFlow
      stravaStatus={searchParams?.strava}
      initialAnswers={{
        discipline: profile?.onboarding_discipline ?? null,
        mission: profile?.onboarding_mission ?? null,
        mode: profile?.onboarding_mode ?? null,
        dataSource: profile?.onboarding_data_source ?? null,
      }}
    />
  )
}
