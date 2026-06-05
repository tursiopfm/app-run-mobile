import { createClient } from '@/lib/database/supabase-server'
import { getServerUser } from '@/lib/database/get-user'
import type { AppMode } from './app-mode'

// Lecture serveur du mode applicatif depuis profiles.ui_preferences.app_mode.
// Sert à filtrer la nav (AppShell) et à décider le rendu allégé côté pages,
// sans flash. Défaut « expert » (comportement actuel) si non défini / erreur.
export async function getServerAppMode(): Promise<AppMode> {
  try {
    const user = await getServerUser()
    if (!user) return 'expert'
    const supabase = await createClient()
    const { data } = await supabase
      .from('profiles')
      .select('ui_preferences')
      .eq('id', user.id)
      .single()
    const prefs = (data?.ui_preferences ?? {}) as Record<string, unknown>
    return prefs.app_mode === 'mission' ? 'mission' : 'expert'
  } catch {
    return 'expert'
  }
}
