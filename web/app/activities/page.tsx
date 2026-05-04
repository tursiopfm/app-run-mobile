import { redirect } from 'next/navigation'
import { AppShell } from '@/components/navigation/AppShell'
import { ActivityCard } from '@/components/ui/ActivityCard'
import { createClient } from '@/lib/database/supabase-server'
import { colors } from '@/lib/design/colors'

export default async function ActivitiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rows } = await supabase
    .from('activities')
    .select('id, name, sport_type, start_time, ces, distance_m, elevation_gain_m, moving_time_sec')
    .eq('user_id', user.id)
    .order('start_time', { ascending: false })
    .limit(100)

  const activities = (rows ?? []) as {
    id: string
    sport_type: string
    name: string
    start_time: string
    ces: number | null
    distance_m: number | null
    elevation_gain_m: number | null
    moving_time_sec: number | null
  }[]

  return (
    <AppShell>
      {/* Android: contentPadding=12dp, spacedBy=10dp */}
      <div className="px-3 py-3 max-w-lg mx-auto">

        {/* SearchFilterBar — mirror of SearchFilterBar composable (line 3494) */}
        <div
          className="rounded-[12px] bg-trail-card border border-trail-border flex items-center mb-[10px]"
          style={{ padding: '4px 6px' }}
        >
          {/* Search side */}
          <div className="flex-1 flex items-center gap-2 px-[10px] py-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke={colors.subtleText} strokeWidth="2" />
              <path d="M16.5 16.5L21 21" stroke={colors.subtleText} strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="text-[14px] text-trail-muted">Rechercher</span>
          </div>
          {/* Divider */}
          <div className="w-px bg-trail-border" style={{ height: 28 }} />
          {/* Filter icon */}
          <div className="px-[14px] py-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M7 12h10M10 18h4" stroke={colors.chargeOrange} strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Activity list */}
        {activities.length === 0 ? (
          <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
            <p className="text-[14px] text-trail-muted">
              Connecte Strava dans Réglages pour importer tes activités.
            </p>
          </div>
        ) : (
          <div className="space-y-[10px]">
            {activities.map((a) => (
              <ActivityCard key={a.id} activity={a} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
