# Re-check & diff — Lot 2a (détection) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un cron re-fetch les tableaux des courses planifiées, détecte un changement (hash) ou une nouvelle édition, et enregistre un `pending_diff` sur `race_tableau_meta` — sans jamais écraser les waypoints.

**Architecture:** Logique pure isolée (`diffWaypoints`, `isDueForRecheck`, `buildPendingDiff`) testable sans DB ; orchestration IO mince (`runFreshnessRecheck`, service role) ; route cron Bearer ; déclencheur GitHub Actions. Réutilise les parsers + `hashWaypoints` + `computeFreshness` du Lot 1.

**Tech Stack:** Next.js 14 route handlers, TypeScript, Supabase service role, Jest, GitHub Actions.

**Conventions repo :** tests depuis `web/` (`cd web`) ; `tsc --noEmit` + `eslint` autoritatifs local ; migrations Supabase non auto-appliquées ; ~50 tests i18n échouent en pré-existant (lancer suites ciblées) ; **working-tree contient des changements NON liés (Garmin/config) → staging EXPLICITE par fichier, jamais `git add -A`.** Spec : `docs/superpowers/specs/2026-06-11-race-freshness-recheck-detection-design.md`.

**Dépendances Lot 1 (déjà en place) :** `web/lib/race-import/freshness.ts` (`computeFreshness`, `DetectedEdition`), `hash.ts` (`hashWaypoints`), `sources/` (`findParserForUrl`), `race_tableau_meta` (migration 039).

---

## Task 1 : Migration 040 (colonnes pending_diff)

**Files:**
- Create: `web/supabase/migrations/040_race_tableau_pending_diff.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- Migration: 040 - race_tableau_meta.pending_diff
-- Diff de re-check en attente de validation utilisateur (Lot 2b). Jamais d'écrasement
-- silencieux : le re-check (Lot 2a) enregistre ici, l'utilisateur valide ensuite.
alter table race_tableau_meta add column if not exists pending_diff    jsonb;
alter table race_tableau_meta add column if not exists pending_diff_at  timestamptz;
```

- [ ] **Step 2 : Commit (staging explicite)**

```bash
git add web/supabase/migrations/040_race_tableau_pending_diff.sql
git commit -m "feat(race-import): migration 040 pending_diff sur race_tableau_meta"
```

> Rappel post-merge : coller dans le SQL Editor Supabase (non auto-appliquée).

---

## Task 2 : Types (PendingDiff + diff waypoints)

**Files:**
- Modify: `web/types/plan.ts`

- [ ] **Step 1 : Ajouter les types (additif, après `RaceTableauMeta`)**

```ts
// === Diff de re-check d'un tableau (Lot 2) ===
type RaceWaypointData = Omit<RaceWaypoint, 'id' | 'raceId'>

export interface WaypointFieldChange {
  field: 'km' | 'dPlus' | 'dMoins' | 'cutoffRaw' | 'supplies'
  from: unknown
  to: unknown
}
export interface WaypointModified {
  name: string
  changes: WaypointFieldChange[]
}
export interface WaypointDiff {
  added: RaceWaypointData[]
  removed: RaceWaypointData[]
  modified: WaypointModified[]
}

export interface PendingDiff {
  kind: 'changed' | 'new_edition'
  detectedAt: string                 // ISO
  newWaypoints: RaceWaypointData[]   // à appliquer si l'utilisateur accepte (Lot 2b)
  newMeta: {
    editionYear: number | null
    editionDate: string | null
    dateExplicit: boolean
    freshnessStatus: FreshnessStatus
    sourceHash: string
  }
  summary: {
    added: number
    removed: number
    modified: number
    modifiedDetails: WaypointModified[]
  }
}
```

- [ ] **Step 2 : Vérifier + commit**

```bash
cd web && npx tsc --noEmit
```
```bash
git add web/types/plan.ts
git commit -m "feat(race-import): types WaypointDiff + PendingDiff (Lot 2a)"
```

---

## Task 3 : `diffWaypoints` (fonction pure)

**Files:**
- Create: `web/lib/race-import/waypoint-diff.ts`
- Test: `web/__tests__/lib/race-import/waypoint-diff.test.ts`

- [ ] **Step 1 : Écrire le test**

