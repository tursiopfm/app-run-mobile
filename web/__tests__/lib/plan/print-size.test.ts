import {
  loadPrintSize, savePrintSize, PRINT_SIZE_DEFS, DEFAULT_PRINT_SIZE,
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
})
