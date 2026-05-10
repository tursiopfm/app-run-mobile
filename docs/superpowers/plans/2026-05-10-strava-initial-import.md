# Strava Initial Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importer automatiquement tout l'historique Strava à la première connexion OAuth, en background via Vercel Cron, avec une bannière de progression dans le dashboard.

**Architecture:** OAuth callback marque la connection `import_status='pending'`. Vercel Cron (1×/min) traite 1 page Strava (200 act) par user, avance le curseur `import_oldest_at`, jusqu'à épuisement. Dashboard polle `/api/strava/import-status` toutes les 10s pour afficher une bannière sticky avec compteur.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (PostgreSQL + RLS), Vercel Cron, Jest + ts-jest, Tailwind, Lucide icons.

**Spec:** [docs/superpowers/specs/2026-05-10-strava-initial-import-design.md](../specs/2026-05-10-strava-initial-import-design.md)

---

## File Structure

**Nouveaux fichiers**
- `web/supabase/migrations/009_strava_initial_import.sql` — Migration colonnes import
- `web/lib/providers/strava/import.ts` — `processOneImportTick(userId)` + types
- `web/app/api/cron/strava-import/route.ts` — Cron handler
- `web/app/api/strava/import-status/route.ts` — Endpoint polling (GET) + retry (POST)
- `web/components/ui/ImportProgressBanner.tsx` — Bannière client component
- `web/__tests__/providers/strava-import.test.ts` — Tests `processOneImportTick`

**Fichiers modifiés**
- `web/lib/providers/strava/api.ts` — Exposer `fetchStravaActivitiesPage` + ajouter param `before`
- `web/app/api/strava/callback/route.ts` — Set `import_status='pending'` à la connexion
- `web/app/(main)/layout.tsx` — Mount `<ImportProgressBanner />`
- `web/vercel.json` — Ajouter cron config

---

## Task 1 : Migration SQL

**Files:**
- Create: `web/supabase/migrations/009_strava_initial_import.sql`

- [ ] **Step 1: Créer le fichier de migration**

```sql
-- 009_strava_initial_import.sql
-- Colonnes pour suivre l'import initial complet de l'historique Strava.
-- Le cron /api/cron/strava-import lit/met à jour ces colonnes pour
-- avancer page par page jusqu'à épuisement des activités.

ALTER TABLE provider_connections
  ADD COLUMN IF NOT EXISTS import_status TEXT NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS import_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS import_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS import_oldest_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS import_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS import_last_error TEXT,
  ADD COLUMN IF NOT EXISTS import_updated_at TIMESTAMPTZ;

-- Contrainte sur les valeurs de import_status
ALTER TABLE provider_connections
  DROP CONSTRAINT IF EXISTS provider_connections_import_status_check;
ALTER TABLE provider_connections
  ADD CONSTRAINT provider_connections_import_status_check
  CHECK (import_status IN ('idle', 'pending', 'in_progress', 'completed', 'error'));

-- Index pour le scan du cron (filtre les jobs actifs uniquement)
CREATE INDEX IF NOT EXISTS idx_provider_connections_import_pending
  ON provider_connections (import_status, import_updated_at)
  WHERE import_status IN ('pending', 'in_progress');
```

- [ ] **Step 2: Rappeler à Franck d'appliquer la migration**

Afficher dans la conversation :
> ⚠️ Migration `009_strava_initial_import.sql` créée. Franck doit la coller dans le Dashboard Supabase (SQL Editor) avant que le code suivant fonctionne. Les migrations ne s'auto-appliquent pas (cf. memory `feedback_supabase_migrations`).

- [ ] **Step 3: Commit**

```bash
git add web/supabase/migrations/009_strava_initial_import.sql
git commit -m "feat(db): add import tracking columns to provider_connections"
```

---

## Task 2 : Refacto api.ts — exposer fetchStravaActivitiesPage

**Files:**
- Modify: `web/lib/providers/strava/api.ts`

Le syncer existant fait une boucle interne. On veut une fonction qui fetch UNE seule page (utilisée par le cron import) sans casser le syncer existant.

- [ ] **Step 1: Ajouter `before` aux types et exposer la fonction de page**

Remplacer le contenu de `web/lib/providers/strava/api.ts` par :

