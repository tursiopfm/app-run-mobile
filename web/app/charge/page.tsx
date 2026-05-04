import { redirect } from 'next/navigation'
import { AppShell } from '@/components/navigation/AppShell'
import { CockpitChartCard } from '@/components/charts/CockpitChartCard'
import { CockpitAreaChart, type AreaPoint } from '@/components/charts/CockpitAreaChart'
import { CockpitLineChart } from '@/components/charts/CockpitLineChart'
import { CockpitBarChart, type BarPoint } from '@/components/charts/CockpitBarChart'
import { CockpitPieChart, type PieSlice } from '@/components/charts/CockpitPieChart'
import { createClient } from '@/lib/database/supabase-server'
import { getDashboardData } from '@/lib/data/dashboard'
import { colors } from '@/lib/design/colors'
import { charge as chargeLabels } from '@/lib/design/labels'

const INTENSITY_COLORS: Record<string, string> = {
  'Footing':       colors.pieFooting,
  'Sortie longue': colors.pieSortieLongue,
  'Seuil':         colors.pieSeuil,
  'VMA':           colors.pieVma,
  'Runtaf':        colors.pieRuntaf,
}

type StatusLevel = 'fresh' | 'balanced' | 'loaded' | 'overloaded' | 'rest'

function tsbStatus(tsb: number): StatusLevel {
  if (tsb >= 10)  return 'fresh'
  if (tsb >= 0)   return 'balanced'
  if (tsb >= -10) return 'loaded'
  return 'overloaded'
}

function freshnessColor(tsb: number): string {
  if (tsb >= 10)  return colors.seriesBlue
  if (tsb >= 0)   return colors.greenOk
  if (tsb >= -10) return colors.seriesYellow
  return colors.runRed
}

const STATUS_META: Record<StatusLevel, { label: string; color: string; text: string }> = {
  fresh:      { label: chargeLabels.fresh,      color: colors.seriesBlue,   text: chargeLabels.wellRested },
  balanced:   { label: chargeLabels.balanced,   color: colors.greenOk,      text: chargeLabels.balancedMsg },
  loaded:     { label: chargeLabels.loaded,     color: colors.seriesYellow, text: chargeLabels.risingFatigue },
  overloaded: { label: chargeLabels.overloaded, color: colors.runRed,       text: chargeLabels.overloadedMsg },
  rest:       { label: chargeLabels.veryLow,    color: colors.subtleText,   text: chargeLabels.insufficientData },
}

function toHex(color: string, opacity: number): string {
  return `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`
}

export default async function ChargePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { dailyMetrics, intensityBreakdown } = await getDashboardData(user.id)

  const latest  = dailyMetrics[dailyMetrics.length - 1] ?? { atl: 0, ctl: 0, tsb: 0, dailyLoad: 0, date: '' }
  const status  = tsbStatus(latest.tsb)
  const meta    = STATUS_META[status]

  // Every 2nd x label (xLabelEveryN=2 in Android → interval=1 in Recharts)
  const xInterval = 1

  // ── 1. Daily charge (ATL area chart) ──
  const dailyData: AreaPoint[] = dailyMetrics.map((m) => ({
    date:  m.date.slice(5),
    value: Math.round(m.atl),
  }))

  // ── 3. Fatigue vs Fitness (no dots) ──
  const fatigueFitnessData = dailyMetrics.map((m) => ({
    date: m.date.slice(5),
    atl:  Math.round(m.atl),
    ctl:  Math.round(m.ctl),
  }))

  // ── 4. Freshness (TSB per day, per-bar color, negative OK) ──
  const freshnessData: BarPoint[] = dailyMetrics.map((m) => ({
    label: m.date.slice(5),
    value: Math.round(m.tsb),
    color: freshnessColor(m.tsb),
  }))

  // ── 5. Intensity pie ──
  const pieData: PieSlice[] = intensityBreakdown.map((s) => ({
    label: s.label,
    value: s.km,
    color: INTENSITY_COLORS[s.label] ?? colors.pieAutre,
  }))

  return (
    <AppShell>
      {/* Android: contentPadding=12dp, spacedBy=12dp */}
      <div className="px-3 py-3 space-y-3 max-w-lg mx-auto">

        {/* ── 1. Charge hebdomadaire (AreaChart ATL) ── */}
        <CockpitChartCard title={chargeLabels.weeklyTitle} minHeight={200}>
          <CockpitAreaChart data={dailyData} color={colors.chargeOrange} height={200} xInterval={xInterval} />
        </CockpitChartCard>

        {/* ── 2. StatusCard (état de forme) ── */}
        <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-bold text-trail-text">{chargeLabels.formState}</p>
              <p className="text-[11px] text-trail-muted mt-1 leading-[16px] max-w-[240px]">{meta.text}</p>
            </div>
            {/* StatusPill */}
            <span
              className="inline-flex items-center rounded-full px-3 py-[6px] text-[11px] font-semibold leading-none ml-3 flex-shrink-0"
              style={{
                backgroundColor: toHex(meta.color, 0.15),
                color:           meta.color,
                border:          `1px solid ${toHex(meta.color, 0.5)}`,
              }}
            >
              {meta.label}
              {Math.abs(latest.tsb) < 100 && <span className="ml-1.5 font-medium">{Math.round(latest.tsb)}</span>}
            </span>
          </div>
          {/* TSB + ATL + CTL summary row */}
          <div className="flex gap-3 mt-3">
            {[
              { label: 'TSB', value: Math.round(latest.tsb), color: meta.color },
              { label: 'ATL', value: Math.round(latest.atl), color: colors.chargeOrange },
              { label: 'CTL', value: Math.round(latest.ctl), color: colors.seriesBlue },
            ].map((item) => (
              <div key={item.label} className="rounded-[10px] bg-trail-surface px-3 py-2 flex-1 text-center">
                <p className="text-[11px] text-trail-muted">{item.label}</p>
                <p className="text-[18px] font-black mt-0.5" style={{ color: item.color }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 3. Fatigue vs Fitness (LineChart, no dots) ── */}
        <CockpitChartCard title={chargeLabels.fatigueFitnessTitle} minHeight={220}>
          <CockpitLineChart
            data={fatigueFitnessData}
            series={[
              { key: 'atl', label: chargeLabels.recentFatigue,    color: colors.chargeOrange },
              { key: 'ctl', label: chargeLabels.trainingCapacity,  color: colors.seriesBlue },
            ]}
            height={220}
            xInterval={xInterval}
            showDots={false}
          />
          <div className="flex gap-4 mt-2">
            {[
              { label: chargeLabels.recentFatigue,   color: colors.chargeOrange },
              { label: chargeLabels.trainingCapacity, color: colors.seriesBlue },
            ].map((s) => (
              <span key={s.label} className="flex items-center gap-1.5 text-[12px] text-trail-muted">
                <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </CockpitChartCard>

        {/* ── 4. Fraîcheur (BarChart TSB, negative, per-bar colors) ── */}
        <CockpitChartCard title={chargeLabels.freshnessTitle} minHeight={200}>
          <CockpitBarChart data={freshnessData} height={200} xInterval={xInterval} />
        </CockpitChartCard>

        {/* ── 5. Répartition intensité ── */}
        <CockpitChartCard title={chargeLabels.intensityTitle} minHeight={220}>
          <CockpitPieChart data={pieData} height={220} />
        </CockpitChartCard>

      </div>
    </AppShell>
  )
}
