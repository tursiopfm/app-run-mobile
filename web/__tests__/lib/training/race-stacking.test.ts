import { computeRaceMarkers } from '@/lib/training/race-stacking'
import type { Race } from '@/types/plan'

function makeRace(overrides: Partial<Race>): Race {
  return {
    id: 'race-x',
    name: 'Race',
    date: '2026-06-01',
    distance: 42,
    elevation: 1500,
    type: 'trail',
    isMain: false,
    priority: 'C',
    ...overrides,
  }
}

describe('computeRaceMarkers', () => {
  const macroStart = '2026-04-01'
  const macroEnd = '2026-08-29'  // 150 jours

  it('retourne [] si aucune course', () => {
    expect(computeRaceMarkers([], macroStart, macroEnd)).toEqual([])
  })

  it('filtre une course avant macroStart', () => {
    const r = makeRace({ id: 'r1', date: '2026-03-15', priority: 'A' })
    expect(computeRaceMarkers([r], macroStart, macroEnd)).toEqual([])
  })

  it('filtre une course après macroEnd', () => {
    const r = makeRace({ id: 'r1', date: '2026-09-15', priority: 'A' })
    expect(computeRaceMarkers([r], macroStart, macroEnd)).toEqual([])
  })

  it('1 course A à mi-période → leftPercent 50%, lane 0', () => {
    // mi-période ≈ 04-01 + 75 jours = 2026-06-15
    const r = makeRace({ id: 'r1', date: '2026-06-15', priority: 'A' })
    const result = computeRaceMarkers([r], macroStart, macroEnd)
    expect(result).toHaveLength(1)
    expect(result[0].race.id).toBe('r1')
    expect(result[0].lane).toBe(0)
    expect(result[0].leftPercent).toBeCloseTo(50, 0)
  })

  it('2 courses A éloignées (> 8% écart) → 2 markers en lane 0', () => {
    const r1 = makeRace({ id: 'r1', date: '2026-05-15', priority: 'A' })   // ~30%
    const r2 = makeRace({ id: 'r2', date: '2026-08-15', priority: 'A' })   // ~91%
    const result = computeRaceMarkers([r1, r2], macroStart, macroEnd)
    expect(result).toHaveLength(2)
    expect(result.every(m => m.lane === 0)).toBe(true)
  })

  it('2 courses A proches (< 8% écart) → 2e pousse en lane fantôme', () => {
    const r1 = makeRace({ id: 'r1', date: '2026-06-15', priority: 'A' })   // ~50%
    const r2 = makeRace({ id: 'r2', date: '2026-06-22', priority: 'A' })   // ~54%, écart ~4.6%
    const result = computeRaceMarkers([r1, r2], macroStart, macroEnd)
    expect(result).toHaveLength(2)
    const lanes = result.map(m => m.lane).sort()
    expect(lanes[0]).toBe(0)
    expect(lanes[1]).toBeGreaterThanOrEqual(2)  // poussée en lane fantôme (>= 2)
  })

  it('mix 1 A + 2 B + 1 C éloignées → A lane 0, B/C lane 1', () => {
    const a = makeRace({ id: 'a', date: '2026-08-15', priority: 'A', isMain: true })
    const b1 = makeRace({ id: 'b1', date: '2026-05-01', priority: 'B' })
    const b2 = makeRace({ id: 'b2', date: '2026-06-15', priority: 'B' })
    const c = makeRace({ id: 'c', date: '2026-07-15', priority: 'C' })
    const result = computeRaceMarkers([a, b1, b2, c], macroStart, macroEnd)
    expect(result).toHaveLength(4)
    expect(result.find(m => m.race.id === 'a')!.lane).toBe(0)
    expect(result.find(m => m.race.id === 'b1')!.lane).toBe(1)
    expect(result.find(m => m.race.id === 'b2')!.lane).toBe(1)
    expect(result.find(m => m.race.id === 'c')!.lane).toBe(1)
  })
})
