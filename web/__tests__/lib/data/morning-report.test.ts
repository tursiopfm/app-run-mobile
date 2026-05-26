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

describe('getMorningReportData', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('agrège charge + dernière activité', async () => {
    let activitiesCall = 0
    mockCreateClient.mockResolvedValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table !== 'activities') throw new Error(`unexpected table: ${table}`)
        const isLast = activitiesCall === 0
        activitiesCall++
        if (isLast) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: [{ id: 'a1', sport_type: 'Run', name: 'EF', start_time: '2026-05-25T17:00:00Z',
                             distance_m: 12000, moving_time_sec: 4500, elevation_gain_m: 85,
                             avg_hr: 142, ces: 58 }],
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        // monthly query
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }
      }),
    })

    const data = await getMorningReportData('user-123')
    expect(data.charge.perSport.all.dailyMetrics).toHaveLength(90)
    expect(data.lastActivity?.id).toBe('a1')
    expect(data.lastActivity?.movingTimeSec).toBe(4500)
    expect(data.lastActivity?.sportType).toBe('Run')
    expect(data.lastActivity?.ces).toBe(58)
    expect(typeof data.generatedAt).toBe('string')
    expect(data.generatedAt.length).toBeGreaterThan(0)
    expect(data.monthlyVolume.km).toBe(0)
    expect(data.monthlyVolume.dPlus).toBe(0)
  })

  it('retourne lastActivity null si aucune activité', async () => {
    let activitiesCall = 0
    mockCreateClient.mockResolvedValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table !== 'activities') throw new Error(`unexpected table: ${table}`)
        const isLast = activitiesCall === 0
        activitiesCall++
        if (isLast) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }
        }
        // monthly query
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }
      }),
    })
    const data = await getMorningReportData('user-123')
    expect(data.lastActivity).toBeNull()
  })

  it('agrège le volume du mois en cours (km + D+)', async () => {
    let activitiesCall = 0
    mockCreateClient.mockResolvedValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table !== 'activities') throw new Error(`unexpected table: ${table}`)
        const isLast = activitiesCall === 0
        activitiesCall++
        if (isLast) {
          // chain: .select(...).eq(...).order(...).limit(...) → 1 row
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: [{ id: 'a1', sport_type: 'Run', name: 'EF', start_time: '2026-05-25T17:00:00Z',
                             distance_m: 12000, moving_time_sec: 4500, elevation_gain_m: 85,
                             avg_hr: 142, ces: 58 }],
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        // monthly query: .select(...).eq(...).gte(...) → 3 rows
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockResolvedValue({
                data: [
                  { distance_m: 10000, elevation_gain_m: 200, manual_distance_m: null, manual_elevation_gain_m: null },
                  { distance_m: 8000,  elevation_gain_m: 150, manual_distance_m: null, manual_elevation_gain_m: null },
                  { distance_m: 15000, elevation_gain_m: 450, manual_distance_m: null, manual_elevation_gain_m: null },
                ],
                error: null,
              }),
            }),
          }),
        }
      }),
    })

    const data = await getMorningReportData('user-123')
    expect(data.monthlyVolume.km).toBe(33)       // (10+8+15) km, arrondi
    expect(data.monthlyVolume.dPlus).toBe(800)   // (200+150+450) m D+
  })
})
