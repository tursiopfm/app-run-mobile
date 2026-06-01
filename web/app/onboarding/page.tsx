import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/database/get-user'
import { createClient } from '@/lib/database/supabase-server'
import { OnboardingStrava } from '@/components/onboarding/OnboardingStrava'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: { strava?: string }
}) {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const [{ data: connection }, { data: profile }] = await Promise.all([
    supabase
      .from('provider_connections')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('provider', 'strava')
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('onboarding_skipped')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  if (connection || profile?.onboarding_skipped) redirect('/dashboard')

  return <OnboardingStrava status={searchParams?.strava} />
}
