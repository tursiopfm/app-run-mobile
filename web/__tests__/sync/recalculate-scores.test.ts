import { recalculateUserEffortScores } from '@/lib/sync/recalculate-scores'
import { packStreams } from '@/lib/providers/strava/streams'

const trailStreams = packStreams({
  time:      Array.from({ length: 1300 }, (_, i) => i),
  altitude:  Array.from({ length: 1300 }, (_, i) => (i < 650 ? i * 0.2 : 130 - (i - 650) * 0.2)),
  velocity:  Array.from({ length: 1300 }, () => 2.5),
  grade:     Array.from({ length: 1300 }, (_, i) => (i < 650 ? 8 : -8)),
  heartrate: Array.from({ length: 1300 }, (_, i) => (i < 650 ? 150 : 158)),
})

const captured: Record<string, Array<Record<string, unknown>>> = {}

jest.mock('@/lib/database/supabase-server', () => ({
  createServiceClient: () => ({
    from: (name: string) => {
      if (name === 'profiles') return {
        select: () => ({ eq: () => ({ single: async () => ({ data: { max_hr: 195, resting_hr: 54, threshold_pace_trail_sec_per_km: null } }) }) }),
      }
      if (name === 'activities') return {
        select: () => ({ eq: async () => ({ data: [{ id: 'a1', sport_type: 'TrailRun', name: 'Trail', start_time: '2026-06-01', duration_sec: 1300, moving_time_sec: 1300, distance_m: 9000, elevation_gain_m: 520, avg_hr: 154, max_hr: 170, avg_power: null }] }) }),
        upsert: async (rows: Array<Record<string, unknown>>) => { captured.activities = rows; return { error: null } },
      }
      if (name === 'activity_streams') return {
        select: () => ({ eq: async () => ({ data: [{ activity_id: 'a1', streams_gz: trailStreams }] }) }),
      }
      if (name === 'activity_metrics') return {
        upsert: async (rows: Array<Record<string, unknown>>) => { captured.activity_metrics = rows; return { error: null } },
      }
      return {}
    },
  }),
}))

describe('recalculateUserEffortScores avec streams', () => {
  it('applique SP-2 et écrit les métriques de streams', async () => {
    const r = await recalculateUserEffortScores('u1')
    expect(r.recalculated).toBe(1)
    const keys = captured.activity_metrics.map(m => m.metric_key as string)
    expect(keys).toEqual(expect.arrayContaining(['grade_adjusted_pace_s', 'decoupling_pct', 'elevation_loss_m', 'cardio_load', 'muscle_load', 'intensity_factor']))
    expect(Number(captured.activities[0].ces)).toBeGreaterThan(0)
  })
})
