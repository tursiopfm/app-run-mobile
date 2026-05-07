import { AppShell } from '@/components/navigation/AppShell'
import { createClient } from '@/lib/database/supabase-server'
import { redirect } from 'next/navigation'
import { ProfileSection, type ProfileData } from '@/components/settings/ProfileSection'
import { HrZoneMethod } from '@/components/settings/HrZoneMethod'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let profileData: ProfileData = {
    first_name: null, last_name: null,
    max_hr: null, threshold_hr: null, resting_hr: null,
    ftp_watts: null, weight_kg: null, year_goal_km: null,
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name,last_name,max_hr,threshold_hr,resting_hr,ftp_watts,weight_kg,year_goal_km')
    .eq('id', user.id)
    .single()
  if (profile) profileData = profile as ProfileData

  const displayName = profileData.first_name
    ? `${profileData.first_name} ${profileData.last_name ?? ''}`.trim()
    : user.email?.split('@')[0] ?? 'Athlète'

  return (
    <AppShell>
      <div className="px-3 py-3 space-y-3 max-w-lg mx-auto">

        <div className="px-1">
          <p className="text-[22px] font-black text-trail-text">{displayName}</p>
          <p className="text-[13px] text-trail-muted">Ce profil sert à calibrer les zones de fréquence cardiaque et à mieux interpréter le niveau d&apos;effort.</p>
        </div>

        <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px] space-y-2">
          <p className="text-[15px] font-bold text-trail-text">Profil athlète</p>
          <div className="h-[6px]" />
          <ProfileSection initial={profileData} />
        </div>

        <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px] space-y-3">
          <p className="text-[15px] font-bold text-trail-text">Méthode de calcul des zones</p>
          <HrZoneMethod />
        </div>

      </div>
    </AppShell>
  )
}
