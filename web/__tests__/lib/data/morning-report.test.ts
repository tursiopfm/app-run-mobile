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
    mockCreateClient.mockResolvedValue({
      from: jest.fn().mockReturnValue({
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
  })

  it('retourne lastActivity null si aucune activité', async () => {
    mockCreateClient.mockResolvedValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }),
    })
    const data = await getMorningReportData('user-123')
    expect(data.lastActivity).toBeNull()
  })
})
