import { AppShell } from '@/components/navigation/AppShell'
import { ChevronRight, Circle } from 'lucide-react'
import { AccountSection } from '@/components/settings/AccountSection'
import { StravaSection } from '@/components/settings/StravaSection'
import { createClient } from '@/lib/database/supabase-server'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let stravaConnected = false
  let stravaAthleteName: string | null = null

  if (user) {
    const { data: connection } = await supabase
      .from('provider_connections')
      .select('athlete_data')
      .eq('user_id', user.id)
      .eq('provider', 'strava')
      .single()

    if (connection) {
      stravaConnected = true
      const athlete = connection.athlete_data as { firstname?: string; lastname?: string } | null
      if (athlete?.firstname) {
        stravaAthleteName = `${athlete.firstname} ${athlete.lastname ?? ''}`.trim()
      }
    }
  }

  return (
    <AppShell title="Réglages">
      <div className="px-4 py-4 space-y-4">
        {/* Connexions */}
        <section>
          <p className="text-xs font-semibold text-trail-muted uppercase tracking-wide mb-2 px-1">
            Connexions
          </p>
          <div className="bg-trail-card border border-trail-border rounded-2xl divide-y divide-trail-border">
            <StravaSection isConnected={stravaConnected} athleteName={stravaAthleteName} />
            {['Garmin', 'Polar', 'Suunto', 'Coros'].map((p) => (
              <div key={p} className="flex items-center gap-3 p-4 opacity-50">
                <Circle size={18} className="text-trail-muted" />
                <p className="text-sm text-trail-text flex-1">{p}</p>
                <span className="text-xs text-trail-muted">Bientôt</span>
              </div>
            ))}
          </div>
        </section>

        {/* Profil athlète */}
        <section>
          <p className="text-xs font-semibold text-trail-muted uppercase tracking-wide mb-2 px-1">
            Profil athlète
          </p>
          <div className="bg-trail-card border border-trail-border rounded-2xl divide-y divide-trail-border">
            {[
              ['FC max',          '185 bpm'],
              ['FC seuil',        '165 bpm'],
              ['Allure seuil',    '5:00/km'],
              ['FTP vélo',        '220 W'  ],
              ['Objectif annuel', '3 000 km'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between p-4">
                <p className="text-sm text-trail-text">{label}</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-trail-muted">{value}</span>
                  <ChevronRight size={14} className="text-trail-muted" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <AccountSection />
      </div>
    </AppShell>
  )
}
