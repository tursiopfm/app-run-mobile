import { redirect } from 'next/navigation'
import { AppShell } from '@/components/navigation/AppShell'
import { CockpitChartCard } from '@/components/charts/CockpitChartCard'
import { CockpitLineChart } from '@/components/charts/CockpitLineChart'
import { CockpitBarChart, type BarPoint } from '@/components/charts/CockpitBarChart'
import { CockpitPieChart, type PieSlice } from '@/components/charts/CockpitPieChart'
import { CockpitKpiTile } from '@/components/ui/CockpitKpiTile'
import { TsbBadge } from '@/components/ui/TsbBadge'
import { GoalProgressRow } from '@/components/ui/GoalProgressRow'
import { WeekTable } from '@/components/ui/WeekTable'
import { createClient } from '@/lib/database/supabase-server'
import { getDashboardData } from '@/lib/data/dashboard'
import { colors } from '@/lib/design/colors'
import { cockpit, sportLabel, units, charge as chargeLabels } from '@/lib/design/labels'

// Placeholder goal targets — read from settings table once available
const GOAL_WEEK_KM    = 50
const GOAL_WEEK_DPLUS = 2000
const GOAL_YEAR_KM    = 1000

const MONTH_ABBR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

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

// Android: normalized from min-max of TSB values (not 0-based)
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

  const dashData = await getDashboardData(user.id)

  const {
    dailyMetrics,
    recentActivities,
    hasActivities,
    weekOverview,
    monthlyRunKm,
    weekSessions,
    ytd,
    intensityBreakdown,
  } = dashData

  const latest = dailyMetrics[dailyMetrics.length - 1] ?? { atl: 0, ctl: 0, tsb: 0, dailyLoad: 0, date: '' }

  // --- KPI tile bar data (bar labels = data values, not day letters) ---
  const weekKmNorm   = normalize(weekOverview.dailyRunKm)
  const weekKmLabels = weekOverview.dailyRunKm.map((v) => v > 0 ? `${Math.round(v * 10) / 10}` : '')

  const weekDPlusNorm   = normalize(weekOverview.dailyRunDPlus)
  const weekDPlusLabels = weekOverview.dailyRunDPlus.map((v) => v > 0 ? `${Math.round(v)}` : '')

  const monthlyNorm   = normalize(monthlyRunKm)
  const monthlyLabels = monthlyRunKm.map((v) => v > 0 ? `${Math.round(v)}` : '')

  // TSB tile — last 7 daily TSB, min-max normalized, labels = int TSB
  const tsbLast7 = dailyMetrics.slice(-7).map((m) => m.tsb)
  const tsbNorm   = normalizeTsb(tsbLast7)
  const tsbLabels = tsbLast7.map((v) => `${Math.round(v)}`)

  // --- Load chart (60 days) ---
  const loadChartData = dailyMetrics.map((m) => ({
    date: m.date.slice(5),
    atl:  Math.round(m.atl),
    ctl:  Math.round(m.ctl),
  }))

  // --- Monthly km bar chart ---
  const monthlyBarData: BarPoint[] = monthlyRunKm.map((km, i) => ({
    label: MONTH_ABBR[i],
    value: Math.round(km * 10) / 10,
  }))

  // --- Intensity pie ---
  const pieData: PieSlice[] = intensityBreakdown.map((s) => ({
    label: s.label,
    value: s.km,
    color: INTENSITY_COLORS[s.label] ?? colors.pieAutre,
  }))

  return (
    <AppShell>
      {/* Android: contentPadding=8dp, spacedBy=8dp */}
      <div className="px-2 py-2 space-y-2 max-w-lg mx-auto">

        {/* ── 1. KPIs block ── */}
        <SectionCard>
          {/* Header: "Activités — Course 🏃" + TsbBadge */}
          <div className="flex items-center justify-between mb-[6px]">
            <div className="flex items-center gap-1">
              <span className="text-[16px] font-semibold text-trail-muted">Activités —</span>
              <span className="text-[16px] font-semibold" style={{ color: colors.chargeOrange }}>Course</span>
              <span className="text-[16px] ml-0.5">🏃</span>
            </div>
            <TsbBadge tsb={latest.tsb} />
          </div>

          {/* Row 1: SEMAINE km + D+ */}
          <div className="grid grid-cols-2 gap-[6px]">
            <CockpitKpiTile
              title="SEMAINE"
              subline={`${weekOverview.runSessions} séance${weekOverview.runSessions !== 1 ? 's' : ''}`}
              barValues={weekKmNorm}
              barLabels={weekKmLabels}
              barColor={colors.chargeOrange}
            >
              <div className="flex items-baseline gap-[3px]">
                <span className="text-[21px] font-black leading-tight text-trail-text">
                  {weekOverview.runKm}
                </span>
                <span className="text-[14px] text-trail-muted">{units.km}</span>
              </div>
            </CockpitKpiTile>

            <CockpitKpiTile
              title="D+ SEMAINE"
              subline={cockpit.kpiWeekDPlus}
              barValues={weekDPlusNorm}
              barLabels={weekDPlusLabels}
              barColor={colors.seriesBlue}
            >
              <div className="flex items-baseline gap-[3px]">
                <span className="text-[21px] font-black leading-tight text-trail-text">
                  {weekOverview.runDPlus}
                </span>
                <span className="text-[14px] text-trail-muted">{units.m}</span>
              </div>
            </CockpitKpiTile>
          </div>

          {/* 6px gap between rows */}
          <div className="h-[6px]" />

          {/* Row 2: ANNÉE + CHARGE */}
          <div className="grid grid-cols-2 gap-[6px]">
            <CockpitKpiTile
              title="ANNÉE"
              subline={`D+ ${ytd.runDPlus.toLocaleString('fr-FR')} m`}
              barValues={monthlyNorm}
              barLabels={monthlyLabels}
              barColor={colors.chargeOrange}
            >
              {/* Android: 18sp (not 21sp) for YTD tile */}
              <div className="flex items-baseline gap-[3px]">
                <span className="text-[18px] font-black leading-tight text-trail-text">
                  {ytd.runKm}
                </span>
                <span className="text-[14px] text-trail-muted">{units.km}</span>
              </div>
            </CockpitKpiTile>

            {/* CHARGE tile: ATL • CTL inline, SeriesYellow bars */}
            <CockpitKpiTile
              icon="⚡"
              title="CHARGE (RUN)"
              subline={`TSB ${Math.round(latest.tsb)} • 7 derniers jours`}
              barValues={tsbNorm}
              barLabels={tsbLabels}
              barColor={colors.seriesYellow}
            >
              <div className="flex items-center flex-wrap gap-[2px]">
                <span className="text-[13px] font-bold" style={{ color: colors.chargeOrange }}>ATL </span>
                <span className="text-[21px] font-black leading-tight" style={{ color: colors.chargeOrange }}>
                  {Math.round(latest.atl)}
                </span>
                <span className="text-[13px] text-trail-muted mx-0.5">•</span>
                <span className="text-[13px] font-bold" style={{ color: colors.seriesBlue }}>CTL </span>
                <span className="text-[21px] font-black leading-tight" style={{ color: colors.seriesBlue }}>
                  {Math.round(latest.ctl)}
                </span>
              </div>
            </CockpitKpiTile>
          </div>
        </SectionCard>

        {/* ── 2. Objectifs ── */}
        <SectionCard title={cockpit.sectionGoals}>
          <div className="space-y-[10px]">
            <GoalProgressRow
              label="Distance hebdo"
              current={weekOverview.runKm}
              target={GOAL_WEEK_KM}
              unit={units.km}
              color={colors.progressRunFg}
            />
            <GoalProgressRow
              label={cockpit.kpiWeekDPlus}
              current={weekOverview.runDPlus}
              target={GOAL_WEEK_DPLUS}
              unit={units.m}
              color={colors.progressDPlusFg}
            />
            <GoalProgressRow
              label="Distance annuelle"
              current={ytd.runKm}
              target={GOAL_YEAR_KM}
              unit={units.km}
              color={colors.progressVolumeFg}
            />
          </div>
        </SectionCard>

        {/* ── 3. Charge — Fatigue vs Fitness ── */}
        <CockpitChartCard title={chargeLabels.fatigueFitnessTitle}>
          <CockpitLineChart
            data={loadChartData}
            series={[
              { key: 'atl', label: chargeLabels.fatigue7d,  color: colors.chargeOrange },
              { key: 'ctl', label: chargeLabels.fitness28d, color: colors.seriesBlue },
            ]}
          />
          <div className="flex gap-4 mt-2">
            {[
              { label: chargeLabels.fatigue7d,  color: colors.chargeOrange },
              { label: chargeLabels.fitness28d, color: colors.seriesBlue },
            ].map((s) => (
              <span key={s.label} className="flex items-center gap-1.5 text-[12px] text-trail-muted">
                <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </CockpitChartCard>

        {/* ── 4. Semaine en cours — tableau ── */}
        <SectionCard title={cockpit.sectionCurrentWeek}>
          <WeekTable sessions={weekSessions} />
        </SectionCard>

        {/* ── 5. Km mensuels ── */}
        <CockpitChartCard title={cockpit.cumulMonthsTitle}>
          <CockpitBarChart data={monthlyBarData} xInterval={0} />
        </CockpitChartCard>

        {/* ── 6. Répartition intensité ── */}
        <CockpitChartCard title={chargeLabels.intensityTitle}>
          <CockpitPieChart data={pieData} />
        </CockpitChartCard>

        {/* ── 7. Activités récentes ── */}
        <SectionCard title="Activités récentes">
          {!hasActivities ? (
            <div className="py-3 text-center space-y-2">
              <p className="text-[12px] text-trail-muted">Aucune activité importée</p>
              <a href="/settings" className="text-[12px] text-trail-accent underline">
                Connecter Strava dans les réglages →
              </a>
            </div>
          ) : recentActivities.length === 0 ? (
            <p className="text-[12px] text-trail-muted py-2">Aucune activité cette semaine</p>
          ) : (
            <ul>
              {recentActivities.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between py-[7px] border-b border-trail-border last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-trail-text truncate">{a.name}</p>
                    <p className="text-[11px] text-trail-muted">
                      {sportLabel[a.sport_type] ?? a.sport_type}
                      {a.distance_m ? ` · ${(a.distance_m / 1000).toFixed(1)} km` : ''}
                      {a.elevation_gain_m ? ` · +${Math.round(a.elevation_gain_m)} m` : ''}
                    </p>
                  </div>
                  <span className="text-[12px] font-semibold ml-2 flex-shrink-0" style={{ color: colors.chargeOrange }}>
                    {a.ces != null ? `${Math.round(a.ces)} CES` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

      </div>
    </AppShell>
  )
}
