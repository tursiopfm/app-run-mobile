> **Status: Implémenté** · Date: 2026-05-03 · Code: `web/lib/providers/strava/`, `web/lib/sync/import-activities.ts`
> *Snapshot de design — pour l'état actuel, voir le code.*

# Strava Data Integration — Web Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect real Strava activities to the Trail Cockpit web dashboard — token refresh, activity import with CES computation, and real Supabase data replacing all mocked values.

**Architecture:** A token manager handles Strava access token refresh. An API client fetches activities from Strava API v3. A provider-agnostic importer normalizes and upserts activities + CES metrics to Supabase. A dashboard data service queries the DB and feeds the existing EWMA analytics engine. Dashboard and settings pages become async Server Components with real data. A `ProviderSyncer` interface keeps the pipeline extensible for Garmin/Polar/Suunto.

**Tech Stack:** Next.js 14 App Router · @supabase/ssr 0.5 · TypeScript · Jest 29 · Strava API v3

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `web/lib/providers/strava/token.ts` | Create | Refresh Strava access token when expired |
| `web/lib/providers/strava/api.ts` | Create | Fetch activities from Strava API v3 |
| `web/lib/sync/types.ts` | Create | `ProviderSyncer` interface + `SyncOptions` |
| `web/lib/sync/import-activities.ts` | Create | Upsert `NormalizedActivity[]` → activities + activity_metrics with CES |
| `web/lib/providers/strava/syncer.ts` | Create | `stravaSyncer` implementing `ProviderSyncer` (incremental sync) |
| `web/app/api/strava/sync/route.ts` | Create | POST: trigger incremental Strava sync for current user |
| `web/app/api/strava/disconnect/route.ts` | Create | DELETE: remove Strava connection |
| `web/lib/data/dashboard.ts` | Create | Load `DailyMetrics` + recent activities from Supabase |
| `web/app/dashboard/page.tsx` | Modify | Replace `MOCK_LOADS` with real `getDashboardData()` |
| `web/components/settings/StravaSection.tsx` | Create | Client component: sync button, disconnect, connect CTA |
| `web/app/settings/page.tsx` | Modify | Query `provider_connections`, pass real status to `StravaSection` |

### Test files

| Test file | What it covers |
|-----------|---------------|
| `web/__tests__/lib/providers/strava/token.test.ts` | Valid token path, refresh path, no connection error |
| `web/__tests__/lib/providers/strava/api.test.ts` | Successful fetch, `after` param, API error |
| `web/__tests__/lib/sync/import-activities.test.ts` | Upsert path, CES computed, empty input, DB error |
| `web/__tests__/lib/data/dashboard.test.ts` | No activities → zeros; with activities → real metrics |

---

### Task 1: Strava token refresh manager

**Files:**
- Create: `web/lib/providers/strava/token.ts`
- Create: `web/__tests__/lib/providers/strava/token.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// web/__tests__/lib/providers/strava/token.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```
cd web && npm test -- --testPathPattern=token.test
```
Expected: FAIL with "Cannot find module '@/lib/providers/strava/token'"

- [ ] **Step 3: Implement token manager**

```typescript
// web/lib/providers/strava/token.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/database/supabase-server'

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'
const BUFFER_MS = 300 * 1000 // refresh 5 minutes before expiry

export async function getValidStravaToken(userId: string): Promise<string> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('provider_connections')
    .select('access_token, refresh_token, token_expires_at')
    .eq('user_id', userId)
    .eq('provider', 'strava')
    .single()

  if (error || !data) throw new Error('No Strava connection found for user')

  const expiresAt = new Date(data.token_expires_at as string).getTime()
  if (Date.now() < expiresAt - BUFFER_MS) return data.access_token as string

  return _refreshToken(supabase, userId, data.refresh_token as string)
}

