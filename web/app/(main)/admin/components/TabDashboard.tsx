import { createServiceClient } from '@/lib/database/supabase-server'
import { Users, Plug, Activity, Webhook, AlertTriangle, Rocket } from 'lucide-react'

async function fetchDashboardStats() {
  const supabase = createServiceClient()

  const [
    { count: userCount },
    { count: stravaCount },
    { count: activityCount },
    { count: webhookCount },
    { count: errorCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('provider_connections').select('*', { count: 'exact', head: true }).eq('provider', 'strava'),
    supabase.from('activities').select('*', { count: 'exact', head: true }),
    supabase.from('webhook_logs').select('*', { count: 'exact', head: true }),
    supabase.from('webhook_logs').select('*', { count: 'exact', head: true })
      .gte('status_code', 500)
      .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
  ])

  return {
    userCount: userCount ?? 0,
    stravaCount: stravaCount ?? 0,
    activityCount: activityCount ?? 0,
    webhookCount: webhookCount ?? 0,
    errorCount: errorCount ?? 0,
  }
}

export async function TabDashboard() {
  const stats = await fetchDashboardStats()

  const STATS = [
    { icon: Users,         label: 'Utilisateurs',       value: String(stats.userCount),    color: 'text-trail-accent'   },
    { icon: Plug,          label: 'Connexions Strava',   value: String(stats.stravaCount),  color: 'text-trail-success'  },
    { icon: Activity,      label: 'Activités importées', value: String(stats.activityCount),color: 'text-trail-primary'  },
    { icon: Webhook,       label: 'Webhooks reçus',      value: String(stats.webhookCount), color: 'text-trail-warning'  },
    { icon: AlertTriangle, label: 'Erreurs (24h)',        value: String(stats.errorCount),   color: stats.errorCount > 0 ? 'text-trail-danger' : 'text-trail-success' },
    { icon: Rocket,        label: 'Déploiement',          value: 'Voir onglet →',            color: 'text-trail-muted'    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {STATS.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="bg-trail-card border border-trail-border rounded-2xl p-4">
          <Icon size={18} className={`${color} mb-2`} />
          <p className="text-2xl font-bold text-trail-text">{value}</p>
          <p className="text-xs text-trail-muted mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  )
}
