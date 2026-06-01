import { Plug2, Palette, Sparkles, LifeBuoy, User, Route } from 'lucide-react'
import { StravaSection } from '@/components/settings/StravaSection'
import { CommuteRoutesTeaser } from '@/components/settings/CommuteRoutesTeaser'
import { AccountSection } from '@/components/settings/AccountSection'
import { AppearanceSection } from '@/components/settings/AppearanceSection'
import { HelpAboutSection } from '@/components/settings/HelpAboutSection'
import { IdentityPreview } from '@/components/settings/IdentityPreview'
import { HrCalibrationTeaser } from '@/components/settings/HrCalibrationTeaser'
import { createClient } from '@/lib/database/supabase-server'
import { getServerUser } from '@/lib/database/get-user'
import { getServerT } from '@/lib/i18n/server'
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
function buildRoadmap(L: ReturnType<typeof getServerT>['settings']) {
  return [
    {
      group: L.roadmap.intelligence,
      items: [L.roadmapItems.coachAi],
    },
    {
      group: L.roadmap.personalization,
      items: [L.roadmapItems.dataCockpit],
    },
    {
      group: L.roadmap.raceManagement,
      items: [L.roadmapItems.raceTable],
    },
  ]
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { strava?: string }
}) {
  const settingsLabels = getServerT().settings
  const stravaNotice =
    searchParams?.strava === 'already_linked' || searchParams?.strava === 'error'
      ? searchParams.strava
      : undefined
  const ROADMAP = buildRoadmap(settingsLabels)
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
  let commuteCount = 0
  let commuteActiveCount = 0
  let commuteLabels: string[] = []
  let planAutoPushTitle = true

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name,last_name,avatar_url,max_hr,threshold_hr,hr_zone_method,plan_auto_push_title')
      .eq('id', user.id)
      .single()

    firstName   = profile?.first_name ?? null
    lastName    = profile?.last_name  ?? null
    hrMethod    = (profile?.hr_zone_method as HrZoneMethod | null) ?? null
    maxHr       = profile?.max_hr       ?? null
    thresholdHr = profile?.threshold_hr ?? null
    planAutoPushTitle = profile?.plan_auto_push_title ?? true

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

    const { data: commuteRows } = await supabase
      .from('commute_routes')
      .select('label, active')
      .eq('user_id', user.id)

    if (commuteRows) {
      const rows = commuteRows as { label: string; active: boolean }[]
      commuteCount = rows.length
      commuteActiveCount = rows.filter(r => r.active).length
      commuteLabels = rows.filter(r => r.active).map(r => r.label)
    }
  }

  return (
    <div className="px-3 py-3 pb-10 space-y-4 max-w-lg mx-auto">

      {/* ── Page hero ── */}
      <div className="px-1 pt-[2px]">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-trail-primary">
          {settingsLabels.title}
        </p>
        <p className="text-[22px] font-black text-trail-text leading-tight mt-[2px]">
          {settingsLabels.pageHeroSubtitle}
        </p>
        <p className="text-[12px] text-trail-muted leading-[16px] mt-[6px] max-w-[360px]">
          {settingsLabels.pageHeroIntro}
        </p>
      </div>

      {/* ── Compte & sync ── */}
      <section>
        <SectionHeader
          icon={Plug2}
          title={settingsLabels.sectionAccount}
          subtitle={settingsLabels.sectionAccountSub}
        />
        <SectionCard>
          <AccountSection />
          <StravaSection
            isConnected={stravaConnected}
            athleteName={stravaAthleteName}
            planAutoPushTitle={planAutoPushTitle}
            notice={stravaNotice}
          />
        </SectionCard>
      </section>

      {/* ── Profil athlète ── */}
      <section>
        <SectionHeader
          icon={User}
          title={settingsLabels.sectionProfile}
          subtitle={settingsLabels.sectionProfileSub}
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

      {/* ── Automatisations ── */}
      <section>
        <SectionHeader
          icon={Route}
          title="Automatisations"
          subtitle="Détection et renommage automatiques d'activités"
        />
        <SectionCard>
          <CommuteRoutesTeaser
            routesCount={commuteCount}
            activeCount={commuteActiveCount}
            labels={commuteLabels}
          />
        </SectionCard>
      </section>

      {/* ── Apparence ── */}
      <section>
        <SectionHeader
          icon={Palette}
          title={settingsLabels.sectionAppearance}
          subtitle={settingsLabels.sectionAppearanceSub}
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
          subtitle={settingsLabels.sectionComingSoonSub}
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
          title={settingsLabels.helpAboutTitle}
          subtitle={settingsLabels.helpAboutSub}
        />
        <SectionCard>
          <HelpAboutSection />
        </SectionCard>
      </section>

      {/* ── Footer signature ── */}
      <p className="text-center text-[10px] text-trail-muted/70 tracking-wider uppercase pt-2">
        {settingsLabels.footerTagline}
      </p>

    </div>
  )
}
