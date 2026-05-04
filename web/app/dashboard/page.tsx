import { redirect } from 'next/navigation'
import { AppShell } from '@/components/navigation/AppShell'
import { GoalsBlock } from '@/components/cockpit/GoalsBlock'
import { ActivitiesBlock } from '@/components/cockpit/ActivitiesBlock'
import { ChargeBlock } from '@/components/cockpit/ChargeBlock'
import { WeeklyStatsBlock } from '@/components/cockpit/WeeklyStatsBlock'
import { HistoryBlock } from '@/components/cockpit/HistoryBlock'
import { CumulBlock } from '@/components/cockpit/CumulBlock'
import { IntensityBlock } from '@/components/cockpit/IntensityBlock'
import { WeekBlock } from '@/components/cockpit/WeekBlock'
import { createClient } from '@/lib/database/supabase-server'
import { getDashboardData } from '@/lib/data/dashboard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { sportOverviews, weekSessions } = await getDashboardData(user.id)

  return (
    <AppShell>
      <div className="px-2 py-2 space-y-2 max-w-lg mx-auto">

        {/* ── 1. Activités (swipeable multi-sport) ── */}
        <ActivitiesBlock sportOverviews={sportOverviews} />

        {/* ── 2. Objectifs (swipeable multi-sport) ── */}
        <GoalsBlock sportOverviews={sportOverviews} />

        {/* ── 3+4. Volume & Ratio — 10 semaines (swipeable multi-sport) ── */}
        <WeeklyStatsBlock sportOverviews={sportOverviews} />

        {/* ── 5. Charge d'entraînement (swipeable multi-sport) ── */}
        <ChargeBlock sportOverviews={sportOverviews} />

        {/* ── 6. Historique (swipeable multi-sport) ── */}
        <HistoryBlock
          sportOverviews={sportOverviews}
          weeklyPoints={sportOverviews.all.weeklyPoints.map((w) => ({ label: w.weekLabel, km: w.km, dPlus: w.dPlus }))}
        />

        {/* ── 7. Cumul km par mois (swipeable multi-sport) ── */}
        <CumulBlock sportOverviews={sportOverviews} />

        {/* ── 8. Répartition intensité 30j (swipeable multi-sport) ── */}
        <IntensityBlock sportOverviews={sportOverviews} />

        {/* ── 9. Semaine en cours ── */}
        <WeekBlock sportOverviews={sportOverviews} allSessions={weekSessions} />

      </div>
    </AppShell>
  )
}
