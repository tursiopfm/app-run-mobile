import { calculateHrZones, computeZoneTimesFromStream, hrZoneForAvgHr, getRecommendedHeartRateZoneMode } from '@/lib/health/hr-zones'

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

describe('zone names', () => {
  it('correct for all 5 zones', () => {
    const { zones } = calculateHrZones({ method: 'pct_max', maxHr: 195 })
    expect(zones[0].name).toBe('Récupération')
    expect(zones[1].name).toBe('Endurance fondamentale')
    expect(zones[2].name).toBe('Endurance active')
    expect(zones[3].name).toBe('Seuil')
    expect(zones[4].name).toBe('Très intense')
  })
})

describe('pct_max FCmax 195 — no overlap', () => {
  const { zones } = calculateHrZones({ method: 'pct_max', maxHr: 195 })
  it('Z1 max = 140', () => expect(zones[0].max).toBe(140))
  it('Z2 min = 141, max = 152', () => { expect(zones[1].min).toBe(141); expect(zones[1].max).toBe(152) })
  it('Z3 min = 153, max = 166', () => { expect(zones[2].min).toBe(153); expect(zones[2].max).toBe(166) })
  it('Z4 min = 167, max = 179', () => { expect(zones[3].min).toBe(167); expect(zones[3].max).toBe(179) })
  it('Z5 min = 180, max = 195', () => { expect(zones[4].min).toBe(180); expect(zones[4].max).toBe(195) })
  it('no overlap between any zones', () => {
    for (let i = 1; i < zones.length; i++) {
      expect(zones[i].min).toBe((zones[i - 1].max as number) + 1)
    }
  })
})

describe('karvonen FCmax 195 FCrepos 57 — no overlap', () => {
  const { zones } = calculateHrZones({ method: 'karvonen', maxHr: 195, restingHr: 57 })
  it('Z1 max = 140', () => expect(zones[0].max).toBe(140))
  it('Z2 min = 141, max = 154', () => { expect(zones[1].min).toBe(141); expect(zones[1].max).toBe(154) })
  it('Z3 min = 155, max = 167', () => { expect(zones[2].min).toBe(155); expect(zones[2].max).toBe(167) })
  it('Z4 min = 168, max = 181', () => { expect(zones[3].min).toBe(168); expect(zones[3].max).toBe(181) })
  it('Z5 min = 182, max = 195', () => { expect(zones[4].min).toBe(182); expect(zones[4].max).toBe(195) })
  it('no overlap between any zones', () => {
    for (let i = 1; i < zones.length; i++) {
      expect(zones[i].min).toBe((zones[i - 1].max as number) + 1)
    }
  })
})

describe('getRecommendedHeartRateZoneMode', () => {
  it('seuils / high when max + aerobic + threshold available', () => {
    const r = getRecommendedHeartRateZoneMode({ max_hr: 195, aerobic_threshold_hr: 155, threshold_hr: 170 })
    expect(r.mode).toBe('seuils')
    expect(r.confidence).toBe('high')
    expect(r.canCompute).toBe(true)
  })

  it('test30 / good when max + threshold only', () => {
    const r = getRecommendedHeartRateZoneMode({ max_hr: 195, threshold_hr: 170 })
    expect(r.mode).toBe('test30')
    expect(r.confidence).toBe('good')
  })

  it('karvonen / medium when max + resting only', () => {
    const r = getRecommendedHeartRateZoneMode({ max_hr: 195, resting_hr: 57 })
    expect(r.mode).toBe('karvonen')
    expect(r.confidence).toBe('medium')
  })

  it('pct_max / low when max only', () => {
    const r = getRecommendedHeartRateZoneMode({ max_hr: 195 })
    expect(r.mode).toBe('pct_max')
    expect(r.confidence).toBe('low')
  })

  it('auto / very_low when only birth_year', () => {
    const r = getRecommendedHeartRateZoneMode({ birth_year: 1985 })
    expect(r.mode).toBe('auto')
    expect(r.confidence).toBe('very_low')
    expect(r.canCompute).toBe(true)
  })

  it('canCompute = false when nothing available', () => {
    const r = getRecommendedHeartRateZoneMode({})
    expect(r.canCompute).toBe(false)
  })

  it('prefers karvonen over pct_max when resting_hr present (no threshold)', () => {
    const r = getRecommendedHeartRateZoneMode({ max_hr: 195, resting_hr: 57 })
    expect(r.mode).toBe('karvonen')
    expect(r.mode).not.toBe('pct_max')
  })
})

describe('computeZoneTimesFromStream', () => {
  const zones = calculateHrZones({ method: 'pct_max', maxHr: 195 }).zones
  // Z1: null–140, Z2: 141–152, Z3: 153–166, Z4: 167–179, Z5: 180–195

  it('counts time in correct zones', () => {
    const hr   = [120, 120, 145, 160, 175, 185]
    const time = [  0,  10,  20,  30,  40,  50]
    const result = computeZoneTimesFromStream(zones, hr, time)
    expect(result).toEqual([20, 10, 10, 10, 0])
    // 0-10: hr=120 → Z1, 10-20: hr=120 → Z1, 20-30: hr=145 → Z2,
    // 30-40: hr=160 → Z3, 40-50: hr=175 → Z4, last point has no duration
  })

  it('returns zeros for empty stream', () => {
    expect(computeZoneTimesFromStream(zones, [], [])).toEqual([0, 0, 0, 0, 0])
  })

  it('handles single-point stream', () => {
    expect(computeZoneTimesFromStream(zones, [150], [0])).toEqual([0, 0, 0, 0, 0])
  })

  it('total matches stream duration', () => {
    const hr   = [130, 130, 155, 170]
    const time = [  0,  30,  60,  90]
    const result = computeZoneTimesFromStream(zones, hr, time)
    expect(result.reduce((a, b) => a + b, 0)).toBe(90)
  })
})

describe('méthode deduced', () => {
  it('utilise la FC repos déduite → réserve FC (Karvonen)', () => {
    const result = calculateHrZones({
      method: 'deduced',
      maxHr: 192,
      restingHr: 54,
    })
    expect(result.zones.length).toBe(5)
    expect(result.confidence).toBe('Adaptative')
    expect(result.maxHrUsed).toBe(192)
  })

  it('sans FC repos mais avec LTHR déduite → ancrage LTHR', () => {
    // max 199, lthr 162 → maxes [138,144,152,160,199]
    const result = calculateHrZones({ method: 'deduced', maxHr: 199, thresholdHr: 162 })
    expect(result.zones.length).toBe(5)
    expect(result.zones[0].max).toBe(138)
    expect(result.zones[4].max).toBe(199)
    expect(result.missing).toHaveLength(0)
  })

  it('avec seulement la FC max → repli % FC max', () => {
    const result = calculateHrZones({ method: 'deduced', maxHr: 199 })
    expect(result.zones.length).toBe(5)
    expect(result.zones[4].max).toBe(199)
    expect(result.missing).toHaveLength(0)
  })

  it('signale uniquement la FC max manquante quand rien n\'est déduit', () => {
    const result = calculateHrZones({ method: 'deduced' })
    expect(result.zones.length).toBe(0)
    expect(result.missing).toContain('FC max observée')
  })
})
