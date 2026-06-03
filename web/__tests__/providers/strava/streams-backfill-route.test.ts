/**
 * @jest-environment node
 */
import { GET } from '@/app/api/cron/strava-streams-backfill/route'

jest.mock('@/lib/providers/strava/streams-backfill', () => ({
  processStreamsBackfillBatch: jest.fn().mockResolvedValue({ processed: 0, stored: 0, rateLimited: false, errors: 0 }),
}))

describe('cron strava-streams-backfill auth', () => {
  const OLD = process.env.CRON_SECRET
  beforeAll(() => { process.env.CRON_SECRET = 'sekret' })
  afterAll(() => { process.env.CRON_SECRET = OLD })

  it('401 sans bearer valide', async () => {
    const res = await GET(new Request('http://x/api/cron/strava-streams-backfill'))
    expect(res.status).toBe(401)
  })

  it('200 avec bearer valide', async () => {
    const res = await GET(new Request('http://x/api/cron/strava-streams-backfill', {
      headers: { authorization: 'Bearer sekret' },
    }))
    expect(res.status).toBe(200)
  })
})
