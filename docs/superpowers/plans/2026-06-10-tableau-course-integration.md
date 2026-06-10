# Intégration tableau de course + export PDF — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le tableau des points de passage d'une course éditable (ravitos solide/liquide/base-vie + heure de passage visée calculée puis ajustable), avec un export PDF A4 paginé.

**Architecture:** Un module de pacing pur (`lib/plan/pacing.ts`) répartit le temps cible sur chaque tronçon (effort-km + fade) ; un module de dérivation pur (`lib/plan/waypoint-view.ts`) calcule colonnes auto (Inter, ▲/▼ tronçon, Σ cumulé) et formate les heures. La table éditable et la route d'impression A4 consomment ces deux modules. Persistance via le PUT waypoints existant (étendu) + `storage.saveRace` (3 colonnes course).

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, Supabase, Jest. Worktree : `C:\Users\Franc\tc-tableau`, branche `feat/tableau-course-integration`.

**Spec:** `docs/superpowers/specs/2026-06-10-tableau-course-integration-design.md`

**Conventions de ce repo (rappels) :**
- Lancer les tests / git depuis le worktree. Jest : `cd C:/Users/Franc/tc-tableau/web && npx jest <chemin>`. Git : `git -C C:/Users/Franc/tc-tableau ...`.
- `next build` local non fiable (bloqué si un `next dev` tourne) → vérifier via `npx tsc --noEmit` + suites Jest ciblées ; le build autoritatif est sur Vercel.
- ~50 tests Jest échouent en pré-existant (useI18n hors provider) → ne lancer que les suites pertinentes, ne pas s'alarmer des autres.
- Migration Supabase **non auto-appliquée** : à la fin, rappeler à Franck de coller le SQL dans le dashboard.
- `d_plus` / `d_moins` sont **cumulés** (convention migration 025). Le tronçon ▲/▼ se dérive par différence.

---

## File Structure

**Créés :**
- `web/supabase/migrations/035_race_pacing_and_waypoint_supplies.sql` — 3 colonnes `races` + 2 colonnes `race_waypoints`.
- `web/lib/plan/pacing.ts` — répartition pure du temps cible (effort-km + fade + ancres/override).
- `web/__tests__/lib/plan/pacing.test.ts` — tests du pacing.
- `web/lib/plan/waypoint-view.ts` — dérivations pures (segments, cumuls) + format heure (elapsed→horloge avec Jx).
- `web/__tests__/lib/plan/waypoint-view.test.ts` — tests des dérivations.
- `web/app/(main)/plan/courses/[id]/print/page.tsx` — route d'impression A4 paginée.

**Modifiés :**
- `web/types/plan.ts` — `WaypointSupply`, champs `RaceWaypoint` + `Race`.
- `web/lib/race-import/schema.ts` — mapping DB↔TS (supplies, override) + défauts extraction.
- `web/lib/race-import/sources/livetrail.ts` — défauts des nouveaux champs.
- `web/lib/race-import/prompt.ts` — préciser `d_plus`/`d_moins` cumulés.
- `web/app/api/races/[id]/waypoints/route.ts` — PUT : sérialiser supplies + override.
- `web/lib/plan/storage.ts` — `RaceRow` + mappers + retry colonne manquante pour les 3 champs course.
- `web/lib/i18n/dictionaries/fr.ts` + `en.ts` — libellés des 3 champs course.
- `web/components/plan/RaceEditorModal.tsx` — 3 inputs (départ, temps cible, fade).
- `web/components/plan/WaypointsTable.tsx` — refonte éditable + colonnes auto + ravitos + objectif.
- `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx` — édition branchée + bouton export.
- `tasks/backlog.md` — moteur d'estimation avancé (phase suivante).

---

## Task 1 : Migration 035 + types

**Files:**
- Create: `web/supabase/migrations/035_race_pacing_and_waypoint_supplies.sql`
- Modify: `web/types/plan.ts:191-220`

- [ ] **Step 1 : Écrire la migration**

Create `web/supabase/migrations/035_race_pacing_and_waypoint_supplies.sql` :

```sql
-- Migration: 035 - pacing course + contenu ravito waypoints
-- races : heure de départ, temps cible total, coefficient de fade (pacing).
-- race_waypoints : contenu du ravito (solide/liquide/base vie) + override
-- manuel de l'heure de passage (secondes écoulées depuis le départ).
-- Rappel : d_plus / d_moins restent CUMULÉS (cf. migration 025).

alter table races
  add column if not exists start_time          time,
  add column if not exists target_duration_min integer,
  add column if not exists pacing_fade         numeric not null default 0;

alter table race_waypoints
  add column if not exists supplies            text[]  not null default '{}',
  add column if not exists target_override_sec integer;
```

- [ ] **Step 2 : Étendre les types**

Dans `web/types/plan.ts`, remplacer le bloc `RaceWaypoint` (≈ lignes 201-213) et ajouter `WaypointSupply` juste avant :

```ts
export type WaypointSupply = 'solid' | 'liquid' | 'base_vie'

export interface RaceWaypoint {
  id: string
  raceId: string
  orderIndex: number
  name: string
  km: number
  kmInter: number | null
  dPlus: number | null    // CUMULÉ depuis le départ
  dMoins: number | null   // CUMULÉ depuis le départ
  cutoffRaw: string | null
  cutoffKind: CutoffKind | null
  type: WaypointType
  supplies: WaypointSupply[]        // contenu ravito (athlète) ; [] si aucun
  targetOverrideSec: number | null  // override manuel de l'heure (s écoulées)
}
```

Dans le même fichier, étendre `Race` (≈ lignes 71-82) en ajoutant 3 champs optionnels avant la fermeture de l'interface :

```ts
  // Pacing (objectif de temps) — alimentent lib/plan/pacing.ts
  startTime?: string         // 'HH:MM' heure locale de départ
  targetDurationMin?: number // temps cible total en minutes (ex : 37 h = 2220)
  pacingFade?: number        // coef fade 2e moitié (0 = neutre)
```

- [ ] **Step 3 : Vérifier la compilation des types**

Run: `cd C:/Users/Franc/tc-tableau/web && npx tsc --noEmit`
Expected: des erreurs UNIQUEMENT « Property 'supplies' is missing » / « 'targetOverrideSec' is missing » dans les fichiers qui construisent des `RaceWaypoint`/`Omit<RaceWaypoint,…>` (livetrail.ts, schema.ts, WaypointsTable.tsx, CoursePageClient.tsx). C'est attendu : ces fichiers sont corrigés dans les tâches suivantes. Aucune autre erreur.

- [ ] **Step 4 : Commit**

```bash
git -C C:/Users/Franc/tc-tableau add web/supabase/migrations/035_race_pacing_and_waypoint_supplies.sql web/types/plan.ts
git -C C:/Users/Franc/tc-tableau commit -m "feat(plan): migration 035 + types pacing & ravitos waypoints"
```

---

## Task 2 : Module pacing (pur, TDD)

**Files:**
- Create: `web/lib/plan/pacing.ts`
- Test: `web/__tests__/lib/plan/pacing.test.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

Create `web/__tests__/lib/plan/pacing.test.ts` :

```ts
import { estimatePassageTimes, type PacingWaypoint } from '@/lib/plan/pacing'

const flat = (kms: number[]): PacingWaypoint[] =>
  kms.map((km) => ({ km, dPlus: 0, targetOverrideSec: null }))