```ts
import { diffWaypoints } from '@/lib/race-import/waypoint-diff'

const wp = (over: any = {}) => ({
  orderIndex: 0, name: 'A', km: 0, kmInter: null, dPlus: 0, dMoins: 0,
  cutoffRaw: null, cutoffKind: null, type: 'depart', supplies: [], targetOverrideSec: null, ...over,
})

describe('diffWaypoints', () => {
  it('identiques → diff vide', () => {
    const a = [wp({ name: 'Départ' }), wp({ name: 'Arrivée', km: 100 })]
    const d = diffWaypoints(a, a.map((x) => ({ ...x })))
    expect(d.added).toEqual([]); expect(d.removed).toEqual([]); expect(d.modified).toEqual([])
  })

  it('ajout / suppression par nom', () => {
    const oldW = [wp({ name: 'Départ' }), wp({ name: 'Col', km: 50 })]
    const newW = [wp({ name: 'Départ' }), wp({ name: 'Refuge', km: 60 })]
    const d = diffWaypoints(oldW, newW)
    expect(d.added.map((w) => w.name)).toEqual(['Refuge'])
    expect(d.removed.map((w) => w.name)).toEqual(['Col'])
    expect(d.modified).toEqual([])
  })

  it('modification d\'un champ (barrière) sur waypoint apparié par nom (accents/casse)', () => {
    const oldW = [wp({ name: 'Col de Bavella', km: 50, cutoffRaw: 'sam. 10:00' })]
    const newW = [wp({ name: 'col de bavella', km: 50, cutoffRaw: 'sam. 11:30' })]
    const d = diffWaypoints(oldW, newW)
    expect(d.added).toEqual([]); expect(d.removed).toEqual([])
    expect(d.modified).toHaveLength(1)
    expect(d.modified[0].changes.map((c) => c.field)).toEqual(['cutoffRaw'])
  })

  it('km + supplies (ordre indifférent) détectés', () => {
    const oldW = [wp({ name: 'R1', km: 12, supplies: ['liquid', 'solid'] })]
    const newW = [wp({ name: 'R1', km: 13, supplies: ['solid', 'liquid', 'hot'] })]
    const d = diffWaypoints(oldW, newW)
    const fields = d.modified[0].changes.map((c) => c.field).sort()
    expect(fields).toEqual(['km', 'supplies'])
  })

  it('appariement fallback km quand le nom diffère (± 1 km)', () => {
    const oldW = [wp({ name: 'Ravito 1', km: 30, dPlus: 1000 })]
    const newW = [wp({ name: 'Ravitaillement 1', km: 30.5, dPlus: 1200 })]
    const d = diffWaypoints(oldW, newW)
    expect(d.added).toEqual([]); expect(d.removed).toEqual([])
    expect(d.modified[0].changes.map((c) => c.field)).toContain('dPlus')
  })
})
```
Run: `cd web && npx jest __tests__/lib/race-import/waypoint-diff.test.ts` → FAIL (module absent).

- [ ] **Step 2 : Implémenter `web/lib/race-import/waypoint-diff.ts`**

```ts
// Diff waypoint-par-waypoint entre deux versions d'un tableau. Pur, sans IO.
import type { RaceWaypoint, WaypointDiff, WaypointModified, WaypointFieldChange } from '@/types/plan'

type WP = Omit<RaceWaypoint, 'id' | 'raceId'>

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function suppliesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort(); const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

function fieldChanges(o: WP, n: WP): WaypointFieldChange[] {
  const changes: WaypointFieldChange[] = []
  if (o.km !== n.km) changes.push({ field: 'km', from: o.km, to: n.km })
  if (o.dPlus !== n.dPlus) changes.push({ field: 'dPlus', from: o.dPlus, to: n.dPlus })
  if (o.dMoins !== n.dMoins) changes.push({ field: 'dMoins', from: o.dMoins, to: n.dMoins })
  if (o.cutoffRaw !== n.cutoffRaw) changes.push({ field: 'cutoffRaw', from: o.cutoffRaw, to: n.cutoffRaw })
  if (!suppliesEqual(o.supplies, n.supplies)) changes.push({ field: 'supplies', from: o.supplies, to: n.supplies })
  return changes
}

export function diffWaypoints(oldWps: WP[], newWps: WP[]): WaypointDiff {
  const newRemaining = newWps.map((w, i) => ({ w, i, used: false }))
  const modified: WaypointModified[] = []
  const removed: WP[] = []

  const findMatch = (o: WP) => {
    // 1) par nom normalisé
    let m = newRemaining.find((c) => !c.used && norm(c.w.name) === norm(o.name))
    // 2) fallback : km le plus proche encore libre, tolérance ± 1 km
    if (!m) {
      let best: typeof newRemaining[number] | undefined
      let bestD = Infinity
      for (const c of newRemaining) {
        if (c.used) continue
        const d = Math.abs(c.w.km - o.km)
        if (d <= 1 && d < bestD) { best = c; bestD = d }
      }
      m = best
    }
    return m
  }

  for (const o of oldWps) {
    const m = findMatch(o)
    if (!m) { removed.push(o); continue }
    m.used = true
    const changes = fieldChanges(o, m.w)
    if (changes.length > 0) modified.push({ name: o.name, changes })
  }
  const added = newRemaining.filter((c) => !c.used).map((c) => c.w)
  return { added, removed, modified }
}
```
Run le test → PASS. `npx tsc --noEmit` → 0.

