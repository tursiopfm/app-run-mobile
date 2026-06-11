# Re-check & diff — Lot 2b (UX) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** L'utilisateur voit le `pending_diff` d'un tableau (écrit par le Lot 2a) et choisit de l'appliquer ou de garder l'actuel, in-app.

**Architecture:** Le `pending_diff` (déjà sur `race_tableau_meta`) est exposé via la meta du GET waypoints. Un endpoint `apply`/`dismiss` résout. Un bandeau sur le détail course ouvre un modal de diff (recalculé client-side via `diffWaypoints`, pur) calqué sur la résolution de conflit Garmin. Indicateur léger sur le bloc Objectif.

**Tech Stack:** Next.js 14 route handler, React (portal), TypeScript, Supabase (SSR auth + RLS), Jest.

**Conventions repo :** tests depuis `web/` (`cd web`) ; `tsc --noEmit` + `eslint` autoritatifs local ; ~50 tests i18n échouent en pré-existant (suites ciblées) ; **working-tree avec changements NON liés (Garmin/config) → staging EXPLICITE par fichier, jamais `git add -A`.** Spec : `docs/superpowers/specs/2026-06-11-race-freshness-diff-ux-design.md`.

**Dépendances (déjà en place) :** `PendingDiff`/`WaypointDiff` (types), `diffWaypoints` (`web/lib/race-import/waypoint-diff.ts`, **pur, client-safe**), `rowToTableauMeta` (`schema.ts`), GET `/api/races/[id]/waypoints` renvoyant `{ waypoints, meta }`, `race_tableau_meta.pending_diff` (migration 040).

---

## Task 1 : Exposer `pendingDiff` dans la meta

**Files:**
- Modify: `web/types/plan.ts`
- Modify: `web/lib/race-import/schema.ts`
- Test: `web/__tests__/lib/race-import/schema.test.ts`

- [ ] **Step 1 : Étendre `RaceTableauMeta` (`plan.ts`)**

Ajouter deux champs à l'interface `RaceTableauMeta` (après `sourceHash`) :
```ts
  pendingDiff: PendingDiff | null
  pendingDiffAt: string | null
```
(`PendingDiff` est défini plus bas dans le même fichier — OK, les interfaces se référencent sans ordre.)

- [ ] **Step 2 : Test du mapping (`schema.test.ts`)**

Ajouter :
```ts
import { rowToTableauMeta } from '@/lib/race-import/schema'

it('rowToTableauMeta mappe pending_diff / pending_diff_at', () => {
  const pd = { kind: 'changed', detectedAt: '2026-06-01T00:00:00Z', newWaypoints: [], newMeta: { editionYear: 2026, editionDate: null, dateExplicit: false, freshnessStatus: 'confirmed', sourceHash: 'H' }, summary: { added: 0, removed: 0, modified: 1, modifiedDetails: [] } }
  const m = rowToTableauMeta({ race_id: 'r1', edition_year: 2026, edition_date: null, date_explicit: false, freshness_status: 'confirmed', source_url: null, source_checked_at: 'T', source_hash: 'H', pending_diff: pd, pending_diff_at: '2026-06-01T00:00:00Z' })
  expect(m.pendingDiff).toEqual(pd)
  expect(m.pendingDiffAt).toBe('2026-06-01T00:00:00Z')
  const m2 = rowToTableauMeta({ race_id: 'r1', edition_year: null, edition_date: null, date_explicit: false, freshness_status: 'unknown', source_url: null, source_checked_at: 'T', source_hash: null })
  expect(m2.pendingDiff).toBeNull()
  expect(m2.pendingDiffAt).toBeNull()
})
```
Run → FAIL.

- [ ] **Step 3 : Mapper dans `rowToTableauMeta` (`schema.ts`)**

Ajouter au retour (importer `PendingDiff` si besoin) :
```ts
    pendingDiff: row.pending_diff ?? null,
    pendingDiffAt: row.pending_diff_at ?? null,
```
Run le test → PASS. `npx tsc --noEmit` → 0.