describe('estimatePassageTimes', () => {
  it('point 0 = 0 et arrivée = temps cible, strictement croissant (plat, sans fade)', () => {
    const out = estimatePassageTimes(flat([0, 10, 20]), { totalDurationSec: 7200, fade: 0 })
    expect(out).toEqual([0, 3600, 7200])
  })

  it('pondère par le D+ cumulé (tronçon plus dur = plus de temps)', () => {
    const wps: PacingWaypoint[] = [
      { km: 0, dPlus: 0, targetOverrideSec: null },
      { km: 10, dPlus: 1000, targetOverrideSec: null }, // +1000 m → effort 20
      { km: 20, dPlus: 1000, targetOverrideSec: null }, // +0 m    → effort 10
    ]
    const out = estimatePassageTimes(wps, { totalDurationSec: 7200, fade: 0 })
    expect(out).toEqual([0, 4800, 7200])
  })

  it('fade > 0 ralentit la 2e moitié', () => {
    const out = estimatePassageTimes(flat([0, 10, 20]), { totalDurationSec: 7200, fade: 1 })
    expect(out[0]).toBe(0)
    expect(out[2]).toBe(7200)
    const seg1 = out[1] - out[0]
    const seg2 = out[2] - out[1]
    expect(out[1]).toBe(2700)
    expect(seg2).toBeGreaterThan(seg1)
  })

  it('un override fige le point et redistribue les tronçons suivants', () => {
    const wps: PacingWaypoint[] = [
      { km: 0, dPlus: 0, targetOverrideSec: null },
      { km: 10, dPlus: 0, targetOverrideSec: null },
      { km: 20, dPlus: 0, targetOverrideSec: 8000 }, // figé
      { km: 30, dPlus: 0, targetOverrideSec: null },
    ]
    const out = estimatePassageTimes(wps, { totalDurationSec: 10800, fade: 0 })
    expect(out).toEqual([0, 4000, 8000, 10800])
  })

  it('cas dégénérés', () => {
    expect(estimatePassageTimes([], { totalDurationSec: 1000, fade: 0 })).toEqual([])
    expect(estimatePassageTimes(flat([0]), { totalDurationSec: 1000, fade: 0 })).toEqual([0])
  })
})
```

- [ ] **Step 2 : Lancer les tests pour vérifier l'échec**

Run: `cd C:/Users/Franc/tc-tableau/web && npx jest __tests__/lib/plan/pacing.test.ts`
Expected: FAIL — `Cannot find module '@/lib/plan/pacing'`.

- [ ] **Step 3 : Implémenter le module**

Create `web/lib/plan/pacing.ts` :

```ts
// Répartition pure du temps cible sur chaque tronçon d'une course.
// v1 : effort-km (distance + D+/100) + fade (2e moitié plus lente) + ancres
// (départ, overrides, arrivée). Conçu pour être remplacé par un moteur avancé
// (VAP réel + indice UTMB/Betrail + historique) SANS changer la signature.

export interface PacingWaypoint {
  km: number                       // cumulé depuis le départ (point 0 = 0)
  dPlus: number | null             // D+ CUMULÉ au point
  targetOverrideSec: number | null // si non-null : heure figée (s écoulées)
}

export interface PacingOptions {
  totalDurationSec: number // temps cible total (arrivée)
  fade: number             // >= 0 ; 0 = répartition pure effort
}

// Retourne les secondes écoulées depuis le départ pour chaque point (aligné par
// index). Point 0 = 0 ; dernier point = arrivée (override prioritaire).
export function estimatePassageTimes(
  waypoints: PacingWaypoint[],
  opts: PacingOptions,
): number[] {
  const n = waypoints.length
  if (n === 0) return []
  if (n === 1) return [0]

  // 1) Effort-km par tronçon i (du point i-1 au point i), i = 1..n-1.
  const effort: number[] = new Array(n).fill(0)
  for (let i = 1; i < n; i++) {
    const dist = Math.max(0, waypoints[i].km - waypoints[i - 1].km)
    const dPlusSeg = Math.max(0, (waypoints[i].dPlus ?? 0) - (waypoints[i - 1].dPlus ?? 0))
    effort[i] = dist + dPlusSeg / 100
  }
  let totalEffort = effort.reduce((s, e) => s + e, 0)
  // Garde-fou : route sans géométrie exploitable → poids uniformes.
  if (totalEffort <= 0) {
    for (let i = 1; i < n; i++) effort[i] = 1
    totalEffort = n - 1
  }

  // 2) Poids temps avec fade, centré sur 0.5 (le total reste ≈ cible).
  const weight: number[] = new Array(n).fill(0)
  let cumBefore = 0
  for (let i = 1; i < n; i++) {
    const midFrac = (cumBefore + effort[i] / 2) / totalEffort
    const factor = Math.max(0.05, 1 + opts.fade * (midFrac - 0.5))
    weight[i] = effort[i] * factor
    cumBefore += effort[i]
  }

  // 3) Ancres : index 0 = 0, dernier = override ?? cible, + overrides internes.
  const elapsed: number[] = new Array(n).fill(0)
  const anchors: number[] = [0]
  for (let i = 1; i < n - 1; i++) {
    if (waypoints[i].targetOverrideSec != null) anchors.push(i)
  }
  anchors.push(n - 1)
  elapsed[0] = 0
  elapsed[n - 1] = waypoints[n - 1].targetOverrideSec ?? opts.totalDurationSec
  for (let i = 1; i < n - 1; i++) {
    if (waypoints[i].targetOverrideSec != null) elapsed[i] = waypoints[i].targetOverrideSec as number
  }

  // 4) Répartir le temps de chaque intervalle entre ancres au prorata des poids.
  for (let a = 0; a < anchors.length - 1; a++) {
    const ia = anchors[a]
    const ib = anchors[a + 1]
    const span = elapsed[ib] - elapsed[ia]
    let spanWeight = 0
    for (let k = ia + 1; k <= ib; k++) spanWeight += weight[k]
    for (let k = ia + 1; k < ib; k++) {
      const w = spanWeight > 0 ? weight[k] / spanWeight : 1 / (ib - ia)
      elapsed[k] = elapsed[k - 1] + span * w
    }
  }

  return elapsed.map((s) => Math.round(s))
}
```

- [ ] **Step 4 : Lancer les tests pour vérifier le succès**

Run: `cd C:/Users/Franc/tc-tableau/web && npx jest __tests__/lib/plan/pacing.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5 : Commit**

```bash
git -C C:/Users/Franc/tc-tableau add web/lib/plan/pacing.ts web/__tests__/lib/plan/pacing.test.ts
git -C C:/Users/Franc/tc-tableau commit -m "feat(plan): module pacing v1 (effort-km + fade + override)"
```

---

## Task 3 : Module de dérivation waypoint-view (pur, TDD)

**Files:**
- Create: `web/lib/plan/waypoint-view.ts`
- Test: `web/__tests__/lib/plan/waypoint-view.test.ts`

But : centraliser les calculs auto (Inter, ▲/▼ tronçon, Σ cumulé) et le formatage des heures, partagés par la table et le PDF (DRY).

- [ ] **Step 1 : Écrire les tests qui échouent**

Create `web/__tests__/lib/plan/waypoint-view.test.ts` :

