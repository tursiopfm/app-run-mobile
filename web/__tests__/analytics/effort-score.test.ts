import { computeCes, computeCesResult, normalizeSportType, type ActivityInput } from '@/lib/analytics/effort-score'

const BASE_RUN: ActivityInput = {
  id: '1',
  rawSportType: 'Run',
  name: 'Morning Run',
  startDate: '2026-05-02',
  movingTimeSeconds: 3600,
  distanceMeters: 12000,
  elevationGainMeters: 0,
}

describe('normalizeSportType', () => {
  it('maps Run → run',          () => expect(normalizeSportType('Run')).toBe('run'))
  it('maps TrailRun → trail_run',() => expect(normalizeSportType('TrailRun')).toBe('trail_run'))
  it('maps VirtualRide → indoor_ride', () => expect(normalizeSportType('VirtualRide')).toBe('indoor_ride'))
  it('maps Swim → swim',         () => expect(normalizeSportType('Swim')).toBe('swim'))
  it('maps unknown → other',     () => expect(normalizeSportType('WeirdSport')).toBe('other'))
  it('uses name for trail hint', () => expect(normalizeSportType('Run', 'Trail du matin')).toBe('trail_run'))
})

describe('computeCes', () => {
  it('returns positive score for a 1-hour run at threshold pace', () => {
    const ces = computeCes({ ...BASE_RUN, movingTimeSeconds: 3600, distanceMeters: 12000 })
    expect(ces).toBeGreaterThan(50)
    expect(ces).toBeLessThan(200)
  })

  it('longer activity has higher CES than shorter', () => {
    const short = computeCes({ ...BASE_RUN, movingTimeSeconds: 1800, distanceMeters: 6000 })
    const long  = computeCes({ ...BASE_RUN, movingTimeSeconds: 7200, distanceMeters: 24000 })
    expect(long).toBeGreaterThan(short)
  })

  it('elevation increases CES for trail', () => {
    const flat  = computeCes({ ...BASE_RUN, rawSportType: 'TrailRun', elevationGainMeters: 0 })
    const hilly = computeCes({ ...BASE_RUN, rawSportType: 'TrailRun', elevationGainMeters: 1000 })
    expect(hilly).toBeGreaterThan(flat)
  })

  it('returns > 0 for minimal activity', () => {
    expect(computeCes({ ...BASE_RUN, movingTimeSeconds: 300, distanceMeters: 1000 })).toBeGreaterThan(0)
  })
})

describe('computeCesResult', () => {
  it('returns a label', () => {
    const r = computeCesResult(BASE_RUN)
    expect(['recovery','endurance','steady','intense','very_hard','extreme']).toContain(r.label)
  })

  it('cardioLoad and muscleLoad are positive', () => {
    const r = computeCesResult(BASE_RUN)
    expect(r.cardioLoad).toBeGreaterThan(0)
    expect(r.muscleLoad).toBeGreaterThan(0)
  })
})

describe('CES GAP-IF (streams présents)', () => {
  const trail = {
    id: 't1', rawSportType: 'TrailRun', name: 'Côte', startDate: '2026-06-03T07:00:00Z',
    movingTimeSeconds: 7307, distanceMeters: 9300, elevationGainMeters: 1003, averageHeartrate: 139,
  }
  it('utilise grade_adjusted_pace_s pour l\'IF et neutralise le FacteurDénivelé', () => {
    const r = computeCesResult(trail, {}, { gradeAdjustedPaceS: 488 })
    expect(r.model).toBe('pace_gap')
    expect(r.intensityFactor).toBeGreaterThan(0.6)
    expect(r.intensityFactor).toBeLessThan(0.75)
    expect(r.components.elevationFactor).toBe(1)
  })
  it('sans streams, retombe sur l\'allure moyenne (model pace_threshold) + FacteurDénivelé', () => {
    const r = computeCesResult(trail, {})
    expect(r.model).toBe('pace_threshold')
    expect(r.components.elevationFactor).toBeGreaterThan(1)
  })
})

