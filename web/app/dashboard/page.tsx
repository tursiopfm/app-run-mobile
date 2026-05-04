import { redirect } from 'next/navigation'
import { AppShell } from '@/components/navigation/AppShell'
import { CockpitChartCard } from '@/components/charts/CockpitChartCard'
import { CockpitLineChart } from '@/components/charts/CockpitLineChart'
import { CockpitComboChart } from '@/components/charts/CockpitComboChart'
import { CockpitCumulChart } from '@/components/charts/CockpitCumulChart'
import { CockpitPieChart, type PieSlice } from '@/components/charts/CockpitPieChart'
import { CockpitKpiTile } from '@/components/ui/CockpitKpiTile'
import { TsbBadge } from '@/components/ui/TsbBadge'
import { CompactMetricCard } from '@/components/ui/CompactMetricCard'
import { WeekTable } from '@/components/ui/WeekTable'
import { GoalsBlock } from '@/components/cockpit/GoalsBlock'
import { HistoryPillsBlock } from '@/components/cockpit/HistoryPillsBlock'
import { createClient } from '@/lib/database/supabase-server'
import { getDashboardData } from '@/lib/data/dashboard'
import { colors } from '@/lib/design/colors'

const INTENSITY_COLORS: Record<string, string> = {
  'Footing':       colors.pieFooting,
  'Sortie longue': colors.pieSortieLongue,
  'Seuil':         colors.pieSeuil,
  'VMA':           colors.pieVma,
  'Runtaf':        colors.pieRuntaf,
}

function normalize(arr: number[]): number[] {
  const max = Math.max(...arr, 0.001)
  return arr.map((v) => v / max)
}

function normalizeTsb(arr: number[]): number[] {
  const min = Math.min(...arr)
  const max = Math.max(...arr)
  const range = (max - min) || 0.001
  return arr.map((v) => (v - min) / range)
}

