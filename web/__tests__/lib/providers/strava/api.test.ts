import { fetchStravaActivities } from '@/lib/providers/strava/api'

global.fetch = jest.fn()

beforeEach(() => jest.clearAllMocks())

describe('fetchStravaActivities', () => {
  it('fetches with correct Authorization header', async () => {
    ;(fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 1, name: 'Morning Run' }]),
    })

    const activities = await fetchStravaActivities('my_token')
    expect(activities).toHaveLength(1)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://www.api-v3.strava.com/athlete/activities'),
      expect.objectContaining({ headers: { Authorization: 'Bearer my_token' } })
    )
  })

  it('passes after param when provided', async () => {
    ;(fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })

    await fetchStravaActivities('tok', { after: 1714500000 })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('after=1714500000'),
      expect.any(Object)
    )
  })

  it('throws on non-200 response', async () => {
    ;(fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401 })
    await expect(fetchStravaActivities('bad')).rejects.toThrow('Strava API error: 401')
  })
})