```ts
import type { StravaActivity } from './mapper'

const STRAVA_BASE = 'https://www.strava.com/api/v3'
const PER_PAGE = 200

export type FetchActivitiesOptions = {
  after?: number
  before?: number
  maxActivities?: number
}

export type FetchPageOptions = {
  after?: number
  before?: number
  perPage?: number
}

export async function fetchStravaActivitiesPage(
  accessToken: string,
  page: number,
  options: FetchPageOptions = {}
): Promise<StravaActivity[]> {
  const params = new URLSearchParams({
    per_page: String(options.perPage ?? PER_PAGE),
    page: String(page),
    ...(options.after !== undefined ? { after: String(options.after) } : {}),
    ...(options.before !== undefined ? { before: String(options.before) } : {}),
  })

  const res = await fetch(`${STRAVA_BASE}/athlete/activities?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (res.status === 429) {
    const err = new Error('Strava rate limit (429)') as Error & { rateLimited: true }
    err.rateLimited = true
    throw err
  }

  if (!res.ok) throw new Error(`Strava API error: ${res.status}`)

  return res.json() as Promise<StravaActivity[]>
}

export async function fetchStravaActivity(
  accessToken: string,
  activityId: number
): Promise<StravaActivity> {
  const res = await fetch(`${STRAVA_BASE}/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Strava API error: ${res.status}`)
  return res.json() as Promise<StravaActivity>
}

export async function fetchStravaActivities(
  accessToken: string,
  options: FetchActivitiesOptions = {}
): Promise<StravaActivity[]> {
  const max = options.maxActivities ?? 1000
  const all: StravaActivity[] = []
  let page = 1

  while (all.length < max) {
    const batch = await fetchStravaActivitiesPage(accessToken, page, {
      after: options.after,
      before: options.before,
    })
    all.push(...batch)
    if (batch.length < PER_PAGE) break
    page++
  }

  return all.slice(0, max)
}
```

- [ ] **Step 2: Vérifier que le syncer existant compile et passe ses tests**

Run: `cd web && npm test -- strava-mapper`
Expected: PASS (4 tests)

- [ ] **Step 3: Commit**

```bash
git add web/lib/providers/strava/api.ts
git commit -m "refactor(strava): expose single-page fetch with before cursor"
```

---

## Task 3 : Lib import.ts — tests d'abord (TDD)

**Files:**
- Create: `web/__tests__/providers/strava-import.test.ts`
- Create: `web/lib/providers/strava/import.ts`

### 3a. Tests

- [ ] **Step 1: Écrire les tests**

Créer `web/__tests__/providers/strava-import.test.ts` :

```ts
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
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `cd web && npm test -- strava-import`
Expected: FAIL avec "Cannot find module '@/lib/providers/strava/import'"

### 3b. Implémentation

- [ ] **Step 3: Créer la lib import.ts**

Créer `web/lib/providers/strava/import.ts` :

