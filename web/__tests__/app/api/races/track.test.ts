/** @jest-environment node */
import { POST } from '@/app/api/races/[id]/track/route'

const mockGetUser = jest.fn()
const mockSingle = jest.fn()
const mockMaybeSingle = jest.fn()
const mockUpsert = jest.fn().mockResolvedValue({ error: null })

jest.mock('@/lib/database/supabase-server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === 'races') return {
        select: () => ({ eq: () => ({ eq: () => ({ single: mockSingle }) }) }),
      }
      if (table === 'race_tableau_meta') return {
        select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
      }
      // race_tracks
      return {
        upsert: mockUpsert,
        select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
      }
    },
  }),
}))

const makeReq = (body: any) =>
  ({ json: async () => body } as unknown as Request)

beforeEach(() => {
  jest.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  mockSingle.mockResolvedValue({ data: { id: 'r1', distance_km: 42 } })
})

const GPX = `<gpx><trk><trkseg>
  <trkpt lat="45.90" lon="6.86"><ele>1000</ele></trkpt>
  <trkpt lat="45.91" lon="6.87"><ele>1200</ele></trkpt>
</trkseg></trk></gpx>`

describe('POST /api/races/[id]/track', () => {
  it('gpxText valide → 200 + stocke la trace', async () => {
    // getRaceTrack relit la ligne : on renvoie une ligne encodée plausible
    mockMaybeSingle.mockResolvedValue({ data: {
      race_id: 'r1',
      profile_gz: require('@/lib/race-track/storage').encodeProfile({ d: [0, 42], e: [1000, 1200] }),
      point_count: 2, source: 'gpx_upload', distance_m: 1500, created_at: '2026-06-22T00:00:00Z',
    } })
    const res = await POST(makeReq({ gpxText: GPX }), { params: { id: 'r1' } })
    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    const body = await res.json()
    expect(body.track.source).toBe('gpx_upload')
  })

  it('utmbAuto sans source_url → 204, aucune écriture', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null }) // pas de meta
    const res = await POST(makeReq({ utmbAuto: true }), { params: { id: 'r1' } })
    expect(res.status).toBe(204)
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('body sans variante → 400', async () => {
    const res = await POST(makeReq({}), { params: { id: 'r1' } })
    expect(res.status).toBe(400)
  })

  it('non authentifié → 401', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeReq({ gpxText: GPX }), { params: { id: 'r1' } })
    expect(res.status).toBe(401)
  })
})
