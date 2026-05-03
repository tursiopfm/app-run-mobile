import { redirect } from 'next/navigation'
import { AppShell } from '@/components/navigation/AppShell'
import { KpiCard } from '@/components/ui/KpiCard'
import { LoadChart } from '@/components/ui/LoadChart'
import { createClient } from '@/lib/database/supabase-server'
import { getDashboardData } from '@/lib/data/dashboard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { dailyMetrics, recentActivities, hasActivities } = await getDashboardData(user.id)

  const latest = dailyMetrics[dailyMetrics.length - 1] ?? {
    atl: 0, ctl: 0, tsb: 0, dailyLoad: 0,
  }
  const chartData = dailyMetrics.slice(-14).map((m) => ({
    date: m.date.slice(5),
    atl: m.atl,
    ctl: m.ctl,
  }))

  return (
    <AppShell title="Dashboard">
      <div className="px-4 py-4 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Fatigue (ATL)" value={Math.round(latest.atl)} sub="7j EWMA" />
          <KpiCard label="Fitness (CTL)" value={Math.round(latest.ctl)} sub="42j EWMA" accent />
          <KpiCard
            label="Fraîcheur (TSB)"
            value={Math.round(latest.tsb)}
            sub={latest.tsb >= 0 ? 'Reposé ✓' : 'Fatigué'}
          />
          <KpiCard label="Charge du jour" value={Math.round(latest.dailyLoad)} unit="CES" />
        </div>

        {/* Load chart */}
        <div className="bg-trail-card border border-trail-border rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-trail-text mb-3">
            Fatigue vs Fitness — 14 jours
          </h2>
          <LoadChart data={chartData} />
          <div className="flex gap-4 mt-3">
            <span className="flex items-center gap-1.5 text-xs text-trail-muted">
              <span className="w-3 h-0.5 bg-[#f97316] rounded-full inline-block" />Fatigue
            </span>
            <span className="flex items-center gap-1.5 text-xs text-trail-muted">
              <span className="w-3 h-0.5 bg-[#22d3ee] rounded-full inline-block" />Fitness
            </span>
          </div>
        </div>

        {/* Cette semaine */}
        <div className="bg-trail-card border border-trail-border rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-trail-text mb-2">Cette semaine</h2>
          {!hasActivities ? (
            <div className="py-4 text-center space-y-2">
              <p className="text-xs text-trail-muted">Aucune activité importée</p>
              <a href="/settings" className="inline-block text-xs text-trail-accent underline">
                Connecter Strava dans les réglages →
              </a>
            </div>
          ) : recentActivities.length === 0 ? (
            <p className="text-xs text-trail-muted py-2">Aucune activité cette semaine</p>
          ) : (
            <ul className="space-y-2">
              {recentActivities.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between py-1.5 border-b border-trail-border last:border-0"
                >
                  <div>
                    <p className="text-sm text-trail-text">{a.name}</p>
                    <p className="text-xs text-trail-muted">
                      {a.sport_type}
                      {a.distance_m ? ` · ${(a.distance_m / 1000).toFixed(1)} km` : ''}
                      {a.elevation_gain_m ? ` · +${Math.round(a.elevation_gain_m)}m` : ''}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-trail-accent">
                    {a.ces != null ? `${Math.round(a.ces)} CES` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  )
}