```ts
import { fetchStravaActivitiesPage } from './api'
import { getValidStravaToken } from './token'
import { stravaToNormalized } from './mapper'
import { importActivities } from '@/lib/sync/import-activities'
import { createServiceClient } from '@/lib/database/supabase-server'
import type { StravaActivity } from './mapper'

const PAGE_SIZE = 200

export type TickResult = {
  done: boolean
  savedThisTick: number
  rateLimited: boolean
}

export async function processOneImportTick(userId: string): Promise<TickResult> {
  const supabase = createServiceClient()

  // Lire le curseur courant
  const { data: connection, error: connErr } = await supabase
    .from('provider_connections')
    .select('import_oldest_at')
    .eq('user_id', userId)
    .eq('provider', 'strava')
    .single()

  if (connErr || !connection) {
    throw new Error('No Strava connection found for user')
  }

  const oldestAt = (connection as { import_oldest_at: string | null }).import_oldest_at
  const before = oldestAt ? Math.floor(new Date(oldestAt).getTime() / 1000) : undefined

  // Marquer in_progress (anti-chevauchement via updated_at)
  await supabase
    .from('provider_connections')
    .update({
      import_status: 'in_progress',
      import_updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', 'strava')

  let batch: StravaActivity[]
  try {
    const token = await getValidStravaToken(userId)
    batch = await fetchStravaActivitiesPage(token, 1, { before, perPage: PAGE_SIZE })
  } catch (err) {
    if ((err as { rateLimited?: boolean }).rateLimited) {
      // 429: garder status pending, retry au prochain tick
      await supabase
        .from('provider_connections')
        .update({
          import_status: 'pending',
          import_updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('provider', 'strava')
      return { done: false, savedThisTick: 0, rateLimited: true }
    }
    // Autre erreur: marquer error et rethrow
    await supabase
      .from('provider_connections')
      .update({
        import_status: 'error',
        import_last_error: err instanceof Error ? err.message : String(err),
        import_updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', 'strava')
    throw err
  }

  // Cas batch vide: terminé
  if (batch.length === 0) {
    await supabase
      .from('provider_connections')
      .update({
        import_status: 'completed',
        import_completed_at: new Date().toISOString(),
        import_updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', 'strava')
    return { done: true, savedThisTick: 0, rateLimited: false }
  }

  // Charger profil pour CES
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('max_hr, resting_hr, threshold_hr, aerobic_threshold_hr, ftp_watts, threshold_pace_run_sec_per_km, threshold_pace_trail_sec_per_km')
    .eq('id', userId)
    .single()
  const profile = (profileRow as Record<string, number | null> | null) ?? {}

  // Mapper + importer
  const normalized = batch.map((a) => stravaToNormalized(userId, a))
  const importResult = await importActivities(normalized, profile)

  // Calculer nouveau curseur (plus ancienne activité du batch)
  const newOldestUnix = batch.reduce((min, a) => {
    const t = new Date(a.start_date).getTime()
    return t < min ? t : min
  }, Number.POSITIVE_INFINITY)
  const newOldestIso = new Date(newOldestUnix).toISOString()

  const isComplete = batch.length < PAGE_SIZE
  const now = new Date().toISOString()

  // Mettre à jour curseur, total, status final
  const updates: Record<string, unknown> = {
    import_oldest_at: newOldestIso,
    import_updated_at: now,
  }
  // Incrémenter total via SQL: on lit + écrit. Ici on fait simple: select courant + update.
  const { data: currentRow } = await supabase
    .from('provider_connections')
    .select('import_total')
    .eq('user_id', userId)
    .eq('provider', 'strava')
    .single()
  const currentTotal = (currentRow as { import_total: number } | null)?.import_total ?? 0
  updates.import_total = currentTotal + importResult.saved

  if (isComplete) {
    updates.import_status = 'completed'
    updates.import_completed_at = now
  }

  await supabase
    .from('provider_connections')
    .update(updates)
    .eq('user_id', userId)
    .eq('provider', 'strava')

  return { done: isComplete, savedThisTick: importResult.saved, rateLimited: false }
}
```

- [ ] **Step 4: Lancer les tests**

Run: `cd web && npm test -- strava-import`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add web/lib/providers/strava/import.ts web/__tests__/providers/strava-import.test.ts
git commit -m "feat(strava): add processOneImportTick for paginated background import"
```

---

## Task 4 : Modifier callback OAuth pour déclencher l'import

**Files:**
- Modify: `web/app/api/strava/callback/route.ts`

- [ ] **Step 1: Ajouter les champs import_* au upsert**

Dans `web/app/api/strava/callback/route.ts`, remplacer le bloc `await supabase.from('provider_connections').upsert({...})` par :

```ts
const now = new Date().toISOString()
await supabase.from('provider_connections').upsert({
  user_id:         user.id,
  provider:        'strava',
  provider_user_id:String(tokens.athlete.id),
  access_token:    tokens.access_token,
  refresh_token:   tokens.refresh_token,
  token_expires_at:new Date(tokens.expires_at * 1000).toISOString(),
  scope:           'activity:read_all,profile:read_all',
  athlete_data:    tokens.athlete,
  updated_at:      now,
  import_status:   'pending',
  import_started_at: now,
  import_completed_at: null,
  import_oldest_at: null,
  import_total:    0,
  import_last_error: null,
  import_updated_at: null,
}, { onConflict: 'user_id,provider' })
```

- [ ] **Step 2: Vérifier que le build passe**

Run: `cd web && npx tsc --noEmit`
Expected: pas d'erreur

- [ ] **Step 3: Commit**

```bash
git add web/app/api/strava/callback/route.ts
git commit -m "feat(strava): trigger initial import on OAuth callback"
```

---

## Task 5 : Endpoint cron

**Files:**
- Create: `web/app/api/cron/strava-import/route.ts`

- [ ] **Step 1: Créer le handler cron**

Créer `web/app/api/cron/strava-import/route.ts` :

```ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/database/supabase-server'
import { processOneImportTick } from '@/lib/providers/strava/import'

