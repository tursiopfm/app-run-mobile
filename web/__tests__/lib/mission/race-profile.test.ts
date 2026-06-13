import { raceProfile } from '@/lib/mission/race-profile'
import type { Race } from '@/types/plan'

function race(p: Partial<Race>): Race {
  return { id: 'r', name: 'R', date: '2026-09-01', distance: 0, elevation: 0, type: 'trail', isMain: true, priority: 'A', ...p } as Race
}

it('10 km route plat → court, VMA en tête', () => {
  const p = raceProfile(race({ distance: 10, elevation: 50, type: 'route' }))
  expect(p.relief).toBe('flat')
  expect(p.distanceClass).toBe('short')
  expect(p.qualityKinds[0]).toBe('fractionne')
  expect(p.longRunMaxMin).toBe(90)
})

it('marathon route → moyen, seuil en tête + allure cible calculée', () => {
  const p = raceProfile(race({ distance: 42, elevation: 200, type: 'route', targetDurationMin: 210 }))
  expect(p.relief).toBe('flat')
  expect(p.distanceClass).toBe('mid')
  expect(p.qualityKinds[0]).toBe('seuil_tempo')
  expect(p.goalPaceMinPerKm).toBeCloseTo(5, 1)
})

it('trail vallonné → côtes présentes', () => {
  const p = raceProfile(race({ distance: 30, elevation: 900, type: 'trail' }))
  expect(p.relief).toBe('rolling')
  expect(p.qualityKinds).toContain('cotes')
})

it('skyrace → montagne, côtes en tête, D+/km élevé', () => {
  const p = raceProfile(race({ distance: 25, elevation: 1800, type: 'skyrace' }))
  expect(p.relief).toBe('mountain')
  expect(p.qualityKinds[0]).toBe('cotes')
  expect(p.dPlusPerKm).toBeGreaterThan(40)
})

it('ultra montagne → distanceClass ultra, plafond SL élevé', () => {
  const p = raceProfile(race({ distance: 170, elevation: 10000, type: 'ultra' }))
  expect(p.distanceClass).toBe('ultra')
  expect(p.longRunMaxMin).toBe(240)
})

it('sans course → profil neutre', () => {
  const p = raceProfile(null)
  expect(p.qualityKinds).toEqual(['seuil_tempo'])
  expect(p.dPlusPerKm).toBe(20)
  expect(p.longRunMaxMin).toBe(120)
  expect(p.goalPaceMinPerKm).toBeNull()
})
