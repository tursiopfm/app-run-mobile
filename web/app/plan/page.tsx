import { redirect } from 'next/navigation'
import { AppShell } from '@/components/navigation/AppShell'
import { createClient } from '@/lib/database/supabase-server'
import PlanClient from './PlanClient'

export default async function PlanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <AppShell>
      <PlanClient />
    </AppShell>
  )
}
