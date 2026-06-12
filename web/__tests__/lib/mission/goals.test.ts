import { readMissionGoals, saveMissionGoals, yearElapsedFraction, projectYearKm, GOALS_TARGETS_KEY } from '@/lib/mission/goals'

beforeEach(() => window.localStorage.clear())

describe('read/saveMissionGoals', () => {
  it('round-trip en préservant les autres sports et champs', () => {
    window.localStorage.setItem(GOALS_TARGETS_KEY, JSON.stringify({ ride: { weekKm: 120 }, run: { yearKm: 1500 } }))
    saveMissionGoals('run', { weekKm: 50, weekDPlus: 2000 })
    expect(readMissionGoals('run')).toEqual({ weekKm: 50, weekDPlus: 2000, yearKm: 1500 })
    expect(JSON.parse(window.localStorage.getItem(GOALS_TARGETS_KEY)!).ride).toEqual({ weekKm: 120 })
  })
  it('vide → {}', () => { expect(readMissionGoals('run')).toEqual({}) })

  it('undefined explicite efface la clé', () => {
    window.localStorage.setItem(GOALS_TARGETS_KEY, JSON.stringify({ run: { weekKm: 50, yearKm: 1500 } }))
    saveMissionGoals('run', { yearKm: undefined })
    const stored = readMissionGoals('run')
    expect(stored).toEqual({ weekKm: 50 })
    expect('yearKm' in stored).toBe(false)
  })
})

describe('yearElapsedFraction', () => {
  it('1er janvier ≈ 1/365, 2 juillet 2026 = 183/365', () => {
    expect(yearElapsedFraction('2026-01-01')).toBeCloseTo(1 / 365, 5)
    expect(yearElapsedFraction('2026-07-02')).toBeCloseTo(183 / 365, 5)
  })
})

describe('projectYearKm', () => {
  it('extrapole le YTD sur l\'année (arrondi à 10 km)', () => {
    // 12 juin 2026 = jour 163 → 996 / (163/365) ≈ 2230
    expect(projectYearKm(996, '2026-06-12')).toBe(2230)
  })
  it('0 km ou tout début d\'année → null (pas de projection délirante)', () => {
    expect(projectYearKm(0, '2026-06-12')).toBeNull()
    expect(projectYearKm(50, '2026-01-05')).toBeNull() // moins de 14 jours écoulés
  })
})
