/**
 * @jest-environment node
 */
jest.mock('@/lib/race-import/recheck', () => ({ runFreshnessRecheck: jest.fn(async () => ({ checked: 0, changed: 0, newEdition: 0 })) }))
import { GET } from '@/app/api/cron/race-freshness/route'

describe('GET /api/cron/race-freshness', () => {
  const OLD = process.env.CRON_SECRET
  beforeAll(() => { process.env.CRON_SECRET = 'sec' })
  afterAll(() => { process.env.CRON_SECRET = OLD })
  const req = (auth?: string) => new Request('http://x', { headers: auth ? { authorization: auth } : {} })

  it('401 sans Bearer', async () => {
    expect((await GET(req())).status).toBe(401)
  })
  it('401 mauvais Bearer', async () => {
    expect((await GET(req('Bearer nope'))).status).toBe(401)
  })
  it('200 avec bon Bearer', async () => {
    const res = await GET(req('Bearer sec'))
    expect(res.status).toBe(200)
  })
})
