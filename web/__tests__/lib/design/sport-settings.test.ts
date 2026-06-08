import {
  defaultSportForDiscipline,
  withDefaultSport,
  readSportSettings,
  applyDisciplineDefaultToCockpit,
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
