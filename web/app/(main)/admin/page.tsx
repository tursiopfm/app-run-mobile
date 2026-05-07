import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/database/get-user'
import { Users, Plug, Activity, Webhook, RefreshCw, AlertTriangle, Brain } from 'lucide-react'

const STATS = [
  { icon: Users,         label: 'Utilisateurs',       value: '1',    color: 'text-trail-accent'   },
  { icon: Plug,          label: 'Connexions actives',  value: '1',    color: 'text-trail-success'  },
  { icon: Activity,      label: 'Activités importées', value: '234',  color: 'text-trail-primary'  },
  { icon: Webhook,       label: 'Webhooks reçus',      value: '47',   color: 'text-trail-warning'  },
  { icon: RefreshCw,     label: 'Jobs en attente',     value: '3',    color: 'text-trail-accent'   },
  { icon: AlertTriangle, label: 'Erreurs (24h)',        value: '0',    color: 'text-trail-danger'   },
  { icon: Brain,         label: 'Tokens IA (mois)',    value: '~12k', color: 'text-trail-muted'    },
]

const RECENT_WEBHOOKS = [
  { provider: 'strava', event: 'activity.create', at: '2026-05-02 09:14' },
  { provider: 'strava', event: 'activity.update', at: '2026-05-01 18:32' },
  { provider: 'strava', event: 'activity.create', at: '2026-05-01 07:55' },
]

export default async function AdminPage() {
  // Local development bypass only. Do not enable in production.
  if (process.env.NODE_ENV !== 'development') {
    const user = await getServerUser()
    if (!user) redirect('/settings')
  }

  return (
    <div className="px-4 py-4 space-y-4">
        <div className="bg-trail-warning/10 border border-trail-warning/30 rounded-2xl px-4 py-3">
          <p className="text-xs text-trail-warning font-medium">⚠ Zone admin — accès restreint</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {STATS.map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-trail-card border border-trail-border rounded-2xl p-4">
              <Icon size={18} className={`${color} mb-2`} />
              <p className="text-2xl font-bold text-trail-text">{value}</p>
              <p className="text-xs text-trail-muted mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="bg-trail-card border border-trail-border rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-trail-text mb-3">Derniers webhooks reçus</h2>
          {RECENT_WEBHOOKS.map((w, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-trail-border last:border-0">
              <div>
                <p className="text-xs font-medium text-trail-text">{w.event}</p>
                <p className="text-xs text-trail-muted">{w.provider}</p>
              </div>
              <span className="text-xs text-trail-muted">{w.at}</span>
            </div>
          ))}
        </div>
    </div>
  )
}
