import { getValidStravaToken } from '@/lib/providers/strava/token'
import { createServiceClient } from '@/lib/database/supabase-server'

jest.mock('@/lib/database/supabase-server', () => ({ createServiceClient: jest.fn() }))
const mockCreateClient = createServiceClient as jest.Mock

global.fetch = jest.fn()

process.env.STRAVA_CLIENT_ID = '12345'
process.env.STRAVA_CLIENT_SECRET = 'secret'

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
    mockCreateClient.mockReturnValue(client)

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
    mockCreateClient.mockReturnValue(client)
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
    // Strava rejette le header Basic sur oauth/token : les identifiants client
    // doivent transiter dans le body (form-urlencoded).
    const body = (fetch as jest.Mock).mock.calls[0][1].body.toString() as string
    expect(body).toContain('client_id=12345')
    expect(body).toContain('client_secret=secret')
    expect(body).toContain('grant_type=refresh_token')
    expect(body).toContain('refresh_token=old_r')
  })

  it('throws when no Strava connection found', async () => {
    const { client } = makeSupabaseMock({ data: null, error: { message: 'not found' } })
    mockCreateClient.mockReturnValue(client)

    await expect(getValidStravaToken('user-1')).rejects.toThrow(
      'No Strava connection found for user'
    )
  })
})
