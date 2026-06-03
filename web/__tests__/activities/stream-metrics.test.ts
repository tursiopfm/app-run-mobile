import { elevationLoss, gradeAdjustedPaceSec, decouplingPct, computeStreamMetrics } from '@/lib/activities/stream-metrics'

describe('elevationLoss', () => {
  it('somme les descentes au-delà du seuil de bruit et ignore le jitter', () => {
    expect(elevationLoss([0, 10, 5, 5, 20, 0], 1)).toBe(25)
  })
  it('ignore les micro-variations sous le seuil', () => {
    expect(elevationLoss([100, 100.4, 99.7, 100.2], 1)).toBe(0)
  })
  it('retourne 0 pour moins de 2 points', () => {
    expect(elevationLoss([42], 1)).toBe(0)
    expect(elevationLoss([], 1)).toBe(0)
  })
})

describe('gradeAdjustedPaceSec', () => {
  it('sur le plat, renvoie ~ l\'allure brute (1000 / vitesse)', () => {
    const p = gradeAdjustedPaceSec([3, 3, 3], [0, 0, 0])
    expect(p).toBeGreaterThanOrEqual(332)
    expect(p).toBeLessThanOrEqual(334)
  })
  it('en côte, l\'allure plate équivalente est plus rapide (sec/km plus petit)', () => {
    const flat = gradeAdjustedPaceSec([3, 3, 3], [0, 0, 0])!
    const hill = gradeAdjustedPaceSec([3, 3, 3], [10, 10, 10])!
    expect(hill).toBeLessThan(flat)
  })
  it('null si vitesse ou pente absente', () => {
    expect(gradeAdjustedPaceSec([], [])).toBeNull()
    expect(gradeAdjustedPaceSec(undefined as unknown as number[], [0])).toBeNull()
  })
})

describe('decouplingPct', () => {
  it('positif quand la FC dérive vers le haut à output constant', () => {
    const time = Array.from({ length: 1300 }, (_, i) => i)
    const out  = time.map(() => 3)
    const hr   = time.map((_, i) => (i < 650 ? 150 : 160))
    const d = decouplingPct(out, hr, time)!
    expect(d).toBeGreaterThan(5.5)
    expect(d).toBeLessThan(7)
  })
  it('null si durée trop courte', () => {
    expect(decouplingPct([3, 3], [150, 160], [0, 100])).toBeNull()
  })
  it('null si pas de FC', () => {
    const time = Array.from({ length: 1300 }, (_, i) => i)
    expect(decouplingPct(time.map(() => 3), [], time)).toBeNull()
  })
})

describe('computeStreamMetrics', () => {
  it('combine les 3 métriques quand les streams sont complets', () => {
    const time = Array.from({ length: 1300 }, (_, i) => i)
    const m = computeStreamMetrics({
      time,
      altitude: time.map((_, i) => (i < 650 ? i * 0.1 : 65 - (i - 650) * 0.1)),
      heartrate: time.map((_, i) => (i < 650 ? 150 : 160)),
      velocity: time.map(() => 3),
      grade: time.map((_, i) => (i < 650 ? 5 : -5)),
    })
    expect(m.elevationLossM).toBeGreaterThan(0)
    expect(m.decouplingPct).toBeGreaterThan(0)
    expect(m.gradeAdjustedPaceS).toBeGreaterThan(0)
  })
  it('renvoie null par métrique manquante', () => {
    const m = computeStreamMetrics({ altitude: [10, 5] })
    expect(m.elevationLossM).toBe(5)
    expect(m.decouplingPct).toBeNull()
    expect(m.gradeAdjustedPaceS).toBeNull()
  })
})
