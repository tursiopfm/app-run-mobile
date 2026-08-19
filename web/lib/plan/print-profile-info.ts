// Couches d'information affichables sur le profil exporté (cf. ProfileInfoDialog).
// Mémorisé en localStorage. Calqué sur print-size.ts / print-columns.ts.

// `objectif` et `barriers` sont EXCLUSIFS (cf. ProfileInfoDialog) : afficher les
// deux séries d'heures surcharge le profil. sanitize() fait respecter la règle,
// y compris pour une config héritée où les deux étaient à true.
export interface ProfileInfoConfig {
  objectif: boolean   // ligne objectif horaire dans la frise
  barriers: boolean   // boîte rouge barrière dans la frise
  supplies: boolean   // puces ravito + couleur des bandeaux
  altitudes: boolean  // pastilles d'altitude sur la courbe + alt dans la frise
}

export const DEFAULT_PROFILE_INFO: ProfileInfoConfig = {
  objectif: false, barriers: true, supplies: true, altitudes: true,
}

const LS_KEY = 'tc:plan:print-profile-info:v1'

function sanitize(raw: Partial<ProfileInfoConfig>): ProfileInfoConfig {
  const barriers = typeof raw.barriers === 'boolean' ? raw.barriers : DEFAULT_PROFILE_INFO.barriers
  const objectif = typeof raw.objectif === 'boolean' ? raw.objectif : DEFAULT_PROFILE_INFO.objectif
  return {
    objectif:  barriers ? false : objectif,   // exclusif : la barrière prime
    barriers,
    supplies:  typeof raw.supplies  === 'boolean' ? raw.supplies  : DEFAULT_PROFILE_INFO.supplies,
    altitudes: typeof raw.altitudes === 'boolean' ? raw.altitudes : DEFAULT_PROFILE_INFO.altitudes,
  }
}

export function loadProfileInfo(): ProfileInfoConfig {
  if (typeof window === 'undefined') return DEFAULT_PROFILE_INFO
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return DEFAULT_PROFILE_INFO
    return sanitize(JSON.parse(raw) as Partial<ProfileInfoConfig>)
  } catch {
    return DEFAULT_PROFILE_INFO
  }
}

export function saveProfileInfo(cfg: ProfileInfoConfig): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(cfg)) } catch { /* quota / privé */ }
}
