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

// Le bloc Charge garde une vue « Toutes » indépendante : il ne suit jamais la
// discipline (en Mode Mission il est masqué, en Expert l'user le pilote seul).
const CHARGE_SETTINGS_KEY = 'cockpit_charge_settings'

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
    // Le bloc Charge = charge globale (« Toutes »), il ne suit jamais la discipline.
    if (key === CHARGE_SETTINGS_KEY) continue
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

/**
 * Re-pointe le défaut sport de TOUS les blocs Cockpit (sauf Charge) sur le sport
 * de la discipline. À appeler quand l'utilisateur change EXPLICITEMENT sa
 * discipline dans les Réglages : ce choix prime sur les défauts par bloc, donc —
 * contrairement à `applyDisciplineDefaultToCockpit` — aucune garde de
 * personnalisation (un défaut déjà ≠ 'run' est quand même réécrit). C'est ce qui
 * débloque le cas « bloc resté sur natation après changement de discipline » :
 * `router.refresh()` met à jour la prop `defaultSport` côté serveur, mais le
 * réglage localStorage prime (LS-override-wins) et doit donc être réconcilié ici.
 *
 * trail/route/inconnu → 'run' (et non un no-op : on veut vraiment quitter le
 * sport précédent). Le `visible[]` éventuel est préservé (et complété). Le bloc
 * Charge est volontairement laissé intact (vue « Toutes » indépendante).
 */
export function setCockpitDefaultSport(
  discipline: string | null | undefined,
): void {
  if (typeof window === 'undefined') return
  const sport = defaultSportForDiscipline(discipline) ?? BASE_DEFAULT_SPORT

  for (const key of COCKPIT_SPORT_SETTINGS_KEYS) {
    if (key === CHARGE_SETTINGS_KEY) continue
    try {
      const raw = window.localStorage.getItem(key)
      const saved = raw
        ? (JSON.parse(raw) as { visible?: SportKey[]; default?: SportKey })
        : null
      const visible = saved?.visible?.length ? [...saved.visible] : [...BASE_VISIBLE]
      if (!visible.includes(sport)) visible.push(sport)
      window.localStorage.setItem(key, JSON.stringify({ visible, default: sport }))
    } catch {
      window.localStorage.setItem(key, JSON.stringify({ visible: [...BASE_VISIBLE], default: sport }))
    }
  }
}

/**
 * Efface les réglages sport des blocs Cockpit en localStorage. Appelé par le
 * reset onboarding admin (« Rejouer l'onboarding ») pour repartir d'une ardoise
 * vierge : la discipline re-choisie est alors ré-appliquée proprement à la
 * complétion. Sans ça, un défaut résiduel (≠ 'run') serait vu comme une
 * personnalisation et bloquerait le re-jeu.
 */
export function clearCockpitSportSettings(): void {
  if (typeof window === 'undefined') return
  for (const key of COCKPIT_SPORT_SETTINGS_KEYS) {
    try { window.localStorage.removeItem(key) } catch { /* quota / private mode */ }
  }
}
