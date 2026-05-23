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
