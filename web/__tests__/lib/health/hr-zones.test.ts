import { calculateHrZones, hrZoneForAvgHr } from '@/lib/health/hr-zones'

describe('hrZoneForAvgHr', () => {
  const zones = calculateHrZones({ method: 'karvonen', maxHr: 195, restingHr: 57 }).zones
  // reserve=138 → t(0.60)=140, t(0.70)=154, t(0.80)=167, t(0.90)=181
  // Z1: null–140, Z2: 141–154, Z3: 155–167, Z4: 168–181, Z5: 182–195

  it('returns null for empty zones array', () => {
    expect(hrZoneForAvgHr(150, [])).toBeNull()
  })

  it('returns 1 for avg_hr at or below Z1 max', () => {
    expect(hrZoneForAvgHr(100, zones)).toBe(1)
    expect(hrZoneForAvgHr(140, zones)).toBe(1)
  })

  it('returns 2 for avg_hr in Z2', () => {
    expect(hrZoneForAvgHr(141, zones)).toBe(2)
    expect(hrZoneForAvgHr(154, zones)).toBe(2)
  })

  it('returns 3 for avg_hr in Z3', () => {
    expect(hrZoneForAvgHr(155, zones)).toBe(3)
    expect(hrZoneForAvgHr(167, zones)).toBe(3)
  })

  it('returns 4 for avg_hr in Z4', () => {
    expect(hrZoneForAvgHr(168, zones)).toBe(4)
    expect(hrZoneForAvgHr(181, zones)).toBe(4)
  })

  it('returns 5 for avg_hr in Z5 or above max', () => {
    expect(hrZoneForAvgHr(182, zones)).toBe(5)
    expect(hrZoneForAvgHr(195, zones)).toBe(5)
    expect(hrZoneForAvgHr(210, zones)).toBe(5)
  })
})