- [ ] **Step 3 : Commit**

```bash
git add web/lib/race-import/waypoint-diff.ts web/__tests__/lib/race-import/waypoint-diff.test.ts
git commit -m "feat(race-import): diffWaypoints pur (added/removed/modified, appariement nom+km)"
```

---

## Task 4 : `recheck-logic.ts` (isDueForRecheck + buildPendingDiff, purs)

**Files:**
- Create: `web/lib/race-import/recheck-logic.ts`
- Test: `web/__tests__/lib/race-import/recheck-logic.test.ts`

Purs (pas de `server-only`, pas de `node:`) : réutilisent `computeFreshness` (client-safe) et `diffWaypoints`. `buildPendingDiff` reçoit `newHash` et `nowISO` en paramètres (déterminisme).

- [ ] **Step 1 : Écrire le test**

```ts
import { isDueForRecheck, buildPendingDiff } from '@/lib/race-import/recheck-logic'

describe('isDueForRecheck', () => {
  const now = '2026-06-28T12:00:00.000Z'
  const ago = (days: number) => new Date(Date.parse(now) - days * 86400000).toISOString()
  it('≤3j : due si dernier > 1j', () => {
    expect(isDueForRecheck(2, ago(2), now)).toBe(true)
    expect(isDueForRecheck(2, ago(0.5), now)).toBe(false)
  })
  it('≤14j : due si dernier > 7j', () => {
    expect(isDueForRecheck(10, ago(8), now)).toBe(true)
    expect(isDueForRecheck(10, ago(3), now)).toBe(false)
  })
  it('≤30j : due si dernier > 14j', () => {
    expect(isDueForRecheck(25, ago(15), now)).toBe(true)
    expect(isDueForRecheck(25, ago(10), now)).toBe(false)
  })
  it('>30j : jamais', () => {
    expect(isDueForRecheck(45, ago(60), now)).toBe(false)
  })
  it('jamais checké (null) → due si dans une fenêtre', () => {
    expect(isDueForRecheck(10, null, now)).toBe(true)
    expect(isDueForRecheck(45, null, now)).toBe(false)
  })
  it('course passée → false', () => {
    expect(isDueForRecheck(-1, ago(30), now)).toBe(false)
  })
})

const wp = (over: any = {}) => ({
  orderIndex: 0, name: 'A', km: 0, kmInter: null, dPlus: 0, dMoins: 0,
  cutoffRaw: null, cutoffKind: null, type: 'depart', supplies: [], targetOverrideSec: null, ...over,
})
const extracted = (over: any = {}) => ({
  raceName: null, editionYear: null, editionDate: null, dateExplicit: false,
  startDayOfMonth: null, startTimeRaw: null, waypoints: [wp({ name: 'Départ' }), wp({ name: 'Arrivée', km: 100 })],
  ...over,
})
const now = '2026-06-28T12:00:00.000Z'

describe('buildPendingDiff', () => {
  it('hash identique, pas de changement d\'édition → null', () => {
    const newData = extracted()
    const out = buildPendingDiff({
      oldWaypoints: newData.waypoints, newData, newHash: 'H',
      meta: { source_hash: 'H', edition_year: 2026, freshness_status: 'confirmed' },
      raceDateISO: '2026-07-12', nowISO: now,
    })
    expect(out).toBeNull()
  })

  it('hash différent → pending changed avec résumé', () => {
    const newData = extracted({ waypoints: [wp({ name: 'Départ' }), wp({ name: 'Arrivée', km: 102, cutoffRaw: 'X' })] })
    const out = buildPendingDiff({
      oldWaypoints: [wp({ name: 'Départ' }), wp({ name: 'Arrivée', km: 100 })], newData, newHash: 'H2',
      meta: { source_hash: 'H1', edition_year: 2026, freshness_status: 'confirmed' },
      raceDateISO: '2026-07-12', nowISO: now,
    })
    expect(out!.kind).toBe('changed')
    expect(out!.detectedAt).toBe(now)
    expect(out!.newMeta.sourceHash).toBe('H2')
    expect(out!.summary.modified + out!.summary.added).toBeGreaterThan(0)
  })

  it('édition N-1 → cible (provisional→confirmed) → new_edition', () => {
    const newData = extracted({ editionYear: 2026, editionDate: '2026-07-12', dateExplicit: true })
    const out = buildPendingDiff({
      oldWaypoints: newData.waypoints, newData, newHash: 'H',  // hash identique mais édition avance
      meta: { source_hash: 'H', edition_year: 2025, freshness_status: 'provisional_previous_edition' },
      raceDateISO: '2026-07-12', nowISO: now,
    })
    expect(out!.kind).toBe('new_edition')
    expect(out!.newMeta.freshnessStatus).toBe('confirmed')
  })
})
```
Run → FAIL.

