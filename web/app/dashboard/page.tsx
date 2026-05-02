import { AppShell } from '@/components/navigation/AppShell'
import { KpiCard }  from '@/components/ui/KpiCard'
import { LoadChart } from '@/components/ui/LoadChart'
import { buildDailyMetrics } from '@/lib/analytics/fatigue'

// Deterministic mock data (server component — no Math.random)
const MOCK_LOADS = [
  { date: '2026-04-03', ces: 45 }, { date: '2026-04-04', ces: 0  },
  { date: '2026-04-05', ces: 72 }, { date: '2026-04-06', ces: 55 },
  { date: '2026-04-07', ces: 88 }, { date: '2026-04-08', ces: 0  },
  { date: '2026-04-09', ces: 30 }, { date: '2026-04-10', ces: 60 },
  { date: '2026-04-11', ces: 48 }, { date: '2026-04-12', ces: 95 },
  { date: '2026-04-13', ces: 0  }, { date: '2026-04-14', ces: 40 },
  { date: '2026-04-15', ces: 78 }, { date: '2026-04-16', ces: 62 },
  { date: '2026-04-17', ces: 0  }, { date: '2026-04-18', ces: 85 },
  { date: '2026-04-19', ces: 50 }, { date: '2026-04-20', ces: 110},
  { date: '2026-04-21', ces: 0  }, { date: '2026-04-22', ces: 35 },
  { date: '2026-04-23', ces: 68 }, { date: '2026-04-24', ces: 55 },
  { date: '2026-04-25', ces: 92 }, { date: '2026-04-26', ces: 0  },
  { date: '2026-04-27', ces: 45 }, { date: '2026-04-28', ces: 70 },
  { date: '2026-04-29', ces: 58 }, { date: '2026-04-30', ces: 80 },
  { date: '2026-05-01', ces: 0  }, { date: '2026-05-02', ces: 65 },
]

export default function DashboardPage() {
  const metrics = buildDailyMetrics(MOCK_LOADS)
  const latest  = metrics[metrics.length - 1] ?? { atl: 0, ctl: 0, tsb: 0, dailyLoad: 0 }
  const chartData = metrics.slice(-14).map((m) => ({
    date: m.date.slice(5),
    atl:  m.atl,
    ctl:  m.ctl,
  }))

  return (
    <AppShell title="Dashboard">
      <div className="px-4 py-4 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Fatigue (ATL)" value={Math.round(latest.atl)} sub="7j EWMA" />
          <KpiCard label="Fitness (CTL)"  value={Math.round(latest.ctl)} sub="42j EWMA" accent />
          <KpiCard label="Fraîcheur (TSB)" value={Math.round(latest.tsb)} sub={latest.tsb >= 0 ? 'Reposé ✓' : 'Fatigué'} />
          <KpiCard label="Charge du jour"  value={Math.round(latest.dailyLoad)} unit="CES" />
        </div>

        {/* Load chart */}
        <div className="bg-trail-card border border-trail-border rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-trail-text mb-3">Fatigue vs Fitness — 14 jours</h2>
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

        {/* Week placeholder */}
        <div className="bg-trail-card border border-trail-border rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-trail-text mb-2">Cette semaine</h2>
          <p className="text-trail-muted text-xs mb-3">Connecte Strava pour voir tes activités</p>
          <div className="grid grid-cols-7 gap-1">
            {['L','M','M','J','V','S','D'].map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="w-full h-10 rounded-lg bg-trail-border/40" />
                <span className="text-xs text-trail-muted">{d}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
