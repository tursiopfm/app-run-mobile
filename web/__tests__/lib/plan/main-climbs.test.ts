import { detectMainClimbs } from '@/lib/plan/main-climbs'

describe('detectMainClimbs', () => {
  it('détecte une montée simple et calcule pente / distance', () => {
    const climbs = detectMainClimbs({ d: [0, 1, 2, 3, 4], e: [100, 300, 500, 700, 900] })
    expect(climbs).toHaveLength(1)
    expect(climbs[0].dPlus).toBe(800)
    expect(climbs[0].distKm).toBe(4)
    expect(climbs[0].gradientPct).toBeCloseTo(20, 3)
    expect(climbs[0].midKm).toBe(2)
  })

  it('ignore les faux-plats sous le seuil minDplus', () => {
    const climbs = detectMainClimbs({ d: [0, 1, 2, 3, 4], e: [100, 110, 90, 115, 95] })
    expect(climbs).toEqual([])
  })

  it('plafonne au nombre demandé et garde les plus grosses, triées par km', () => {
    // Montée A km0→1 (+500), descente, Montée B km2→5 (+700)
    const climbs = detectMainClimbs(
      { d: [0, 1, 2, 3, 4, 5, 6], e: [100, 600, 200, 200, 300, 900, 900] },
      { max: 1 },
    )
    expect(climbs).toHaveLength(1)
    expect(climbs[0].dPlus).toBe(700)
    expect(climbs[0].startKm).toBe(2)
  })

  it('renvoie [] pour une trace vide ou trop courte', () => {
    expect(detectMainClimbs({ d: [], e: [] })).toEqual([])
    expect(detectMainClimbs({ d: [0], e: [100] })).toEqual([])
  })
})
