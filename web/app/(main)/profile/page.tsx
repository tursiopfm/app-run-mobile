import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/database/supabase-server'
import { getServerUser } from '@/lib/database/get-user'
import { HrCalibrationCard } from '@/components/settings/HrCalibrationCard'
import type { HrZoneMethod } from '@/lib/health/hr-zones'
import type { CardioState } from '@/components/settings/HrCardioFields'
import { getServerT } from '@/lib/i18n/server'

export default async function ProfilePage() {
  const S = getServerT().settings
  const user = await getServerUser()
  if (!user) redirect('/login')
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('max_hr,aerobic_threshold_hr,threshold_hr,resting_hr,ftp_watts,weight_kg,year_goal_km,birth_year,birth_date,hr_zone_method,hr_zones_custom,hr_method_updated_at')
    .eq('id', user.id)
    .single()

  const { data: connection } = await supabase
    .from('provider_connections')
    .select('athlete_data')
    .eq('user_id', user.id)
    .eq('provider', 'strava')
    .maybeSingle()

  const athlete = (connection?.athlete_data ?? null) as
    | { resting_heart_rate?: number | null }
    | null

  const initialMethod: HrZoneMethod = (profile?.hr_zone_method as HrZoneMethod) ?? 'seuils'

  const birthYearFromDate =
    typeof profile?.birth_date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(profile.birth_date)
      ? Number(profile.birth_date.slice(0, 4))
      : null

  const initialState: CardioState = {
    max_hr:               profile?.max_hr               ?? null,
    resting_hr:           profile?.resting_hr           ?? null,
    aerobic_threshold_hr: profile?.aerobic_threshold_hr ?? null,
    threshold_hr:         profile?.threshold_hr         ?? null,
    birth_year:           profile?.birth_year ?? birthYearFromDate,
    hr_zones_custom:      (profile?.hr_zones_custom as CardioState['hr_zones_custom']) ?? null,
  }

  return (
    <div className="px-3 py-3 space-y-3 max-w-lg md:max-w-3xl mx-auto pb-8">
      <div className="px-1 flex items-center gap-2">
        <Link
          href="/settings"
          className="text-trail-muted hover:text-trail-text -ml-1 p-1"
          aria-label={S.backToSettingsAria}
        >
          <ChevronLeft size={20} />
        </Link>
        <div>
          <p className="text-h1 font-display font-bold text-trail-text leading-tight">{S.profilePageTitle}</p>
          <p className="text-caption text-trail-muted leading-[16px] mt-1">
            {S.profilePageIntro}
          </p>
        </div>
      </div>

      <HrCalibrationCard
        initial={initialState}
        initialMethod={initialMethod}
        athleteData={athlete ? { resting_heart_rate: athlete.resting_heart_rate ?? null } : null}
        methodUpdatedAt={profile?.hr_method_updated_at ?? null}
      />
    </div>
  )
}
