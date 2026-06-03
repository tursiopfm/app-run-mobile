// jsdom n'expose pas Request/Headers comme globals → polyfill minimal pour les tests
if (typeof globalThis.Request === 'undefined') {
  class MockRequest {
    private _url: string
    private _init: RequestInit | undefined
    readonly headers: { get: (name: string) => string | null }
    constructor(url: string, init?: RequestInit) {
      this._url = url
      this._init = init
      const rawHeaders = (init?.headers ?? {}) as Record<string, string>
      this.headers = {
        get: (name: string) => rawHeaders[name.toLowerCase()] ?? rawHeaders[name] ?? null,
      }
    }
  }
  ;(globalThis as unknown as Record<string, unknown>).Request = MockRequest
}

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      body,
    }),
  },
}))

jest.mock('@/lib/providers/strava/streams-backfill', () => ({
  processStreamsBackfillBatch: jest.fn().mockResolvedValue({ processed: 0, stored: 0, rateLimited: false, errors: 0 }),
}))

import { GET } from '@/app/api/cron/strava-streams-backfill/route'

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
