import { redirect } from 'next/navigation'
import { AppShell } from '@/components/navigation/AppShell'
import { DashboardGrid } from '@/components/cockpit/DashboardGrid'
import { createClient } from '@/lib/database/supabase-server'
import { getDashboardData } from '@/lib/data/dashboard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { sportOverviews, weekSessions } = await getDashboardData(user.id)

  return (
    <AppShell>
      <div className="px-2 py-2 max-w-lg mx-auto">
        <DashboardGrid sportOverviews={sportOverviews} weekSessions={weekSessions} />
      </div>
    </AppShell>
  )
}
