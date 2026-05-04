import { getDashboardData } from '@/lib/data/dashboard'
import { createClient } from '@/lib/database/supabase-server'

jest.mock('@/lib/database/supabase-server', () => ({ createClient: jest.fn() }))
const mockCreateClient = createClient as jest.Mock

function makeSelectMock(rows: unknown[]) {
  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: rows, error: null }),
          }),
        }),
      }),
    }),
  }
}

beforeEach(() => jest.clearAllMocks())

describe('getDashboardData', () => {
  it('returns 60 daily metrics (all zeros) when no activities', async () => {
    mockCreateClient.mockResolvedValue(makeSelectMock([]))
    const result = await getDashboardData('user-1')
    expect(result.hasActivities).toBe(false)
    expect(result.recentActivities).toHaveLength(0)
    expect(result.dailyMetrics).toHaveLength(60)
    expect(result.dailyMetrics.every((m) => m.atl === 0 && m.ctl === 0)).toBe(true)
  })

  it('computes non-zero ATL from a recent activity', async () => {
    const today = new Date().toISOString()
    mockCreateClient.mockResolvedValue(makeSelectMock([
      { id: '1', sport_type: 'Run', name: 'Run', start_time: today,
        ces: 60, distance_m: 10000, elevation_gain_m: 100, moving_time_sec: 3600 },
    ]))
    const result = await getDashboardData('user-1')
    expect(result.hasActivities).toBe(true)
    expect(result.recentActivities).toHaveLength(1)
    const latest = result.dailyMetrics[result.dailyMetrics.length - 1]
    expect(latest.atl).toBeGreaterThan(0)
  })

  it('returns sportOverviews for all sport keys', async () => {
    mockCreateClient.mockResolvedValue(makeSelectMock([]))
    const result = await getDashboardData('user-1')
    expect(result.sportOverviews).toBeDefined()
    expect(result.sportOverviews.run).toBeDefined()
    expect(result.sportOverviews.ride).toBeDefined()
    expect(result.sportOverviews.swim).toBeDefined()
    expect(result.sportOverviews.all).toBeDefined()
  })

  it('filters weekSessions by sport type in sportOverviews', async () => {
    const today = new Date().toISOString()
    mockCreateClient.mockResolvedValue(makeSelectMock([
      { id: '1', sport_type: 'Run',  name: 'Run',  start_time: today,
        ces: 60, distance_m: 10000, elevation_gain_m: 100, moving_time_sec: 3600 },
      { id: '2', sport_type: 'Ride', name: 'Ride', start_time: today,
        ces: 40, distance_m: 20000, elevation_gain_m: 200, moving_time_sec: 3600 },
    ]))
    const result = await getDashboardData('user-1')
    expect(result.sportOverviews.run.weekSessions).toBe(1)
    expect(result.sportOverviews.ride.weekSessions).toBe(1)
    expect(result.sportOverviews.swim.weekSessions).toBe(0)
    expect(result.sportOverviews.all.weekSessions).toBe(2)
  })

  it('sportOverviews.run.weekKm sums only Run/TrailRun distance', async () => {
    const today = new Date().toISOString()
    mockCreateClient.mockResolvedValue(makeSelectMock([
      { id: '1', sport_type: 'Run',  name: 'Run',  start_time: today,
        ces: 60, distance_m: 10000, elevation_gain_m: 0, moving_time_sec: 3600 },
      { id: '2', sport_type: 'Ride', name: 'Ride', start_time: today,
        ces: 40, distance_m: 30000, elevation_gain_m: 0, moving_time_sec: 3600 },
    ]))
    const result = await getDashboardData('user-1')
    expect(result.sportOverviews.run.weekKm).toBeCloseTo(10, 1)
    expect(result.sportOverviews.all.weekKm).toBeCloseTo(40, 1)
  })
})
