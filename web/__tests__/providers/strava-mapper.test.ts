import { stravaToNormalized, type StravaActivity } from '@/lib/providers/strava/mapper'

const MOCK_STRAVA: StravaActivity = {
  id: 12345,
  name: 'Morning Trail Run',
  type: 'Run',
  sport_type: 'Run',
  start_date: '2026-05-02T07:00:00Z',
  start_date_local: '2026-05-02T09:00:00',
  moving_time: 3600,
  elapsed_time: 3700,
  distance: 15000,
  total_elevation_gain: 400,
  average_heartrate: 155,
  max_heartrate: 175,
  calories: 820,
}

describe('stravaToNormalized', () => {
  it('maps core fields correctly', () => {
    const result = stravaToNormalized('user-123', MOCK_STRAVA)
    expect(result.provider).toBe('strava')
    expect(result.providerActivityId).toBe('12345')
    expect(result.sportType).toBe('Run')
    expect(result.distanceM).toBe(15000)
    expect(result.durationSec).toBe(3700)
    expect(result.movingTimeSec).toBe(3600)
    expect(result.elevationGainM).toBe(400)
    expect(result.avgHr).toBe(155)
    expect(result.maxHr).toBe(175)
    expect(result.calories).toBe(820)
  })

  it('preserves raw payload', () => {
    const result = stravaToNormalized('user-123', MOCK_STRAVA)
    const raw = result.rawPayload as StravaActivity
    expect(raw.id).toBe(12345)
  })

  it('uses start_date_local when available', () => {
    const result = stravaToNormalized('user-123', MOCK_STRAVA)
    expect(result.startTime).toBe('2026-05-02T09:00:00')
  })

  it('falls back to start_date when no local date', () => {
    const a: StravaActivity = { ...MOCK_STRAVA, start_date_local: undefined }
    const result = stravaToNormalized('user-123', a)
    expect(result.startTime).toBe('2026-05-02T07:00:00Z')
  })
})
