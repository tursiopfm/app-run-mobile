import { getDashboardData } from '@/lib/data/dashboard'
import { createClient } from '@/lib/database/supabase-server'

jest.mock('@/lib/database/supabase-server', () => ({ createClient: jest.fn() }))
const mockCreateClient = createClient as jest.Mock

function makeSelectMock(rows: unknown[], dailyTotals?: { d: string; s: string; km: number; dp: number }[]) {
  const orderRange = (data: unknown[]) => ({
    order: jest.fn().mockReturnValue({
      range: jest.fn().mockImplementation((from: number) =>
        Promise.resolve({ data: from === 0 ? data : [], error: null }),
      ),
    }),
  })
  const activitiesChain = {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        // Single-shot query: rows (last 365d) — chain ends at .order(...)
        gte: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: rows, error: null }),
          }),
        }),
        // Paginated query: full history — chain is .is().order().range(...)
        is: jest.fn().mockReturnValue(orderRange(rows as unknown[])),
      }),
    }),
  }
  const profileChain = {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  }
  return {
    from: jest.fn().mockImplementation((table: string) =>
      table === 'profiles' ? profileChain : activitiesChain
    ),
    // activity_daily_totals (migration 048) : Postgres agrège désormais l'historique
    // par (jour, sport). On reproduit cette agrégation depuis les mêmes lignes.
    // Comme PostgREST, sans .range() la réponse est plafonnée à 1000 lignes.
    rpc: jest.fn().mockImplementation(() => {
      const all = dailyTotals ?? toDailyTotals(rows)
      const chain = {
        then: (resolve: (v: unknown) => unknown) => resolve({ data: all.slice(0, 1000), error: null }),
        order: () => chain,
        range: (from: number, to: number) =>
          Promise.resolve({ data: all.slice(from, Math.min(to + 1, from + 1000)), error: null }),
      }
      return chain
    }),
  }
}

type Row = {
  start_time?: string
  sport_type?: string
  manual_sport_type?: string | null
  distance_m?: number | null
  manual_distance_m?: number | null
  elevation_gain_m?: number | null
  manual_elevation_gain_m?: number | null
}

function toDailyTotals(rows: unknown[]) {
  const acc = new Map<string, { d: string; s: string; km: number; dp: number }>()
  for (const raw of rows as Row[]) {
    if (!raw.start_time) continue
    const d = String(raw.start_time).slice(0, 10)
    const s = raw.manual_sport_type ?? raw.sport_type ?? ''
    const key = `${d}|${s}`
    const cur = acc.get(key) ?? { d, s, km: 0, dp: 0 }
    cur.km += (raw.manual_distance_m ?? raw.distance_m ?? 0) / 1000
    cur.dp += raw.manual_elevation_gain_m ?? raw.elevation_gain_m ?? 0
    acc.set(key, cur)
  }
  return Array.from(acc.values()).sort((a, b) => a.d.localeCompare(b.d))
}

beforeEach(() => jest.clearAllMocks())

describe('getDashboardData', () => {
  it('returns 90 daily metrics (all zeros) when no activities', async () => {
    mockCreateClient.mockResolvedValue(makeSelectMock([]))
    const result = await getDashboardData('user-1')
    expect(result.hasActivities).toBe(false)
    expect(result.recentActivities).toHaveLength(0)
    expect(result.dailyMetrics).toHaveLength(90)
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
    expect(result.sportOverviews.walk).toBeDefined()
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

  it('groups Walk and Hike into sportOverviews.walk (and into all, not run)', async () => {
    const today = new Date().toISOString()
    mockCreateClient.mockResolvedValue(makeSelectMock([
      { id: '1', sport_type: 'Walk', name: 'Marche', start_time: today,
        ces: 10, distance_m: 5000,  elevation_gain_m: 50,  moving_time_sec: 3600 },
      { id: '2', sport_type: 'Hike', name: 'Rando',  start_time: today,
        ces: 30, distance_m: 12000, elevation_gain_m: 800, moving_time_sec: 7200 },
    ]))
    const result = await getDashboardData('user-1')
    expect(result.sportOverviews.walk.weekSessions).toBe(2)
    expect(result.sportOverviews.walk.weekKm).toBeCloseTo(17, 1)
    expect(result.sportOverviews.run.weekSessions).toBe(0)
    expect(result.sportOverviews.all.weekSessions).toBe(2)
  })

  it('dailyHistory includes recent days beyond the 1000-row PostgREST cap', async () => {
    // 2500 jours consécutifs finissant le 2026-09-15 : les plus récents sont au-delà de 1000.
    const totals = Array.from({ length: 2500 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 8, 15) - (2499 - i) * 86_400_000).toISOString().slice(0, 10)
      return { d, s: 'Run', km: 5, dp: 50 }
    })
    mockCreateClient.mockResolvedValue(makeSelectMock([], totals))
    const result = await getDashboardData('user-1')
    const history = result.sportOverviews.run.dailyHistory
    expect(history).toHaveLength(2500)
    expect(history.some((h) => h.date === '2026-09-15')).toBe(true)
  })
})
