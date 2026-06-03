import { elevationLoss } from '@/lib/activities/stream-metrics'

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