- [ ] **Step 2 : Implémenter `web/lib/race-import/recheck-logic.ts`**

```ts
// Décisions PURES du re-check (sans IO/server-only) : cadence + construction du diff.
import type { ExtractedRaceData, PendingDiff, RaceWaypoint } from '@/types/plan'
import { computeFreshness } from './freshness'
import { diffWaypoints } from './waypoint-diff'

type WP = Omit<RaceWaypoint, 'id' | 'raceId'>

// Cadence resserrée : approxime J-30/J-14/J-3 avec pour seul état source_checked_at.
export function isDueForRecheck(
  daysUntilRace: number,
  lastCheckedAtISO: string | null,
  nowISO: string,
): boolean {
  if (daysUntilRace < 0) return false
  let minStaleDays: number
  if (daysUntilRace <= 3) minStaleDays = 1
  else if (daysUntilRace <= 14) minStaleDays = 7
  else if (daysUntilRace <= 30) minStaleDays = 14
  else return false
  if (lastCheckedAtISO == null) return true
  const ageDays = (Date.parse(nowISO) - Date.parse(lastCheckedAtISO)) / 86400000
  return ageDays > minStaleDays
}

export interface BuildPendingDiffParams {
  oldWaypoints: WP[]
  newData: ExtractedRaceData
  newHash: string
  meta: { source_hash: string | null; edition_year: number | null; freshness_status: string }
  raceDateISO: string
  nowISO: string
}

// Compare la nouvelle source à la meta stockée → PendingDiff ou null (aucun changement).
export function buildPendingDiff(p: BuildPendingDiffParams): PendingDiff | null {
  const newFresh = computeFreshness(
    {
      editionYear: p.newData.editionYear,
      editionDate: p.newData.editionDate,
      dateExplicit: p.newData.dateExplicit,
      startDayOfMonth: p.newData.startDayOfMonth,
    },
    p.raceDateISO,
  )

  const isNewEdition =
    p.meta.freshness_status === 'provisional_previous_edition' &&
    (newFresh.freshnessStatus === 'confirmed' ||
      (newFresh.editionYear != null && p.meta.edition_year != null && newFresh.editionYear > p.meta.edition_year))
  const isChanged = p.newHash !== p.meta.source_hash

  if (!isNewEdition && !isChanged) return null

  const diff = diffWaypoints(p.oldWaypoints, p.newData.waypoints)
  return {
    kind: isNewEdition ? 'new_edition' : 'changed',
    detectedAt: p.nowISO,
    newWaypoints: p.newData.waypoints,
    newMeta: {
      editionYear: newFresh.editionYear,
      editionDate: newFresh.editionDate,
      dateExplicit: p.newData.dateExplicit,
      freshnessStatus: newFresh.freshnessStatus,
      sourceHash: p.newHash,
    },
    summary: {
      added: diff.added.length,
      removed: diff.removed.length,
      modified: diff.modified.length,
      modifiedDetails: diff.modified,
    },
  }
}
```
Run le test → PASS. `npx tsc --noEmit` → 0.

- [ ] **Step 3 : Commit**

