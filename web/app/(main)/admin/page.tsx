import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getServerUser } from '@/lib/database/get-user'
import { getIsAdmin } from '@/lib/database/get-admin'
import { TabDashboard } from './components/TabDashboard'
import { TabUsers } from './components/TabUsers'
import { TabDeployments } from './components/TabDeployments'
import { TabWebhooks } from './components/TabWebhooks'
import { TabSystem } from './components/TabSystem'
import { TabSync } from './components/TabSync'
import { TabWhatsNew } from './components/TabWhatsNew'

const VALID_TABS = ['dashboard', 'users', 'deployments', 'webhooks', 'system', 'sync', 'whats-new'] as const
type Tab = typeof VALID_TABS[number]

const TAB_TITLES: Record<Exclude<Tab, 'dashboard'>, string> = {
  users: 'Users',
  deployments: 'Déploiements',
  webhooks: 'Webhooks',
  system: 'Système',
  sync: 'Sync',
  'whats-new': 'Quoi de neuf',
}

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

      <div className="px-4 py-4">
        {activeTab !== 'dashboard' && (
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/admin"
              className="flex items-center gap-1 text-xs font-semibold text-trail-muted hover:text-trail-primary transition-colors"
            >
              <ChevronLeft size={14} />
              Admin
            </Link>
            <p className="text-xs font-bold uppercase tracking-widest text-trail-text">
              {TAB_TITLES[activeTab]}
            </p>
          </div>
        )}

        {activeTab === 'dashboard'   && <TabDashboard />}
        {activeTab === 'users'       && <TabUsers />}
        {activeTab === 'deployments' && <TabDeployments />}
        {activeTab === 'webhooks'    && <TabWebhooks />}
        {activeTab === 'system'      && <TabSystem />}
        {activeTab === 'sync'        && <TabSync />}
        {activeTab === 'whats-new'   && <TabWhatsNew />}
      </div>
    </div>
  )
}