async function _refreshToken(
  supabase: SupabaseClient,
  userId: string,
  refreshToken: string
): Promise<string> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status}`)

  const json = (await res.json()) as {
    access_token: string
    refresh_token: string
    expires_at: number
  }

  await supabase
    .from('provider_connections')
    .update({
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      token_expires_at: new Date(json.expires_at * 1000).toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', 'strava')

  return json.access_token
}
```

- [ ] **Step 4: Run test to verify it passes**

```
cd web && npm test -- --testPathPattern=token.test
```
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add web/lib/providers/strava/token.ts web/__tests__/lib/providers/strava/token.test.ts
git commit -m "feat(web): Strava token refresh manager"
```

---

### Task 2: Strava API client

**Files:**
- Create: `web/lib/providers/strava/api.ts`
- Create: `web/__tests__/lib/providers/strava/api.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// web/__tests__/lib/providers/strava/api.test.ts
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
      expect.stringContaining('https://www.strava.com/api/v3/athlete/activities'),
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
```

- [ ] **Step 2: Run test to verify it fails**

```
cd web && npm test -- --testPathPattern=api.test
```
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement API client**

```typescript
// web/lib/providers/strava/api.ts
import type { StravaActivity } from './mapper'

const STRAVA_BASE = 'https://www.strava.com/api/v3'

export type FetchActivitiesOptions = {
  after?: number   // Unix timestamp — only activities after this date
  perPage?: number // default 200 (Strava max per page)
  page?: number    // default 1
}

