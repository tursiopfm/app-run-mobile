/** @jest-environment node */
jest.mock('@/lib/database/supabase-server', () => ({ createClient: jest.fn() }))
import { POST } from '@/app/api/races/[id]/tableau-recheck/route'
import { createClient } from '@/lib/database/supabase-server'

const PD = {
  kind: 'changed', detectedAt: 'T',
  newWaypoints: [{ orderIndex: 0, name: 'Départ', km: 0, kmInter: null, dPlus: 0, dMoins: 0, cutoffRaw: null, cutoffKind: null, type: 'depart', supplies: [], targetOverrideSec: null }],
  newMeta: { editionYear: 2026, editionDate: null, dateExplicit: false, freshnessStatus: 'confirmed', sourceHash: 'NEW' },
  summary: { added: 1, removed: 0, modified: 0, modifiedDetails: [] },
}

function client({ user = { id: 'u1' }, race = { id: 'r1' }, pending = PD as any, capture }: any) {
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    from(table: string) {
      if (table === 'races') return { select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: race }) }) }) }) }
      if (table === 'race_waypoints') return {
        delete: () => ({ eq: async () => { capture.deleted = true; return { error: null } } }),
        insert: async (rows: any) => { capture.inserted = rows; return { error: null } },
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { pending_diff: pending } }) }) }),
        update: (patch: any) => ({ eq: async () => { capture.updated = patch; return { error: null } } }),
      }
    },
  }
}

const req = (action?: string) => new Request('http://x', { method: 'POST', body: JSON.stringify({ action }) })

describe('POST tableau-recheck', () => {
  afterEach(() => jest.restoreAllMocks())

  it('401 sans user', async () => {
    ;(createClient as jest.Mock).mockResolvedValue(client({ user: null, capture: {} }))
    expect((await POST(req('apply'), { params: { id: 'r1' } })).status).toBe(401)
  })
  it('404 si course pas au user', async () => {
    ;(createClient as jest.Mock).mockResolvedValue(client({ race: null, capture: {} }))
    expect((await POST(req('apply'), { params: { id: 'r1' } })).status).toBe(404)
  })
  it('409 si pas de pending_diff', async () => {
    ;(createClient as jest.Mock).mockResolvedValue(client({ pending: null, capture: {} }))
    expect((await POST(req('apply'), { params: { id: 'r1' } })).status).toBe(409)
  })
  it('apply : insert newWaypoints + meta mise à jour + pending vidé', async () => {
    const capture: any = {}
    ;(createClient as jest.Mock).mockResolvedValue(client({ capture }))
    const res = await POST(req('apply'), { params: { id: 'r1' } })
    expect(res.status).toBe(200)
    expect(capture.deleted).toBe(true)
    expect(capture.inserted).toHaveLength(1)
    expect(capture.updated.source_hash).toBe('NEW')
    expect(capture.updated.pending_diff).toBeNull()
  })
  it('dismiss : pas d\'insert, hash avancé, pending vidé', async () => {
    const capture: any = {}
    ;(createClient as jest.Mock).mockResolvedValue(client({ capture }))
    const res = await POST(req('dismiss'), { params: { id: 'r1' } })
    expect(res.status).toBe(200)
    expect(capture.inserted).toBeUndefined()
    expect(capture.updated.source_hash).toBe('NEW')
    expect(capture.updated.pending_diff).toBeNull()
  })
})
