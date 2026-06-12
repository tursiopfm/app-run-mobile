# Mode barrières (Obj calé sur les BH) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quand l'objectif total d'une course égale (à la minute près) sa barrière horaire d'arrivée, la colonne « Obj » du tableau reproduit exactement les barrières (interpolation distance pour les points sans barrière) et le bloc « Stratégie d'allure » se grise avec une note.

**Architecture :** Un module pur `lib/plan/barrier-lock.ts` expose `resolveElapsed` (point d'entrée unique : barrières vs effort-km) et `isBarrierLocked` (détection dérivée). `WaypointsTable` et la carte `/print` passent par `resolveElapsed` ; `CoursePageClient` calcule `isBarrierLocked` et grise `PacingStrategyCard`. Rien n'est persisté (mode dérivé).

**Tech Stack :** TypeScript, React (Next 14 App Router), Jest. Réutilise `parseClockToElapsed` (`lib/plan/waypoint-view.ts`) et `estimatePassageTimes` (`lib/plan/pacing.ts`).

**Spec :** `web/docs/superpowers/specs/2026-06-12-mode-barrieres-design.md`

**Commandes** (toujours depuis `web/`, chemin absolu sous Windows) :
- Tests ciblés : `cd /c/Users/Franc/app-run-mobile/web && npx jest <fichier>`
- Type-check : `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit`
- Lint : `cd /c/Users/Franc/app-run-mobile/web && npm run lint`

> ⚠️ Ne **pas** pousser sur `master` pendant l'exécution. Les commits restent **locaux** sur `feat/race-website-autofill` ; le push (déploiement prod) est une décision séparée de Franck (cf. Task 7).

---

## File Structure

- **Create** `web/lib/plan/barrier-lock.ts` — logique pure : détection + résolution des heures de passage.
- **Create** `web/__tests__/lib/plan/barrier-lock.test.ts` — tests unitaires purs.
- **Modify** `web/lib/i18n/dictionaries/fr.ts` — type + valeurs `pacingLockedNote` / `pacingLockedBadge`.
- **Modify** `web/lib/i18n/dictionaries/en.ts` — valeurs `pacingLockedNote` / `pacingLockedBadge`.
- **Modify** `web/components/plan/WaypointsTable.tsx` — `elapsed` via `resolveElapsed`.
- **Modify** `web/app/(main)/plan/courses/[id]/print/page.tsx` — `elapsed` via `resolveElapsed`.
- **Modify** `web/components/plan/PacingStrategyCard.tsx` — prop `barrierLocked` (grisé + note + badge).
- **Modify** `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx` — calcule `isBarrierLocked`, passe la prop.

---

## Task 1 : Clés i18n (note + badge)

**Files:**
- Modify: `web/lib/i18n/dictionaries/fr.ts:546` (type) et `:2401` (valeurs)
- Modify: `web/lib/i18n/dictionaries/en.ts:1221` (valeurs)

- [ ] **Step 1 : Ajouter les deux clés au type (fr.ts)**

Ligne `pacingMethodSummary: string; pacingMethodFormula: string; pacingMethodBody: string` (~`fr.ts:546`) → ajouter à la fin de la ligne :

```ts
    pacingMethodSummary: string; pacingMethodFormula: string; pacingMethodBody: string
    pacingLockedNote: string; pacingLockedBadge: string
```

- [ ] **Step 2 : Ajouter les valeurs FR**

Juste après la ligne `pacingMethodBody:` (~`fr.ts:2401`) :

```ts
    pacingLockedNote:     'Objectif = barrière finale → heures calées sur les barrières (zéro marge).',
    pacingLockedBadge:    'Barrières',
```

- [ ] **Step 3 : Ajouter les valeurs EN**

Juste après la ligne `pacingMethodBody:` (~`en.ts:1221`) :

```ts
    pacingLockedNote:     'Goal = final cutoff → times pinned to the cutoffs (zero margin).',
    pacingLockedBadge:    'Cutoffs',
```

- [ ] **Step 4 : Type-check**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit`
Expected: exit 0 (aucune erreur — les deux dictionnaires conforment au type).

- [ ] **Step 5 : Commit**

```bash
git add web/lib/i18n/dictionaries/fr.ts web/lib/i18n/dictionaries/en.ts
git commit -m "feat(plan): clés i18n mode barrières (note + badge)"
```

---

## Task 2 : Module pur `barrier-lock.ts` (TDD)

**Files:**
- Create: `web/lib/plan/barrier-lock.ts`
- Test: `web/__tests__/lib/plan/barrier-lock.test.ts`

- [ ] **Step 1 : Écrire le test (qui échoue)**

Créer `web/__tests__/lib/plan/barrier-lock.test.ts` :

```ts
import { barrierElapsedSeries, isBarrierLocked, resolveElapsed, type LockWaypoint } from '@/lib/plan/barrier-lock'
import { estimatePassageTimes } from '@/lib/plan/pacing'

const wp = (over: Partial<LockWaypoint> & { km: number }): LockWaypoint => ({
  dPlus: null, targetOverrideSec: null, cutoffRaw: null, cutoffKind: null, ...over,
})

// Tableau synthétique : départ 19:00 ; barrières A 22:30 (3h30), C 04:30 (J+1, 9h30),
// arrivée D 07:00 (J+1, 12h). B sans barrière (interpolé).
const START = '19:00'
const TABLE: LockWaypoint[] = [
  wp({ km: 0,  dPlus: 0,   cutoffRaw: null }),                               // départ
  wp({ km: 10, dPlus: 100, cutoffRaw: '22:30', cutoffKind: 'clock_time' }),  // A → 12600
  wp({ km: 20, dPlus: 200, cutoffRaw: null }),                              // B → interpolé
  wp({ km: 30, dPlus: 300, cutoffRaw: '04:30', cutoffKind: 'clock_time' }),  // C → 34200
  wp({ km: 40, dPlus: 400, cutoffRaw: '07:00', cutoffKind: 'clock_time' }),  // D → 43200
]
const OBJ_MIN = 720 // 12h = barrière d'arrivée → mode barrières

describe('barrierElapsedSeries', () => {
  it('convertit les barrières horloge en écoulé monotone (passage de minuit)', () => {
    expect(barrierElapsedSeries(TABLE, START)).toEqual([null, 12600, null, 34200, 43200])
  })
  it('ignore les barrières horloge sans heure de départ', () => {
    expect(barrierElapsedSeries(TABLE, undefined)).toEqual([null, null, null, null, null])
  })
})

describe('isBarrierLocked', () => {
  it('vrai quand objectif ≈ barrière d’arrivée (à la minute)', () => {
    expect(isBarrierLocked(TABLE, START, 720)).toBe(true)
  })
  it('faux quand objectif < barrière finale', () => {
    expect(isBarrierLocked(TABLE, START, 660)).toBe(false)
  })
  it('faux sans barrière à l’arrivée', () => {
    const t = [...TABLE.slice(0, 4), wp({ km: 40, cutoffRaw: null })]
    expect(isBarrierLocked(t, START, 720)).toBe(false)
  })
  it('faux sans heure de départ (barrières horloge)', () => {
    expect(isBarrierLocked(TABLE, undefined, 720)).toBe(false)
  })
})

describe('resolveElapsed — mode barrières', () => {
  it('cale chaque Obj sur sa barrière, interpole les trous au prorata distance', () => {
    const { elapsed, locked } = resolveElapsed(TABLE, START, OBJ_MIN, -1.2)
    expect(locked).toBe(true)
    // A = 3h30 exact (et non une valeur effort-km/fade > barrière) ;
    // B = milieu distance de [km10→12600 ; km30→34200] = 23400 ; D = objectif.
    expect(elapsed).toEqual([0, 12600, 23400, 34200, 43200])
  })
  it('respecte un override manuel comme ancre prioritaire', () => {
    const t = TABLE.map((w, i) => (i === 2 ? { ...w, targetOverrideSec: 20000 } : w))
    const { elapsed } = resolveElapsed(t, START, OBJ_MIN, 0)
    expect(elapsed![2]).toBe(20000)
  })
})

describe('resolveElapsed — mode normal', () => {
  it('retombe sur estimatePassageTimes quand non verrouillé', () => {
    const { elapsed, locked } = resolveElapsed(TABLE, START, 660, 0.5)
    expect(locked).toBe(false)
    const expected = estimatePassageTimes(
      TABLE.map((w) => ({ km: w.km, dPlus: w.dPlus, targetOverrideSec: w.targetOverrideSec })),
      { totalDurationSec: 660 * 60, fade: 0.5 },
    )
    expect(elapsed).toEqual(expected)
  })
  it('elapsed null sans objectif', () => {
    expect(resolveElapsed(TABLE, START, null, 0)).toEqual({ elapsed: null, locked: false })
  })
})
```

- [ ] **Step 2 : Lancer le test pour le voir échouer**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/plan/barrier-lock.test.ts`
Expected: FAIL — `Cannot find module '@/lib/plan/barrier-lock'`.

- [ ] **Step 3 : Écrire le module**

Créer `web/lib/plan/barrier-lock.ts` :

```ts
// Mode « barrières » : quand l'objectif total égale la barrière d'arrivée (zéro
// marge), la colonne Objectif doit reproduire EXACTEMENT les barrières horaires —
// pas de répartition effort-km/fade, qui projetterait un passage au-delà d'une
// barrière intermédiaire. Logique pure, dérivée : rien n'est persisté.

import { parseClockToElapsed } from '@/lib/plan/waypoint-view'
import { estimatePassageTimes } from '@/lib/plan/pacing'

export interface LockWaypoint {
  km: number
  dPlus: number | null
  targetOverrideSec: number | null
  cutoffRaw: string | null
  cutoffKind: 'clock_time' | 'elapsed' | 'unknown' | null
}

const TOLERANCE_SEC = 60

// Écoulé (s depuis le départ) de la barrière de chaque point, null si absente.
// Parcours monotone (chaque barrière ≥ la précédente) → lève l'ambiguïté du jour.
export function barrierElapsedSeries(
  waypoints: LockWaypoint[],
  startTime?: string,
): (number | null)[] {
  const out: (number | null)[] = new Array(waypoints.length).fill(null)
  let prev = 0
  for (let i = 0; i < waypoints.length; i++) {
    const raw = waypoints[i].cutoffRaw
    if (!raw) continue
    const m = /(\d{1,2})[:h](\d{2})/.exec(raw)
    if (!m) continue
    let e: number | null
    if (waypoints[i].cutoffKind === 'elapsed') {
      e = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60
    } else {
      if (!startTime) continue
      e = parseClockToElapsed(startTime, `${m[1]}:${m[2]}`, prev)
    }
    if (e == null) continue
    out[i] = e
    prev = e
  }
  return out
}

// Écoulé de la barrière d'arrivée (dernier point), null si absente.
export function arrivalBarrierSec(
  waypoints: LockWaypoint[],
  startTime?: string,
): number | null {
  if (waypoints.length === 0) return null
  const series = barrierElapsedSeries(waypoints, startTime)
  return series[series.length - 1]
}

// Vrai quand l'objectif total ≈ la barrière d'arrivée (à la minute près).
export function isBarrierLocked(
  waypoints: LockWaypoint[],
  startTime: string | undefined,
  targetDurationMin: number | null | undefined,
): boolean {
  if (targetDurationMin == null) return false
  const arr = arrivalBarrierSec(waypoints, startTime)
  if (arr == null) return false
  return Math.abs(arr - targetDurationMin * 60) <= TOLERANCE_SEC
}

// Heures de passage (s écoulées) + indicateur de mode. Point d'entrée UNIQUE de
// l'UI (tableau + PDF) : décide barrières vs répartition effort-km.
export function resolveElapsed(
  waypoints: LockWaypoint[],
  startTime: string | undefined,
  targetDurationMin: number | null | undefined,
  fade: number,
): { elapsed: number[] | null; locked: boolean } {
  if (targetDurationMin == null) return { elapsed: null, locked: false }
  const totalSec = targetDurationMin * 60

  if (!isBarrierLocked(waypoints, startTime, targetDurationMin)) {
    const elapsed = estimatePassageTimes(
      waypoints.map((w) => ({ km: w.km, dPlus: w.dPlus, targetOverrideSec: w.targetOverrideSec })),
      { totalDurationSec: totalSec, fade },
    )
    return { elapsed, locked: false }
  }

  // Mode barrières : ancres = override ?? barrière (départ 0, arrivée objectif),
  // trous interpolés au prorata de la distance.
  const n = waypoints.length
  const series = barrierElapsedSeries(waypoints, startTime)
  const elapsed: number[] = new Array(n).fill(0)

  const anchorVal = (i: number): number | null => {
    if (i === 0) return 0
    if (i === n - 1) return totalSec
    if (waypoints[i].targetOverrideSec != null) return waypoints[i].targetOverrideSec
    return series[i]
  }

  const anchors: number[] = []
  for (let i = 0; i < n; i++) {
    const v = anchorVal(i)
    if (v != null) { elapsed[i] = v; anchors.push(i) }
  }

  for (let a = 0; a < anchors.length - 1; a++) {
    const ia = anchors[a]
    const ib = anchors[a + 1]
    const span = elapsed[ib] - elapsed[ia]
    const dist = waypoints[ib].km - waypoints[ia].km
    for (let k = ia + 1; k < ib; k++) {
      const frac = dist > 0 ? (waypoints[k].km - waypoints[ia].km) / dist : (k - ia) / (ib - ia)
      elapsed[k] = elapsed[ia] + span * frac
    }
  }

  return { elapsed: elapsed.map((s) => Math.round(s)), locked: true }
}
```

- [ ] **Step 4 : Lancer le test pour le voir passer**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/plan/barrier-lock.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5 : Commit**

```bash
git add web/lib/plan/barrier-lock.ts web/__tests__/lib/plan/barrier-lock.test.ts
git commit -m "feat(plan): module barrier-lock (Obj calé sur les barrières)"
```

---

## Task 3 : Brancher `resolveElapsed` dans `WaypointsTable`

**Files:**
- Modify: `web/components/plan/WaypointsTable.tsx:14` (import), `:112-118` (useMemo `elapsed`)

- [ ] **Step 1 : Remplacer l'import**

Ligne 14 — remplacer :

```ts
import { estimatePassageTimes } from '@/lib/plan/pacing'
```

par :

```ts
import { resolveElapsed } from '@/lib/plan/barrier-lock'
```

- [ ] **Step 2 : Remplacer le calcul `elapsed`**

Bloc `const elapsed = useMemo(...)` (~`:112-118`) — remplacer :

```ts
  const elapsed = useMemo(() => {
    if (targetDurationMin == null) return null
    return estimatePassageTimes(
      waypoints.map((w) => ({ km: w.km, dPlus: w.dPlus, targetOverrideSec: w.targetOverrideSec })),
      { totalDurationSec: targetDurationMin * 60, fade: pacingFade ?? 0 },
    )
  }, [waypoints, targetDurationMin, pacingFade])
```

par :

```ts
  const elapsed = useMemo(() => {
    return resolveElapsed(
      waypoints.map((w) => ({
        km: w.km, dPlus: w.dPlus, targetOverrideSec: w.targetOverrideSec,
        cutoffRaw: w.cutoffRaw, cutoffKind: w.cutoffKind,
      })),
      startTime,
      targetDurationMin ?? null,
      pacingFade ?? 0,
    ).elapsed
  }, [waypoints, startTime, targetDurationMin, pacingFade])
```

- [ ] **Step 3 : Type-check + tests existants du tableau**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit && npx jest __tests__/components/plan/WaypointsTable.undo.test.tsx`
Expected: tsc exit 0 ; tests PASS (le comportement Obj en mode normal est inchangé).

- [ ] **Step 4 : Commit**

```bash
git add web/components/plan/WaypointsTable.tsx
git commit -m "feat(plan): WaypointsTable — Obj via resolveElapsed (mode barrières)"
```

---

## Task 4 : Brancher `resolveElapsed` dans la carte `/print`

**Files:**
- Modify: `web/app/(main)/plan/courses/[id]/print/page.tsx:9` (import), `:168-178` (calcul `elapsed`)

- [ ] **Step 1 : Remplacer l'import**

Ligne 9 — remplacer :

```ts
import { estimatePassageTimes } from '@/lib/plan/pacing'
```

par :

```ts
import { resolveElapsed } from '@/lib/plan/barrier-lock'
```

- [ ] **Step 2 : Remplacer le calcul `elapsed`**

Bloc `const totalSec = ...` / `const elapsed = ...` (~`:168-178`) — remplacer :

```ts
  const totalSec = race.targetDurationMin != null ? race.targetDurationMin * 60 : null
  const elapsed = totalSec != null
    ? estimatePassageTimes(
        wps.map((w) => ({ km: w.km, dPlus: w.dPlus, targetOverrideSec: w.targetOverrideSec })),
        { totalDurationSec: totalSec, fade: race.pacingFade ?? 0 },
      )
    : null
```

par :

```ts
  const totalSec = race.targetDurationMin != null ? race.targetDurationMin * 60 : null
  const elapsed = resolveElapsed(
    wps.map((w) => ({
      km: w.km, dPlus: w.dPlus, targetOverrideSec: w.targetOverrideSec,
      cutoffRaw: w.cutoffRaw, cutoffKind: w.cutoffKind,
    })),
    race.startTime,
    race.targetDurationMin ?? null,
    race.pacingFade ?? 0,
  ).elapsed
```

(`totalSec` reste utilisé plus bas pour `arrClock`/`goal` — ne pas le supprimer.)

- [ ] **Step 3 : Type-check**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4 : Commit**

```bash
git add "web/app/(main)/plan/courses/[id]/print/page.tsx"
git commit -m "feat(plan): carte /print — Obj via resolveElapsed (mode barrières)"
```

---

## Task 5 : `PacingStrategyCard` — état grisé + note

**Files:**
- Modify: `web/components/plan/PacingStrategyCard.tsx` — Props (`:23-33`), CSS badge (`:160-163`), corps (`:128-239`)

- [ ] **Step 1 : Ajouter la prop `barrierLocked`**

Dans `type Props` (~`:23`), ajouter la prop :

```ts
type Props = {
  waypoints: PacingStrategyWaypoint[]
  targetDurationMin: number
  pacingFade: number
  onChange: (fade: number) => void
  readOnly?: boolean
  barrierLocked?: boolean
  // Objectif / départ affichés à droite du titre, cliquables (popups d'édition).
  startTime?: string
  onEditObjective?: () => void
  onEditStart?: () => void
}
```

- [ ] **Step 2 : Déstructurer la prop + dériver badge/variante**

Signature de la fonction (~`:128`) — ajouter `barrierLocked` :

```ts
export function PacingStrategyCard({
  waypoints, targetDurationMin, pacingFade, onChange, readOnly, barrierLocked,
  startTime, onEditObjective, onEditStart,
}: Props) {
```

Puis remplacer les lignes `variant` (~`:136`) et `curLabel` (~`:146`) :

```ts
  // Variante de couleur du badge : barrières=neutre · régulier=gris · finir fort=bleu · partir vite=orange.
  const variant = barrierLocked ? 'lock' : Math.abs(fade) < 0.08 ? 'even' : fade < 0 ? 'start' : 'end'
```

```ts
  const curLabel = barrierLocked
    ? L.pacingLockedBadge
    : Math.abs(fade) < 0.08 ? L.pacingScaleMid : fade < 0 ? L.pacingScaleStart : L.pacingScaleEnd
```

- [ ] **Step 3 : Ajouter la classe CSS `.v-lock`**

Après la règle `.pstrat .psum-cur.v-end{...}` (~`:163`), ajouter :

```css
        .pstrat .psum-cur.v-lock{color:var(--trail-muted);background:rgba(127,127,127,.12);border-color:var(--trail-border);}
```

- [ ] **Step 4 : Griser le curseur + note + masquer courbe/méthode**

Dans `<div className="pbody">` (~`:212-238`), faire trois changements :

(a) Slider — ajouter `barrierLocked` à `disabled` :

```tsx
        <input
          type="range" min={-100} max={100} step={1}
          className="prange"
          value={sliderFromFade(fade)}
          disabled={readOnly || barrierLocked}
          onChange={(e) => onChange(fadeFromSlider(Number(e.target.value)))}
          aria-label={L.pacingTitle}
        />
```

(b) Phrase — note si verrouillé :

```tsx
        <p className="text-body-sm text-trail-text mt-3 leading-snug">{barrierLocked ? L.pacingLockedNote : phrase}</p>
```

(c) Courbe + méthode — masquées si verrouillé :

```tsx
        {!barrierLocked && <PaceCurve waypoints={waypoints} totalSec={totalSec} fade={fade} L={L} />}

        {!barrierLocked && (
          <details className="pmethod">
            <summary>{L.pacingMethodSummary}</summary>
            <div className="mt-2 text-caption text-trail-muted leading-relaxed">
              <div className="pmethod-formula">{L.pacingMethodFormula}</div>
              <p>{L.pacingMethodBody}</p>
            </div>
          </details>
        )}
```

- [ ] **Step 5 : Type-check**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6 : Commit**

```bash
git add web/components/plan/PacingStrategyCard.tsx
git commit -m "feat(plan): PacingStrategyCard grisé + note en mode barrières"
```

---

## Task 6 : `CoursePageClient` — calcule et passe `barrierLocked`

**Files:**
- Modify: `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx:10` (import), `:267-275` (rendu `PacingStrategyCard`)

- [ ] **Step 1 : Importer `isBarrierLocked`**

Après l'import de `PacingStrategyCard` (~`:10`), ajouter :

```ts
import { isBarrierLocked } from '@/lib/plan/barrier-lock'
```

- [ ] **Step 2 : Passer la prop `barrierLocked`**

Dans le rendu `<PacingStrategyCard ... />` (~`:267-275`), ajouter la prop. `waypoints` (type `RaceWaypoint[]`) satisfait structurellement `LockWaypoint[]` (km, dPlus, targetOverrideSec, cutoffRaw, cutoffKind) :

```tsx
              <PacingStrategyCard
                waypoints={waypoints.map(({ km, dPlus, targetOverrideSec }) => ({ km, dPlus, targetOverrideSec }))}
                targetDurationMin={race.targetDurationMin}
                startTime={race.startTime}
                pacingFade={race.pacingFade ?? 0}
                barrierLocked={isBarrierLocked(waypoints, race.startTime, race.targetDurationMin)}
                onChange={handlePacingChange}
                onEditObjective={() => setEditField('objective')}
                onEditStart={() => setEditField('start')}
              />
```

- [ ] **Step 3 : Type-check + lint**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit && npm run lint`
Expected: tsc exit 0 ; lint exit 0 (warnings pré-existants tolérés, aucune nouvelle erreur).

- [ ] **Step 4 : Commit**

```bash
git add "web/app/(main)/plan/courses/[id]/CoursePageClient.tsx"
git commit -m "feat(plan): CoursePageClient — grise la stratégie en mode barrières"
```

---

## Task 7 : Vérification finale + handoff

**Files:** aucun (vérification).

- [ ] **Step 1 : Suite complète ciblée + type-check + lint**

Run:
```bash
cd /c/Users/Franc/app-run-mobile/web \
  && npx tsc --noEmit \
  && npm run lint \
  && npx jest __tests__/lib/plan/barrier-lock.test.ts __tests__/components/plan/WaypointsTable.undo.test.tsx __tests__/components/plan/TableActionsMenu.test.tsx __tests__/components/plan/TimeEditModal.test.tsx
```
Expected: tsc exit 0 ; lint exit 0 ; jest tout PASS.

- [ ] **Step 2 : Bandeau « Implémenté » sur la spec**

En tête de `web/docs/superpowers/specs/2026-06-12-mode-barrieres-design.md`, remplacer `> **Status: Spec**` par :

```markdown
> **Status: Implémenté** · 2026-06-12 · Code: web/lib/plan/barrier-lock.ts, web/components/plan/{WaypointsTable,PacingStrategyCard}.tsx, web/app/(main)/plan/courses/[id]/{CoursePageClient,print/page}.tsx
```

```bash
git add web/docs/superpowers/specs/2026-06-12-mode-barrieres-design.md
git commit -m "docs(plan): spec mode barrières — Implémenté"
```

- [ ] **Step 3 : Vérif manuelle (à faire par Franck) + décision de push**

Ne **pas** pousser automatiquement. Rapporter à Franck :
- Ouvrir une course dont l'objectif = barrière d'arrivée (ex. Grand Raid, 42h00) → bloc « Stratégie d'allure » grisé + note, badge « Barrières », **point 2 = 3h30** (pas 3h36), Obj alignés sur les BH ; vérifier aussi le PDF `/print`.
- Baisser l'objectif (ex. 40h) → stratégie réactivée, répartition effort-km de retour.
- Une fois validé visuellement, Franck décide du push sur `master` (déploiement Vercel prod) — éventuellement avec un rappel d'appliquer la **migration 041** si pas encore fait (indépendant de cette feature).

---

## Notes de vérification de plan (auto-revue)

- **Couverture spec** : détection auto ≤60 s (Task 2 `isBarrierLocked`) ; interpolation distance (Task 2 `resolveElapsed`) ; source unique tableau+PDF (Tasks 3-4) ; bloc grisé+note+badge (Tasks 1+5) ; calcul dérivé non persisté (Task 6) ; tests cas Grand Raid/override/minuit (Task 2). ✓
- **Types cohérents** : `LockWaypoint`, `resolveElapsed → { elapsed, locked }`, `isBarrierLocked(...)` identiques entre module (Task 2) et consommateurs (Tasks 3-6). ✓
- **Pas de placeholder** : tout le code est complet et exact. ✓