```bash
git add web/lib/race-import/recheck-logic.ts web/__tests__/lib/race-import/recheck-logic.test.ts
git commit -m "feat(race-import): isDueForRecheck + buildPendingDiff (logique pure du re-check)"
```

---

## Task 5 : `runFreshnessRecheck` (orchestration service role)

**Files:**
- Create: `web/lib/race-import/recheck.ts`
- Test: `web/__tests__/lib/race-import/recheck.test.ts`

Glue IO mince : query (service role), filtre `isDueForRecheck`, fetch via parser, `hashWaypoints`, `buildPendingDiff`, upsert. Logique métier déjà testée (Tasks 3-4) ; ici on teste le câblage avec un client mocké.

- [ ] **Step 1 : Implémenter `web/lib/race-import/recheck.ts`**

```ts
import 'server-only'
import { createServiceClient } from '@/lib/database/supabase-server'
import { findParserForUrl } from './sources'
import { hashWaypoints } from './hash'
import { isDueForRecheck, buildPendingDiff } from './recheck-logic'
import { rowToRaceWaypoint } from './schema'

const MAX_RACES_PER_TICK = 5
const THROTTLE_MS = 300
const UA = 'TrailCockpitBot/1.0 (+https://trailcockpit.run)'  // (UA appliqué par les parsers/fetch)

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const daysUntil = (raceDateISO: string, nowMs: number) =>
  Math.ceil((Date.parse(raceDateISO + 'T00:00:00Z') - nowMs) / 86400000)

export async function runFreshnessRecheck(): Promise<{ checked: number; changed: number; newEdition: number }> {
  const supabase = createServiceClient()
  const nowMs = Date.now()
  const nowISO = new Date(nowMs).toISOString()
  const today = nowISO.slice(0, 10)

  // Courses à venir avec un tableau importé re-checkable et SANS diff déjà en attente.
  const { data: rows, error } = await supabase
    .from('race_tableau_meta')
    .select('race_id, source_url, source_hash, edition_year, freshness_status, source_checked_at, races!inner(date)')
    .not('source_url', 'is', null)
    .is('pending_diff', null)
    .gte('races.date', today)

  if (error || !rows) {
    console.error('[recheck] select error:', error?.message)
    return { checked: 0, changed: 0, newEdition: 0 }
  }

  // Filtre cadence + cap.
  const due = rows
    .filter((r: any) => isDueForRecheck(daysUntil(r.races.date, nowMs), r.source_checked_at, nowISO))
    .slice(0, MAX_RACES_PER_TICK)

  let changed = 0, newEdition = 0
  for (let i = 0; i < due.length; i++) {
    if (i > 0) await sleep(THROTTLE_MS)
    const r: any = due[i]
    const parser = findParserForUrl(r.source_url)
    if (!parser) continue  // générique/LLM : hors 2a
    try {
      const data = await parser.parse(r.source_url)
      if (data.waypoints.length === 0) continue
      const newHash = hashWaypoints(data.waypoints)

      // Anciens waypoints (l'« avant »).
      const { data: oldRows } = await supabase
        .from('race_waypoints').select('*').eq('race_id', r.race_id).order('order_index', { ascending: true })
      const oldWaypoints = (oldRows ?? []).map(rowToRaceWaypoint as any)
        .map(({ id: _i, raceId: _r, ...rest }: any) => rest)

      const pending = buildPendingDiff({
        oldWaypoints, newData: data, newHash,
        meta: { source_hash: r.source_hash, edition_year: r.edition_year, freshness_status: r.freshness_status },
        raceDateISO: r.races.date, nowISO,
      })

      const patch: Record<string, unknown> = { source_checked_at: nowISO }
      if (pending) {
        patch.pending_diff = pending
        patch.pending_diff_at = nowISO
        if (pending.kind === 'new_edition') newEdition++; else changed++
      }
      await supabase.from('race_tableau_meta').update(patch).eq('race_id', r.race_id)
    } catch (err) {
      // Best-effort : on n'avance PAS source_checked_at en cas d'échec de fetch.
      console.warn('[recheck] course', r.race_id, 'ignorée:', (err as Error).message)
    }
  }
  return { checked: due.length, changed, newEdition }
}
```

- [ ] **Step 2 : Test câblage (client mocké)**

