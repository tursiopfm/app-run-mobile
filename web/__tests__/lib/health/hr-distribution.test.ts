import {
  estimateHrZoneDistribution,
  type HeartRateZoneDistributionResult,
} from '@/lib/health/hr-distribution'
import { calculateHrZones } from '@/lib/health/hr-zones'

const zones = calculateHrZones({ method: 'karvonen', maxHr: 195, restingHr: 57 }).zones

describe('estimateHrZoneDistribution — no HR data', () => {
  it('returns source=none and confidence=none when no HR', () => {
    const r = estimateHrZoneDistribution({ avgHr: null, maxHr: null, durationSec: 3600, zones })
    expect(r.source).toBe('none')
    expect(r.confidence).toBe('none')
    expect(r.zones).toHaveLength(0)
    expect(r.warnings).toContain('Pas de données FC disponibles.')
  })
})

describe('estimateHrZoneDistribution — avg+max estimate', () => {
  const r = estimateHrZoneDistribution({ avgHr: 155, maxHr: 175, durationSec: 3600, zones })

  it('source = avg_max_estimate', () => expect(r.source).toBe('avg_max_estimate'))
  it('confidence = low', () => expect(r.confidence).toBe('low'))
  it('has 5 zones', () => expect(r.zones).toHaveLength(5))
  it('all zones estimated = true', () => r.zones.forEach(z => expect(z.estimated).toBe(true)))
  it('zone percents sum to ~100', () => {
    const sum = r.zones.reduce((acc, z) => acc + z.percent, 0)
    expect(sum).toBeGreaterThanOrEqual(99)
    expect(sum).toBeLessThanOrEqual(101)
  })
  it('zone seconds sum to durationSec', () => {
    const sum = r.zones.reduce((acc, z) => acc + z.seconds, 0)
    expect(sum).toBe(3600)
  })
  it('includes fiability warning', () => {
    expect(r.warnings.some(w => w.includes('FC moyenne'))).toBe(true)
  })
  it('zone with avg_hr has highest share', () => {
    // avgHr=155 is in Z3 (155-167 in karvonen 195/57)
    const z3 = r.zones.find(z => z.zone === 3)!
    expect(z3.percent).toBeGreaterThan(20)
  })
})
