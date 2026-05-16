import { estimateCharge } from '@/lib/training/charge'

describe('estimateCharge', () => {
  it('60 min × intensité 3 sans D+ → 72', () => {
    // 60 * 1.2 * 1 = 72
    expect(estimateCharge(60, 3)).toBe(72)
  })

  it('90 min × intensité 4 avec 500 m D+ → ~174', () => {
    // 90 * 1.8 * (1 + 0.5 * 0.15) = 90 * 1.8 * 1.075 = 174.15 → round 174
    expect(estimateCharge(90, 4, 500)).toBe(174)
  })

  it('30 min × intensité 1 sans D+ → 15', () => {
    // 30 * 0.5 * 1 = 15
    expect(estimateCharge(30, 1, 0)).toBe(15)
  })

  it('traite elevation undefined comme 0', () => {
    expect(estimateCharge(60, 3, undefined)).toBe(estimateCharge(60, 3, 0))
  })

  it('intensité 5 (VMA) majore fortement', () => {
    // 30 * 2.5 * 1 = 75
    expect(estimateCharge(30, 5)).toBe(75)
  })

  it('D+ important augmente la charge', () => {
    // 60 * 1.2 * (1 + 1 * 0.15) = 60 * 1.2 * 1.15 = 82.8 → 83
    expect(estimateCharge(60, 3, 1000)).toBe(83)
  })
})
