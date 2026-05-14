import { Plug2, Palette, Sparkles, LifeBuoy, User } from 'lucide-react'
import { StravaSection } from '@/components/settings/StravaSection'
import { AccountSection } from '@/components/settings/AccountSection'
import { AppearanceSection } from '@/components/settings/AppearanceSection'
import { HelpAboutSection } from '@/components/settings/HelpAboutSection'
import { IdentityPreview } from '@/components/settings/IdentityPreview'
import { HrCalibrationTeaser } from '@/components/settings/HrCalibrationTeaser'
import { createClient } from '@/lib/database/supabase-server'
import { getServerUser } from '@/lib/database/get-user'
import { settings as settingsLabels } from '@/lib/design/labels'
import type { HrZoneMethod } from '@/lib/health/hr-zones'

// ── Section header with icon + title + subtitle (mirrors a true settings UI rhythm)
function SectionHeader({
  icon: Icon, title, subtitle,
}: {
  icon: typeof Plug2; title: string; subtitle: string
}) {
  return (
    <div className="flex items-center gap-[10px] px-1 mb-[10px]">
      <div className="w-7 h-7 rounded-[8px] bg-trail-surface border border-trail-border flex items-center justify-center flex-shrink-0">
        <Icon size={14} className="text-trail-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-trail-text leading-tight">{title}</p>
        <p className="text-[11px] text-trail-muted leading-tight mt-[1px]">{subtitle}</p>
      </div>
    </div>
  )
}

// ── Card container — keeps existing trail-card styling
function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] bg-trail-card border border-trail-border p-[10px] space-y-[10px]">
      {children}
    </div>
  )
}

// ── Roadmap items grouped by theme — derived from project memory + TODO docs
const ROADMAP: { group: string; items: string[] }[] = [
  {
    group: 'Intelligence',
    items: [
      'Coach IA personnalisé (résumé hebdo, conseil du jour)',
      'Zones cardiaques configurables (manuel · déduit · mixte)',
    ],
  },
  {
    group: 'Personnalisation',
    items: [
      'Plan d’entraînement personnalisable manuellement',
      'Data cockpit entièrement personnalisables',
    ],
  },
  {
    group: 'Gestion de course',
    items: [
      'Définir son calendrier de course',
      'Tableau de plan de course (ravito, BH, temps de passage)',
    ],
  },
  {
    group: 'Indicateurs physiologiques',
    items: [
      'Amélioration des indicateurs d’effort et de fatigue',
    ],
  },
]

export default async function SettingsPage() {
  const user = await getServerUser()
  const supabase = await createClient()

  let stravaConnected = false
  let stravaAthleteName: string | null = null
  let firstName: string | null = null
  let lastName:  string | null = null
  let avatarUrl: string | null = null
  let hrMethod:    HrZoneMethod | null = null
  let maxHr:       number | null = null
  let thresholdHr: number | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name,last_name,avatar_url,max_hr,threshold_hr,hr_zone_method')
      .eq('id', user.id)
      .single()

    firstName   = profile?.first_name ?? null
    lastName    = profile?.last_name  ?? null
    hrMethod    = (profile?.hr_zone_method as HrZoneMethod | null) ?? null
    maxHr       = profile?.max_hr       ?? null
    thresholdHr = profile?.threshold_hr ?? null

    const { data: connection } = await supabase
      .from('provider_connections')
      .select('athlete_data')
      .eq('user_id', user.id)
      .eq('provider', 'strava')
      .maybeSingle()

    if (connection) {
      stravaConnected = true
      const athlete = connection.athlete_data as { firstname?: string; lastname?: string; profile?: string } | null
      if (athlete?.firstname) {
        stravaAthleteName = `${athlete.firstname} ${athlete.lastname ?? ''}`.trim()
        firstName ??= athlete.firstname ?? null
        lastName  ??= athlete.lastname  ?? null
      }
      if (athlete?.profile && athlete.profile !== 'avatar/athlete/large.png') {
        avatarUrl ??= athlete.profile
      }
    }

    avatarUrl ??= profile?.avatar_url ?? null
  }

  return (
    <div className="px-3 py-3 pb-10 space-y-4 max-w-lg mx-auto">

      {/* ── Page hero ── */}
      <div className="px-1 pt-[2px]">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-trail-primary">
          {settingsLabels.title}
        </p>
        <p className="text-[22px] font-black text-trail-text leading-tight mt-[2px]">
          Compte, connexions & préférences
        </p>
        <p className="text-[12px] text-trail-muted leading-[16px] mt-[6px] max-w-[360px]">
          Gère ton identité, tes intégrations sportives et l’apparence de ton cockpit.
        </p>
      </div>

      {/* ── Compte & sync ── */}
      <section>
        <SectionHeader
          icon={Plug2}
          title={settingsLabels.sectionAccount}
          subtitle="Identité Trail Cockpit et intégrations tierces"
        />
        <SectionCard>
          <AccountSection />
          <StravaSection isConnected={stravaConnected} athleteName={stravaAthleteName} />
        </SectionCard>
      </section>

      {/* ── Profil athlète ── */}
      <section>
        <SectionHeader
          icon={User}
          title={settingsLabels.sectionProfile}
          subtitle="Aperçu de ton profil sportif et accès à la calibration cardiaque"
        />
        <SectionCard>
          <IdentityPreview
            firstName={firstName}
            lastName={lastName}
            email={user?.email ?? null}
            avatarUrl={avatarUrl}
            accountCreatedAt={user?.created_at ?? null}
          />
          <HrCalibrationTeaser
            method={hrMethod}
            maxHr={maxHr}
            thresholdHr={thresholdHr}
          />
        </SectionCard>
      </section>

      {/* ── Apparence ── */}
      <section>
        <SectionHeader
          icon={Palette}
          title={settingsLabels.sectionAppearance}
          subtitle="Thème et langue de l’interface"
        />
        <SectionCard>
          <AppearanceSection />
        </SectionCard>
      </section>

      {/* ── Bientôt — feuille de route ── */}
      <section>
        <SectionHeader
          icon={Sparkles}
          title={settingsLabels.comingSoon}
          subtitle="Prochaines étapes du produit"
        />
        <SectionCard>
          <div className="space-y-[14px]">
            {ROADMAP.map(({ group, items }) => (
              <div key={group} className="space-y-[6px]">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-trail-muted px-1">
                  {group}
                </p>
                <div className="space-y-[6px]">
                  {items.map(text => (
                    <div
                      key={text}
                      className="flex items-start gap-[10px] px-3 py-[8px] rounded-[10px] bg-trail-surface"
                    >
                      <div className="flex-shrink-0 mt-[6px] w-[6px] h-[6px] rounded-full bg-trail-primary" />
                      <p className="text-[13px] text-trail-text leading-[18px]">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>

      {/* ── Aide & À propos ── */}
      <section>
        <SectionHeader
          icon={LifeBuoy}
          title="Aide & À propos"
          subtitle="Mentions, support et version de l’application"
        />
        <SectionCard>
          <HelpAboutSection />
        </SectionCard>
      </section>

      {/* ── Footer signature ── */}
      <p className="text-center text-[10px] text-trail-muted/70 tracking-wider uppercase pt-2">
        Trail Cockpit · Conçu pour les coureurs de trail
      </p>

    </div>
  )
}
