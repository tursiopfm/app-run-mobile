import { defaultSportForDiscipline, withDefaultSport } from '@/lib/design/sport-settings'

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
