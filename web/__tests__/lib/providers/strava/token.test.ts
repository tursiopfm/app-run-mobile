import { getValidStravaToken } from '@/lib/providers/strava/token'
import { createClient } from '@/lib/database/supabase-server'

jest.mock('@/lib/database/supabase-server', () => ({ createClient: jest.fn() }))
const mockCreateClient = createClient as jest.Mock

global.fetch = jest.fn()

function makeSupabaseMock(singleResult: { data: unknown; error: unknown }) {
  const mockSingle = jest.fn().mockResolvedValue(singleResult)
  const mockUpdateEq = jest.fn().mockResolvedValue({ error: null })
  return {
    mockSingle,
    mockUpdateEq,
    client: {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({ single: mockSingle }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: mockUpdateEq,
          }),
        }),
      }),
    },
  }
}

beforeEach(() => jest.clearAllMocks())

describe('getValidStravaToken', () => {
  it('returns existing token when not expired', async () => {
    const future = new Date(Date.now() + 3600 * 1000).toISOString()
    const { client } = makeSupabaseMock({
      data: { access_token: 'valid', refresh_token: 'r', token_expires_at: future },
      error: null,
    })
    mockCreateClient.mockResolvedValue(client)

    const token = await getValidStravaToken('user-1')
    expect(token).toBe('valid')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('refreshes token when expired', async () => {
    const past = new Date(Date.now() - 1000).toISOString()
    const { client, mockUpdateEq } = makeSupabaseMock({
      data: { access_token: 'old', refresh_token: 'old_r', token_expires_at: past },
      error: null,
    })
    mockCreateClient.mockResolvedValue(client)
    ;(fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'new_token',
          refresh_token: 'new_r',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }),
    })
    mockUpdateEq.mockResolvedValue({ error: null })

    const token = await getValidStravaToken('user-1')
    expect(token).toBe('new_token')
    expect(fetch).toHaveBeenCalledWith(
      'https://www.strava.com/oauth/token',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('throws when no Strava connection found', async () => {
    const { client } = makeSupabaseMock({ data: null, error: { message: 'not found' } })
    mockCreateClient.mockResolvedValue(client)

    await expect(getValidStravaToken('user-1')).rejects.toThrow(
      'No Strava connection found for user'
    )
  })
})
