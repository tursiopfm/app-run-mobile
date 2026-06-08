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

  // Efface aussi les préférences semées par l'onboarding et synchronisées en DB,
  // sinon le re-jeu est bloqué : app_mode garde son ancienne valeur (guard
  // seed-once) et cockpit_goals_settings serait ré-hydraté (cloud→localStorage)
  // par-dessus la nouvelle discipline. Lecture-merge pour préserver le reste
  // (ordres de blocs, largeurs, cibles d'objectifs…).
  const { data: prof } = await supabase
    .from('profiles')
    .select('ui_preferences')
    .eq('id', user.id)
    .maybeSingle()
  const prefs = { ...((prof?.ui_preferences ?? {}) as Record<string, unknown>) }
  delete prefs.app_mode
  delete prefs.cockpit_goals_settings

  const { error } = await supabase
    .from('profiles')
    .update({
      onboarding_completed_at: null,
      onboarding_skipped: false,
      onboarding_discipline: null,
      onboarding_mission: null,
      onboarding_mode: null,
      onboarding_data_source: null,
      ui_preferences: prefs,
    })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
