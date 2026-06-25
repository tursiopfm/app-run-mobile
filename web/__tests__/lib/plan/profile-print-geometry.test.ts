import { xOf, yOf, buildLinePath, buildAreaPath, type ProfileGeom } from '@/lib/plan/profile-print-geometry'

const G: ProfileGeom = { W: 900, H: 300, padL: 50, padR: 10, plotTop: 20, plotH: 200, yMin: 1000, yMax: 2000, maxKm: 100 }

describe('profile-print-geometry', () => {
  it('xOf cale 0 km à gauche et maxKm à droite', () => {
    expect(xOf(G, 0)).toBeCloseTo(50, 3)
    expect(xOf(G, 100)).toBeCloseTo(890, 3) // W - padR
    expect(xOf(G, 50)).toBeCloseTo(470, 3)
  })

  it('yOf cale yMin au bas du plot et yMax en haut', () => {
    expect(yOf(G, 1000)).toBeCloseTo(220, 3) // plotTop + plotH
    expect(yOf(G, 2000)).toBeCloseTo(20, 3)  // plotTop
  })

  it('buildLinePath commence par M et buildAreaPath se ferme par Z', () => {
    const profile = { d: [0, 50, 100], e: [1000, 1500, 2000] }
    expect(buildLinePath(G, profile).startsWith('M')).toBe(true)
    const area = buildAreaPath(G, profile)
    expect(area.startsWith('M')).toBe(true)
    expect(area.trimEnd().endsWith('Z')).toBe(true)
  })
})