```ts
jest.mock('@/lib/database/supabase-server', () => ({ createServiceClient: jest.fn() }))
jest.mock('@/lib/race-import/sources', () => ({ findParserForUrl: jest.fn() }))
jest.mock('@/lib/race-import/hash', () => ({ hashWaypoints: jest.fn(() => 'NEWHASH') }))

import { runFreshnessRecheck } from '@/lib/race-import/recheck'
import { createServiceClient } from '@/lib/database/supabase-server'
import { findParserForUrl } from '@/lib/race-import/sources'

const wp = (over: any = {}) => ({
  orderIndex: 0, name: 'A', km: 0, kmInter: null, dPlus: 0, dMoins: 0,
  cutoff_raw: null, cutoff_kind: null, type: 'depart', supplies: [], target_override_sec: null,
  race_id: 'r1', id: 'x', km_inter: null, d_plus: 0, d_moins: 0, ...over,
})

function makeClient(metaRows: any[], oldRows: any[], capture: any) {
  return {
    from(table: string) {
      if (table === 'race_tableau_meta') {
        const q: any = {
          select: () => q, not: () => q, is: () => q,
          gte: () => Promise.resolve({ data: metaRows, error: null }),
          update: (patch: any) => ({ eq: (_c: string, id: string) => { capture.push({ id, patch }); return Promise.resolve({ error: null }) } }),
        }
        return q
      }
      // race_waypoints
      const q2: any = { select: () => q2, eq: () => q2, order: () => Promise.resolve({ data: oldRows, error: null }) }
      return q2
    },
  }
}

describe('runFreshnessRecheck', () => {
  afterEach(() => jest.restoreAllMocks())
  const farFuture = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10) // ≤14j

  it('hash changé → update avec pending_diff', async () => {
    const capture: any[] = []
    ;(createServiceClient as jest.Mock).mockReturnValue(
      makeClient(
        [{ race_id: 'r1', source_url: 'https://x.livetrail.run/parcours.php?course=A', source_hash: 'OLD', edition_year: 2026, freshness_status: 'confirmed', source_checked_at: null, races: { date: farFuture } }],
        [wp({ name: 'Départ' })],
        capture,
      ),
    )
    ;(findParserForUrl as jest.Mock).mockReturnValue({
      id: 'livetrail',
      parse: async () => ({ raceName: null, editionYear: 2026, editionDate: null, dateExplicit: false, startDayOfMonth: null, startTimeRaw: null, waypoints: [{ orderIndex: 0, name: 'Départ', km: 0, kmInter: null, dPlus: 0, dMoins: 0, cutoffRaw: 'NEW', cutoffKind: 'clock_time', type: 'depart', supplies: [], targetOverrideSec: null }] }),
    })
    const res = await runFreshnessRecheck()
    expect(res.changed).toBe(1)
    expect(capture).toHaveLength(1)
    expect(capture[0].patch.pending_diff.kind).toBe('changed')
    expect(capture[0].patch.source_checked_at).toBeDefined()
  })

  it('hash identique → update source_checked_at SANS pending_diff', async () => {
    const capture: any[] = []
    ;(createServiceClient as jest.Mock).mockReturnValue(
      makeClient(
        [{ race_id: 'r1', source_url: 'https://x.livetrail.run/parcours.php?course=A', source_hash: 'NEWHASH', edition_year: 2026, freshness_status: 'confirmed', source_checked_at: null, races: { date: farFuture } }],
        [{ ...wp({ name: 'Départ' }), cutoff_raw: null }],
        capture,
      ),
    )
    ;(findParserForUrl as jest.Mock).mockReturnValue({
      id: 'livetrail',
      parse: async () => ({ raceName: null, editionYear: 2026, editionDate: null, dateExplicit: false, startDayOfMonth: null, startTimeRaw: null, waypoints: [{ orderIndex: 0, name: 'Départ', km: 0, kmInter: null, dPlus: 0, dMoins: 0, cutoffRaw: null, cutoffKind: null, type: 'depart', supplies: [], targetOverrideSec: null }] }),
    })
    const res = await runFreshnessRecheck()
    expect(res.changed).toBe(0)
    expect(capture[0].patch.pending_diff).toBeUndefined()
    expect(capture[0].patch.source_checked_at).toBeDefined()
  })
})
```
> Note implémenteur : adapte la forme du mock de query si la vraie chaîne supabase-js diffère ; l'objectif des tests = (1) hash changé ⇒ `pending_diff` posé, (2) hash identique ⇒ seulement `source_checked_at`. La **correction exacte de la requête PostgREST** (filtre sur `races!inner(date)`, `is('pending_diff', null)`) se vérifie au déploiement (pas de vraie DB en test).