function SectionCard({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      {title && (
        <p className="text-[13px] font-semibold text-trail-text mb-[6px] leading-tight">{title}</p>
      )}
      {children}
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const {
    dailyMetrics,
    weekOverview,
    monthlyRunKm,
    weekSessions,
    ytd,
    intensityBreakdown,
    weeklyPoints,
    weekSuffer,
    cumulMonths,
  } = await getDashboardData(user.id)

  const latest = dailyMetrics[dailyMetrics.length - 1] ?? { atl: 0, ctl: 0, tsb: 0, dailyLoad: 0, date: '' }

  // KPI tile bar data
  const weekKmNorm    = normalize(weekOverview.dailyRunKm)
  const weekKmLabels  = weekOverview.dailyRunKm.map((v) => v > 0 ? `${Math.round(v * 10) / 10}` : '')
  const weekDPlusNorm   = normalize(weekOverview.dailyRunDPlus)
  const weekDPlusLabels = weekOverview.dailyRunDPlus.map((v) => v > 0 ? `${Math.round(v)}` : '')
  const monthlyNorm   = normalize(monthlyRunKm)
  const monthlyLabels = monthlyRunKm.map((v) => v > 0 ? `${Math.round(v)}` : '')
  const tsbLast7  = dailyMetrics.slice(-7).map((m) => m.tsb)
  const tsbNorm   = normalizeTsb(tsbLast7)
  const tsbLabels = tsbLast7.map((v) => `${Math.round(v)}`)

  // Run/D+ 10 weeks combo data
  const comboData = weeklyPoints.map((w) => ({ label: w.weekLabel, dPlus: w.dPlus, km: w.km }))

  // Ratio D+/km line data
  const ratioData = weeklyPoints.map((w) => ({
    date:  w.weekLabel,
    ratio: w.km > 0 ? Math.round((w.dPlus / w.km) * 10) / 10 : 0,
  }))

  // HistoryPills — map weeklyPoints to WeekPill shape
  const weekPills = weeklyPoints.map((w) => ({ label: w.weekLabel, km: w.km, dPlus: w.dPlus }))

  // Intensity pie
  const pieData: PieSlice[] = intensityBreakdown.map((s) => ({
    label: s.label,
    value: s.km,
    color: INTENSITY_COLORS[s.label] ?? colors.pieAutre,
  }))

  const tsbColor = latest.tsb >= 0 ? colors.greenOk : colors.runRed

  return (
    <AppShell>
      <div className="px-2 py-2 space-y-2 max-w-lg mx-auto">

        {/* ── 1. Activités ── */}
        <SectionCard>
          <div className="flex items-center justify-between mb-[6px]">
            <div className="flex items-center gap-1">
              <span className="text-[16px] font-semibold text-trail-muted">Activités —</span>
              <span className="text-[16px] font-semibold" style={{ color: colors.chargeOrange }}>Course</span>
              <span className="text-[16px] ml-0.5">🏃</span>
            </div>
            <TsbBadge tsb={latest.tsb} />
          </div>

          <div className="grid grid-cols-2 gap-[6px]">
            <CockpitKpiTile
              title="SEMAINE"
              subline={`${weekOverview.runSessions} séance${weekOverview.runSessions !== 1 ? 's' : ''}`}
              barValues={weekKmNorm} barLabels={weekKmLabels} barColor={colors.chargeOrange}
            >
              <div className="flex items-baseline gap-[3px]">
                <span className="text-[21px] font-black leading-tight text-trail-text">{weekOverview.runKm}</span>
                <span className="text-[14px] text-trail-muted">km</span>
              </div>
            </CockpitKpiTile>

            <CockpitKpiTile
              title="D+ SEMAINE"
              subline="Dénivelé positif"
              barValues={weekDPlusNorm} barLabels={weekDPlusLabels} barColor={colors.seriesBlue}
            >
              <div className="flex items-baseline gap-[3px]">
                <span className="text-[21px] font-black leading-tight text-trail-text">{weekOverview.runDPlus}</span>
                <span className="text-[14px] text-trail-muted">m</span>
              </div>
            </CockpitKpiTile>
          </div>

          <div className="h-[6px]" />

          <div className="grid grid-cols-2 gap-[6px]">
            <CockpitKpiTile
              title="ANNÉE"
              subline={`D+ ${ytd.runDPlus.toLocaleString('fr-FR')} m`}
              barValues={monthlyNorm} barLabels={monthlyLabels} barColor={colors.chargeOrange}
            >
              <div className="flex items-baseline gap-[3px]">
                <span className="text-[18px] font-black leading-tight text-trail-text">{ytd.runKm}</span>
                <span className="text-[14px] text-trail-muted">km</span>
              </div>
            </CockpitKpiTile>

            <CockpitKpiTile
              icon="⚡"
              title="CHARGE (RUN)"
              subline={`TSB ${Math.round(latest.tsb)} • 7 derniers jours`}
              barValues={tsbNorm} barLabels={tsbLabels} barColor={colors.seriesYellow}
            >
              <div className="flex items-center flex-wrap gap-[2px]">
                <span className="text-[13px] font-bold" style={{ color: colors.chargeOrange }}>ATL </span>
                <span className="text-[21px] font-black leading-tight" style={{ color: colors.chargeOrange }}>{Math.round(latest.atl)}</span>
                <span className="text-[13px] text-trail-muted mx-0.5">•</span>
                <span className="text-[13px] font-bold" style={{ color: colors.seriesBlue }}>CTL </span>
                <span className="text-[21px] font-black leading-tight" style={{ color: colors.seriesBlue }}>{Math.round(latest.ctl)}</span>
              </div>
            </CockpitKpiTile>
          </div>
        </SectionCard>

        {/* ── 2. Objectifs (configurable) ── */}
        <GoalsBlock
          weekKm={weekOverview.runKm}
          weekDPlus={weekOverview.runDPlus}
          yearKm={ytd.runKm}
        />

        {/* ── 3. Run / D+ — 10 semaines ── */}
        <CockpitChartCard
          minHeight={220}
          titleSlot={
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[16px] font-bold" style={{ color: colors.chargeOrange }}>RUN km</span>
              <span className="text-[16px] font-semibold text-trail-muted"> / </span>
              <span className="text-[16px] font-bold" style={{ color: colors.seriesBlue }}>D+</span>
              <span className="text-[16px] font-semibold text-trail-muted"> — 10 semaines</span>
            </div>
          }
        >
          <CockpitComboChart data={comboData} />
        </CockpitChartCard>

        {/* ── 4. Ratio D+/km — 10 semaines ── */}
        <CockpitChartCard title="Ratio RUN D+/km — 10 semaines" minHeight={220}>
          <CockpitLineChart
            data={ratioData}
            series={[{ key: 'ratio', label: 'D+/km', color: colors.seriesGreen }]}
            xInterval={0}
            height={220}
          />
        </CockpitChartCard>

        {/* ── 5. Charge d'entraînement ── */}
        <SectionCard title="Charge d'entraînement">
          <div className="grid grid-cols-2 gap-2 mt-1">
            <CompactMetricCard unit="ATL"    value={latest.atl}  description="Fatigue 7j"  color={colors.chargeOrange}  />
            <CompactMetricCard unit="CTL"    value={latest.ctl}  description="Fitness 28j" color={colors.seriesBlue}    />
            <CompactMetricCard unit="TSB"    value={latest.tsb}  description="Forme"        color={tsbColor}             />
            <CompactMetricCard unit="Suffer" value={weekSuffer}  description="Charge sem." color={colors.seriesYellow}  />
          </div>
        </SectionCard>

        {/* ── 6. Historique Running ── */}
        <HistoryPillsBlock
          daySessions={weekSessions.map((s) => ({ label: s.day, volumeKm: s.volumeKm, dPlus: s.dPlus }))}
          weeklyPoints={weekPills}
          monthlyRunKm={monthlyRunKm}
        />

        {/* ── 7. Cumul km par mois ── */}
        <CockpitChartCard
          minHeight={220}
          titleSlot={
            <div className="flex items-center justify-between mb-1">
              <span className="text-[16px] font-bold" style={{ color: colors.chargeOrange }}>
                Cumul km par mois — Course
              </span>
            </div>
          }
        >
          <CockpitCumulChart months={cumulMonths} height={220} />
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {cumulMonths.map((m) => (
              <span key={m.label} className="flex items-center gap-1 text-[11px] text-trail-muted">
                <span className="inline-block w-3 h-[3px] rounded-full" style={{ backgroundColor: m.color }} />
                {m.label}
              </span>
            ))}
          </div>
        </CockpitChartCard>

        {/* ── 8. Répartition intensité 30j ── */}
        <CockpitChartCard title="Répartition intensité — 30j glissants">
          <CockpitPieChart data={pieData} />
        </CockpitChartCard>

        {/* ── 9. Semaine en cours ── */}
        <SectionCard title="Semaine en cours">
          <WeekTable sessions={weekSessions} />
        </SectionCard>

      </div>
    </AppShell>
  )
}