const MAX_USERS_PER_TICK = 5
const STALE_THRESHOLD_SEC = 50

export async function GET(request: Request) {
  // Auth: header injecté par Vercel pour les crons
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const staleCutoff = new Date(Date.now() - STALE_THRESHOLD_SEC * 1000).toISOString()

  // Sélection: jobs actifs et non-en-cours
  const { data: jobs, error } = await supabase
    .from('provider_connections')
    .select('user_id')
    .eq('provider', 'strava')
    .in('import_status', ['pending', 'in_progress'])
    .or(`import_updated_at.is.null,import_updated_at.lt.${staleCutoff}`)
    .limit(MAX_USERS_PER_TICK)

  if (error) {
    console.error('[cron strava-import] select error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const userIds = (jobs ?? []).map((j) => (j as { user_id: string }).user_id)
  console.log('[cron strava-import] processing', userIds.length, 'user(s)')

  const results = await Promise.allSettled(
    userIds.map(async (userId) => {
      try {
        const r = await processOneImportTick(userId)
        return { userId, ...r }
      } catch (err) {
        console.error('[cron strava-import] user', userId, 'error:', err)
        return { userId, error: err instanceof Error ? err.message : String(err) }
      }
    })
  )

  return NextResponse.json({
    processed: userIds.length,
    results: results.map((r) => r.status === 'fulfilled' ? r.value : { error: String(r.reason) }),
  })
}
```

- [ ] **Step 2: Vérifier que le build passe**

Run: `cd web && npx tsc --noEmit`
Expected: pas d'erreur

- [ ] **Step 3: Commit**

```bash
git add web/app/api/cron/strava-import/route.ts
git commit -m "feat(cron): add Strava initial import worker endpoint"
```

---

## Task 6 : Endpoint import-status (GET + POST retry)

**Files:**
- Create: `web/app/api/strava/import-status/route.ts`

- [ ] **Step 1: Créer l'endpoint**

Créer `web/app/api/strava/import-status/route.ts` :

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('provider_connections')
    .select('import_status, import_total, import_oldest_at, import_started_at, import_completed_at, import_last_error')
    .eq('user_id', user.id)
    .eq('provider', 'strava')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!data) {
    return NextResponse.json(
      {
        status: 'idle',
        total: 0,
        oldestAt: null,
        startedAt: null,
        completedAt: null,
        error: null,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const row = data as {
    import_status: string
    import_total: number
    import_oldest_at: string | null
    import_started_at: string | null
    import_completed_at: string | null
    import_last_error: string | null
  }

  return NextResponse.json(
    {
      status: row.import_status,
      total: row.import_total,
      oldestAt: row.import_oldest_at,
      startedAt: row.import_started_at,
      completedAt: row.import_completed_at,
      error: row.import_last_error,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { action?: string }
  if (body.action !== 'retry') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const { error } = await supabase
    .from('provider_connections')
    .update({
      import_status: 'pending',
      import_last_error: null,
      import_updated_at: null,
    })
    .eq('user_id', user.id)
    .eq('provider', 'strava')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Vérifier que le build passe**

Run: `cd web && npx tsc --noEmit`
Expected: pas d'erreur

- [ ] **Step 3: Commit**

```bash
git add web/app/api/strava/import-status/route.ts
git commit -m "feat(api): add Strava import-status polling + retry endpoint"
```

---

## Task 7 : Composant ImportProgressBanner

**Files:**
- Create: `web/components/ui/ImportProgressBanner.tsx`

- [ ] **Step 1: Créer le composant**

Créer `web/components/ui/ImportProgressBanner.tsx` :

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'

const POLL_INTERVAL_MS = 10_000
const COMPLETED_DISPLAY_MS = 5_000
const COMPLETED_DISMISSED_KEY = 'strava_import_completed_dismissed'

type ImportStatus = {
  status: 'idle' | 'pending' | 'in_progress' | 'completed' | 'error'
  total: number
  oldestAt: string | null
  startedAt: string | null
  completedAt: string | null
  error: string | null
}

function formatMonth(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export function ImportProgressBanner() {
  const [data, setData] = useState<ImportStatus | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [hideCompleted, setHideCompleted] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const completedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function fetchStatus(): Promise<ImportStatus | null> {
    try {
      const res = await fetch('/api/strava/import-status', { cache: 'no-store' })
      if (!res.ok) return null
      return (await res.json()) as ImportStatus
    } catch {
      return null
    }
  }

  useEffect(() => {
    let cancelled = false

    async function tick() {
      const next = await fetchStatus()
      if (cancelled) return
      setData(next)
      if (next && (next.status === 'completed' || next.status === 'error')) {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }

    tick()
    intervalRef.current = setInterval(tick, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (completedTimerRef.current) clearTimeout(completedTimerRef.current)
    }
  }, [])

  // Auto-hide du bandeau "completed" après 5s, persisté en localStorage
  useEffect(() => {
    if (data?.status !== 'completed') return
    const dismissedAt = typeof window !== 'undefined'
      ? window.localStorage.getItem(COMPLETED_DISMISSED_KEY)
      : null
    if (dismissedAt && data.completedAt && dismissedAt === data.completedAt) {
      setHideCompleted(true)
      return
    }
    completedTimerRef.current = setTimeout(() => {
      setHideCompleted(true)
      if (data.completedAt && typeof window !== 'undefined') {
        window.localStorage.setItem(COMPLETED_DISMISSED_KEY, data.completedAt)
      }
    }, COMPLETED_DISPLAY_MS)
  }, [data])

  async function handleRetry() {
    setRetrying(true)
    try {
      await fetch('/api/strava/import-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry' }),
      })
      const next = await fetchStatus()
      setData(next)
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(async () => {
        const r = await fetchStatus()
        setData(r)
        if (r && (r.status === 'completed' || r.status === 'error')) {
          if (intervalRef.current) clearInterval(intervalRef.current)
        }
      }, POLL_INTERVAL_MS)
    } finally {
      setRetrying(false)
    }
  }

  if (!data || data.status === 'idle') return null
  if (data.status === 'completed' && hideCompleted) return null

  const baseClasses = 'sticky top-0 z-40 w-full h-9 flex items-center justify-center gap-2 px-3 text-xs font-medium transition-all duration-300'

  if (data.status === 'pending' || data.status === 'in_progress') {
    return (
      <div className={`${baseClasses} bg-trail-accent/10 text-trail-text`}>
        <Loader2 size={14} className="animate-spin" />
        <span>
          Import Strava — <strong>{data.total}</strong> activité{data.total > 1 ? 's' : ''}
          {data.oldestAt ? ` (remonté jusqu'à ${formatMonth(data.oldestAt)})` : ''}
        </span>
      </div>
    )
  }

  if (data.status === 'completed') {
    return (
      <div className={`${baseClasses} bg-green-500/15 text-green-400`}>
        <CheckCircle2 size={14} />
        <span>Import Strava terminé — {data.total} activité{data.total > 1 ? 's' : ''}</span>
      </div>
    )
  }

  // status === 'error'
  return (
    <div className={`${baseClasses} bg-red-500/15 text-red-400`}>
      <AlertTriangle size={14} />
      <span className="truncate">Import Strava : {data.error ?? 'erreur inconnue'}</span>
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="ml-2 px-2 py-0.5 rounded border border-red-400/40 text-red-300 hover:bg-red-500/20 disabled:opacity-50"
      >
        {retrying ? '…' : 'Réessayer'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier que le composant compile**

Run: `cd web && npx tsc --noEmit`
Expected: pas d'erreur

- [ ] **Step 3: Commit**

```bash
git add web/components/ui/ImportProgressBanner.tsx
git commit -m "feat(ui): add Strava import progress banner with polling + retry"
```

---

## Task 8 : Mounter la bannière dans le layout authenticated

**Files:**
- Modify: `web/app/(main)/layout.tsx`

- [ ] **Step 1: Ajouter la bannière en haut du layout**

Remplacer le contenu de `web/app/(main)/layout.tsx` par :

```tsx
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/navigation/AppShell'
import { ImportProgressBanner } from '@/components/ui/ImportProgressBanner'
import { getServerUser } from '@/lib/database/get-user'
import type { ReactNode } from 'react'

export default async function MainLayout({ children }: { children: ReactNode }) {
  const user = await getServerUser()
  if (!user) redirect('/login')
  return (
    <>
      <ImportProgressBanner />
      <AppShell>{children}</AppShell>
    </>
  )
}
```

- [ ] **Step 2: Vérifier que le build passe**

Run: `cd web && npx tsc --noEmit`
Expected: pas d'erreur

- [ ] **Step 3: Commit**

```bash
git add web/app/(main)/layout.tsx
git commit -m "feat(ui): mount ImportProgressBanner in authenticated layout"
```

---

## Task 9 : Configurer le cron Vercel + variable d'env

**Files:**
- Modify: `web/vercel.json`

- [ ] **Step 1: Ajouter la config cron**

Remplacer le contenu de `web/vercel.json` par :

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "outputDirectory": ".next",
  "crons": [
    { "path": "/api/cron/strava-import", "schedule": "* * * * *" }
  ]
}
```

- [ ] **Step 2: Documenter la variable d'env requise**

Afficher dans la conversation :
> ⚠️ Variable d'environnement requise sur Vercel (et dans `.env.local`) :
> - `CRON_SECRET` — générer avec : `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
>
> Vercel injecte automatiquement le header `Authorization: Bearer ${CRON_SECRET}` quand il déclenche le cron, donc rien à faire côté Vercel UI au-delà d'ajouter la variable dans Settings → Environment Variables.

- [ ] **Step 3: Commit**

```bash
git add web/vercel.json
git commit -m "feat(deploy): schedule Strava import cron every minute"
```

---

## Task 10 : Smoke test manuel

**Pas de fichier modifié — vérification end-to-end.**

- [ ] **Step 1: Vérifier que la migration SQL a été appliquée**

Demander à Franck de confirmer qu'il a collé `009_strava_initial_import.sql` dans le Dashboard Supabase. Sinon, le déploiement va échouer au runtime.

- [ ] **Step 2: Vérifier que `CRON_SECRET` est défini sur Vercel**

Demander à Franck de confirmer dans Vercel Dashboard → Settings → Environment Variables.

- [ ] **Step 3: Push pour déclencher le déploiement**

```bash
git push origin master
```

Vercel auto-déploie. Attendre la fin du build.

- [ ] **Step 4: Tester le flow complet**

1. Aller sur https://trail-cockpit.vercel.app/settings
2. Déconnecter Strava si déjà connecté
3. Reconnecter Strava
4. Être redirigé vers `/settings?strava=connected`
5. Naviguer vers `/dashboard`
6. **Vérifier la bannière** « Import Strava — N activités » en haut
7. Attendre 1-2 min, recharger : le compteur doit augmenter
8. Quand `completed` : flash vert 5s puis disparaît

- [ ] **Step 5: Vérifier les logs Vercel du cron**

Vercel Dashboard → Project → Deployments → [latest] → Functions → `/api/cron/strava-import`
Logs attendus toutes les minutes : `[cron strava-import] processing 1 user(s)`

---

## Notes pour l'implémenteur

- **Memory feedback** : ne PAS exécuter `vercel --prod` — Vercel auto-deploy via `git push` (cf. memory `feedback_deployment`).
- **Memory feedback** : les migrations Supabase ne s'auto-appliquent pas — toujours rappeler à Franck de coller le SQL (cf. memory `feedback_supabase_migrations`).
- **Memory feedback** : travailler dans `web/`, pas dans Android (cf. memory `feedback_android_vs_web`).
- Le syncer incrémental existant (bouton « Sync » dans Settings) reste fonctionnel et indépendant de l'import initial.
- Si pendant les tests Strava renvoie 401, vérifier que le scope OAuth est `activity:read_all` (pas juste `activity:read`).
