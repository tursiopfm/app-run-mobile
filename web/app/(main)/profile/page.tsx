import { createClient } from '@/lib/database/supabase-server'
import { getServerUser } from '@/lib/database/get-user'
import { HrZoneMethod } from '@/components/settings/HrZoneMethod'
import { ProfileSourceSection } from '@/components/settings/ProfileSourceSection'
import { ProfileCardioSection, type ProfileCardioData } from '@/components/settings/ProfileCardioSection'
import { HrZonesDisplay } from '@/components/settings/HrZonesDisplay'
import { IdentityCard } from '@/components/settings/IdentityCard'

export default async function ProfilePage() {
  const user     = await getServerUser()
  const supabase = await createClient()

  let data: ProfileCardioData = {
    first_name: null, last_name: null,
    max_hr: null, aerobic_threshold_hr: null, threshold_hr: null,
    resting_hr: null, ftp_watts: null, weight_kg: null,
    year_goal_km: null, birth_year: null,
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name,last_name,max_hr,aerobic_threshold_hr,threshold_hr,resting_hr,ftp_watts,weight_kg,year_goal_km,birth_year')
    .eq('id', user!.id)
    .single()
  if (profile) data = profile as ProfileCardioData

  const { data: connection } = await supabase
    .from('provider_connections')
    .select('athlete_data')
    .eq('user_id', user!.id)
    .eq('provider', 'strava')
    .maybeSingle()

  const athlete = (connection?.athlete_data ?? null) as
    | { firstname?: string; lastname?: string; profile?: string }
    | null

  const firstName = data.first_name ?? athlete?.firstname ?? null
  const lastName  = data.last_name  ?? athlete?.lastname  ?? null
  const avatarUrl = athlete?.profile && athlete.profile !== 'avatar/athlete/large.png'
    ? athlete.profile
    : null

  const displayName = firstName
    ? `${firstName} ${lastName ?? ''}`.trim()
    : user!.email?.split('@')[0] ?? 'Athlète'

  return (
    <div className="px-3 py-3 space-y-3 max-w-lg mx-auto pb-8">

      {/* En-tête */}
      <div className="px-1">
        <p className="text-[22px] font-black text-trail-text">{displayName}</p>
        <p className="text-[12px] text-trail-muted leading-[16px] mt-1">
          Ce profil calibre tes zones de fréquence cardiaque et améliore l&apos;interprétation de l&apos;effort.
        </p>
      </div>

      {/* Identité */}
      <IdentityCard
        firstName={firstName}
        lastName={lastName}
        email={user!.email ?? null}
        avatarUrl={avatarUrl}
        accountCreatedAt={user!.created_at ?? null}
      />

      {/* Méthode de calcul des zones */}
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[12px] space-y-[10px]">
        <p className="text-[14px] font-bold text-trail-text">Méthode de calcul des zones</p>
        <HrZoneMethod />
      </div>

      {/* Source des valeurs */}
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[12px] space-y-[10px]">
        <p className="text-[14px] font-bold text-trail-text">Source des valeurs</p>
        <ProfileSourceSection />
      </div>

      {/* Données cardio + Infos athlète + Save */}
      <ProfileCardioSection initial={data} />

      {/* Zones FC utilisées */}
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[12px] space-y-[10px]">
        <p className="text-[14px] font-bold text-trail-text">Zones FC utilisées</p>
        <HrZonesDisplay
          maxHr={data.max_hr}
          restingHr={data.resting_hr}
          aerobicThresholdHr={data.aerobic_threshold_hr}
          thresholdHr={data.threshold_hr}
        />
      </div>

    </div>
  )
}
