import Link from 'next/link'
import { createServiceClient } from '@/lib/database/supabase-server'
import { fetchVercelDeployments } from '@/lib/admin/vercel'
import { formatDateTime } from '@/lib/admin/format'
import { envSummary } from '@/lib/admin/system-env'
import { Users, Plug, Activity, Webhook, Rocket, Settings } from 'lucide-react'

const DAY_MS = 86400000

async function fetchDashboardStats() {
  const supabase = createServiceClient()
  const since24h = new Date(Date.now() - DAY_MS).toISOString()
  const since7d = new Date(Date.now() - 7 * DAY_MS).toISOString()

  const [
    { count: userCount },
    { data: { users: usersList } },
    { count: stravaCount },
    { count: activityCount },
    { count: activity24hCount },
    { data: lastActivity },
    { count: webhookCount },
    { data: lastWebhook },
    { count: errorCount },
    deployments,
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.auth.admin.listUsers({ perPage: 200 }),
    supabase.from('provider_connections').select('*', { count: 'exact', head: true }).eq('provider', 'strava'),
    supabase.from('activities').select('*', { count: 'exact', head: true }),
    supabase.from('activities').select('*', { count: 'exact', head: true }).gte('created_at', since24h),
    supabase.from('activities').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('webhook_logs').select('*', { count: 'exact', head: true }),
    supabase.from('webhook_logs').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('webhook_logs').select('*', { count: 'exact', head: true })
      .gte('status_code', 500).gte('created_at', since24h),
    fetchVercelDeployments(),
  ])

  const newUsers7d = (usersList ?? []).filter(u => u.created_at >= since7d).length
  const active24h = (usersList ?? []).filter(u => u.last_sign_in_at && u.last_sign_in_at >= since24h).length

  return {
    userCount: userCount ?? 0,
    newUsers7d,
    active24h,
    stravaCount: stravaCount ?? 0,
    activityCount: activityCount ?? 0,
    activity24h: activity24hCount ?? 0,
    lastSyncAt: lastActivity?.created_at ?? null,
    webhookCount: webhookCount ?? 0,
    lastWebhookAt: lastWebhook?.created_at ?? null,
    errorCount: errorCount ?? 0,
    lastDeploy: deployments[0] ?? null,
    env: envSummary(),
  }
}

const STATE_LABEL: Record<string, { color: string; label: string }> = {
  READY:    { color: 'text-trail-success', label: 'Ready'    },
  ERROR:    { color: 'text-trail-danger',  label: 'Error'    },
  BUILDING: { color: 'text-trail-warning', label: 'Building' },
  CANCELED: { color: 'text-trail-muted',   label: 'Canceled' },
}

function Card({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="bg-trail-card border border-trail-border rounded-2xl p-4 block transition-colors hover:border-trail-primary/60 active:bg-trail-card/70"
    >
      {children}
    </Link>
  )
}

export async function TabDashboard() {
  const s = await fetchDashboardStats()
  const deployState = s.lastDeploy ? (STATE_LABEL[s.lastDeploy.state] ?? STATE_LABEL.CANCELED) : null
  const envOk = s.env.missing === 0

  return (
    <div className="grid grid-cols-2 gap-3">
      <Card href="/admin?tab=users">
        <Users size={18} className="text-trail-accent mb-2" />
        <p className="text-2xl font-bold text-trail-text">{s.userCount}</p>
        <p className="text-xs text-trail-muted mt-0.5">Utilisateurs</p>
        <p className="text-[11px] text-trail-muted mt-1">
          +{s.newUsers7d} <span className="opacity-70">7j</span> · {s.active24h} <span className="opacity-70">actifs 24h</span>
        </p>
      </Card>

      <Card href="/admin?tab=users">
        <Plug size={18} className="text-trail-success mb-2" />
        <p className="text-2xl font-bold text-trail-text">{s.stravaCount}</p>
        <p className="text-xs text-trail-muted mt-0.5">Connexions Strava</p>
      </Card>

      <Card href="/admin?tab=sync">
        <Activity size={18} className="text-trail-primary mb-2" />
        <p className="text-2xl font-bold text-trail-text">{s.activityCount}</p>
        <p className="text-xs text-trail-muted mt-0.5">Activités importées</p>
        <p className="text-[11px] text-trail-muted mt-1">
          +{s.activity24h} <span className="opacity-70">24h</span> · sync {formatDateTime(s.lastSyncAt)}
        </p>
      </Card>

      <Card href="/admin?tab=webhooks">
        <Webhook size={18} className="text-trail-warning mb-2" />
        <p className="text-2xl font-bold text-trail-text">{s.webhookCount}</p>
        <p className="text-xs text-trail-muted mt-0.5">Webhooks reçus</p>
        <p className="text-[11px] text-trail-muted mt-1">
          dernier {formatDateTime(s.lastWebhookAt)}
        </p>
        <p className={`text-[11px] mt-0.5 ${s.errorCount > 0 ? 'text-trail-danger' : 'text-trail-muted'}`}>
          {s.errorCount} <span className="opacity-70">erreur{s.errorCount > 1 ? 's' : ''} 24h</span>
        </p>
      </Card>

      <Card href="/admin?tab=deployments">
        <Rocket size={18} className="text-trail-muted mb-2" />
        {s.lastDeploy && deployState ? (
          <>
            <p className={`text-sm font-bold ${deployState.color}`}>{deployState.label}</p>
            <p className="text-xs text-trail-muted mt-0.5">{s.lastDeploy.environment}</p>
            <p className="text-[11px] text-trail-muted mt-1 font-mono truncate">
              {s.lastDeploy.commitHash || '—'}
            </p>
            <p className="text-[11px] text-trail-muted mt-0.5">
              {formatDateTime(new Date(s.lastDeploy.createdAt).toISOString())}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-trail-muted">—</p>
            <p className="text-xs text-trail-muted mt-0.5">Déploiement</p>
          </>
        )}
      </Card>

      <Card href="/admin?tab=system">
        <Settings size={18} className={envOk ? 'text-trail-success mb-2' : 'text-trail-warning mb-2'} />
        <p className={`text-2xl font-bold ${envOk ? 'text-trail-text' : 'text-trail-warning'}`}>
          {s.env.present}/{s.env.total}
        </p>
        <p className="text-xs text-trail-muted mt-0.5">Système — env vars</p>
        <p className="text-[11px] text-trail-muted mt-1">
          {process.env.NODE_ENV ?? '—'} {envOk ? '· tout OK' : `· ${s.env.missing} manquant${s.env.missing > 1 ? 's' : ''}`}
        </p>
      </Card>
    </div>
  )
}
