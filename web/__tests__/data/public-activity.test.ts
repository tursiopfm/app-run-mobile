// React 18.3.1 (résolu par Jest) n'expose pas `cache` (présent dans la canary
// utilisée par Next.js 14). On le shim localement en identité — scope limité à
// ce fichier, pas de mock global de React.
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  cache: (fn: unknown) => fn,
}))

import { getPublicActivity } from '@/lib/data/public-activity'
import { createServiceClient } from '@/lib/database/supabase-server'

jest.mock('@/lib/database/supabase-server', () => ({
  createServiceClient: jest.fn(),
}))

jest.mock('@/lib/providers/strava/streams', () => ({
  unpackStreams: jest.fn(() => ({ heartrate: [120, 130], time: [0, 1] })),
}))

type Result = { data: unknown; error: unknown }

function builder(result: Result) {
  const b: Record<string, jest.Mock> = {
    select: jest.fn(() => b),
    eq: jest.fn(() => b),
    is: jest.fn(() => b),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
  }
  return b
}

function mockClient(byTable: Record<string, ReturnType<typeof builder>>) {
  return {
    from: jest.fn((t: string) => byTable[t] ?? builder({ data: null, error: null })),
  }
}

const ACTIVITY_ROW = {
  id: 'abc', user_id: 'owner-1', sport_type: 'Run', manual_sport_type: null,
  name: 'Sortie matinale', start_time: '2026-06-01T07:00:00Z', ces: 90,
  manual_intensity: null, manual_workout_type: null, distance_m: 10000,
  manual_distance_m: null, elevation_gain_m: 200, manual_elevation_gain_m: null,
  moving_time_sec: 3000, manual_moving_time_sec: null, duration_sec: 3100,
  avg_hr: null, max_hr: null, calories: 500, raw_payload: {},
  provider: 'manual', provider_activity_id: null,
}

describe('getPublicActivity', () => {
  beforeEach(() => jest.clearAllMocks())

  it('retourne activity + ownerId quelle que soit la session (bypass RLS)', async () => {
    ;(createServiceClient as jest.Mock).mockReturnValue(mockClient({
      activities: builder({ data: ACTIVITY_ROW, error: null }),
      profiles: builder({ data: { max_hr: 190 }, error: null }),
    }))
    const res = await getPublicActivity('abc')
    expect(res).not.toBeNull()
    expect(res!.ownerId).toBe('owner-1')
    expect(res!.activity.name).toBe('Sortie matinale')
    // user_id ne doit pas fuiter dans l'objet activity passé au client
    expect((res!.activity as Record<string, unknown>).user_id).toBeUndefined()
  })

  it('retourne null si l\'activité est absente ou supprimée', async () => {
    ;(createServiceClient as jest.Mock).mockReturnValue(mockClient({
      activities: builder({ data: null, error: null }),
    }))
    const res = await getPublicActivity('inconnue')
    expect(res).toBeNull()
  })

  it('expose splits/laps présents dans raw_payload sans appeler Strava', async () => {
    ;(createServiceClient as jest.Mock).mockReturnValue(mockClient({
      activities: builder({
        data: { ...ACTIVITY_ROW, raw_payload: { splits_metric: [{ distance: 1000 }], laps: [{}, {}] } },
        error: null,
      }),
      profiles: builder({ data: null, error: null }),
    }))
    const res = await getPublicActivity('abc')
    expect(res!.splits).toHaveLength(1)
    expect(res!.laps).toHaveLength(2)
  })

  it('peuple hrStream quand avg_hr et streams_gz sont présents', async () => {
    ;(createServiceClient as jest.Mock).mockReturnValue(mockClient({
      activities: builder({ data: { ...ACTIVITY_ROW, avg_hr: 145 }, error: null }),
      profiles: builder({ data: null, error: null }),
      activity_streams: builder({ data: { streams_gz: 'fake-gz' }, error: null }),
    }))
    const res = await getPublicActivity('abc')
    expect(res!.hrStream).toEqual({ heartrate: [120, 130], time: [0, 1] })
  })
})
