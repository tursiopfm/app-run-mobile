/** @jest-environment node */
import { PATCH } from '@/app/api/commute-routes/[id]/route'

const mockGetUser = jest.fn()
const mockSingle = jest.fn()
const mockUpdate = jest.fn()

jest.mock('@/lib/database/supabase-server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      update: (payload: Record<string, unknown>) => {
        mockUpdate(payload)
        return {
          eq: () => ({ eq: () => ({ select: () => ({ single: mockSingle }) }) }),
        }
      },
    }),
  }),
}))

const ROW = {
  id: 'r1', user_id: 'u1', sport_type: 'Run', label: 'Runtaf',
  ref_distance_m: 9500, distance_tol_pct: 12,
  home_lat: 45.9, home_lng: 6.1, office_lat: 45.92, office_lng: 6.15,
  geo_tol_m: 250, outbound_title: 'A', return_title: 'B',
  hour_split: 14, active: true,
}

const makeReq = (body: unknown) => ({ json: async () => body } as unknown as Request)
const ctx = { params: Promise.resolve({ id: 'r1' }) }

beforeEach(() => {
  jest.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  mockSingle.mockResolvedValue({ data: ROW, error: null })
})

describe('PATCH /api/commute-routes/[id] — points Home/Office', () => {
  it('4 valeurs valides → update home_lat/home_lng/office_lat/office_lng', async () => {
    const res = await PATCH(
      makeReq({ homeLat: 45.9, homeLng: 6.1, officeLat: 45.92, officeLng: 6.15 }),
      ctx,
    )
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({
      home_lat: 45.9, home_lng: 6.1, office_lat: 45.92, office_lng: 6.15,
    })
  })

  it('une seule paire complète (Office) → acceptée, Home intouché', async () => {
    const res = await PATCH(makeReq({ officeLat: 45.92, officeLng: 6.15 }), ctx)
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({ office_lat: 45.92, office_lng: 6.15 })
  })

  it('lat hors bornes (91) → 400, aucune écriture', async () => {
    const res = await PATCH(
      makeReq({ homeLat: 91, homeLng: 6.1, officeLat: 45.92, officeLng: 6.15 }),
      ctx,
    )
    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('lng hors bornes (-181) → 400, aucune écriture', async () => {
    const res = await PATCH(
      makeReq({ homeLat: 45.9, homeLng: -181, officeLat: 45.92, officeLng: 6.15 }),
      ctx,
    )
    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('paire incomplète (homeLat sans homeLng) → 400, aucune écriture', async () => {
    const res = await PATCH(makeReq({ homeLat: 45.9 }), ctx)
    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('comportement existant intact : label seul → update label', async () => {
    const res = await PATCH(makeReq({ label: 'Vélotaf' }), ctx)
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({ label: 'Vélotaf' })
  })
})