- [ ] **Step 4 : Commit**

```bash
git add web/types/plan.ts web/lib/race-import/schema.ts web/__tests__/lib/race-import/schema.test.ts
git commit -m "feat(race-import): expose pendingDiff/pendingDiffAt dans RaceTableauMeta"
```

---

## Task 2 : Endpoint `POST /api/races/[id]/tableau-recheck`

**Files:**
- Create: `web/app/api/races/[id]/tableau-recheck/route.ts`
- Test: `web/__tests__/app/api/races/tableau-recheck.test.ts`

Réutilise le mapping de lignes du `PUT /api/races/[id]/waypoints` (camelCase → snake_case).

- [ ] **Step 1 : Implémenter la route**

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import type { PendingDiff, RaceWaypoint } from '@/types/plan'

export const runtime = 'nodejs'

type WP = Omit<RaceWaypoint, 'id' | 'raceId'>
const toRow = (raceId: string, w: WP) => ({
  race_id: raceId, order_index: w.orderIndex, name: w.name, km: w.km, km_inter: w.kmInter,
  d_plus: w.dPlus, d_moins: w.dMoins, cutoff_raw: w.cutoffRaw,
  cutoff_kind: w.cutoffRaw === null ? null : w.cutoffKind, type: w.type,
  supplies: w.supplies ?? [], target_override_sec: w.targetOverrideSec ?? null,
})

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: race } = await supabase
    .from('races').select('id').eq('id', params.id).eq('athlete_id', user.id).single()
  if (!race) return NextResponse.json({ error: 'Course introuvable' }, { status: 404 })

  const { data: metaRow } = await supabase
    .from('race_tableau_meta').select('pending_diff').eq('race_id', params.id).maybeSingle()
  const pending = metaRow?.pending_diff as PendingDiff | null | undefined
  if (!pending) return NextResponse.json({ error: 'Aucun diff en attente' }, { status: 409 })

  const body = await request.json() as { action?: 'apply' | 'dismiss' }
  if (body.action !== 'apply' && body.action !== 'dismiss') {
    return NextResponse.json({ error: 'action invalide' }, { status: 400 })
  }

  const nowISO = new Date().toISOString()

  if (body.action === 'apply') {
    const { error: delErr } = await supabase.from('race_waypoints').delete().eq('race_id', params.id)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    const rows = (pending.newWaypoints ?? []).map((w) => toRow(params.id, w))
    if (rows.length > 0) {
      const { error: insErr } = await supabase.from('race_waypoints').insert(rows)
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
    await supabase.from('race_tableau_meta').update({
      edition_year: pending.newMeta.editionYear,
      edition_date: pending.newMeta.editionDate,
      date_explicit: pending.newMeta.dateExplicit,
      freshness_status: pending.newMeta.freshnessStatus,
      source_hash: pending.newMeta.sourceHash,
      source_checked_at: nowISO,
      pending_diff: null,
      pending_diff_at: null,
      updated_at: nowISO,
    }).eq('race_id', params.id)
  } else {
    // dismiss : on garde les waypoints actuels mais on avance le hash → pas de re-signal.
    await supabase.from('race_tableau_meta').update({
      source_hash: pending.newMeta.sourceHash,
      pending_diff: null,
      pending_diff_at: null,
      updated_at: nowISO,
    }).eq('race_id', params.id)
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2 : Tests (supabase mocké)**

```ts
/** @jest-environment node */
jest.mock('@/lib/database/supabase-server', () => ({ createClient: jest.fn() }))
import { POST } from '@/app/api/races/[id]/tableau-recheck/route'
import { createClient } from '@/lib/database/supabase-server'

const PD = {
  kind: 'changed', detectedAt: 'T',
  newWaypoints: [{ orderIndex: 0, name: 'Départ', km: 0, kmInter: null, dPlus: 0, dMoins: 0, cutoffRaw: null, cutoffKind: null, type: 'depart', supplies: [], targetOverrideSec: null }],
  newMeta: { editionYear: 2026, editionDate: null, dateExplicit: false, freshnessStatus: 'confirmed', sourceHash: 'NEW' },
  summary: { added: 1, removed: 0, modified: 0, modifiedDetails: [] },
}

function client({ user = { id: 'u1' }, race = { id: 'r1' }, pending = PD as any, capture }: any) {
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    from(table: string) {
      if (table === 'races') return { select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: race }) }) }) }) }
      if (table === 'race_waypoints') return {
        delete: () => ({ eq: async () => { capture.deleted = true; return { error: null } } }),
        insert: async (rows: any) => { capture.inserted = rows; return { error: null } },
      }
      // race_tableau_meta
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { pending_diff: pending } }) }) }),
        update: (patch: any) => ({ eq: async () => { capture.updated = patch; return { error: null } } }),
      }
    },
  }
}

const req = (action?: string) => new Request('http://x', { method: 'POST', body: JSON.stringify({ action }) })

describe('POST tableau-recheck', () => {
  afterEach(() => jest.restoreAllMocks())

  it('401 sans user', async () => {
    ;(createClient as jest.Mock).mockResolvedValue(client({ user: null, capture: {} }))
    expect((await POST(req('apply'), { params: { id: 'r1' } })).status).toBe(401)
  })
  it('404 si course pas au user', async () => {
    ;(createClient as jest.Mock).mockResolvedValue(client({ race: null, capture: {} }))
    expect((await POST(req('apply'), { params: { id: 'r1' } })).status).toBe(404)
  })
  it('409 si pas de pending_diff', async () => {
    ;(createClient as jest.Mock).mockResolvedValue(client({ pending: null, capture: {} }))
    expect((await POST(req('apply'), { params: { id: 'r1' } })).status).toBe(409)
  })
  it('apply : insert newWaypoints + meta mise à jour + pending vidé', async () => {
    const capture: any = {}
    ;(createClient as jest.Mock).mockResolvedValue(client({ capture }))
    const res = await POST(req('apply'), { params: { id: 'r1' } })
    expect(res.status).toBe(200)
    expect(capture.deleted).toBe(true)
    expect(capture.inserted).toHaveLength(1)
    expect(capture.updated.source_hash).toBe('NEW')
    expect(capture.updated.pending_diff).toBeNull()
  })
  it('dismiss : pas d\'insert, hash avancé, pending vidé', async () => {
    const capture: any = {}
    ;(createClient as jest.Mock).mockResolvedValue(client({ capture }))
    const res = await POST(req('dismiss'), { params: { id: 'r1' } })
    expect(res.status).toBe(200)
    expect(capture.inserted).toBeUndefined()
    expect(capture.updated.source_hash).toBe('NEW')
    expect(capture.updated.pending_diff).toBeNull()
  })
})
```
Run: `cd web && npx jest __tests__/app/api/races/tableau-recheck.test.ts && npx tsc --noEmit` → PASS, 0 tsc. (Adapte le mock si la chaîne diffère ; vise les 5 assertions.)

- [ ] **Step 3 : Commit**

```bash
git add "web/app/api/races/[id]/tableau-recheck/route.ts" web/__tests__/app/api/races/tableau-recheck.test.ts
git commit -m "feat(race-import): endpoint tableau-recheck (apply/dismiss du pending_diff)"
```

---

## Task 3 : `TableauDiffModal`

**Files:**
- Create: `web/components/plan/TableauDiffModal.tsx`
- Test: `web/__tests__/components/plan/TableauDiffModal.test.tsx`

Recalcule le diff client-side via `diffWaypoints` (pur) à partir des waypoints actuels + `pendingDiff.newWaypoints`. **Pas de `useT`** (chaînes FR en dur → évite la friction i18n en test).

- [ ] **Step 1 : Implémenter le composant**

```tsx
'use client'
import { createPortal } from 'react-dom'
import type { PendingDiff, RaceWaypoint, WaypointFieldChange } from '@/types/plan'
import { diffWaypoints } from '@/lib/race-import/waypoint-diff'

type WP = Omit<RaceWaypoint, 'id' | 'raceId'>

const SUPPLY_LABEL: Record<string, string> = { liquid: 'liquide', solid: 'solide', hot: 'chaud', base_vie: 'base vie', assistance: 'assistance' }
function fmt(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (field === 'supplies' && Array.isArray(v)) return v.length ? v.map((s) => SUPPLY_LABEL[s] ?? s).join(', ') : 'aucun'
  return String(v)
}
const FIELD_LABEL: Record<WaypointFieldChange['field'], string> = { km: 'km', dPlus: 'D+', dMoins: 'D−', cutoffRaw: 'barrière', supplies: 'ravito' }

export function TableauDiffModal({
  currentWaypoints, pendingDiff, busy, onApply, onDismiss, onClose,
}: {
  currentWaypoints: WP[]
  pendingDiff: PendingDiff
  busy: boolean
  onApply: () => void
  onDismiss: () => void
  onClose: () => void
}) {
  if (typeof document === 'undefined') return null
  const diff = diffWaypoints(currentWaypoints, pendingDiff.newWaypoints)
  const title = pendingDiff.kind === 'new_edition'
    ? `Nouvelle édition ${pendingDiff.newMeta.editionYear ?? ''} disponible`
    : 'Le tableau de course a été mis à jour'

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-trail-card border border-trail-border rounded-t-[20px] md:rounded-[16px] w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-[16px] font-semibold text-trail-text mb-1">{title}</h2>
        <p className="text-body-sm text-trail-muted mb-4">
          {diff.added.length} ajout(s) · {diff.removed.length} retrait(s) · {diff.modified.length} modif(s)
        </p>

        <div className="space-y-3 text-body-sm">
          {diff.modified.length > 0 && (
            <div>
              <div className="text-caption font-semibold text-trail-muted mb-1">Modifié</div>
              {diff.modified.map((m, i) => (
                <div key={`m-${i}`} className="mb-1">
                  <span className="text-trail-text font-semibold">{m.name}</span>
                  <ul className="ml-3 text-trail-muted">
                    {m.changes.map((c, j) => (
                      <li key={j}>{FIELD_LABEL[c.field]} : {fmt(c.field, c.from)} → {fmt(c.field, c.to)}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {diff.added.length > 0 && (
            <div>
              <div className="text-caption font-semibold text-trail-muted mb-1">Ajouté</div>
              {diff.added.map((w, i) => <div key={`a-${i}`} className="text-trail-text">+ {w.name} <span className="text-trail-muted">@ {w.km} km</span></div>)}
            </div>
          )}
          {diff.removed.length > 0 && (
            <div>
              <div className="text-caption font-semibold text-trail-muted mb-1">Retiré</div>
              {diff.removed.map((w, i) => <div key={`r-${i}`} className="text-trail-text">− {w.name} <span className="text-trail-muted">@ {w.km} km</span></div>)}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 mt-6">
          <button type="button" disabled={busy} onClick={onApply}
            className="w-full py-2 rounded-[10px] bg-trail-primary text-white text-body-sm font-semibold disabled:opacity-50">
            Appliquer le nouveau tableau
          </button>
          <button type="button" disabled={busy} onClick={onDismiss}
            className="w-full py-2 rounded-[10px] border border-trail-border text-trail-text text-body-sm disabled:opacity-50">
            Garder l&apos;actuel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 2 : Test (RTL)**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { TableauDiffModal } from '@/components/plan/TableauDiffModal'

const wp = (over: any = {}) => ({ orderIndex: 0, name: 'A', km: 0, kmInter: null, dPlus: 0, dMoins: 0, cutoffRaw: null, cutoffKind: null, type: 'depart', supplies: [], targetOverrideSec: null, ...over })
const pd: any = {
  kind: 'changed', detectedAt: 'T',
  newWaypoints: [wp({ name: 'Départ' }), wp({ name: 'Col', km: 50, cutoffRaw: 'sam. 11:00' }), wp({ name: 'Arrivée', km: 100 })],
  newMeta: { editionYear: 2026, editionDate: null, dateExplicit: false, freshnessStatus: 'confirmed', sourceHash: 'NEW' },
  summary: { added: 1, removed: 0, modified: 1, modifiedDetails: [] },
}
const current = [wp({ name: 'Départ' }), wp({ name: 'Col', km: 50, cutoffRaw: 'sam. 10:00' }), wp({ name: 'Arrivée', km: 100 })]

it('rend le diff et déclenche apply/dismiss', () => {
  const onApply = jest.fn(); const onDismiss = jest.fn()
  render(<TableauDiffModal currentWaypoints={current as any} pendingDiff={pd} busy={false} onApply={onApply} onDismiss={onDismiss} onClose={() => {}} />)
  expect(screen.getByText(/mis à jour/i)).toBeInTheDocument()
  expect(screen.getByText(/barrière/i)).toBeInTheDocument()  // Col a changé de barrière
  fireEvent.click(screen.getByText('Appliquer le nouveau tableau')); expect(onApply).toHaveBeenCalled()
  fireEvent.click(screen.getByText(/Garder l/)); expect(onDismiss).toHaveBeenCalled()
})
```
Run: `cd web && npx jest __tests__/components/plan/TableauDiffModal.test.tsx` → PASS. `npx tsc --noEmit` → 0.

- [ ] **Step 3 : Commit**

```bash
git add web/components/plan/TableauDiffModal.tsx web/__tests__/components/plan/TableauDiffModal.test.tsx
git commit -m "feat(plan): TableauDiffModal (diff recalculé client-side, apply/garder)"
```

---

## Task 4 : Bandeau + câblage sur le détail course

**Files:**
- Modify: `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx`

Le `reload()` lit déjà `body.waypoints` ; il faut aussi capter `body.meta` (Task 1 l'enrichit de `pendingDiff`).

- [ ] **Step 1 : État meta + capture**

Ajoute `import { TableauDiffModal } from '@/components/plan/TableauDiffModal'`, `import type { RaceTableauMeta } from '@/types/plan'`. États :
```ts
const [meta, setMeta] = useState<RaceTableauMeta | null>(null)
const [diffOpen, setDiffOpen] = useState(false)
const [diffBusy, setDiffBusy] = useState(false)
```
Dans `reload`, après `setWaypoints(body.waypoints ?? [])` : `setMeta(body.meta ?? null)`.

> NOTE : si une autre tâche/feature (badge fraîcheur Lot 1) a déjà ajouté un état `meta` ici, **réutilise-le** (ne pas dupliquer). Lis le fichier d'abord.

- [ ] **Step 2 : Handlers de résolution**

```ts
async function resolveDiff(action: 'apply' | 'dismiss') {
  setDiffBusy(true)
  try {
    await fetch(`/api/races/${raceId}/tableau-recheck`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    })
    setDiffOpen(false)
    await reload()
  } finally {
    setDiffBusy(false)
  }
}
```

- [ ] **Step 3 : Bandeau dans la branche « tableau présent »**

Dans `<Section title="Tableau de course">`, branche non-vide, TOUT EN HAUT (avant le `FreshnessBadge`/bandeau objectif), insère :
```tsx
{meta?.pendingDiff && (
  <button type="button" onClick={() => setDiffOpen(true)}
    className="w-full text-left mb-2 rounded-[10px] border px-3 py-2 text-body-sm"
    style={{ borderColor: '#EAB308', background: '#EAB30815', color: '#EAB308' }}>
    {meta.pendingDiff.kind === 'new_edition'
      ? `✨ Nouvelle édition ${meta.pendingDiff.newMeta.editionYear ?? ''} disponible`
      : `⚠️ Le tableau a changé — ${meta.pendingDiff.summary.added} ajout(s) · ${meta.pendingDiff.summary.removed} retrait(s) · ${meta.pendingDiff.summary.modified} modif(s)`}
    <span className="block text-caption text-trail-muted">Touche pour vérifier et valider.</span>
  </button>
)}
```

- [ ] **Step 4 : Rendre le modal**

Près des autres modals en bas du JSX :
```tsx
{meta?.pendingDiff && diffOpen && (
  <TableauDiffModal
    currentWaypoints={waypoints.map(({ id: _i, raceId: _r, ...rest }) => rest)}
    pendingDiff={meta.pendingDiff}
    busy={diffBusy}
    onApply={() => resolveDiff('apply')}
    onDismiss={() => resolveDiff('dismiss')}
    onClose={() => setDiffOpen(false)}
  />
)}
```

- [ ] **Step 5 : Vérifier + commit**

`cd web && npx tsc --noEmit && npx eslint "app/(main)/plan/courses/[id]/CoursePageClient.tsx"` → 0.
```bash
git add "web/app/(main)/plan/courses/[id]/CoursePageClient.tsx"
git commit -m "feat(plan): bandeau + modal de diff sur le détail course (Lot 2b)"
```

---

## Task 5 : Indicateur sur le bloc Objectif (sécable)

**Files:**
- Modify: `web/lib/plan/storage.ts`
- Modify: `web/components/plan/ObjectifCourseBlock.tsx`

- [ ] **Step 1 : Helper `getRacesWithPendingDiff` (`storage.ts`)**

Calqué sur les autres lectures Supabase du fichier (client SSR/anon, RLS). En une requête :
```ts
export async function getRacesWithPendingDiff(): Promise<Set<string>> {
  const supabase = getSupabaseClient()  // (utilise le même accès que les autres getX du fichier)
  if (!supabase) return new Set()
  const { data, error } = await supabase
    .from('race_tableau_meta').select('race_id').not('pending_diff', 'is', null)
  if (error || !data) return new Set()
  return new Set(data.map((r: { race_id: string }) => r.race_id))
}
```
> Lis le fichier pour reprendre EXACTEMENT le pattern d'accès client + le fallback localStorage des autres fonctions (ne pas inventer `getSupabaseClient` s'il s'appelle autrement).

- [ ] **Step 2 : Indicateur dans `ObjectifCourseBlock`**

Charger l'ensemble au mount (`useEffect` + `useState<Set<string>>`), et afficher une pastille ⚠️ sur la `MainRaceCard`/`CompactRaceCard` dont `race.id ∈ set`. Pastille discrète (ex. un `⚠️` `text-[#EAB308]` près du nom) ; clic sur la carte mène déjà au détail (`openCourseDetail`). Pas de modal ici.

- [ ] **Step 3 : Vérifier + commit**

`cd web && npx tsc --noEmit && npx eslint components/plan/ObjectifCourseBlock.tsx lib/plan/storage.ts` → 0.
```bash
git add web/lib/plan/storage.ts web/components/plan/ObjectifCourseBlock.tsx
git commit -m "feat(plan): indicateur « tableau mis à jour » sur le bloc Objectif"
```

---

## Clôture

- [ ] **Vérif intégrée** : `cd web && npx tsc --noEmit && npx jest __tests__/lib/race-import __tests__/app/api/races/tableau-recheck __tests__/components/plan/TableauDiffModal` → tout vert.
- [ ] **Bandeau spec** : `> **Status: Implémenté** · 2026-06-11 · Code: …` en tête du spec 2b.
- [ ] **Revue finale** : agent-skills:code-reviewer sur le diff de branche.
- [ ] **finishing-a-development-branch** (merge ; pas de migration neuve — 040 déjà côté Lot 2a).

## Notes d'ordre

- Ordre : **1 → 2 → 3 → 4 → 5**. 3 dépend de `diffWaypoints` (présent). 4 dépend de 1+2+3. 5 sécable (peut être livré séparément).
- Chaque tâche finit `tsc` vert + suites pertinentes vertes ; commit par tâche ; **staging explicite**.
- Pas de nouvelle migration (les colonnes `pending_diff` viennent du Lot 2a / migration 040).
```
