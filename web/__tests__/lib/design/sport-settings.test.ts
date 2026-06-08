import { defaultSportForDiscipline, withDefaultSport, readSportSettings } from '@/lib/design/sport-settings'

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
