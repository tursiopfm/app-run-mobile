import {
  xOf, yOf, buildLinePath, buildAreaPath, assignLevels, altitudeStep, type ProfileGeom,
} from '@/lib/plan/profile-print-geometry'

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

  describe('assignLevels', () => {
    it('garde tout sur le rang 0 quand rien ne se chevauche', () => {
      const items = [{ left: 0, right: 10 }, { left: 20, right: 30 }, { left: 40, right: 50 }]
      expect(assignLevels(items, 4)).toEqual([0, 0, 0])
    })

    it('ouvre autant de rangs que nécessaire et réutilise le plus haut disponible', () => {
      // 4 étiquettes empilées au même endroit → 4 rangs ; la 5e, à l'écart, retombe au rang 0.
      const items = [
        { left: 0, right: 10 }, { left: 1, right: 11 }, { left: 2, right: 12 }, { left: 3, right: 13 },
        { left: 100, right: 110 },
      ]
      expect(assignLevels(items, 4)).toEqual([0, 1, 2, 3, 0])
    })

    it('respecte l\'écart minimal demandé', () => {
      const items = [{ left: 0, right: 10 }, { left: 12, right: 22 }]
      expect(assignLevels(items, 4)).toEqual([0, 1])  // 12 < 10 + 4
      expect(assignLevels(items, 2)).toEqual([0, 0])  // 12 ≥ 10 + 2
    })
  })

  describe('altitudeStep', () => {
    it('choisit un pas qui laisse les étiquettes respirer', () => {
      // 120 unités de relief pour 2400 m de dénivelé : un pas de 200 m ne laisserait
      // que 10 unités entre deux étiquettes de 15 → il faut monter à 500 m.
      expect(altitudeStep(120, 2400, 15)).toBe(500)
      // Relief plus court (cas d'une carte dense) : le pas monte jusqu'à 1000 m.
      expect(altitudeStep(93, 2400, 15)).toBe(1000)
      // relief confortable et domaine étroit → le pas fin suffit.
      expect(altitudeStep(300, 400, 15)).toBe(100)
    })

    it('plafonne à 1000 m quand même le pas le plus large est serré', () => {
      expect(altitudeStep(20, 4000, 15)).toBe(1000)
    })
  })
})