describe('CES K_cardio (découplage)', () => {
  const trail = {
    id: 't2', rawSportType: 'TrailRun', name: 'Boucle', startDate: '2026-05-30T07:00:00Z',
    movingTimeSeconds: 19701, distanceMeters: 42900, elevationGainMeters: 267, averageHeartrate: 135,
  }
  it('un découplage positif gonfle le CES de façon bornée', () => {
    const base = computeCesResult(trail, {}, { gradeAdjustedPaceS: 474 })
    const drift = computeCesResult(trail, {}, { gradeAdjustedPaceS: 474, decouplingPct: 8.6 })
    expect(drift.ces).toBeGreaterThan(base.ces)
    expect(drift.ces / base.ces).toBeLessThan(1.16)
  })
  it('un découplage ≤ 0 ne pénalise pas (K_cardio = 1)', () => {
    const neg = computeCesResult(trail, {}, { gradeAdjustedPaceS: 474, decouplingPct: -20 })
    const none = computeCesResult(trail, {}, { gradeAdjustedPaceS: 474 })
    expect(neg.ces).toBe(none.ces)
  })
})

describe('CES v2 — profile-aware', () => {
  const BASE_RUN: ActivityInput = {
    id: '1', rawSportType: 'Run', name: 'Run', startDate: '2026-05-08',
    movingTimeSeconds: 3600, distanceMeters: 12000, elevationGainMeters: 0,
  }

  it('1h run flat at threshold pace → CES ≈ 100 (±5)', () => {
    // threshold_pace = 300 s/km, distance at 300s/km for 1h = 12000m
    const profile = { threshold_pace_run_sec_per_km: 300 }
    const r = computeCesResult(BASE_RUN, profile)
    expect(r.ces).toBeGreaterThanOrEqual(95)
    expect(r.ces).toBeLessThanOrEqual(105)
  })

  it('uses user ftp_watts for cycling (not default 220W)', () => {
    const activity: ActivityInput = {
      id: '2', rawSportType: 'Ride', name: 'Ride', startDate: '2026-05-08',
      movingTimeSeconds: 3600, averageWatts: 200, elevationGainMeters: 0,
    }
    const withUserFtp    = computeCesResult(activity, { ftp_watts: 200 })
    const withDefaultFtp = computeCesResult(activity)
    // At 200W with ftp=200: IF=1.0 (full threshold). With default 220W: IF≈0.91
    expect(withUserFtp.ces).toBeGreaterThan(withDefaultFtp.ces)
    expect(withUserFtp.components.thresholdSource).toContain('utilisateur')
  })

  it('run without user threshold_pace produces warning', () => {
    const r = computeCesResult(BASE_RUN)
    expect(r.warnings.some(w => w.includes('allure seuil'))).toBe(true)
    expect(r.confidence).toBe('low')
  })

  it('run with user threshold_pace has higher confidence', () => {
    const r = computeCesResult(BASE_RUN, { threshold_pace_run_sec_per_km: 300 })
    expect(r.confidence).toBe('high')
    expect(r.warnings.filter(w => w.includes('allure seuil'))).toHaveLength(0)
  })

  it('trail with D+ — confidence ≤ medium + descent warning', () => {
    const trail: ActivityInput = {
      id: '3', rawSportType: 'TrailRun', name: 'Trail', startDate: '2026-05-08',
      movingTimeSeconds: 7200, distanceMeters: 20000, elevationGainMeters: 1000,
    }
    const r = computeCesResult(trail, { threshold_pace_trail_sec_per_km: 360 })
    expect(['medium', 'low']).toContain(r.confidence)
    expect(r.warnings.some(w => w.includes('D+'))).toBe(true)
  })

  it('result includes version string', () => {
    const r = computeCesResult(BASE_RUN)
    expect(typeof r.version).toBe('string')
    expect(r.version.startsWith('v')).toBe(true)
  })

  it('result includes model field', () => {
    const r = computeCesResult(BASE_RUN, { threshold_pace_run_sec_per_km: 300 })
    expect(['power', 'pace_threshold', 'pace_effort_distance', 'hr_proxy', 'legacy']).toContain(r.model)
  })

  it('components includes durationHours and elevationFactor', () => {
    const r = computeCesResult(BASE_RUN, { threshold_pace_run_sec_per_km: 300 })
    expect(r.components.durationHours).toBeCloseTo(1.0, 1)
    expect(r.components.elevationFactor).toBe(1.0)
  })
})
