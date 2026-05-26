import { getMorningReportData } from '@/lib/data/morning-report'
import { createClient } from '@/lib/database/supabase-server'

jest.mock('@/lib/database/supabase-server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/data/charge', () => ({
  getChargePageData: jest.fn().mockResolvedValue({
    perSport: {
      all: {
        dailyMetrics: Array.from({ length: 90 }, (_, i) => ({
          date: `2026-${String(Math.floor((90-i)/30)+3).padStart(2,'0')}-01`,
          atl: 50 + i*0.2, ctl: 40 + i*0.25, tsb: -2 + Math.sin(i)*3,
        })),
        insights: { status: 'balanced' },
      },
    },
    generatedAt: '2026-05-26T06:00:00Z',
  }),
}))

const mockCreateClient = createClient as jest.Mock

type Fixtures = {
  profile?:       { first_name: string | null } | null
  lastActivity?:  Record<string, unknown> | null
  monthRows?:     Record<string, unknown>[]
  weekRows?:      Record<string, unknown>[]
  todaySession?:  Record<string, unknown> | null
}

function makeClient(fix: Fixtures): unknown {
  let activitiesCall = 0
  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: fix.profile ?? null,
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'planned_sessions') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: fix.todaySession ? [fix.todaySession] : [],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'activities') {
        const idx = activitiesCall++
        if (idx === 0) {
          // last activity (yesterday): .eq.lt.order.limit
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                lt: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                      data: fix.lastActivity ? [fix.lastActivity] : [],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        if (idx === 1) {
          // monthly: .eq.gte
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockResolvedValue({
                  data: fix.monthRows ?? [],
                  error: null,
                }),
              }),
            }),
          }
        }
        if (idx === 2) {
          // weekly: .eq.gte
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                gte: jest.fn().mockResolvedValue({
                  data: fix.weekRows ?? [],
                  error: null,
                }),
              }),
            }),
          }
        }
        throw new Error('unexpected activities call ' + idx)
      }
      throw new Error('unexpected table: ' + table)
    }),
  }
}

describe('getMorningReportData', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('agrège charge + dernière activité (filtrée < aujourd\'hui)', async () => {
    mockCreateClient.mockResolvedValue(makeClient({
      profile: { first_name: 'Franck' },
      lastActivity: { id: 'a1', sport_type: 'Run', name: 'EF', start_time: '2026-05-25T17:00:00Z',
                      distance_m: 12000, moving_time_sec: 4500, elevation_gain_m: 85, avg_hr: 142, ces: 58 },
    }))

    const data = await getMorningReportData('user-123')
    expect(data.charge.perSport.all.dailyMetrics).toHaveLength(90)
    expect(data.firstName).toBe('Franck')
    expect(data.lastActivity?.id).toBe('a1')
    expect(data.lastActivity?.movingTimeSec).toBe(4500)
    expect(data.lastActivity?.sportType).toBe('Run')
    expect(data.lastActivity?.ces).toBe(58)
    expect(typeof data.generatedAt).toBe('string')
    expect(data.generatedAt.length).toBeGreaterThan(0)
    expect(data.monthlyVolume.km).toBe(0)
    expect(data.monthlyVolume.dPlus).toBe(0)
    expect(data.todaySession).toBeNull()
  })

  it('retourne lastActivity null si aucune activité', async () => {
    mockCreateClient.mockResolvedValue(makeClient({}))
    const data = await getMorningReportData('user-123')
    expect(data.lastActivity).toBeNull()
    expect(data.firstName).toBeNull()
  })

  it('agrège le volume du mois en cours (km + D+)', async () => {
    mockCreateClient.mockResolvedValue(makeClient({
      lastActivity: { id: 'a1', sport_type: 'Run', name: 'EF', start_time: '2026-05-25T17:00:00Z',
                      distance_m: 12000, moving_time_sec: 4500, elevation_gain_m: 85, avg_hr: 142, ces: 58 },
      monthRows: [
        { distance_m: 10000, elevation_gain_m: 200, manual_distance_m: null, manual_elevation_gain_m: null },
        { distance_m: 8000,  elevation_gain_m: 150, manual_distance_m: null, manual_elevation_gain_m: null },
        { distance_m: 15000, elevation_gain_m: 450, manual_distance_m: null, manual_elevation_gain_m: null },
      ],
    }))

    const data = await getMorningReportData('user-123')
    expect(data.monthlyVolume.km).toBe(33)
    expect(data.monthlyVolume.dPlus).toBe(800)
  })

  it('agrège le volume de la semaine + ventilation par jour', async () => {
    // Today's day-of-week is needed for assertions, but we just check totals here
    mockCreateClient.mockResolvedValue(makeClient({
      weekRows: [
        { start_time: '2026-05-25T07:00:00Z', distance_m: 5000,  elevation_gain_m: 50,  manual_distance_m: null, manual_elevation_gain_m: null },
        { start_time: '2026-05-26T07:00:00Z', distance_m: 10000, elevation_gain_m: 100, manual_distance_m: null, manual_elevation_gain_m: null },
      ],
    }))

    const data = await getMorningReportData('user-123')
    expect(data.weekVolume.km).toBe(15)
    expect(data.weekVolume.dPlus).toBe(150)
    expect(data.weekVolume.byDay).toHaveLength(7)
    expect(data.weekVolume.byDay.reduce((a, b) => a + b, 0)).toBeCloseTo(15, 1)
    expect(data.weekVolume.todayIdx).toBeGreaterThanOrEqual(0)
    expect(data.weekVolume.todayIdx).toBeLessThanOrEqual(6)
  })

  it('retourne todaySession quand une séance est planifiée pour aujourd\'hui', async () => {
    mockCreateClient.mockResolvedValue(makeClient({
      todaySession: {
        type: 'footing', title: 'Trail vallonné', duration_min: 60,
        distance_km: 10, elevation_m: 200, status: 'planned',
        created_at: '2026-05-24T18:34:31Z',
      },
    }))

    const data = await getMorningReportData('user-123')
    expect(data.todaySession).not.toBeNull()
    expect(data.todaySession?.title).toBe('Trail vallonné')
    expect(data.todaySession?.type).toBe('footing')
    expect(data.todaySession?.duration).toBe(60)
    expect(data.todaySession?.distance).toBe(10)
  })
})
