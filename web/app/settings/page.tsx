import { AppShell } from '@/components/navigation/AppShell'
import { StravaSection } from '@/components/settings/StravaSection'
import { AccountSection } from '@/components/settings/AccountSection'
import { AppearanceSection } from '@/components/settings/AppearanceSection'
import { ProfileSection, type ProfileData } from '@/components/settings/ProfileSection'
import { createClient } from '@/lib/database/supabase-server'
import { colors } from '@/lib/design/colors'
import { settings as settingsLabels } from '@/lib/design/labels'

// SettingsRow — mirror of SettingsRow composable (line 6183 of DashboardScreen.kt)
// Surface bg, 12dp radius, px-12 py-10, title SubtleText + value accented right
function SettingsRow({ title, value, accent }: { title: string; value: string; accent: string }) {
  return (
    <div
      className="flex items-center justify-between rounded-[12px] bg-trail-surface"
      style={{ padding: '10px 12px' }}
    >
      <span className="text-[14px] text-trail-muted">{title}</span>
      <span className="text-[14px] font-semibold" style={{ color: accent }}>{value}</span>
    </div>
  )
}

// SectionTitle — 15sp Bold text (mirrors SectionTitle composable)
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] font-bold text-trail-text">{children}</p>
}

// BulletLine — mirrors BulletLine composable (6dp ChargeOrange circle + text)
function BulletLine({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-[4px]">
      <div
        className="flex-shrink-0 rounded-full mt-[6px]"
        style={{ width: 6, height: 6, backgroundColor: colors.chargeOrange }}
      />
      <p className="text-[13px] text-trail-muted leading-[18px]">{text}</p>
    </div>
  )
}

// SectionCard — 12dp radius, CardBg, 10dp padding
function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px] space-y-2">
      {children}
    </div>
  )
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let stravaConnected = false
  let stravaAthleteName: string | null = null
  let profileData: ProfileData = {
    first_name: null, last_name: null,
    max_hr: null, threshold_hr: null, resting_hr: null,
    ftp_watts: null, weight_kg: null, year_goal_km: null,
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name,last_name,max_hr,threshold_hr,resting_hr,ftp_watts,weight_kg,year_goal_km')
      .eq('id', user.id)
      .single()
    if (profile) profileData = profile as ProfileData
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
    <AppShell>
      {/* Android: contentPadding=12dp, spacedBy=12dp */}
      <div className="px-3 py-3 space-y-3 max-w-lg mx-auto">

        {/* ── Compte / Strava ── */}
        <SectionCard>
          <SectionTitle>{settingsLabels.sectionAccount}</SectionTitle>
          <div className="h-[10px]" />
          <SettingsRow
            title="Strava"
            value={stravaConnected ? 'Connecté' : 'Non connecté'}
            accent={stravaConnected ? colors.greenOk : colors.chargeOrange}
          />
          <SettingsRow
            title="Athlète Strava"
            value={stravaAthleteName ?? '—'}
            accent={colors.seriesBlue}
          />
          <SettingsRow
            title="OAuth Strava"
            value={stravaConnected ? 'Prêt' : 'Non configuré'}
            accent={colors.seriesYellow}
          />
          <div className="h-[2px]" />
          {/* Strava action chips (client component) */}
          <StravaSection isConnected={stravaConnected} athleteName={stravaAthleteName} />
        </SectionCard>

        {/* ── Apparence — chips interactifs (ActionChip fidèle Android) ── */}
        <SectionCard>
          <SectionTitle>{settingsLabels.sectionAppearance}</SectionTitle>
          <div className="h-[10px]" />
          <AppearanceSection />
        </SectionCard>

        {/* ── Préférences Cockpit ── */}
        <SectionCard>
          <SectionTitle>Préférences Cockpit</SectionTitle>
          <div className="h-[10px]" />
          <SettingsRow
            title={settingsLabels.sectionStartup}
            value="Cockpit"
            accent={colors.chargeOrange}
          />
          <SettingsRow
            title="Source de données"
            value={stravaConnected ? 'Strava connecté' : 'Local'}
            accent={colors.seriesBlue}
          />
          <SettingsRow
            title="Granularité stats"
            value="Hebdomadaire"
            accent={colors.greenOk}
          />
        </SectionCard>

        {/* ── Profil athlète ── */}
        <SectionCard>
          <SectionTitle>Profil athlète</SectionTitle>
          <div className="h-[10px]" />
          <ProfileSection initial={profileData} />
        </SectionCard>

        {/* ── À venir ── */}
        <SectionCard>
          <SectionTitle>{settingsLabels.comingSoon}</SectionTitle>
          <div className="h-[10px]" />
          <BulletLine text="Notifications Strava" />
          <BulletLine text="Métriques favorites" />
          <BulletLine text="Thèmes personnalisés" />
          <BulletLine text="Gestion du compte" />
        </SectionCard>

        {/* Déconnexion */}
        <div className="pt-1">
          <AccountSection />
        </div>

      </div>
    </AppShell>
  )
}
