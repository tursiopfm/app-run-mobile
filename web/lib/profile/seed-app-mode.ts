import type { AppMode } from '@/lib/preferences/app-mode'

/**
 * Construit l'objet `ui_preferences` à écrire pour SEMER `app_mode` depuis le
 * choix d'onboarding (Mode Mission/Expert).
 *
 * - Retourne `null` (→ ne rien écrire) si `mode` n'est pas un AppMode valide,
 *   ou si `app_mode` est déjà défini dans les préférences (on ne réécrase
 *   jamais un choix existant).
 * - Sinon retourne une copie non destructive de `current` avec `app_mode` posé.
 */
export function seedAppModePreferences(
  current: Record<string, unknown> | null | undefined,
  mode: unknown,
): Record<string, unknown> | null {
  if (mode !== 'mission' && mode !== 'expert') return null
  const prefs = current ?? {}
  if (prefs.app_mode === 'mission' || prefs.app_mode === 'expert') return null
  return { ...prefs, app_mode: mode as AppMode }
}
