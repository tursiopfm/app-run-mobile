'use client'

import { useRouter } from 'next/navigation'

const TABS = [
  { id: 'dashboard',    label: '📊 Dashboard'    },
  { id: 'users',        label: '👥 Users'         },
  { id: 'deployments',  label: '🚀 Déploiements'  },
  { id: 'webhooks',     label: '🔗 Webhooks'      },
  { id: 'system',       label: '⚙️ Système'       },
  { id: 'sync',         label: '🔄 Sync'          },
]

export function AdminTabs({ activeTab }: { activeTab: string }) {
  const router = useRouter()

  return (
    <div className="flex gap-0 border-b border-trail-border overflow-x-auto">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => router.push(`/admin?tab=${id}`)}
          className={`px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === id
              ? 'text-trail-primary border-trail-primary'
              : 'text-trail-muted border-transparent hover:text-trail-text'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
