import { elevationLoss, gradeAdjustedPaceSec } from '@/lib/activities/stream-metrics'

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
