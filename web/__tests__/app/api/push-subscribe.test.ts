/** @jest-environment node */
import { POST, DELETE } from '@/app/api/push/subscribe/route'
import { createClient } from '@/lib/database/supabase-server'

jest.mock('@/lib/database/supabase-server', () => ({ createClient: jest.fn() }))

const mockCreate = createClient as jest.Mock

const upsert = jest.fn(() => Promise.resolve({ error: null }))
const eq     = jest.fn()
const del    = jest.fn()

// `.delete().eq(...).eq(...)` doit être chaînable puis awaitable : chaque `eq`
// renvoie la même chaîne, qui est elle-même une thenable résolue à { error }.
function makeDeleteChain(): Record<string, unknown> {
  const chain: Record<string, unknown> = {}
  chain.eq = eq.mockReturnValue(chain)
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ error: null }).then(resolve)
  return chain
}

function makeClient(user: { id: string } | null): unknown {
  del.mockReturnValue(makeDeleteChain())
  return {
    auth: { getUser: () => Promise.resolve({ data: { user } }) },
    from: () => ({ upsert, delete: del }),
  }
}

function req(body: unknown): Request {
  return new Request('http://localhost/api/push/subscribe', {
    method:  'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'JestAgent/1.0' },
    body:    JSON.stringify(body),
  })
}

const VALID = { endpoint: 'https://push.example/abc', keys: { p256dh: 'k', auth: 'a' } }

beforeEach(() => jest.clearAllMocks())

describe('POST /api/push/subscribe', () => {
  it('refuse un visiteur non authentifié', async () => {
    mockCreate.mockResolvedValue(makeClient(null))
    const res = await POST(req(VALID))
    expect(res.status).toBe(401)
  })

  it('refuse un corps incomplet', async () => {
    mockCreate.mockResolvedValue(makeClient({ id: 'u1' }))
    const res = await POST(req({ endpoint: 'https://push.example/abc' }))
    expect(res.status).toBe(400)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('upsert l\'abonnement sur endpoint avec le user courant', async () => {
    mockCreate.mockResolvedValue(makeClient({ id: 'u1' }))
    const res = await POST(req(VALID))
    expect(res.status).toBe(200)
    expect(upsert).toHaveBeenCalledWith(
      {
        user_id:    'u1',
        endpoint:   VALID.endpoint,
        p256dh:     'k',
        auth:       'a',
        user_agent: 'JestAgent/1.0',
      },
      { onConflict: 'endpoint' },
    )
  })
})

describe('DELETE /api/push/subscribe', () => {
  it('refuse un visiteur non authentifié', async () => {
    mockCreate.mockResolvedValue(makeClient(null))
    const res = await DELETE(req({ endpoint: VALID.endpoint }))
    expect(res.status).toBe(401)
  })

  it('supprime la ligne de l\'utilisateur courant', async () => {
    mockCreate.mockResolvedValue(makeClient({ id: 'u1' }))
    const res = await DELETE(req({ endpoint: VALID.endpoint }))
    expect(res.status).toBe(200)
    // Filtré sur l'endpoint ET sur user_id : personne ne peut désabonner
    // l'appareil d'un autre compte.
    expect(eq).toHaveBeenCalledWith('endpoint', VALID.endpoint)
    expect(eq).toHaveBeenCalledWith('user_id', 'u1')
  })
})
