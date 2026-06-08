import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/database/get-user'
import { getIsAdmin } from '@/lib/database/get-admin'
import { createServiceClient } from '@/lib/database/supabase-server'

// Outil de test : remet l'onboarding à zéro pour l'admin courant.
// Permet de re-jouer le flow « Mission Setup » sans recréer un compte.
export async function POST() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = await getIsAdmin(user.id)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      onboarding_completed_at: null,
      onboarding_skipped: false,
      onboarding_discipline: null,
      onboarding_mission: null,
      onboarding_mode: null,
      onboarding_data_source: null,
    })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