```ts
import { deriveSegment, formatElapsedToClock } from '@/lib/plan/waypoint-view'

describe('deriveSegment', () => {
  const wps = [
    { km: 0, dPlus: 0, dMoins: 0 },
    { km: 10, dPlus: 300, dMoins: 100 },
    { km: 25, dPlus: 800, dMoins: 250 },
  ]
  it('point 0 : pas de tronçon', () => {
    expect(deriveSegment(wps, 0)).toEqual({ interKm: null, dPlusSeg: null, dMoinsSeg: null })
  })
  it('tronçon = différence du cumulé', () => {
    expect(deriveSegment(wps, 2)).toEqual({ interKm: 15, dPlusSeg: 500, dMoinsSeg: 150 })
  })
  it('cumulé null → tronçon null', () => {
    const w = [{ km: 0, dPlus: null, dMoins: null }, { km: 5, dPlus: null, dMoins: null }]
    expect(deriveSegment(w, 1)).toEqual({ interKm: 5, dPlusSeg: null, dMoinsSeg: null })
  })
})

describe('formatElapsedToClock', () => {
  it('même jour', () => {
    expect(formatElapsedToClock('20:00', 7500)).toEqual({ label: '22:05', dayIndex: 1 })
  })
  it('jour suivant → préfixe Jx', () => {
    expect(formatElapsedToClock('20:00', 15600)).toEqual({ label: 'J2 00:20', dayIndex: 2 })
  })
  it('départ invalide → null', () => {
    expect(formatElapsedToClock('', 1000)).toBeNull()
  })
})

describe('parseClockToElapsed', () => {
  it('même jour : différence directe', () => {
    expect(parseClockToElapsed('20:00', '22:05', 0)).toBe(7500)
  })
  it('passage de minuit : choisit le 1er jour >= écoulé mini', () => {
    expect(parseClockToElapsed('20:00', '00:20', 14000)).toBe(15600)
  })
  it('saisie invalide → null', () => {
    expect(parseClockToElapsed('20:00', 'xx', 0)).toBeNull()
  })
})
```

Ajouter `parseClockToElapsed` à l'import en tête du fichier de test :

```ts
import { deriveSegment, formatElapsedToClock, parseClockToElapsed } from '@/lib/plan/waypoint-view'
```

- [ ] **Step 2 : Lancer les tests pour vérifier l'échec**

Run: `cd C:/Users/Franc/tc-tableau/web && npx jest __tests__/lib/plan/waypoint-view.test.ts`
Expected: FAIL — `Cannot find module '@/lib/plan/waypoint-view'`.

- [ ] **Step 3 : Implémenter le module**

Create `web/lib/plan/waypoint-view.ts` :

```ts
// Dérivations pures pour l'affichage des waypoints (table + PDF). DRY.
// dPlus/dMoins stockés = CUMULÉS → le tronçon se dérive par différence.

export interface SegmentInput {
  km: number
  dPlus: number | null
  dMoins: number | null
}

export interface SegmentDerived {
  interKm: number | null  // distance du tronçon (km_i - km_{i-1})
  dPlusSeg: number | null // D+ du tronçon
  dMoinsSeg: number | null
}

export function deriveSegment(wps: SegmentInput[], i: number): SegmentDerived {
  if (i <= 0) return { interKm: null, dPlusSeg: null, dMoinsSeg: null }
  const prev = wps[i - 1]
  const cur = wps[i]
  const diff = (a: number | null, b: number | null): number | null =>
    a == null || b == null ? null : Math.max(0, a - b)
  return {
    interKm: Math.round((cur.km - prev.km) * 10) / 10,
    dPlusSeg: diff(cur.dPlus, prev.dPlus),
    dMoinsSeg: diff(cur.dMoins, prev.dMoins),
  }
}

export interface ClockResult {
  label: string   // 'HH:MM' ou 'Jx HH:MM' si jour > 1
  dayIndex: number
}

// startTime : 'HH:MM' (heure locale de départ). elapsedSec : s depuis le départ.
// Calcul purement arithmétique (pas de Date → robuste aux fuseaux).
export function formatElapsedToClock(
  startTime: string,
  elapsedSec: number,
): ClockResult | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(startTime.trim())
  if (!m) return null
  const startTod = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60
  const total = startTod + Math.round(elapsedSec)
  const dayIndex = Math.floor(total / 86400) + 1
  const tod = ((total % 86400) + 86400) % 86400
  const hh = Math.floor(tod / 3600)
  const mm = Math.floor((tod % 3600) / 60)
  const pad = (x: number) => String(x).padStart(2, '0')
  const hhmm = `${pad(hh)}:${pad(mm)}`
  return { label: dayIndex > 1 ? `J${dayIndex} ${hhmm}` : hhmm, dayIndex }
}

// Parse une saisie 'HH:MM' (heure d'horloge) en secondes écoulées depuis le
// départ, en tenant compte du passage de minuit (choisit le 1er jour où
// l'heure d'horloge dépasse l'écoulé minimal fourni). Retourne null si invalide.
export function parseClockToElapsed(
  startTime: string,
  input: string,
  minElapsedSec: number,
): number | null {
  const ms = /^(\d{1,2}):(\d{2})$/.exec(startTime.trim())
  const mi = /^(\d{1,2}):(\d{2})$/.exec(input.trim())
  if (!ms || !mi) return null
  const startTod = parseInt(ms[1], 10) * 3600 + parseInt(ms[2], 10) * 60
  const inTod = parseInt(mi[1], 10) * 3600 + parseInt(mi[2], 10) * 60
  // Cherche le plus petit nombre de jours tel que l'écoulé >= minElapsed.
  let elapsed = inTod - startTod
  while (elapsed < minElapsedSec - 1) elapsed += 86400
  return elapsed < 0 ? elapsed + 86400 : elapsed
}
```

- [ ] **Step 4 : Lancer les tests pour vérifier le succès**

Run: `cd C:/Users/Franc/tc-tableau/web && npx jest __tests__/lib/plan/waypoint-view.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5 : Commit**

```bash
git -C C:/Users/Franc/tc-tableau add web/lib/plan/waypoint-view.ts web/__tests__/lib/plan/waypoint-view.test.ts
git -C C:/Users/Franc/tc-tableau commit -m "feat(plan): waypoint-view (dérivations tronçon + format horaire)"
```

---

## Task 4 : Mapping import (DB↔TS, défauts, prompt)

**Files:**
- Modify: `web/lib/race-import/schema.ts`
- Modify: `web/lib/race-import/sources/livetrail.ts:141-151`
- Modify: `web/lib/race-import/prompt.ts:11`
- Test: `web/__tests__/lib/race-import/schema.test.ts` (existant — y ajouter un cas)

- [ ] **Step 1 : Ajouter un test sur `rowToRaceWaypoint`**

Dans `web/__tests__/lib/race-import/schema.test.ts`, ajouter ce test (adapter l'import si `rowToRaceWaypoint` n'est pas déjà importé) :

```ts
import { rowToRaceWaypoint } from '@/lib/race-import/schema'

