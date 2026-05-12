import { redirect } from 'next/navigation'
import { createClient } from '@/lib/database/supabase-server'
import { getServerUser } from '@/lib/database/get-user'
import { IdentityCard } from '@/components/settings/IdentityCard'
import { HrCalibrationCard } from '@/components/settings/HrCalibrationCard'
import type { HrZoneMethod } from '@/lib/health/hr-zones'
import type { CardioState } from '@/components/settings/HrCardioFields'

export default async function ProfilePage() {
  const user = await getServerUser()
  if (!user) redirect('/login')
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name,last_name,avatar_url,max_hr,aerobic_threshold_hr,threshold_hr,resting_hr,ftp_watts,weight_kg,year_goal_km,birth_year,hr_zone_method,hr_zones_custom,hr_method_updated_at')
    .eq('id', user.id)
    .single()

  const { data: connection } = await supabase
    .from('provider_connections')
    .select('athlete_data')
    .eq('user_id', user.id)
    .eq('provider', 'strava')
    .maybeSingle()

  const athlete = (connection?.athlete_data ?? null) as
    | { firstname?: string; lastname?: string; profile?: string; resting_heart_rate?: number | null }
    | null

  const firstName = profile?.first_name ?? athlete?.firstname ?? null
  const lastName  = profile?.last_name  ?? athlete?.lastname  ?? null
  const stravaAvatarUrl = athlete?.profile && athlete.profile !== 'avatar/athlete/large.png'
    ? athlete.profile
    : null
  const avatarUrl = profile?.avatar_url ?? stravaAvatarUrl
  const displayName = firstName ? `${firstName} ${lastName ?? ''}`.trim() : user.email?.split('@')[0] ?? 'Athlète'

  const initialMethod: HrZoneMethod = (profile?.hr_zone_method as HrZoneMethod) ?? 'seuils'

  const initialState: CardioState = {
    max_hr:               profile?.max_hr               ?? null,
    resting_hr:           profile?.resting_hr           ?? null,
    aerobic_threshold_hr: profile?.aerobic_threshold_hr ?? null,
    threshold_hr:         profile?.threshold_hr         ?? null,
    birth_year:           profile?.birth_year           ?? null,
    hr_zones_custom:      (profile?.hr_zones_custom as CardioState['hr_zones_custom']) ?? null,
  }

  return (
    <div className="px-3 py-3 space-y-3 max-w-lg mx-auto pb-8">
      <div className="px-1">
        <p className="text-[22px] font-black text-trail-text">{displayName}</p>
        <p className="text-[12px] text-trail-muted leading-[16px] mt-1">
          Ce profil calibre tes zones de fréquence cardiaque et améliore l&apos;interprétation de l&apos;effort.
        </p>
      </div>

      <IdentityCard
        firstName={firstName}
        lastName={lastName}
        email={user.email ?? null}
        avatarUrl={avatarUrl}
        hasCustomAvatar={!!profile?.avatar_url}
        accountCreatedAt={user.created_at ?? null}
      />

      <HrCalibrationCard
        initial={initialState}
        initialMethod={initialMethod}
        athleteData={athlete ? { resting_heart_rate: athlete.resting_heart_rate ?? null } : null}
        methodUpdatedAt={profile?.hr_method_updated_at ?? null}
      />
    </div>
  )
}
