import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/database/get-user'
import { getIsAdmin } from '@/lib/database/get-admin'
import { AdminTabs } from './components/AdminTabs'
import { TabDashboard } from './components/TabDashboard'
import { TabUsers } from './components/TabUsers'
import { TabDeployments } from './components/TabDeployments'
import { TabWebhooks } from './components/TabWebhooks'
import { TabSystem } from './components/TabSystem'
import { TabSync } from './components/TabSync'

const VALID_TABS = ['dashboard', 'users', 'deployments', 'webhooks', 'system', 'sync'] as const
type Tab = typeof VALID_TABS[number]

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const isAdmin = await getIsAdmin(user.id)
  if (!isAdmin) redirect('/dashboard')

  const { tab } = await searchParams
  const activeTab: Tab = VALID_TABS.includes(tab as Tab) ? (tab as Tab) : 'dashboard'

  return (
    <div className="flex flex-col">
      <div className="bg-trail-warning/10 border-b border-trail-warning/30 px-4 py-2">
        <p className="text-xs text-trail-warning font-medium">⚠ Zone admin — accès restreint</p>
      </div>

      <AdminTabs activeTab={activeTab} />

      <div className="px-4 py-4">
        {activeTab === 'dashboard'   && <TabDashboard />}
        {activeTab === 'users'       && <TabUsers />}
        {activeTab === 'deployments' && <TabDeployments />}
        {activeTab === 'webhooks'    && <TabWebhooks />}
        {activeTab === 'system'      && <TabSystem />}
        {activeTab === 'sync'        && <TabSync />}
      </div>
    </div>
  )
}