describe('rowToRaceWaypoint (nouveaux champs)', () => {
  it('mappe supplies et target_override_sec', () => {
    const wp = rowToRaceWaypoint({
      id: 'w1', race_id: 'r1', order_index: 1, name: 'Ravito A',
      km: 10, km_inter: null, d_plus: 300, d_moins: 100,
      cutoff_raw: null, cutoff_kind: null, type: 'ravito',
      supplies: ['solid', 'liquid'], target_override_sec: 8000,
    })
    expect(wp.supplies).toEqual(['solid', 'liquid'])
    expect(wp.targetOverrideSec).toBe(8000)
  })

  it('défauts : supplies absent → [], override absent → null', () => {
    const wp = rowToRaceWaypoint({
      id: 'w2', race_id: 'r1', order_index: 0, name: 'Départ',
      km: 0, km_inter: null, d_plus: 0, d_moins: 0,
      cutoff_raw: null, cutoff_kind: null, type: 'depart',
    } as any)
    expect(wp.supplies).toEqual([])
    expect(wp.targetOverrideSec).toBeNull()
  })
})
```

- [ ] **Step 2 : Lancer le test pour vérifier l'échec**

Run: `cd C:/Users/Franc/tc-tableau/web && npx jest __tests__/lib/race-import/schema.test.ts -t "nouveaux champs"`
Expected: FAIL — `supplies` / `targetOverrideSec` indéfinis (le mapper ne les gère pas encore).

- [ ] **Step 3 : Étendre `rowToRaceWaypoint` + `DbRow`**

Dans `web/lib/race-import/schema.ts`, remplacer le type `DbRow` (≈ lignes 141-153) et la fonction `rowToRaceWaypoint` (≈ lignes 155-169) :

```ts
type DbRow = {
  id: string
  race_id: string
  order_index: number
  name: string
  km: number | string
  km_inter: number | string | null
  d_plus: number | null
  d_moins: number | null
  cutoff_raw: string | null
  cutoff_kind: CutoffKind | null
  type: WaypointType
  supplies?: WaypointSupply[] | null
  target_override_sec?: number | null
}

export function rowToRaceWaypoint(row: DbRow): RaceWaypoint {
  return {
    id: row.id,
    raceId: row.race_id,
    orderIndex: row.order_index,
    name: row.name,
    km: Number(row.km),
    kmInter: row.km_inter === null ? null : Number(row.km_inter),
    dPlus: row.d_plus,
    dMoins: row.d_moins,
    cutoffRaw: row.cutoff_raw,
    cutoffKind: row.cutoff_kind,
    type: row.type,
    supplies: row.supplies ?? [],
    targetOverrideSec: row.target_override_sec ?? null,
  }
}
```

Ajouter `WaypointSupply` à l'import de types en tête de fichier (ligne 2-7) :

```ts
import type {
  ExtractedRaceData,
  CutoffKind,
  WaypointType,
  WaypointSupply,
  RaceWaypoint,
} from '@/types/plan'
```

- [ ] **Step 4 : Défauts dans `rawToExtractedRaceData`**

Toujours dans `schema.ts`, dans `rawToExtractedRaceData` (≈ lignes 75-86), ajouter les 2 champs au mapping de chaque waypoint (l'extraction LLM ne fournit ni supplies ni override — défauts) :

```ts
    waypoints: raw.waypoints.map((w) => ({
      orderIndex: w.order_index,
      name: w.name,
      km: w.km,
      kmInter: w.km_inter,
      dPlus: w.d_plus,
      dMoins: w.d_moins,
      cutoffRaw: w.cutoff_raw,
      cutoffKind: w.cutoff_raw === null ? null : (w.cutoff_kind as CutoffKind),
      type: w.type,
      supplies: [],
      targetOverrideSec: null,
    })),
```

- [ ] **Step 5 : Défauts dans le parser LiveTrail**

Dans `web/lib/race-import/sources/livetrail.ts`, dans l'objet retourné par `pts.map` (≈ lignes 141-151), ajouter les 2 champs :

```ts
    return {
      orderIndex: idx,
      name: (p['@_n'] ?? '').trim(),
      km,
      kmInter: null,
      dPlus,
      dMoins: null,
      cutoffRaw,
      cutoffKind: cutoffRaw === null ? null : ('clock_time' as const),
      type,
      supplies: [],
      targetOverrideSec: null,
    }
```

- [ ] **Step 6 : Clarifier le prompt (D+ cumulé)**

Dans `web/lib/race-import/prompt.ts`, après la ligne `- Nombres sans unité …` (ligne 10), ajouter une règle :

```
- d_plus / d_moins = dénivelé positif / négatif CUMULÉ depuis le départ au point (pas le dénivelé du tronçon).
```

- [ ] **Step 7 : Mettre à jour les attentes des tests d'import existants**

Ajouter `supplies: []` et `targetOverrideSec: null` aux waypoints produits casse les assertions exactes existantes (les objets attendus n'ont pas ces champs). Lancer d'abord toute la suite import pour repérer les échecs :

Run: `cd C:/Users/Franc/tc-tableau/web && npx jest __tests__/lib/race-import`
Expected: FAIL sur `livetrail.test.ts` / `extract.test.ts` / `sources.test.ts` aux endroits qui comparent des waypoints complets (`toEqual` / `toMatchObject` / `objectContaining`).

Pour CHAQUE objet waypoint attendu dans ces tests (waypoints issus de `livetrailParser` ou de `rawToExtractedRaceData`/`validateExtractedRaceData`), ajouter les 2 champs par défaut. Exemple de transformation à appliquer à chaque waypoint attendu :

```ts
// avant
{ orderIndex: 0, name: 'Départ', km: 0, kmInter: null, dPlus: 0, dMoins: null,
  cutoffRaw: null, cutoffKind: null, type: 'depart' }
// après
{ orderIndex: 0, name: 'Départ', km: 0, kmInter: null, dPlus: 0, dMoins: null,
  cutoffRaw: null, cutoffKind: null, type: 'depart', supplies: [], targetOverrideSec: null }
```

> Si un test utilise `expect.objectContaining({...})` sans les nouveaux champs, il continue de passer — ne le modifier que s'il échoue.

- [ ] **Step 8 : Lancer toute la suite import**

Run: `cd C:/Users/Franc/tc-tableau/web && npx jest __tests__/lib/race-import`
Expected: PASS (tous, y compris les 2 nouveaux de schema.test.ts et les attentes mises à jour).

- [ ] **Step 9 : Commit**

```bash
git -C C:/Users/Franc/tc-tableau add web/lib/race-import web/__tests__/lib/race-import
git -C C:/Users/Franc/tc-tableau commit -m "feat(race-import): mapping supplies + override, prompt D+ cumulé"
```

---

## Task 5 : Persistance PUT waypoints (supplies + override)

**Files:**
- Modify: `web/app/api/races/[id]/waypoints/route.ts:53-64`

- [ ] **Step 1 : Sérialiser les 2 nouveaux champs**

Dans `web/app/api/races/[id]/waypoints/route.ts`, dans la fonction `PUT`, remplacer la construction `rows` (≈ lignes 53-64) :

```ts
  const rows = (body.waypoints ?? []).map((w) => ({
    race_id: params.id,
    order_index: w.orderIndex,
    name: w.name,
    km: w.km,
    km_inter: w.kmInter,
    d_plus: w.dPlus,
    d_moins: w.dMoins,
    cutoff_raw: w.cutoffRaw,
    cutoff_kind: w.cutoffRaw === null ? null : w.cutoffKind,
    type: w.type,
    supplies: w.supplies ?? [],
    target_override_sec: w.targetOverrideSec ?? null,
  }))
