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
