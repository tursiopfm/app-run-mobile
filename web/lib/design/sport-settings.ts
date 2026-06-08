import type { SportKey } from '@/lib/design/sports'

// Helper sync pour les blocs Cockpit qui persistent leurs préférences
// (visible[], default sport) en localStorage. Permet le lazy-init de useState :
//
//   const [settings, setSettings] = useState(() => readSportSettings(KEY, DEFAULTS))
//
// → 1er render direct avec les préférences user, plus de flash entre le sport
// par défaut et celui choisi par l'utilisateur.

export function readSportSettings<T extends object>(storageKey: string, defaults: T): T {
  if (typeof window === 'undefined') return defaults
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return defaults
    return { ...defaults, ...(JSON.parse(raw) as Partial<T>) }
  } catch {
    return defaults
  }
}

/**
 * Sport par défaut à appliquer aux blocs cockpit selon la discipline
 * d'onboarding. `undefined` = pas de surcharge (le bloc garde son défaut).
 * trail/route restent sur le défaut par bloc (« laisse tous les blocs »).
 */
export function defaultSportForDiscipline(
  discipline: string | null | undefined,
): SportKey | undefined {
  switch (discipline) {
    case 'velo':      return 'ride'
    case 'natation':  return 'swim'
    case 'triathlon': return 'all'
    default:          return undefined
  }
}

/**
 * Renvoie une copie des `defaults` avec `default` surchargé par `defaultSport`
 * s'il est fourni. Sinon renvoie `defaults` inchangé (même référence).
 */
export function withDefaultSport<T extends { default: SportKey }>(
  defaults: T,
  defaultSport?: SportKey,
): T {
  return defaultSport ? { ...defaults, default: defaultSport } : defaults
}

// Clés localStorage des blocs Cockpit pilotés par sport (un défaut + un visible[]
// chacun). Doit rester synchro avec les STORAGE_KEY des composants cockpit/*.
export const COCKPIT_SPORT_SETTINGS_KEYS = [
  'cockpit_activities_settings',
  'cockpit_last_activity_settings',
  'cockpit_history_settings',
  'cockpit_goals_settings',
  'cockpit_intensity_settings',
  'cockpit_charge_settings',
  'cockpit_weekly_settings',
  'cockpit_cumul_settings',
] as const

const BASE_DEFAULT_SPORT: SportKey = 'run'
const BASE_VISIBLE: SportKey[] = ['run', 'ride', 'swim', 'all']

/**
 * Applique le sport d'une discipline d'onboarding comme défaut des blocs Cockpit.
 *
 * À appeler à la complétion de l'onboarding. Le défaut discipline n'est qu'un
 * repli au render (withDefaultSport) : tout réglage LS résiduel l'écrase
 * (« LS-override-wins »). Sans cette passe, re-choisir une discipline laissait
 * les blocs sur « course » dès qu'un réglage existait.
 *
 * Respecte les personnalisations : un bloc dont le défaut a été DÉLIBÉRÉMENT
 * changé (≠ 'run') est laissé tel quel ; seuls les blocs vierges ou au défaut
 * incident 'run' reçoivent le sport de la discipline. trail/route → no-op.
 * Le `visible[]` éventuel est préservé (et complété si le sport y manquait).
 */
export function applyDisciplineDefaultToCockpit(
  discipline: string | null | undefined,
): void {
  if (typeof window === 'undefined') return
  const sport = defaultSportForDiscipline(discipline)
  if (!sport) return

  for (const key of COCKPIT_SPORT_SETTINGS_KEYS) {
    try {
      const raw = window.localStorage.getItem(key)
      const saved = raw
        ? (JSON.parse(raw) as { visible?: SportKey[]; default?: SportKey })
        : null
      // Défaut délibérément personnalisé : on n'y touche pas.
      if (saved?.default && saved.default !== BASE_DEFAULT_SPORT) continue

      const visible = saved?.visible?.length ? [...saved.visible] : [...BASE_VISIBLE]
      if (!visible.includes(sport)) visible.push(sport)
      window.localStorage.setItem(key, JSON.stringify({ visible, default: sport }))
    } catch {
      // Clé corrompue : on réécrit un réglage propre porté par la discipline.
      window.localStorage.setItem(key, JSON.stringify({ visible: [...BASE_VISIBLE], default: sport }))
    }
  }
}