export async function fetchStravaActivities(
  accessToken: string,
  options: FetchActivitiesOptions = {}
): Promise<StravaActivity[]> {
  const params = new URLSearchParams({
    per_page: String(options.perPage ?? 200),
    page: String(options.page ?? 1),
    ...(options.after !== undefined ? { after: String(options.after) } : {}),
  })

  const res = await fetch(`${STRAVA_BASE}/athlete/activities?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) throw new Error(`Strava API error: ${res.status}`)

  return res.json() as Promise<StravaActivity[]>
}
```

- [ ] **Step 4: Run test to verify it passes**

```
cd web && npm test -- --testPathPattern=api.test
```
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add web/lib/providers/strava/api.ts web/__tests__/lib/providers/strava/api.test.ts
git commit -m "feat(web): Strava activities API client"
```

---

### Task 3: Provider interface + activity importer

**Files:**
- Create: `web/lib/sync/types.ts`
- Create: `web/lib/sync/import-activities.ts`
- Create: `web/__tests__/lib/sync/import-activities.test.ts`

- [ ] **Step 1: Create provider interface**

```typescript
// web/lib/sync/types.ts
import type { NormalizedActivity } from '@/lib/providers/strava/mapper'

export type SyncOptions = {
  fullSync?: boolean  // if true, fetch all activities (ignore incremental after-date)
}

export type ProviderSyncer = {
  provider: string
  fetchActivities(userId: string, options?: SyncOptions): Promise<NormalizedActivity[]>
}
```

- [ ] **Step 2: Write failing importer tests**

```typescript
// web/__tests__/lib/sync/import-activities.test.ts
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
```

- [ ] **Step 3: Run test to verify it fails**

```
cd web && npm test -- --testPathPattern=import-activities.test
```
Expected: FAIL

- [ ] **Step 4: Implement activity importer**

```typescript
// web/lib/sync/import-activities.ts
import { createClient } from '@/lib/database/supabase-server'
import { computeCesResult } from '@/lib/analytics/effort-score'
import type { NormalizedActivity } from '@/lib/providers/strava/mapper'
import type { ActivityInput, CesResult } from '@/lib/analytics/types'

export type ImportResult = { saved: number }

function toActivityInput(act: NormalizedActivity): ActivityInput {
  return {
    id: act.providerActivityId,
    rawSportType: act.sportType,
    name: act.name,
    startDate: act.startTime,
    movingTimeSeconds: act.movingTimeSec,
    elapsedTimeSeconds: act.durationSec,
    distanceMeters: act.distanceM,
    elevationGainMeters: act.elevationGainM,
    averageHeartrate: act.avgHr ?? undefined,
    maxHeartrate: act.maxHr ?? undefined,
    averageWatts: act.avgPower ?? undefined,
    calories: act.calories ?? undefined,
  }
}

export async function importActivities(activities: NormalizedActivity[]): Promise<ImportResult> {
  if (activities.length === 0) return { saved: 0 }

  const supabase = await createClient()

  const cesMap = new Map<string, CesResult>(
    activities.map((act) => [act.providerActivityId, computeCesResult(toActivityInput(act))])
  )

  const records = activities.map((act) => ({
    user_id: act.userId,
    provider: act.provider,
    provider_activity_id: act.providerActivityId,
    sport_type: act.sportType,
    name: act.name,
    start_time: act.startTime,
    duration_sec: act.durationSec,
    moving_time_sec: act.movingTimeSec,
    distance_m: act.distanceM,
    elevation_gain_m: act.elevationGainM,
    avg_hr: act.avgHr,
    max_hr: act.maxHr,
    avg_power: act.avgPower,
    calories: act.calories,
    external_training_load: act.externalTrainingLoad,
    ces: cesMap.get(act.providerActivityId)!.ces,
    raw_payload: act.rawPayload,
  }))

  const { data: savedRows, error: actError } = await supabase
    .from('activities')
    .upsert(records, { onConflict: 'user_id,provider,provider_activity_id' })
    .select('id, provider_activity_id')

  if (actError) throw new Error(`Activity upsert failed: ${actError.message}`)
  if (!savedRows || savedRows.length === 0) return { saved: 0 }

  const typedRows = savedRows as { id: string; provider_activity_id: string }[]
  const metricRows = typedRows.flatMap((row) => {
    const ces = cesMap.get(row.provider_activity_id)!
    return [
      { activity_id: row.id, metric_key: 'ces',              metric_value: ces.ces },
      { activity_id: row.id, metric_key: 'cardio_load',      metric_value: ces.cardioLoad },
      { activity_id: row.id, metric_key: 'muscle_load',      metric_value: ces.muscleLoad },
      { activity_id: row.id, metric_key: 'intensity_factor', metric_value: ces.intensityFactor },
    ]
  })

  const { error: metricError } = await supabase
    .from('activity_metrics')
    .upsert(metricRows, { onConflict: 'activity_id,metric_key' })

  if (metricError) throw new Error(`Metrics upsert failed: ${metricError.message}`)

  return { saved: typedRows.length }
}
```

- [ ] **Step 5: Run test to verify it passes**

```
cd web && npm test -- --testPathPattern=import-activities.test
```
Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
git add web/lib/sync/types.ts web/lib/sync/import-activities.ts web/__tests__/lib/sync/import-activities.test.ts
git commit -m "feat(web): provider sync interface + activity importer with CES"
```

---

### Task 4: Strava syncer + sync route + disconnect route

**Files:**
- Create: `web/lib/providers/strava/syncer.ts`
- Create: `web/app/api/strava/sync/route.ts`
- Create: `web/app/api/strava/disconnect/route.ts`

No unit tests for route handlers — they delegate entirely to helpers already tested. Run full test suite at the end to check for regressions.

- [ ] **Step 1: Implement Strava syncer**

```typescript
// web/lib/providers/strava/syncer.ts
import { getValidStravaToken } from './token'
import { fetchStravaActivities } from './api'
import { stravaToNormalized } from './mapper'
import { createClient } from '@/lib/database/supabase-server'
import type { ProviderSyncer, SyncOptions } from '@/lib/sync/types'
import type { NormalizedActivity } from './mapper'

export const stravaSyncer: ProviderSyncer = {
  provider: 'strava',

  async fetchActivities(userId: string, options?: SyncOptions): Promise<NormalizedActivity[]> {
    const accessToken = await getValidStravaToken(userId)

    let after: number | undefined
    if (!options?.fullSync) {
      // Incremental: only fetch activities newer than the latest stored one
      const supabase = await createClient()
      const { data } = await supabase
        .from('activities')
        .select('start_time')
        .eq('user_id', userId)
        .eq('provider', 'strava')
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data) {
        after = Math.floor(new Date(data.start_time as string).getTime() / 1000)
      }
    }

    const stravaActivities = await fetchStravaActivities(accessToken, { after })
    return stravaActivities.map((a) => stravaToNormalized(userId, a))
  },
}
```

- [ ] **Step 2: Implement sync route**

```typescript
// web/app/api/strava/sync/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import { stravaSyncer } from '@/lib/providers/strava/syncer'
import { importActivities } from '@/lib/sync/import-activities'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: connection } = await supabase
    .from('provider_connections')
    .select('id')
    .eq('user_id', user.id)
    .eq('provider', 'strava')
    .single()

  if (!connection) return NextResponse.json({ error: 'Strava not connected' }, { status: 404 })

  try {
    const activities = await stravaSyncer.fetchActivities(user.id)
    const result = await importActivities(activities)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 3: Implement disconnect route**

```typescript
// web/app/api/strava/disconnect/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('provider_connections')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', 'strava')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run full test suite — no regressions**

```
cd web && npm test
```
Expected: all previously passing tests still pass

- [ ] **Step 5: Commit**

```bash
git add web/lib/providers/strava/syncer.ts web/app/api/strava/sync/route.ts web/app/api/strava/disconnect/route.ts
git commit -m "feat(web): Strava syncer, POST /api/strava/sync, DELETE /api/strava/disconnect"
```

---

### Task 5: Dashboard data service

**Files:**
- Create: `web/lib/data/dashboard.ts`
- Create: `web/__tests__/lib/data/dashboard.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// web/__tests__/lib/data/dashboard.test.ts
import { getDashboardData } from '@/lib/data/dashboard'
import { createClient } from '@/lib/database/supabase-server'

jest.mock('@/lib/database/supabase-server', () => ({ createClient: jest.fn() }))
const mockCreateClient = createClient as jest.Mock

function makeSelectMock(rows: unknown[]) {
  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: rows, error: null }),
          }),
        }),
      }),
    }),
  }
}

beforeEach(() => jest.clearAllMocks())

describe('getDashboardData', () => {
  it('returns 60 daily metrics (all zeros) when no activities', async () => {
    mockCreateClient.mockResolvedValue(makeSelectMock([]))

    const result = await getDashboardData('user-1')
    expect(result.hasActivities).toBe(false)
    expect(result.recentActivities).toHaveLength(0)
    expect(result.dailyMetrics).toHaveLength(60)
    expect(result.dailyMetrics.every((m) => m.atl === 0 && m.ctl === 0)).toBe(true)
  })

  it('computes non-zero ATL from a recent activity', async () => {
    const today = new Date().toISOString()
    mockCreateClient.mockResolvedValue(
      makeSelectMock([
        {
          id: '1',
          sport_type: 'run',
          name: 'Run',
          start_time: today,
          ces: 60,
          distance_m: 10000,
          elevation_gain_m: 100,
          moving_time_sec: 3600,
        },
      ])
    )

    const result = await getDashboardData('user-1')
    expect(result.hasActivities).toBe(true)
    expect(result.recentActivities).toHaveLength(1)
    const latest = result.dailyMetrics[result.dailyMetrics.length - 1]
    expect(latest.atl).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
cd web && npm test -- --testPathPattern=dashboard.test
```
Expected: FAIL

- [ ] **Step 3: Implement dashboard data service**

```typescript
// web/lib/data/dashboard.ts
import { createClient } from '@/lib/database/supabase-server'
import { buildDailyMetrics, type DailyLoad, type DailyMetrics } from '@/lib/analytics/fatigue'

export type ActivityRow = {
  id: string
  sport_type: string
  name: string
  start_time: string
  ces: number | null
  distance_m: number | null
  elevation_gain_m: number | null
  moving_time_sec: number | null
}

export type DashboardData = {
  dailyMetrics: DailyMetrics[]
  recentActivities: ActivityRow[]
  hasActivities: boolean
}

function buildWindowedLoads(rows: ActivityRow[], days: number): DailyLoad[] {
  const loadMap = new Map<string, number>()
  for (const row of rows) {
    const date = row.start_time.slice(0, 10)
    loadMap.set(date, (loadMap.get(date) ?? 0) + (row.ces ?? 0))
  }
  // Dense array covering the full window — zero-fill rest days so EWMA is continuous
  const result: DailyLoad[] = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const date = d.toISOString().slice(0, 10)
    result.push({ date, ces: loadMap.get(date) ?? 0 })
  }
  return result
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const supabase = await createClient()

  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

  const { data: rows } = await supabase
    .from('activities')
    .select('id, sport_type, name, start_time, ces, distance_m, elevation_gain_m, moving_time_sec')
    .eq('user_id', userId)
    .gte('start_time', sixtyDaysAgo.toISOString())
    .order('start_time', { ascending: true })

  const activities = (rows ?? []) as ActivityRow[]
  const loads = buildWindowedLoads(activities, 60)

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const recentActivities = activities
    .filter((r) => new Date(r.start_time) >= sevenDaysAgo)
    .reverse()

  return {
    dailyMetrics: buildDailyMetrics(loads),
    recentActivities,
    hasActivities: activities.length > 0,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```
cd web && npm test -- --testPathPattern=dashboard.test
```
Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add web/lib/data/dashboard.ts web/__tests__/lib/data/dashboard.test.ts
git commit -m "feat(web): dashboard data service — loads DailyMetrics from Supabase"
```

---

### Task 6: Dashboard page — replace mock data

**Files:**
- Modify: `web/app/dashboard/page.tsx`

The current page is a sync Server Component using `MOCK_LOADS`. Make it `async`, query real data, require auth, show real activities in "Cette semaine".

- [ ] **Step 1: Replace entire file content**

```typescript
// web/app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/navigation/AppShell'
import { KpiCard } from '@/components/ui/KpiCard'
import { LoadChart } from '@/components/ui/LoadChart'
import { createClient } from '@/lib/database/supabase-server'
import { getDashboardData } from '@/lib/data/dashboard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { dailyMetrics, recentActivities, hasActivities } = await getDashboardData(user.id)

  const latest = dailyMetrics[dailyMetrics.length - 1] ?? {
    atl: 0, ctl: 0, tsb: 0, dailyLoad: 0,
  }
  const chartData = dailyMetrics.slice(-14).map((m) => ({
    date: m.date.slice(5),
    atl: m.atl,
    ctl: m.ctl,
  }))

  return (
    <AppShell title="Dashboard">
      <div className="px-4 py-4 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Fatigue (ATL)" value={Math.round(latest.atl)} sub="7j EWMA" />
          <KpiCard label="Fitness (CTL)" value={Math.round(latest.ctl)} sub="42j EWMA" accent />
          <KpiCard
            label="Fraîcheur (TSB)"
            value={Math.round(latest.tsb)}
            sub={latest.tsb >= 0 ? 'Reposé ✓' : 'Fatigué'}
          />
          <KpiCard label="Charge du jour" value={Math.round(latest.dailyLoad)} unit="CES" />
        </div>

        {/* Load chart */}
        <div className="bg-trail-card border border-trail-border rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-trail-text mb-3">
            Fatigue vs Fitness — 14 jours
          </h2>
          <LoadChart data={chartData} />
          <div className="flex gap-4 mt-3">
            <span className="flex items-center gap-1.5 text-xs text-trail-muted">
              <span className="w-3 h-0.5 bg-[#f97316] rounded-full inline-block" />Fatigue
            </span>
            <span className="flex items-center gap-1.5 text-xs text-trail-muted">
              <span className="w-3 h-0.5 bg-[#22d3ee] rounded-full inline-block" />Fitness
            </span>
          </div>
        </div>

        {/* Cette semaine */}
        <div className="bg-trail-card border border-trail-border rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-trail-text mb-2">Cette semaine</h2>
          {!hasActivities ? (
            <div className="py-4 text-center space-y-2">
              <p className="text-xs text-trail-muted">Aucune activité importée</p>
              <a href="/settings" className="inline-block text-xs text-trail-accent underline">
                Connecter Strava dans les réglages →
              </a>
            </div>
          ) : recentActivities.length === 0 ? (
            <p className="text-xs text-trail-muted py-2">Aucune activité cette semaine</p>
          ) : (
            <ul className="space-y-2">
              {recentActivities.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between py-1.5 border-b border-trail-border last:border-0"
                >
                  <div>
                    <p className="text-sm text-trail-text">{a.name}</p>
                    <p className="text-xs text-trail-muted">
                      {a.sport_type}
                      {a.distance_m ? ` · ${(a.distance_m / 1000).toFixed(1)} km` : ''}
                      {a.elevation_gain_m ? ` · +${Math.round(a.elevation_gain_m)}m` : ''}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-trail-accent">
                    {a.ces != null ? `${Math.round(a.ces)} CES` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 2: Run full test suite**

```
cd web && npm test
```
Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add web/app/dashboard/page.tsx
git commit -m "feat(web): dashboard page — replace MOCK_LOADS with real Supabase data"
```

---

### Task 7: Settings — real connection status + StravaSection

**Files:**
- Create: `web/components/settings/StravaSection.tsx`
- Modify: `web/app/settings/page.tsx`

The settings page queries `provider_connections` server-side and passes `isConnected` + `athleteName` to a Client Component that handles the sync/disconnect interactions.

- [ ] **Step 1: Create StravaSection client component**

```typescript
// web/components/settings/StravaSection.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink } from 'lucide-react'

type Props = {
  isConnected: boolean
  athleteName?: string | null
}

export function StravaSection({ isConnected, athleteName }: Props) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/strava/sync', { method: 'POST' })
      const json = (await res.json()) as { saved?: number; error?: string }
      setSyncMsg(
        res.ok ? `${json.saved ?? 0} activité(s) importée(s)` : `Erreur : ${json.error ?? 'inconnue'}`
      )
      if (res.ok) router.refresh()
    } catch {
      setSyncMsg('Erreur réseau')
    } finally {
      setSyncing(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      await fetch('/api/strava/disconnect', { method: 'DELETE' })
      router.refresh()
    } catch {
      setDisconnecting(false)
    }
  }

  return (
    <div className="flex items-center gap-3 p-4">
      <div className="w-9 h-9 rounded-xl bg-[#FC4C02]/15 flex items-center justify-center flex-shrink-0">
        <ExternalLink size={16} className="text-[#FC4C02]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-trail-text">Strava</p>
        {isConnected ? (
          <p className="text-xs text-green-500">
            Connecté{athleteName ? ` — ${athleteName}` : ''}
          </p>
        ) : (
          <p className="text-xs text-trail-muted">Non connecté</p>
        )}
        {syncMsg && <p className="text-xs text-trail-muted mt-0.5">{syncMsg}</p>}
      </div>
      {isConnected ? (
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-3 py-1.5 rounded-lg border border-trail-border text-trail-text text-xs font-semibold disabled:opacity-50"
          >
            {syncing ? '…' : 'Sync'}
          </button>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs font-semibold disabled:opacity-50"
          >
            {disconnecting ? '…' : 'Déconnecter'}
          </button>
        </div>
      ) : (
        <a
          href="/api/strava/connect"
          className="px-3 py-1.5 rounded-lg bg-[#FC4C02] text-white text-xs font-semibold flex-shrink-0"
        >
          Connecter
        </a>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update settings page**

Replace entire content of `web/app/settings/page.tsx`:

```typescript
// web/app/settings/page.tsx
import { AppShell } from '@/components/navigation/AppShell'
import { ChevronRight, Circle } from 'lucide-react'
import { AccountSection } from '@/components/settings/AccountSection'
import { StravaSection } from '@/components/settings/StravaSection'
import { createClient } from '@/lib/database/supabase-server'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let stravaConnected = false
  let stravaAthleteName: string | null = null

  if (user) {
    const { data: connection } = await supabase
      .from('provider_connections')
      .select('athlete_data')
      .eq('user_id', user.id)
      .eq('provider', 'strava')
      .single()

    if (connection) {
      stravaConnected = true
      const athlete = connection.athlete_data as { firstname?: string; lastname?: string } | null
      if (athlete?.firstname) {
        stravaAthleteName = `${athlete.firstname} ${athlete.lastname ?? ''}`.trim()
      }
    }
  }

  return (
    <AppShell title="Réglages">
      <div className="px-4 py-4 space-y-4">
        {/* Connexions */}
        <section>
          <p className="text-xs font-semibold text-trail-muted uppercase tracking-wide mb-2 px-1">
            Connexions
          </p>
          <div className="bg-trail-card border border-trail-border rounded-2xl divide-y divide-trail-border">
            <StravaSection isConnected={stravaConnected} athleteName={stravaAthleteName} />
            {['Garmin', 'Polar', 'Suunto', 'Coros'].map((p) => (
              <div key={p} className="flex items-center gap-3 p-4 opacity-50">
                <Circle size={18} className="text-trail-muted" />
                <p className="text-sm text-trail-text flex-1">{p}</p>
                <span className="text-xs text-trail-muted">Bientôt</span>
              </div>
            ))}
          </div>
        </section>

        {/* Profil athlète */}
        <section>
          <p className="text-xs font-semibold text-trail-muted uppercase tracking-wide mb-2 px-1">
            Profil athlète
          </p>
          <div className="bg-trail-card border border-trail-border rounded-2xl divide-y divide-trail-border">
            {[
              ['FC max',          '185 bpm'],
              ['FC seuil',        '165 bpm'],
              ['Allure seuil',    '5:00/km'],
              ['FTP vélo',        '220 W'  ],
              ['Objectif annuel', '3 000 km'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between p-4">
                <p className="text-sm text-trail-text">{label}</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-trail-muted">{value}</span>
                  <ChevronRight size={14} className="text-trail-muted" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <AccountSection />
      </div>
    </AppShell>
  )
}
```

- [ ] **Step 3: Run full test suite**

```
cd web && npm test
```
Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add web/components/settings/StravaSection.tsx web/app/settings/page.tsx
git commit -m "feat(web): settings — real Strava status, sync and disconnect buttons"
```

---

### Task 8: Build verification

**Files:** none (verification only)

- [ ] **Step 1: Run TypeScript build**

```
cd web && npm run build
```

- [ ] **Step 2: Fix any build errors**

Common issues:

**"Property does not exist on type 'unknown'"** in Supabase `.select()` results:
→ Add explicit type cast: `(row as { id: string; provider_activity_id: string })`

**"Type 'string' is not assignable to type 'Provider'"** in `import-activities.ts`:
→ Cast provider value: `provider: act.provider as Provider` (import `Provider` from `@/lib/providers/strava/mapper`)

**"Module not found"** for any new file:
→ Verify the file exists at the exact path listed in the File Map above.

- [ ] **Step 3: Confirm clean build**

```
cd web && npm run build
```
Expected: Route table printed, exit code 0, no TypeScript errors

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(web): resolve TypeScript errors from build check"
```
