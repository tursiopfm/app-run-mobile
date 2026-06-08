import {
  defaultSportForDiscipline,
  withDefaultSport,
  readSportSettings,
  applyDisciplineDefaultToCockpit,
  setCockpitDefaultSport,
  clearCockpitSportSettings,
  COCKPIT_SPORT_SETTINGS_KEYS,
} from '@/lib/design/sport-settings'

describe('defaultSportForDiscipline', () => {
  it('mappe les disciplines mono-sport', () => {
    expect(defaultSportForDiscipline('velo')).toBe('ride')
    expect(defaultSportForDiscipline('natation')).toBe('swim')
    expect(defaultSportForDiscipline('triathlon')).toBe('all')
  })
  it('ne surcharge pas trail/route ni les valeurs inconnues', () => {
    expect(defaultSportForDiscipline('trail')).toBeUndefined()
    expect(defaultSportForDiscipline('route')).toBeUndefined()
    expect(defaultSportForDiscipline(null)).toBeUndefined()
    expect(defaultSportForDiscipline(undefined)).toBeUndefined()
    expect(defaultSportForDiscipline('xxx')).toBeUndefined()
  })
})

describe('withDefaultSport', () => {
  const base = { visible: ['run', 'ride', 'swim', 'all'] as const, default: 'run' as const }
  it('surcharge le default quand un sport est fourni', () => {
    expect(withDefaultSport(base, 'ride')).toEqual({ ...base, default: 'ride' })
  })
  it('renvoie les défauts inchangés quand defaultSport est undefined', () => {
    expect(withDefaultSport(base, undefined)).toBe(base)
  })
})

// Contrat d'intégration : la discipline ne fait que poser le DÉFAUT ; le réglage
// utilisateur stocké en localStorage doit toujours primer (LS-override-wins).
describe('readSportSettings + withDefaultSport (intégration)', () => {
  const KEY = 'test_block_settings'
  const DEFAULTS = { visible: ['run', 'ride', 'swim', 'all'] as const, default: 'run' as const }
  afterEach(() => localStorage.clear())

  it('utilise le sport de la discipline quand aucun réglage stocké', () => {
    expect(readSportSettings(KEY, withDefaultSport(DEFAULTS, 'ride')).default).toBe('ride')
  })
  it('le réglage utilisateur stocké prime sur le défaut discipline', () => {
    localStorage.setItem(KEY, JSON.stringify({ visible: ['run', 'ride', 'swim', 'all'], default: 'swim' }))
    expect(readSportSettings(KEY, withDefaultSport(DEFAULTS, 'ride')).default).toBe('swim')
  })
  it('sans discipline ni réglage : garde le défaut du bloc', () => {
    expect(readSportSettings(KEY, withDefaultSport(DEFAULTS, undefined)).default).toBe('run')
  })
})

// Appliqué à la complétion de l'onboarding : la discipline force le défaut des
// blocs Cockpit NON personnalisés (défaut incident 'run'), mais respecte un
// défaut délibérément changé. Corrige le cas où un réglage LS résiduel bloquait
// la discipline (bug du carrousel resté sur « course »).
describe('applyDisciplineDefaultToCockpit', () => {
  afterEach(() => localStorage.clear())

  function read(key: string) {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  }

  it('applique le sport sur tous les blocs sans réglage stocké', () => {
    applyDisciplineDefaultToCockpit('natation')
    for (const key of COCKPIT_SPORT_SETTINGS_KEYS) {
      expect(read(key).default).toBe('swim')
    }
  })

  it('écrase un défaut incident (=run) en préservant le visible personnalisé', () => {
    const key = COCKPIT_SPORT_SETTINGS_KEYS[0]
    localStorage.setItem(key, JSON.stringify({ visible: ['run', 'ride'], default: 'run' }))
    applyDisciplineDefaultToCockpit('velo')
    expect(read(key)).toEqual({ visible: ['run', 'ride'], default: 'ride' })
  })

  it('respecte un défaut délibérément changé (≠ run)', () => {
    const key = COCKPIT_SPORT_SETTINGS_KEYS[0]
    localStorage.setItem(key, JSON.stringify({ visible: ['run', 'ride', 'swim', 'all'], default: 'swim' }))
    applyDisciplineDefaultToCockpit('velo')
    expect(read(key).default).toBe('swim')
  })

  it('ajoute le sport au visible si l’utilisateur l’avait masqué', () => {
    const key = COCKPIT_SPORT_SETTINGS_KEYS[0]
    localStorage.setItem(key, JSON.stringify({ visible: ['run'], default: 'run' }))
    applyDisciplineDefaultToCockpit('natation')
    const s = read(key)
    expect(s.default).toBe('swim')
    expect(s.visible).toContain('swim')
  })

  it('triathlon → all sur les blocs vierges', () => {
    applyDisciplineDefaultToCockpit('triathlon')
    expect(read(COCKPIT_SPORT_SETTINGS_KEYS[0]).default).toBe('all')
  })

  it('ne touche à rien pour trail/route/null (pas de surcharge discipline)', () => {
    applyDisciplineDefaultToCockpit('trail')
    applyDisciplineDefaultToCockpit('route')
    applyDisciplineDefaultToCockpit(null)
    for (const key of COCKPIT_SPORT_SETTINGS_KEYS) {
      expect(localStorage.getItem(key)).toBeNull()
    }
  })
})

