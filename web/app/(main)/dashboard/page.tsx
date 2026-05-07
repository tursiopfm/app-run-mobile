import { getServerUser } from '@/lib/database/get-user'
import { DashboardGrid } from '@/components/cockpit/DashboardGrid'
import { getDashboardData } from '@/lib/data/dashboard'

export default async function DashboardPage() {
  const user = await getServerUser()
  const { sportOverviews, weekSessions } = await getDashboardData(user!.id)

  return (
    <div className="px-2 py-2 max-w-lg mx-auto">
      <DashboardGrid sportOverviews={sportOverviews} weekSessions={weekSessions} />
    </div>
  )
}
