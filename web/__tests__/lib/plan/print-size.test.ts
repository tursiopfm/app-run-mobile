import {
  loadPrintSize, savePrintSize, PRINT_SIZE_DEFS, DEFAULT_PRINT_SIZE,
  fitIphoneScale, IPHONE_CARD_MM,
} from '@/lib/plan/print-size'

describe('print-size', () => {
  beforeEach(() => window.localStorage.clear())

  it('default is iphone when nothing stored', () => {
    expect(DEFAULT_PRINT_SIZE).toBe('iphone')
    expect(loadPrintSize()).toBe('iphone')
  })

  it('round-trips a saved size', () => {
    savePrintSize('a4')
    expect(loadPrintSize()).toBe('a4')
  })

  it('falls back to default on a corrupted value', () => {
    window.localStorage.setItem('tc:plan:print-size:v1', 'letter')
    expect(loadPrintSize()).toBe('iphone')
  })

  it('exposes coherent specs (scale ÷ 120mm width, 8mm margins)', () => {
    expect(PRINT_SIZE_DEFS.iphone.scale).toBe(1)
    expect(PRINT_SIZE_DEFS.iphone.pageRule).toContain('A4 portrait')
    expect(PRINT_SIZE_DEFS.a5.pageRule).toContain('A4 portrait')
    expect(PRINT_SIZE_DEFS.a4.pageRule).toContain('A4 landscape')
    expect(PRINT_SIZE_DEFS.a5.scale).toBeCloseTo(1.617, 2)
    expect(PRINT_SIZE_DEFS.a4.scale).toBeCloseTo(2.342, 2)
  })

  describe('fitIphoneScale', () => {
    it('remplit le dos du téléphone : c\'est la hauteur qui commande sur une course longue', () => {
      // 17 points ≈ 60 mm de haut → 66/60 = 1.1 (la largeur autoriserait 1.167).
      expect(fitIphoneScale(120, 60)).toBeCloseTo(1.1, 3)
      expect(120 * fitIphoneScale(120, 60)).toBeLessThanOrEqual(IPHONE_CARD_MM.w)
      expect(60 * fitIphoneScale(120, 60)).toBeCloseTo(IPHONE_CARD_MM.h, 1)
    })

    it('plafonne à la largeur quand la carte est courte', () => {
      // 6 points ≈ 30 mm : la hauteur autoriserait ×2,2, la largeur limite à 1,167.
      expect(fitIphoneScale(120, 30)).toBeCloseTo(1.167, 2)
      expect(120 * fitIphoneScale(120, 30)).toBeCloseTo(IPHONE_CARD_MM.w, 1)
    })

    it('ne réduit pas au-delà de 0,8 (illisible) sur une course très dense', () => {
      expect(fitIphoneScale(120, 200)).toBe(0.8)
    })

    it('renvoie 1 tant que rien n\'est mesuré', () => {
      expect(fitIphoneScale(0, 0)).toBe(1)
      expect(fitIphoneScale(120, 0)).toBe(1)
    })
  })
})