```

- [ ] **Step 2 : Vérifier la compilation**

Run: `cd C:/Users/Franc/tc-tableau/web && npx tsc --noEmit`
Expected: plus d'erreur sur ce fichier (`w.supplies` / `w.targetOverrideSec` existent désormais sur `Omit<RaceWaypoint,'id'|'raceId'>`).

- [ ] **Step 3 : Commit**

```bash
git -C C:/Users/Franc/tc-tableau add web/app/api/races/[id]/waypoints/route.ts
git -C C:/Users/Franc/tc-tableau commit -m "feat(api): PUT waypoints persiste supplies + target_override_sec"
```

> Vérification réelle (Supabase) reportée à la vérif manuelle finale (Task 11) — les mocks Jest n'attrapent pas les noms de colonnes.

---

## Task 6 : Persistance des 3 champs course (storage)

**Files:**
- Modify: `web/lib/plan/storage.ts:98-148, 513-538`

- [ ] **Step 1 : Étendre `RaceRow` + mappers**

Dans `web/lib/plan/storage.ts`, remplacer le type `RaceRow` (≈ lignes 98-112), `raceFromRow` (≈ 114-129) et `raceToRow` (≈ 131-148) :

```ts
type RaceRow = {
  id: string
  athlete_id: string
  name: string
  date: string
  distance_km: number
  elevation_m: number
  type: Race['type']
  location: string | null
  is_main: boolean
  priority?: Race['priority']
  notes: string | null
  // Migration 035 — optionnels pour tolérer DB non encore migrée (retry à l'écriture).
  start_time?: string | null
  target_duration_min?: number | null
  pacing_fade?: number | null
}

function raceFromRow(r: RaceRow): Race {
  return {
    id: r.id,
    name: r.name,
    date: r.date,
    distance: Number(r.distance_km),
    elevation: r.elevation_m ?? 0,
    type: r.type,
    location: r.location ?? undefined,
    isMain: !!r.is_main,
    priority: r.priority ?? (r.is_main ? 'A' : 'C'),
    notes: r.notes ?? undefined,
    startTime: r.start_time ?? undefined,
    targetDurationMin: r.target_duration_min ?? undefined,
    pacingFade: r.pacing_fade ?? undefined,
  }
}