Run: `cd web && npx jest __tests__/lib/race-import/recheck.test.ts && npx tsc --noEmit` → PASS, 0 tsc.

- [ ] **Step 3 : Commit**

```bash
git add web/lib/race-import/recheck.ts web/__tests__/lib/race-import/recheck.test.ts
git commit -m "feat(race-import): runFreshnessRecheck (orchestration service role, best-effort)"
```

---

## Task 6 : Route cron `race-freshness`

**Files:**
- Create: `web/app/api/cron/race-freshness/route.ts`
- Test: `web/__tests__/app/api/cron/race-freshness.test.ts`

Modèle exact : `web/app/api/cron/livetrail-catalog/route.ts`.

- [ ] **Step 1 : Test auth**

```ts
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
```
Run → FAIL (route absente).

- [ ] **Step 2 : Implémenter la route**

```ts
import { NextResponse } from 'next/server'
import { runFreshnessRecheck } from '@/lib/race-import/recheck'
import '@/lib/race-import/sources/livetrail' // side-effect: registerParser
import '@/lib/race-import/sources/utmb'       // side-effect: registerParser

export const runtime = 'nodejs'
export const maxDuration = 60

// Re-check de fraîcheur des tableaux des courses planifiées. Déclenché en externe (Bearer).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await runFreshnessRecheck()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[cron race-freshness]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
```
Run le test → PASS. `npx tsc --noEmit` → 0.

- [ ] **Step 3 : Commit**

```bash
git add web/app/api/cron/race-freshness/route.ts web/__tests__/app/api/cron/race-freshness.test.ts
git commit -m "feat(race-import): route cron race-freshness (Bearer CRON_SECRET)"
```

---

## Task 7 : Déclencheur GitHub Actions (quotidien)

**Files:**
- Create: `.github/workflows/race-freshness-recheck.yml`

- [ ] **Step 1 : Repérer le pattern existant**

Lis le workflow GA du cron `livetrail-catalog` (ou `strava-import`) dans `.github/workflows/` et **calque-toi dessus** (mêmes secrets `CRON_SECRET` + URL de prod, même style). Si un workflow cron existe déjà, copie sa structure exacte.

- [ ] **Step 2 : Écrire le workflow (modèle ; aligne sur l'existant)**

```yaml
name: race-freshness-recheck
on:
  schedule:
    - cron: '17 4 * * *'   # quotidien ~04:17 UTC (décalé des autres crons)
  workflow_dispatch:
jobs:
  recheck:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger re-check
        run: |
          curl -fsS -X GET "${{ secrets.APP_URL }}/api/cron/race-freshness" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```
> Si les workflows existants utilisent une URL en dur ou un autre nom de secret, **reprends exactement leur convention** (ne pas inventer `secrets.APP_URL` s'ils utilisent autre chose).

- [ ] **Step 3 : Commit**

```bash
git add .github/workflows/race-freshness-recheck.yml
git commit -m "ci(race-import): cron GitHub Actions quotidien pour le re-check de fraîcheur"
```

---

## Clôture

- [ ] **Vérif intégrée** : `cd web && npx tsc --noEmit && npx jest __tests__/lib/race-import __tests__/app/api/cron/race-freshness` → tout vert.
- [ ] **Bandeau spec** : `> **Status: Implémenté** · 2026-06-11 · Code: …` en tête du spec 2a.
- [ ] **Revue finale** : agent-skills:code-reviewer sur le diff de branche.
- [ ] **Rappels déploiement** : migration `040` à coller dans Supabase ; secret `CRON_SECRET` + URL déjà configurés (réutilisés des autres crons) — vérifier que le workflow GA pointe la bonne URL.
- [ ] **finishing-a-development-branch**.

## Notes d'ordre

- Ordre : **1 → 2 → 3 → 4 → 5 → 6 → 7**. 3 et 4 indépendants après 2 ; 5 dépend de 3+4 ; 6 dépend de 5 ; 7 indépendant (peut se faire en parallèle de 6).
- Chaque tâche finit `tsc` vert + suites pertinentes vertes ; commit par tâche ; **staging explicite** (working-tree sale).
- Hors-scope (Lot 2b) : bandeau, modal de validation, application du diff. YAGNI ici.
```