// Changement explicite de discipline dans les Réglages : ce signal fort re-pointe
// le défaut sport de TOUS les blocs Cockpit sur la discipline (SANS garde de
// personnalisation, contrairement à applyDisciplineDefaultToCockpit), trail/route
// inclus → 'run'. SAUF le bloc Charge, qui reste indépendant (vue « Toutes »).
describe('setCockpitDefaultSport', () => {
  afterEach(() => localStorage.clear())

  function read(key: string) {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  }

  const CHARGE_KEY = 'cockpit_charge_settings'
  const nonChargeKeys = COCKPIT_SPORT_SETTINGS_KEYS.filter((k) => k !== CHARGE_KEY)

  it('re-pointe TOUS les blocs (hors Charge) même sur un défaut déjà personnalisé', () => {
    // État « bloqué en natation » : tous les blocs en swim (cas du bug signalé).
    for (const key of COCKPIT_SPORT_SETTINGS_KEYS) {
      localStorage.setItem(key, JSON.stringify({ visible: ['run', 'ride', 'swim', 'all'], default: 'swim' }))
    }
    setCockpitDefaultSport('velo')
    for (const key of nonChargeKeys) {
      expect(read(key).default).toBe('ride')
    }
  })

  it('trail/route/inconnu → run (re-pointe vraiment, pas de no-op)', () => {
    for (const key of COCKPIT_SPORT_SETTINGS_KEYS) {
      localStorage.setItem(key, JSON.stringify({ visible: ['run', 'ride', 'swim', 'all'], default: 'swim' }))
    }
    setCockpitDefaultSport('trail')
    for (const key of nonChargeKeys) {
      expect(read(key).default).toBe('run')
    }
  })

  it('laisse le bloc Charge intact (vue « Toutes » indépendante)', () => {
    localStorage.setItem(CHARGE_KEY, JSON.stringify({ visible: ['run', 'ride', 'swim', 'all'], default: 'all' }))
    setCockpitDefaultSport('velo')
    expect(read(CHARGE_KEY).default).toBe('all')
  })

  it('préserve le visible personnalisé et y ajoute le sport si manquant', () => {
    const key = nonChargeKeys[0]
    localStorage.setItem(key, JSON.stringify({ visible: ['run', 'ride'], default: 'run' }))
    setCockpitDefaultSport('natation')
    const s = read(key)
    expect(s.default).toBe('swim')
    expect(s.visible).toEqual(['run', 'ride', 'swim'])
  })

  it('écrit un réglage propre sur les blocs vierges (hors Charge)', () => {
    setCockpitDefaultSport('triathlon')
    for (const key of nonChargeKeys) {
      expect(read(key).default).toBe('all')
    }
    expect(localStorage.getItem(CHARGE_KEY)).toBeNull()
  })
})

// Reset onboarding admin : on efface les réglages sport des blocs pour que le
// re-jeu réapplique proprement la discipline (sinon le défaut résiduel bloque).
describe('clearCockpitSportSettings', () => {
  afterEach(() => localStorage.clear())

  it('supprime toutes les clés cockpit_*_settings', () => {
    for (const key of COCKPIT_SPORT_SETTINGS_KEYS) {
      localStorage.setItem(key, JSON.stringify({ visible: ['run'], default: 'swim' }))
    }
    clearCockpitSportSettings()
    for (const key of COCKPIT_SPORT_SETTINGS_KEYS) {
      expect(localStorage.getItem(key)).toBeNull()
    }
  })

  it('après reset, une nouvelle discipline est ré-appliquée (re-jeu débloqué)', () => {
    // Simule l'état « bloqué en natation » : tous les blocs en swim.
    applyDisciplineDefaultToCockpit('natation')
    // Re-jeu vélo SANS reset → resté en swim (perçu comme personnalisé).
    applyDisciplineDefaultToCockpit('velo')
    expect(JSON.parse(localStorage.getItem(COCKPIT_SPORT_SETTINGS_KEYS[0])!).default).toBe('swim')
    // Avec reset → la nouvelle discipline prend bien.
    clearCockpitSportSettings()
    applyDisciplineDefaultToCockpit('velo')
    expect(JSON.parse(localStorage.getItem(COCKPIT_SPORT_SETTINGS_KEYS[0])!).default).toBe('ride')
  })
})
