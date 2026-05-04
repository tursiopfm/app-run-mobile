import { redirect } from 'next/navigation'
import { AppShell } from '@/components/navigation/AppShell'
import { CockpitChartCard } from '@/components/charts/CockpitChartCard'
import { CockpitLineChart } from '@/components/charts/CockpitLineChart'
import { CockpitComboChart } from '@/components/charts/CockpitComboChart'
import { CockpitCumulChart } from '@/components/charts/CockpitCumulChart'
import { CockpitPieChart, type PieSlice } from '@/components/charts/CockpitPieChart'
import { GoalsBlock } from '@/components/cockpit/GoalsBlock'
import { ActivitiesBlock } from '@/components/cockpit/ActivitiesBlock'
import { ChargeBlock } from '@/components/cockpit/ChargeBlock'
import { HistoryBlock } from '@/components/cockpit/HistoryBlock'
import { WeekBlock } from '@/components/cockpit/WeekBlock'
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

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const {
    sportOverviews,
    weekSessions,
    intensityBreakdown,
    weeklyPoints,
    cumulMonths,
  } = await getDashboardData(user.id)

  // Intensity pie
  const pieData: PieSlice[] = intensityBreakdown.map((s) => ({
    label: s.label,
    value: s.km,
    color: INTENSITY_COLORS[s.label] ?? colors.pieAutre,
  }))

  // Run/D+ 10 weeks combo data
  const comboData = weeklyPoints.map((w) => ({ label: w.weekLabel, dPlus: w.dPlus, km: w.km }))

  // Ratio D+/km line data
  const ratioData = weeklyPoints.map((w) => ({
    date:  w.weekLabel,
    ratio: w.km > 0 ? Math.round((w.dPlus / w.km) * 10) / 10 : 0,
  }))

  return (
    <AppShell>
      <div className="px-2 py-2 space-y-2 max-w-lg mx-auto">

        {/* ── 1. Activités (swipeable multi-sport) ── */}
        <ActivitiesBlock sportOverviews={sportOverviews} />

        {/* ── 2. Objectifs (configurable) ── */}
        <GoalsBlock
          weekKm={sportOverviews.run.weekKm}
          weekDPlus={sportOverviews.run.weekDPlus}
          yearKm={sportOverviews.run.ytdKm}
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

        {/* ── 5. Charge d'entraînement (swipeable multi-sport) ── */}
        <ChargeBlock sportOverviews={sportOverviews} />

        {/* ── 6. Historique (swipeable multi-sport) ── */}
        <HistoryBlock
          sportOverviews={sportOverviews}
          weeklyPoints={weeklyPoints.map((w) => ({ label: w.weekLabel, km: w.km, dPlus: w.dPlus }))}
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
        <WeekBlock sportOverviews={sportOverviews} allSessions={weekSessions} />

      </div>
    </AppShell>
  )
}
