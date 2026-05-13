import { kpiStatusFatigue, kpiStatusFitness, kpiStatusFreshness } from '@/lib/analytics/charge-kpi-status'

describe('kpiStatusFatigue', () => {
  it('returns "high" when atl > 1.15 * ctl', () => {
    expect(kpiStatusFatigue(120, 100).id).toBe('high')
  })

  it('returns "low" when atl < 0.85 * ctl', () => {
    expect(kpiStatusFatigue(80, 100).id).toBe('low')
  })

  it('returns "usual" when atl is close to ctl', () => {
    expect(kpiStatusFatigue(100, 100).id).toBe('usual')
    expect(kpiStatusFatigue(110, 100).id).toBe('usual')
    expect(kpiStatusFatigue(90,  100).id).toBe('usual')
  })

  it('falls back to "usual" when ctl is 0 (no division)', () => {
    expect(kpiStatusFatigue(50, 0).id).toBe('usual')
  })
})

describe('kpiStatusFitness', () => {
  it('returns "building" below 20', () => {
    expect(kpiStatusFitness(10).id).toBe('building')
    expect(kpiStatusFitness(19.9).id).toBe('building')
  })

  it('returns "progressing" between 20 and 40', () => {
    expect(kpiStatusFitness(20).id).toBe('progressing')
    expect(kpiStatusFitness(39).id).toBe('progressing')
  })

  it('returns "solid" between 40 and 60', () => {
    expect(kpiStatusFitness(40).id).toBe('solid')
    expect(kpiStatusFitness(59).id).toBe('solid')
  })

  it('returns "very-solid" at 60 and above', () => {
    expect(kpiStatusFitness(60).id).toBe('very-solid')
    expect(kpiStatusFitness(90).id).toBe('very-solid')
  })
})

describe('kpiStatusFreshness', () => {
  it('returns "very-fresh" when tsb >= 15', () => {
    expect(kpiStatusFreshness(20).id).toBe('very-fresh')
    expect(kpiStatusFreshness(15).id).toBe('very-fresh')
  })

  it('returns "fresh" when 5 <= tsb < 15', () => {
    expect(kpiStatusFreshness(10).id).toBe('fresh')
    expect(kpiStatusFreshness(5).id).toBe('fresh')
  })

  it('returns "balanced" when -10 < tsb < 5', () => {
    expect(kpiStatusFreshness(0).id).toBe('balanced')
    expect(kpiStatusFreshness(-9).id).toBe('balanced')
  })

  it('returns "normal-fatigue" when -25 < tsb <= -10', () => {
    expect(kpiStatusFreshness(-10).id).toBe('normal-fatigue')
    expect(kpiStatusFreshness(-13).id).toBe('normal-fatigue')
    expect(kpiStatusFreshness(-24).id).toBe('normal-fatigue')
  })

  it('returns "high-fatigue" when tsb <= -25', () => {
    expect(kpiStatusFreshness(-25).id).toBe('high-fatigue')
    expect(kpiStatusFreshness(-40).id).toBe('high-fatigue')
  })
})
