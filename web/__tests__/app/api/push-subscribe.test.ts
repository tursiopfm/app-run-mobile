/** @jest-environment node */
import { POST, DELETE } from '@/app/api/push/subscribe/route'
import { createClient, createServiceClient } from '@/lib/database/supabase-server'

jest.mock('@/lib/database/supabase-server', () => ({
  createClient: jest.fn(),
  createServiceClient: jest.fn(),
}))

const mockCreate = createClient as jest.Mock
const mockServiceCreate = createServiceClient as jest.Mock

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

function makeServiceClient(): unknown {
  return {
    from: () => ({ upsert }),
  }
}

function req(body: unknown, options?: { notJson?: boolean }): Request {
  const bodyStr = options?.notJson ? 'not json {{{' : JSON.stringify(body)
  return new Request('http://localhost/api/push/subscribe', {
    method:  'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'JestAgent/1.0' },
    body:    bodyStr,
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
    mockServiceCreate.mockReturnValue(makeServiceClient())
    const res = await POST(req({ endpoint: 'https://push.example/abc' }))
    expect(res.status).toBe(400)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('refuse un corps non-JSON', async () => {
    mockCreate.mockResolvedValue(makeClient({ id: 'u1' }))
    mockServiceCreate.mockReturnValue(makeServiceClient())
    const res = await POST(req({}, { notJson: true }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('JSON')
  })

  it('upsert l\'abonnement sur endpoint avec le user courant', async () => {
    mockCreate.mockResolvedValue(makeClient({ id: 'u1' }))
    mockServiceCreate.mockReturnValue(makeServiceClient())
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

  it('utilise user_id de la session même si le corps en propose un autre', async () => {
    mockCreate.mockResolvedValue(makeClient({ id: 'u1' }))
    mockServiceCreate.mockReturnValue(makeServiceClient())
    const bodyWithFakeUserId = { ...VALID, user_id: 'u2_attacker' }
    const res = await POST(req(bodyWithFakeUserId))
    expect(res.status).toBe(200)
    // Vérifier que user_id écrit est u1, pas u2_attacker
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1' }),
      { onConflict: 'endpoint' },
    )
  })

  it('retourne 500 si Supabase renvoie une erreur', async () => {
    mockCreate.mockResolvedValue(makeClient({ id: 'u1' }))
    mockServiceCreate.mockReturnValue({
      from: () => ({
        upsert: jest.fn(() => Promise.resolve({ error: { message: 'DB error' } })),
      }),
    })
    const res = await POST(req(VALID))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('DB error')
  })
})

describe('DELETE /api/push/subscribe', () => {
  it('refuse un visiteur non authentifié', async () => {
    mockCreate.mockResolvedValue(makeClient(null))
    const res = await DELETE(req({ endpoint: VALID.endpoint }))
    expect(res.status).toBe(401)
  })

  it('refuse un corps sans endpoint', async () => {
    mockCreate.mockResolvedValue(makeClient({ id: 'u1' }))
    const res = await DELETE(req({}))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('endpoint')
  })

  it('refuse un corps non-JSON', async () => {
    mockCreate.mockResolvedValue(makeClient({ id: 'u1' }))
    const res = await DELETE(req({}, { notJson: true }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('JSON')
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

  it('retourne 500 si Supabase renvoie une erreur', async () => {
    eq.mockReturnValue({ then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ error: { message: 'DB error' } }).then(resolve)
    })
    mockCreate.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
      from: () => ({
        delete: () => ({
          eq: () => ({
            eq: () => ({
              then: (resolve: (v: unknown) => unknown) =>
                Promise.resolve({ error: { message: 'DB error' } }).then(resolve),
            }),
          }),
        }),
      }),
    })
    const res = await DELETE(req({ endpoint: VALID.endpoint }))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('DB error')
  })
})
