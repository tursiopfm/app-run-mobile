import { importActivities } from '@/lib/sync/import-activities'
import type { NormalizedActivity } from '@/lib/providers/strava/mapper'
import { createClient } from '@/lib/database/supabase-server'

jest.mock('@/lib/database/supabase-server', () => ({ createClient: jest.fn() }))
const mockCreateClient = createClient as jest.Mock

const sampleActivity: NormalizedActivity = {
  userId: 'u1',
  provider: 'strava',
  providerActivityId: '111',
  sportType: 'run',
  name: 'Morning Run',
  startTime: '2026-05-01T06:00:00Z',
  durationSec: 3600,
  movingTimeSec: 3550,
  distanceM: 10000,
  elevationGainM: 100,
  avgHr: 155,
  maxHr: 175,
  avgPower: null,
  calories: 600,
  externalTrainingLoad: null,
  rawPayload: {},
}

function makeImportMock(
  activitiesResult: { data: unknown; error: unknown },
  metricsResult: { error: unknown }
) {
  const mockUpsertActivities = jest.fn().mockReturnValue({
    select: jest.fn().mockResolvedValue(activitiesResult),
  })
  const mockUpsertMetrics = jest.fn().mockResolvedValue(metricsResult)
  return {
    mockUpsertActivities,
    mockUpsertMetrics,
    client: {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'activities') return { upsert: mockUpsertActivities }
        if (table === 'activity_metrics') return { upsert: mockUpsertMetrics }
      }),
    },
  }
}

beforeEach(() => jest.clearAllMocks())

describe('importActivities', () => {
  it('returns { saved: 0 } for empty input without DB calls', async () => {
    const result = await importActivities([])
    expect(result).toEqual({ saved: 0 })
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('upserts activities and metrics, returns saved count', async () => {
    const { client } = makeImportMock(
      { data: [{ id: 'db-id-1', provider_activity_id: '111' }], error: null },
      { error: null }
    )
    mockCreateClient.mockResolvedValue(client)

    const result = await importActivities([sampleActivity])
    expect(result).toEqual({ saved: 1 })
    expect(client.from).toHaveBeenCalledWith('activities')
    expect(client.from).toHaveBeenCalledWith('activity_metrics')
  })

  it('stores non-zero CES for a 10km run', async () => {
    let capturedRecords: Record<string, unknown>[] = []
    const mockUpsertActivities = jest.fn().mockImplementation((records: unknown[]) => {
      capturedRecords = records as Record<string, unknown>[]
      return {
        select: jest.fn().mockResolvedValue({
          data: [{ id: 'x', provider_activity_id: '111' }],
          error: null,
        }),
      }
    })
    const client = {
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'activities') return { upsert: mockUpsertActivities }
        return { upsert: jest.fn().mockResolvedValue({ error: null }) }
      }),
    }
    mockCreateClient.mockResolvedValue(client)

    await importActivities([sampleActivity])
    expect(capturedRecords[0].ces).toBeGreaterThan(0)
  })

  it('throws when activities upsert fails', async () => {
    const mockUpsertActivities = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    })
    const client = { from: jest.fn().mockReturnValue({ upsert: mockUpsertActivities }) }
    mockCreateClient.mockResolvedValue(client)

    await expect(importActivities([sampleActivity])).rejects.toThrow(
      'Activity upsert failed: DB error'
    )
  })
})
