import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/database/supabase-server'
import { getServerUser } from '@/lib/database/get-user'
import { IdentityCard } from '@/components/settings/IdentityCard'

export default async function ProfileIdentityPage() {
  const user = await getServerUser()
  if (!user) redirect('/login')
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name,last_name,avatar_url,birth_date,sex')
    .eq('id', user.id)
    .single()

  const { data: connection } = await supabase
    .from('provider_connections')
    .select('athlete_data')
    .eq('user_id', user.id)
    .eq('provider', 'strava')
    .maybeSingle()

  const athlete = (connection?.athlete_data ?? null) as
    | { firstname?: string; lastname?: string; profile?: string }
    | null

  const firstName = profile?.first_name ?? athlete?.firstname ?? null
  const lastName  = profile?.last_name  ?? athlete?.lastname  ?? null
  const stravaAvatarUrl = athlete?.profile && athlete.profile !== 'avatar/athlete/large.png'
    ? athlete.profile
    : null
  const avatarUrl = profile?.avatar_url ?? stravaAvatarUrl

  return (
    <div className="px-3 py-3 space-y-3 max-w-lg mx-auto pb-8">
      <div className="px-1 flex items-center gap-2">
        <Link
          href="/settings"
          className="text-trail-muted hover:text-trail-text -ml-1 p-1"
          aria-label="Retour aux Réglages"
        >
          <ChevronLeft size={20} />
        </Link>
        <div>
          <p className="text-[22px] font-black text-trail-text leading-tight">Identité</p>
          <p className="text-[12px] text-trail-muted leading-[16px]">
            Modifie ton nom et ta photo de profil.
          </p>
        </div>
      </div>

      <IdentityCard
        firstName={firstName}
        lastName={lastName}
        email={user.email ?? null}
        birthDate={profile?.birth_date ?? null}
        sex={(profile?.sex as 'male' | 'female' | 'other' | null) ?? null}
        avatarUrl={avatarUrl}
        hasCustomAvatar={!!profile?.avatar_url}
        accountCreatedAt={user.created_at ?? null}
      />
    </div>
  )
}
