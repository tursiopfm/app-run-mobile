import { processOneImportTick } from '@/lib/providers/strava/import'
import { fetchStravaActivitiesPage } from '@/lib/providers/strava/api'
import { getValidStravaToken } from '@/lib/providers/strava/token'
import { importActivities } from '@/lib/sync/import-activities'
import { createServiceClient } from '@/lib/database/supabase-server'

jest.mock('@/lib/providers/strava/api')
jest.mock('@/lib/providers/strava/token')
jest.mock('@/lib/sync/import-activities')
jest.mock('@/lib/database/supabase-server')

const mockFetchPage = fetchStravaActivitiesPage as jest.MockedFunction<typeof fetchStravaActivitiesPage>
const mockGetToken = getValidStravaToken as jest.MockedFunction<typeof getValidStravaToken>
const mockImport = importActivities as jest.MockedFunction<typeof importActivities>
const mockCreateClient = createServiceClient as jest.MockedFunction<typeof createServiceClient>

function makeStravaActivity(overrides: Partial<{ id: number; start_date: string }> = {}) {
  return {
    id: overrides.id ?? 1,
    name: 'Run',
    type: 'Run',
    sport_type: 'Run',
    start_date: overrides.start_date ?? '2026-05-01T07:00:00Z',
    moving_time: 3600,
    elapsed_time: 3700,
    distance: 10000,
    total_elevation_gain: 100,
  }
}

function makeMockSupabase(connectionRow: Record<string, unknown>, profileRow: Record<string, unknown> = {}) {
  const update = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: null, error: null }) }) })
  const select = jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: connectionRow, error: null }) }),
      single: jest.fn().mockResolvedValue({ data: profileRow, error: null }),
    }),
  })
  const from = jest.fn((table: string) => {
    if (table === 'provider_connections') return { select, update }
    if (table === 'profiles') return { select }
    return { select, update }
  })
  return { from } as unknown as ReturnType<typeof createServiceClient>
}

describe('processOneImportTick', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetToken.mockResolvedValue('fake-token')
    mockImport.mockResolvedValue({ saved: 0 })
  })

  it('first tick: fetches without before, updates oldest_at and total', async () => {
    const activities = [
      makeStravaActivity({ id: 1, start_date: '2026-05-01T07:00:00Z' }),
      makeStravaActivity({ id: 2, start_date: '2026-04-15T07:00:00Z' }),
    ]
    mockFetchPage.mockResolvedValue(activities)
    mockImport.mockResolvedValue({ saved: 2 })
    mockCreateClient.mockReturnValue(makeMockSupabase({ import_oldest_at: null }))

    const result = await processOneImportTick('user-1')

    expect(mockFetchPage).toHaveBeenCalledWith('fake-token', 1, expect.objectContaining({ before: undefined }))
    expect(result).toEqual({ done: false, savedThisTick: 2, rateLimited: false })
  })

  it('next tick: fetches with before=oldest_at (in seconds)', async () => {
    mockFetchPage.mockResolvedValue([makeStravaActivity()])
    mockImport.mockResolvedValue({ saved: 1 })
    const oldestIso = '2026-03-01T00:00:00Z'
    mockCreateClient.mockReturnValue(makeMockSupabase({ import_oldest_at: oldestIso }))

    await processOneImportTick('user-1')

    const beforeUnix = Math.floor(new Date(oldestIso).getTime() / 1000)
    expect(mockFetchPage).toHaveBeenCalledWith('fake-token', 1, expect.objectContaining({ before: beforeUnix }))
  })

  it('batch < 200: marks status completed', async () => {
    mockFetchPage.mockResolvedValue([makeStravaActivity()])
    mockImport.mockResolvedValue({ saved: 1 })
    mockCreateClient.mockReturnValue(makeMockSupabase({ import_oldest_at: null }))

    const result = await processOneImportTick('user-1')

    expect(result.done).toBe(true)
  })

  it('empty batch: marks status completed without calling import', async () => {
    mockFetchPage.mockResolvedValue([])
    mockCreateClient.mockReturnValue(makeMockSupabase({ import_oldest_at: '2020-01-01T00:00:00Z' }))

    const result = await processOneImportTick('user-1')

    expect(mockImport).not.toHaveBeenCalled()
    expect(result).toEqual({ done: true, savedThisTick: 0, rateLimited: false })
  })

  it('Strava 429: returns rateLimited, does not throw, status stays pending', async () => {
    const err = new Error('Strava rate limit (429)') as Error & { rateLimited: true }
    err.rateLimited = true
    mockFetchPage.mockRejectedValue(err)
    mockCreateClient.mockReturnValue(makeMockSupabase({ import_oldest_at: null }))

    const result = await processOneImportTick('user-1')

    expect(result).toEqual({ done: false, savedThisTick: 0, rateLimited: true })
  })

  it('other error: rethrows so caller can mark status=error', async () => {
    mockFetchPage.mockRejectedValue(new Error('Strava API error: 500'))
    mockCreateClient.mockReturnValue(makeMockSupabase({ import_oldest_at: null }))

    await expect(processOneImportTick('user-1')).rejects.toThrow('Strava API error: 500')
  })
})
