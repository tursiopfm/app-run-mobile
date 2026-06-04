/**
 * @jest-environment node
 */
import { triggerStreamsBackfill } from '@/lib/providers/strava/trigger-backfill'

jest.mock('@vercel/functions', () => ({ waitUntil: jest.fn() }))

describe('triggerStreamsBackfill', () => {
  const OLD = { ...process.env }
  afterEach(() => { process.env = { ...OLD }; jest.restoreAllMocks() })

  it('appelle le cron backfill avec le bearer CRON_SECRET', () => {
    process.env.CRON_SECRET = 'sekret'
    process.env.APP_URL = 'https://trailcockpit.run'
    const fetchMock = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock as unknown as typeof fetch
    triggerStreamsBackfill()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://trailcockpit.run/api/cron/strava-streams-backfill')
    expect((opts as { headers: Record<string, string> }).headers.Authorization).toBe('Bearer sekret')
  })

  it('no-op si CRON_SECRET absent', () => {
    delete process.env.CRON_SECRET
    const fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof fetch
    triggerStreamsBackfill()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