function raceToRow(race: Race, athleteId: string): RaceRow {
  return {
    id: race.id,
    athlete_id: athleteId,
    name: race.name,
    date: race.date,
    distance_km: race.distance,
    elevation_m: race.elevation,
    type: race.type,
    location: race.location ?? null,
    is_main: race.priority === 'A',
    priority: race.priority,
    notes: race.notes ?? null,
    start_time: race.startTime ?? null,
    target_duration_min: race.targetDurationMin ?? null,
    pacing_fade: race.pacingFade ?? 0,
  }
}
```

- [ ] **Step 2 : Retry sans les colonnes 035 si absentes**

Dans `saveRace` (≈ lignes 513-538), le bloc `else if (isMissingColumnError(error))` retire déjà `priority`. Étendre ce retry pour retirer AUSSI les colonnes 035 (cas migration 035 non appliquée), en remplaçant la ligne de destructuration :

```ts
    } else if (isMissingColumnError(error)) {
      // Colonne absente (migration 022 et/ou 035 non appliquée) : retry sans les
      // colonnes optionnelles plutôt que fallback LS (qui ferait disparaître la
      // race côté serveur).
      const {
        priority: _priority,
        start_time: _st,
        target_duration_min: _td,
        pacing_fade: _pf,
        ...legacyRow
      } = row
      const { error: retryErr } = await ctx.supabase
        .from('races')
        .upsert(legacyRow, { onConflict: 'id' })
```

- [ ] **Step 3 : Vérifier la compilation**

Run: `cd C:/Users/Franc/tc-tableau/web && npx tsc --noEmit`
Expected: aucune erreur sur `storage.ts`.

- [ ] **Step 4 : Commit**

```bash
git -C C:/Users/Franc/tc-tableau add web/lib/plan/storage.ts
git -C C:/Users/Franc/tc-tableau commit -m "feat(plan): persiste start_time / target_duration / fade sur races"
```

---

## Task 7 : Libellés i18n (3 champs course)

**Files:**
- Modify: `web/lib/i18n/dictionaries/fr.ts` (interface ≈ 625-634 + valeurs ≈ 2489-2503)
- Modify: `web/lib/i18n/dictionaries/en.ts` (mêmes emplacements)

- [ ] **Step 1 : Déclarer les clés dans l'interface (fr.ts)**

Dans `web/lib/i18n/dictionaries/fr.ts`, dans le bloc d'interface du namespace `plan` (après `raceEditFieldType: string`, ≈ ligne 630), ajouter :

```ts
    raceEditFieldStartTime: string
    raceEditFieldTargetTime: string
    raceEditFieldFade: string
    raceEditAdvanced: string
```

- [ ] **Step 2 : Valeurs FR**

Dans `web/lib/i18n/dictionaries/fr.ts`, après `raceEditFieldType: 'Type',` (≈ ligne 2498), ajouter :

```ts
    raceEditFieldStartTime:   'Heure de départ',
    raceEditFieldTargetTime:  'Temps cible (hh:mm)',
    raceEditFieldFade:        'Fade 2e moitié',
    raceEditAdvanced:         'Réglages avancés',
```

- [ ] **Step 3 : Valeurs EN (mêmes emplacements dans en.ts)**

Dans `web/lib/i18n/dictionaries/en.ts`, ajouter au même endroit du namespace `plan` :

```ts
    raceEditFieldStartTime:   'Start time',
    raceEditFieldTargetTime:  'Target time (hh:mm)',
    raceEditFieldFade:        'Second-half fade',
    raceEditAdvanced:         'Advanced settings',
```

- [ ] **Step 4 : Vérifier la compilation (les 2 dicos doivent satisfaire l'interface)**

Run: `cd C:/Users/Franc/tc-tableau/web && npx tsc --noEmit`
Expected: aucune erreur i18n (si `en.ts` partage l'interface de `fr.ts`, les 4 clés y sont requises — d'où l'étape 3).

- [ ] **Step 5 : Commit**

```bash
git -C C:/Users/Franc/tc-tableau add web/lib/i18n/dictionaries/fr.ts web/lib/i18n/dictionaries/en.ts
git -C C:/Users/Franc/tc-tableau commit -m "i18n(plan): libellés départ / temps cible / fade"
```

---

## Task 8 : Éditeur de course — départ, temps cible, fade

**Files:**
- Modify: `web/components/plan/RaceEditorModal.tsx`

- [ ] **Step 1 : Défauts du draft**

Dans `web/components/plan/RaceEditorModal.tsx`, dans `emptyDraft()` (≈ lignes 20-33), ajouter les 3 champs avant la fermeture :

```ts
    notes: undefined,
    startTime: undefined,
    targetDurationMin: undefined,
    pacingFade: 0,
```

- [ ] **Step 2 : Champs du formulaire**

Toujours dans le même fichier, juste après le bloc `<Field label={L.raceEditFieldType}>…</Field>` (≈ ligne 188, le select de type), insérer le bloc départ + temps cible + avancé (fade) :

```tsx
          <div className="grid grid-cols-2 gap-3">
            <Field label={L.raceEditFieldStartTime}>
              <input
                type="time"
                value={draft.startTime ?? ''}
                onChange={(e) => setDraft({ ...draft, startTime: e.target.value || undefined })}
                className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-body focus:outline-none focus:border-trail-primary"
              />
            </Field>
            <Field label={L.raceEditFieldTargetTime}>
              <input
                type="text"
                inputMode="numeric"
                placeholder="37:00"
                value={
                  draft.targetDurationMin != null
                    ? `${Math.floor(draft.targetDurationMin / 60)}:${String(draft.targetDurationMin % 60).padStart(2, '0')}`
                    : ''
                }
                onChange={(e) => {
                  const m = /^(\d{1,3}):(\d{2})$/.exec(e.target.value.trim())
                  setDraft({
                    ...draft,
                    targetDurationMin: m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : undefined,
                  })
                }}
                className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-body focus:outline-none focus:border-trail-primary"
              />
            </Field>
          </div>

          <details className="rounded-[10px] bg-trail-surface border border-trail-border px-3 py-2">
            <summary className="text-caption font-semibold text-trail-muted cursor-pointer">
              {L.raceEditAdvanced}
            </summary>
            <div className="mt-2">
              <Field label={L.raceEditFieldFade}>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={0}
                  max={2}
                  value={draft.pacingFade ?? 0}
                  onChange={(e) => setDraft({ ...draft, pacingFade: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-body focus:outline-none focus:border-trail-primary"
                />
              </Field>
            </div>
          </details>
```

> Note : `handleSave` fait déjà `const toSave: Race = { ...draft, … }` — les 3 nouveaux champs sont donc transmis sans modification supplémentaire.

- [ ] **Step 3 : Vérifier la compilation**

Run: `cd C:/Users/Franc/tc-tableau/web && npx tsc --noEmit`
Expected: aucune erreur sur `RaceEditorModal.tsx`.

- [ ] **Step 4 : Commit**

```bash
git -C C:/Users/Franc/tc-tableau add web/components/plan/RaceEditorModal.tsx
git -C C:/Users/Franc/tc-tableau commit -m "feat(plan): éditeur course — départ, temps cible, fade"
```

---

## Task 9 : Refonte du tableau éditable

**Files:**
- Modify: `web/components/plan/WaypointsTable.tsx` (réécriture)

Objectif : table éditable avec colonnes `Point · Km · ΣD+ · Inter · ▲D+ · ▼D− · Ravito · Objectif · Barrière`. Inter/▲/▼ dérivés (lecture seule). Objectif calculé via pacing, éditable (override). Ravito = toggles S/L/BV.

- [ ] **Step 1 : Réécrire le composant**

Remplacer intégralement `web/components/plan/WaypointsTable.tsx` :

```tsx
'use client'

// Tableau éditable des points de passage. Colonnes auto (Inter, ▲/▼ tronçon)
// dérivées du cumulé via lib/plan/waypoint-view ; Objectif calculé via
// lib/plan/pacing, override éditable. Pas d'undo (re-import pour reset).
import { useCallback, useMemo } from 'react'
import type { RaceWaypoint, WaypointSupply } from '@/types/plan'
import { deriveSegment, formatElapsedToClock, parseClockToElapsed } from '@/lib/plan/waypoint-view'
import { estimatePassageTimes } from '@/lib/plan/pacing'

type Draft = Omit<RaceWaypoint, 'id' | 'raceId'>

type Props = {
  waypoints: Draft[]
  onChange: (next: Draft[]) => void
  readOnly?: boolean
  // Pacing (optionnel) : si absent, la colonne Objectif affiche '—'.
  startTime?: string
  targetDurationMin?: number
  pacingFade?: number
}

const SUPPLY_TOGGLES: { value: WaypointSupply; label: string }[] = [
  { value: 'solid',    label: 'S' },
  { value: 'liquid',   label: 'L' },
  { value: 'base_vie', label: 'BV' },
]

function reindex(rows: Draft[]): Draft[] {
  const sorted = [...rows].sort((a, b) => a.km - b.km)
  return sorted.map((r, i) => ({
    ...r,
    orderIndex: i,
    type: i === 0 ? 'depart' : i === sorted.length - 1 ? 'arrivee' : r.type,
  }))
}

export function WaypointsTable({
  waypoints, onChange, readOnly, startTime, targetDurationMin, pacingFade,
}: Props) {
  const update = useCallback(
    (i: number, patch: Partial<Draft>) => {
      const next = waypoints.map((w, idx) => (idx === i ? { ...w, ...patch } : w))
      onChange(reindex(next))
    },
    [waypoints, onChange],
  )

  // Heures de passage (s écoulées) calculées par le pacing si configuré.
  const elapsed = useMemo(() => {
    if (targetDurationMin == null) return null
    return estimatePassageTimes(
      waypoints.map((w) => ({ km: w.km, dPlus: w.dPlus, targetOverrideSec: w.targetOverrideSec })),
      { totalDurationSec: targetDurationMin * 60, fade: pacingFade ?? 0 },
    )
  }, [waypoints, targetDurationMin, pacingFade])

  const toggleSupply = (i: number, s: WaypointSupply) => {
    const cur = waypoints[i].supplies
    const next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]
    update(i, { supplies: next })
  }

  const onObjectifBlur = (i: number, raw: string) => {
    if (!startTime || elapsed == null) return
    const v = raw.trim()
    if (v === '') { update(i, { targetOverrideSec: null }); return }
    const min = i > 0 && elapsed[i - 1] != null ? elapsed[i - 1] : 0
    const sec = parseClockToElapsed(startTime, v, min)
    if (sec != null) update(i, { targetOverrideSec: sec })
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-caption text-trail-text">
          <thead>
            <tr className="text-trail-muted text-micro">
              <th className="text-left p-1">Point</th>
              <th className="text-right p-1">Km</th>
              <th className="text-right p-1">ΣD+</th>
              <th className="text-right p-1">Inter</th>
              <th className="text-right p-1">▲D+</th>
              <th className="text-right p-1">▼D−</th>
              <th className="text-left p-1">Ravito</th>
              <th className="text-right p-1">Objectif</th>
              <th className="text-left p-1">Barrière</th>
              {!readOnly && <th />}
            </tr>
          </thead>
          <tbody>
            {waypoints.map((w, i) => {
              const seg = deriveSegment(
                waypoints.map((x) => ({ km: x.km, dPlus: x.dPlus, dMoins: x.dMoins })),
                i,
              )
              const clock =
                elapsed && startTime ? formatElapsedToClock(startTime, elapsed[i]) : null
              const isOverride = w.targetOverrideSec != null
              return (
                <tr key={`${w.orderIndex}-${i}`} className="border-t border-trail-border">
                  <td className="p-1">
                    <input type="text" value={w.name} disabled={readOnly}
                      onChange={(e) => update(i, { name: e.target.value })}
                      className="w-full bg-transparent outline-none" />
                  </td>
                  <td className="p-1 w-[54px]">
                    <input type="number" step="0.1" value={w.km} disabled={readOnly}
                      onChange={(e) => update(i, { km: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent outline-none text-right" />
                  </td>
                  <td className="p-1 w-[54px]">
                    <input type="number" value={w.dPlus ?? ''} disabled={readOnly}
                      onChange={(e) => update(i, { dPlus: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                      className="w-full bg-transparent outline-none text-right" />
                  </td>
                  <td className="p-1 w-[48px] text-right text-trail-muted">
                    {seg.interKm ?? '—'}
                  </td>
                  <td className="p-1 w-[48px] text-right" style={{ color: 'var(--trail-primary)' }}>
                    {seg.dPlusSeg ?? '—'}
                  </td>
                  <td className="p-1 w-[48px] text-right text-trail-muted">
                    {seg.dMoinsSeg ?? '—'}
                  </td>
                  <td className="p-1">
                    <div className="flex gap-1">
                      {SUPPLY_TOGGLES.map((s) => {
                        const on = w.supplies.includes(s.value)
                        return (
                          <button key={s.value} type="button" disabled={readOnly}
                            onClick={() => toggleSupply(i, s.value)}
                            aria-pressed={on}
                            className={`px-1 rounded text-micro font-bold border ${
                              on ? 'bg-trail-primary text-white border-trail-primary'
                                 : 'text-trail-muted border-trail-border'
                            }`}>
                            {s.label}
                          </button>
                        )
                      })}
                    </div>
                  </td>
                  <td className="p-1 w-[64px] text-right">
                    {targetDurationMin == null ? (
                      <span className="text-trail-muted">—</span>
                    ) : (
                      <input type="text" disabled={readOnly} placeholder="—"
                        defaultValue={clock?.label ?? ''}
                        key={`${clock?.label ?? ''}-${isOverride}`}
                        onBlur={(e) => onObjectifBlur(i, e.target.value)}
                        className={`w-full bg-transparent outline-none text-right ${
                          isOverride ? 'font-bold text-trail-text' : 'text-trail-muted'
                        }`} />
                    )}
                  </td>
                  <td className="p-1">
                    <input type="text" value={w.cutoffRaw ?? ''} disabled={readOnly} placeholder="—"
                      onChange={(e) => {
                        const v = e.target.value || null
                        update(i, { cutoffRaw: v, cutoffKind: v === null ? null : w.cutoffKind ?? 'clock_time' })
                      }}
                      className="w-[64px] bg-transparent outline-none" />
                  </td>
                  {!readOnly && (
                    <td className="p-1 w-[24px]">
                      <button type="button" onClick={() => onChange(reindex(waypoints.filter((_, idx) => idx !== i)))}
                        aria-label={`Supprimer ${w.name || 'ligne'}`}
                        className="text-trail-danger text-body">×</button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

> Décisions : la saisie « Objectif » est non-contrôlée (`defaultValue` + `key` qui se réinitialise quand la valeur calculée change) pour ne pas écraser la frappe pendant l'édition ; on persiste au blur. `▲D+` colorée via `--trail-primary` (cohérent avec la maquette). Le bouton « + Ajouter une ligne » est retiré (les points viennent de l'import ; correction inline + suppression suffisent au MVP — l'ajout manuel n'était pas demandé).

- [ ] **Step 2 : Vérifier la compilation**

Run: `cd C:/Users/Franc/tc-tableau/web && npx tsc --noEmit`
Expected: aucune erreur sur `WaypointsTable.tsx` (les props pacing sont optionnelles ; le parent est mis à jour à la Task 10).

- [ ] **Step 3 : Commit**

```bash
git -C C:/Users/Franc/tc-tableau add web/components/plan/WaypointsTable.tsx
git -C C:/Users/Franc/tc-tableau commit -m "feat(plan): tableau course éditable (ravitos, objectif auto, colonnes dérivées)"
```

---

## Task 10 : Brancher l'édition + bouton export (page course)

**Files:**
- Modify: `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx:128-153`

- [ ] **Step 1 : Persistance debounced des waypoints**

Dans `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx`, ajouter en haut du composant (après les `useState`, ≈ ligne 35) un handler qui met à jour l'état ET persiste (debounce 600 ms) :

```tsx
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleWaypointsChange = useCallback(
    (next: Array<Omit<RaceWaypoint, 'id' | 'raceId'>>) => {
      setWaypoints(next.map((w, i) => ({ ...w, id: waypoints[i]?.id ?? `tmp-${i}`, raceId })))
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        void fetch(`/api/races/${raceId}/waypoints`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ waypoints: next }),
        })
      }, 600)
    },
    [raceId, waypoints],
  )
```

Ajouter `useRef` à l'import React (ligne 3) : `import { useCallback, useEffect, useRef, useState } from 'react'`.

- [ ] **Step 2 : Rendre la table éditable + bouton export**

Remplacer le bloc `<Section title="Tableau de course">…</Section>` (≈ lignes 128-153) :

```tsx
      <Section title="Tableau de course">
        {waypoints.length === 0 ? (
          <button type="button" onClick={() => setImportOpen(true)}
            className="text-caption text-trail-primary underline">
            Importer le tableau (URL / PDF / Image / Texte)
          </button>
        ) : (
          <>
            <WaypointsTable
              waypoints={waypoints.map(({ id: _id, raceId: _rid, ...rest }) => rest)}
              onChange={handleWaypointsChange}
              startTime={race.startTime}
              targetDurationMin={race.targetDurationMin}
              pacingFade={race.pacingFade}
            />
            <div className="mt-2 flex items-center gap-4">
              <a href={`/plan/courses/${raceId}/print`} target="_blank" rel="noopener noreferrer"
                className="text-caption text-trail-primary underline">
                Exporter en PDF
              </a>
              <button type="button" onClick={() => setImportOpen(true)}
                className="text-caption text-trail-muted underline">
                Ré-importer
              </button>
            </div>
          </>
        )}
      </Section>
```

- [ ] **Step 3 : Vérifier la compilation**

Run: `cd C:/Users/Franc/tc-tableau/web && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git -C C:/Users/Franc/tc-tableau add "web/app/(main)/plan/courses/[id]/CoursePageClient.tsx"
git -C C:/Users/Franc/tc-tableau commit -m "feat(plan): édition inline des waypoints + bouton export PDF"
```

---

## Task 11 : Route d'impression A4 paginée

**Files:**
- Create: `web/app/(main)/plan/courses/[id]/print/page.tsx`

- [ ] **Step 1 : Créer la page d'impression**

Create `web/app/(main)/plan/courses/[id]/print/page.tsx` (client component : fetch waypoints + course, calcule les heures, déclenche `window.print()`) :

```tsx
'use client'

import { useEffect, useState } from 'react'
import type { Race, RaceWaypoint, WaypointSupply } from '@/types/plan'
import { getRaces } from '@/lib/plan/storage'
import { estimatePassageTimes } from '@/lib/plan/pacing'
import { deriveSegment, formatElapsedToClock } from '@/lib/plan/waypoint-view'

const SUP: Record<WaypointSupply, string> = { solid: 'S', liquid: 'L', base_vie: 'BV' }

export default function PrintCoursePage({ params }: { params: { id: string } }) {
  const [race, setRace] = useState<Race | null>(null)
  const [wps, setWps] = useState<RaceWaypoint[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void (async () => {
      const races = await getRaces()
      setRace(races.find((r) => r.id === params.id) ?? null)
      const res = await fetch(`/api/races/${params.id}/waypoints`)
      if (res.ok) setWps((await res.json()).waypoints ?? [])
      setReady(true)
    })()
  }, [params.id])

  useEffect(() => {
    if (ready && wps.length > 0) {
      const t = setTimeout(() => window.print(), 400)
      return () => clearTimeout(t)
    }
  }, [ready, wps.length])

  const elapsed =
    race?.targetDurationMin != null
      ? estimatePassageTimes(
          wps.map((w) => ({ km: w.km, dPlus: w.dPlus, targetOverrideSec: w.targetOverrideSec })),
          { totalDurationSec: race.targetDurationMin * 60, fade: race.pacingFade ?? 0 },
        )
      : null

  if (!ready) return <div className="p-6 text-sm">Préparation…</div>
  if (!race) return <div className="p-6 text-sm">Course introuvable.</div>

  return (
    <div className="print-root">
      <style>{`
        @page { size: A4 landscape; margin: 10mm; }
        .print-root { background: #fff; color: #0E1513; font-family: system-ui, sans-serif; padding: 8mm; }
        .print-root h1 { font-size: 16px; font-weight: 700; margin: 0; }
        .print-root .sub { font-size: 10px; color: #55615E; margin: 2px 0 8px; }
        .print-root table { width: 100%; border-collapse: collapse; }
        .print-root th, .print-root td { padding: 3px 5px; font-size: 11px; border-bottom: .5px solid #C9D1CE; }
        .print-root th { text-align: left; font-size: 9px; text-transform: uppercase; color: #55615E; border-bottom: 1px solid #2A332F; }
        .print-root td.r, .print-root th.r { text-align: right; }
        .print-root thead { display: table-header-group; } /* en-tête répété par page */
        .print-root tr { break-inside: avoid; }
        .print-root .bv { font-weight: 700; }
        @media screen {
          .print-root { max-width: 1000px; margin: 16px auto; box-shadow: 0 2px 12px rgba(0,0,0,.1); }
          .toolbar { max-width: 1000px; margin: 12px auto 0; }
        }
        @media print { .toolbar { display: none; } }
      `}</style>

      <div className="toolbar">
        <button onClick={() => window.print()}
          style={{ padding: '8px 14px', borderRadius: 8, background: '#C44E22', color: '#fff', border: 0, fontWeight: 600 }}>
          Imprimer / Enregistrer en PDF
        </button>
      </div>

      <h1>{race.name}</h1>
      <div className="sub">
        {race.distance} km · {race.elevation} m D+
        {race.startTime ? ` · Départ ${race.startTime}` : ''}
        {race.targetDurationMin != null
          ? ` · Objectif ${Math.floor(race.targetDurationMin / 60)} h ${String(race.targetDurationMin % 60).padStart(2, '0')}`
          : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th>Point</th><th className="r">Km</th><th className="r">ΣD+</th>
            <th className="r">Inter</th><th className="r">▲D+</th><th className="r">▼D−</th>
            <th>Ravito</th><th className="r">Objectif</th><th>Barrière</th>
          </tr>
        </thead>
        <tbody>
          {wps.map((w, i) => {
            const seg = deriveSegment(wps.map((x) => ({ km: x.km, dPlus: x.dPlus, dMoins: x.dMoins })), i)
            const clock = elapsed && race.startTime ? formatElapsedToClock(race.startTime, elapsed[i]) : null
            return (
              <tr key={w.id}>
                <td>{w.name}</td>
                <td className="r">{w.km}</td>
                <td className="r">{w.dPlus ?? '—'}</td>
                <td className="r">{seg.interKm ?? '—'}</td>
                <td className="r">{seg.dPlusSeg ?? '—'}</td>
                <td className="r">{seg.dMoinsSeg ?? '—'}</td>
                <td>{w.supplies.map((s) => SUP[s]).join(' ') || '—'}</td>
                <td className="r">{clock?.label ?? '—'}</td>
                <td>{w.cutoffRaw ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier la compilation**

Run: `cd C:/Users/Franc/tc-tableau/web && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3 : Vérifier le rendu (headless) — sanity build de la page statique**

La page dépend de données runtime (fetch) ; on vérifie surtout que la route compile et rend côté client. Lancer le dev server puis capturer (la page affichera « Course introuvable » sans données, c'est OK pour valider le layout d'erreur) :

Run (depuis une fenêtre dédiée) : `cd C:/Users/Franc/tc-tableau/web && npx tsc --noEmit && npx jest __tests__/lib/plan`
Expected: tsc OK, suites pacing + waypoint-view PASS.

> Le rendu visuel réel (A4, pagination, en-tête répété) se valide à la vérif manuelle finale avec une vraie course (Task 12, étape vérif), au besoin via Chrome headless Windows (cf. `tasks/lessons.md` 2026-06-10).

- [ ] **Step 4 : Commit**

```bash
git -C C:/Users/Franc/tc-tableau add "web/app/(main)/plan/courses/[id]/print/page.tsx"
git -C C:/Users/Franc/tc-tableau commit -m "feat(plan): route d'impression A4 du tableau de course"
```

---

## Task 12 : Backlog (moteur avancé) + bandeau spec + vérif finale

**Files:**
- Modify: `tasks/backlog.md`
- Modify: `docs/superpowers/specs/2026-06-10-tableau-course-integration-design.md` (bandeau Status)

- [ ] **Step 1 : Ajouter l'item backlog**

Ajouter dans `tasks/backlog.md` (au format du fichier) une entrée :

> **Moteur d'estimation horaire avancé (tableau de course)** — Remplacer le pacing v1 (effort-km + fade dans `web/lib/plan/pacing.ts`) par un modèle VAP réel grade-adjusted, calibré sur l'indice UTMB/Betrail/ITRA de l'athlète et un benchmark des résultats historiques des autres coureurs de la course. Même signature `estimatePassageTimes` → remplacement interne sans toucher table/PDF. Dépend de sources externes (indices + base de résultats).

- [ ] **Step 2 : Bandeau Status sur la spec**

En tête de `docs/superpowers/specs/2026-06-10-tableau-course-integration-design.md`, ajouter sous le titre :

```markdown
> **Status: Implémenté** · 2026-06-10 · Code: web/lib/plan/{pacing,waypoint-view}.ts, web/components/plan/WaypointsTable.tsx, web/app/(main)/plan/courses/[id]/print/page.tsx
```

- [ ] **Step 3 : Vérification globale (types + tests ciblés)**

Run: `cd C:/Users/Franc/tc-tableau/web && npx tsc --noEmit && npx jest __tests__/lib/plan __tests__/lib/race-import`
Expected: tsc OK ; suites pacing, waypoint-view, race-import PASS.

- [ ] **Step 4 : Commit**

```bash
git -C C:/Users/Franc/tc-tableau add tasks/backlog.md docs/superpowers/specs/2026-06-10-tableau-course-integration-design.md
git -C C:/Users/Franc/tc-tableau commit -m "docs(plan): backlog moteur avancé + bandeau spec implémenté"
```

---

## Vérification manuelle finale (à faire avec Franck)

1. **Appliquer la migration 035** : coller le SQL de `web/supabase/migrations/035_*.sql` dans le dashboard Supabase. (Rappel : non auto-appliquée.)
2. `npm run dev` dans le worktree, ouvrir une course avec waypoints importés.
3. Éditer la course → renseigner **Heure de départ** + **Temps cible** → la colonne **Objectif** se remplit (heures de passage).
4. Corriger une heure « Objectif » à la main → elle se fige (gras) et **les tronçons suivants se recalculent**.
5. Cocher des ravitos **S / L / BV** → recharger la page → valeurs persistées.
6. **Exporter en PDF** → la route `/print` s'ouvre, `window.print()` se déclenche, le tableau tient en A4 paysage, l'en-tête se répète si > 1 page.

---

## Notes de séquencement

- Tasks 1→8 sont indépendantes côté UI et peuvent être validées par `tsc` + Jest. Les Tasks 9→11 (UI/route) se vérifient surtout manuellement.
- Aucune tâche ne pousse sur `master` ni ne merge : tout reste sur `feat/tableau-course-integration` (worktree). La décision merge/PR se prend à la fin (skill `finishing-a-development-branch`).
