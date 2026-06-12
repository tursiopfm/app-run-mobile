# Mode Mission v2 — 3 piliers (Cockpit / Plan / Activités) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les vues Mission actuelles (BlockGrid filtré) par 3 écrans dédiés — Cockpit (briefing, état de forme + verdict, semaine, cap vs plan, tendance), Plan (séance du jour, semaine, destination course, prépa, bouton Coach IA), Activités (dernière sortie, cumul mois, liste) — conformément à la spec `web/docs/superpowers/specs/2026-06-12-mode-mission-v2-3-piliers-design.md` et à la maquette `Prompts/mode-mission-3-piliers-mockup-v2.html`.

**Architecture:** Logique pure dans `web/lib/mission/` (verdict de forme, cible hebdo, progression prépa, agrégat tri) testée en TDD. Écrans dans `web/components/mission/` (client components), branchés par les pages serveur existantes quand `mode === 'mission'`. Le mode Expert est strictement intact. La nav (BottomNav/DesktopSidebar) ne change pas : Mission affiche déjà Cockpit / Plan / Activités / Réglages.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind (tokens `trail-*` / `ink-*` / `--data-*`), Jest + React Testing Library, Supabase (aucune migration).

**Hors périmètre assumé (décisions, pas des TODO) :**
- La « trace du profil » sur la dernière sortie (Activités) nécessite les streams → reporté ; une entrée est ajoutée à `tasks/backlog.md` (Task 10).
- Le module Coach IA : seul le bouton placeholder est posé (aucun handler).
- Desktop : écrans Mission rendus en colonne unique centrée (`max-w-lg mx-auto`), la sidebar existante ne change pas.

**Conventions d'exécution (Windows) :**
- Jest : `cd /c/Users/Franc/app-run-mobile/web && npx jest <chemin> -v` (toujours `cd` absolu vers `web/`).
- Git : `git -C /c/Users/Franc/app-run-mobile add … && git -C /c/Users/Franc/app-run-mobile commit …`.
- ~50 tests jest échouent en pré-existant (`useI18n` hors provider) : ne lancer QUE les suites du fichier touché.
- Pas de `next build` local (conflit `.next` si dev server) ; vérification finale = `npx tsc --noEmit` + `npx next lint`.

**Référence visuelle obligatoire :** ouvrir `Prompts/mode-mission-3-piliers-mockup-v2.html` avant les tasks UI (6-8). Les classes/valeurs y sont la source de vérité visuelle (couleurs : checks sport via `--data-*`, D+ en `--status-info` #38BDF8, héros `font-display`).

---

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| Create `web/lib/mission/forme-verdict.ts` | FreshnessZone + TSB → position curseur + clé de verdict (continuer/adapter) |
| Create `web/lib/mission/weekly-target.ts` | Cible km/D+ de la semaine courante depuis le plan actif + fraction attendue du jour |
| Create `web/lib/mission/prepa.ts` | % séances faites + segments de la frise de phases |
| Create `web/lib/mission/tri-week.ts` | Agrégat heures par discipline (triathlon) + format `8h45` |
| Create `web/components/mission/MissionCockpit.tsx` | Écran Cockpit (assemble les 5 blocs) |
| Create `web/components/mission/cards.tsx` | Cartes partagées : `MissionCard`, `DayDots`, jauge `CapGauge` |
| Create `web/components/mission/FormeCard.tsx` | Bloc État de forme |
| Create `web/components/mission/MissionPlan.tsx` | Écran Plan (séance du jour, semaine, destination, prépa, bouton IA) |
| Create `web/components/mission/MissionActivities.tsx` | Écran Activités (dernière sortie, cumul mois, liste) |
| Modify `web/app/(main)/dashboard/page.tsx` | Branche `mode === 'mission'` → `MissionCockpit` |
| Modify `web/app/(main)/plan/page.tsx` | Branche `mode === 'mission'` → `MissionPlan` |
| Modify `web/app/(main)/activities/page.tsx` | Lit le mode ; mission (sans `?full=1`) → `MissionActivities` |
| Modify `web/lib/i18n/dictionaries/fr.ts` + `en.ts` | Section `mission` |
| Modify `web/components/cockpit/DashboardGrid.tsx`, `web/app/(main)/plan/PlanClient.tsx`, `web/components/blocks/BlockGrid.tsx` | Cleanup du chemin `missionVisible` (Task 9) |
| Tests | `web/__tests__/lib/mission/*.test.ts`, `web/__tests__/components/mission/*.test.tsx` |

---

### Task 1: Verdict de forme (`lib/mission/forme-verdict.ts`)

**Files:**
- Create: `web/lib/mission/forme-verdict.ts`
- Test: `web/__tests__/lib/mission/forme-verdict.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// web/__tests__/lib/mission/forme-verdict.test.ts
import { formeVerdict, cursorPctFromTsb } from '@/lib/mission/forme-verdict'

describe('cursorPctFromTsb', () => {
  it('clampe à [-35, 25] et renvoie un % linéaire', () => {
    expect(cursorPctFromTsb(-35)).toBe(0)
    expect(cursorPctFromTsb(25)).toBe(100)
    expect(cursorPctFromTsb(-5)).toBe(50)     // milieu de l'échelle
    expect(cursorPctFromTsb(-100)).toBe(0)    // clamp bas
    expect(cursorPctFromTsb(100)).toBe(100)   // clamp haut
  })
})

describe('formeVerdict', () => {
  it('high-fatigue → adapter', () => {
    expect(formeVerdict('high-fatigue')).toEqual({ tone: 'adapt', zone: 'high-fatigue' })
  })
  it('normal-fatigue → continuer (fatigue d\'entraînement normale)', () => {
    expect(formeVerdict('normal-fatigue').tone).toBe('continue')
  })
  it('balanced / fresh / very-fresh → continuer', () => {
    expect(formeVerdict('balanced').tone).toBe('continue')
    expect(formeVerdict('fresh').tone).toBe('continue')
    expect(formeVerdict('very-fresh').tone).toBe('continue')
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/mission/forme-verdict.test.ts -v`
Expected: FAIL — `Cannot find module '@/lib/mission/forme-verdict'`

- [ ] **Step 3: Implémenter**

```ts
// web/lib/mission/forme-verdict.ts
// État de forme du Mode Mission : transforme la fraîcheur TSB (calcul existant,
// lib/analytics/charge-insights.computeFreshness) en un curseur visuel et un
// verdict actionnable « continuer / adapter ». Les textes vivent dans i18n
// (t.mission.formeVerdict[zone]).

import type { FreshnessZone } from '@/lib/analytics/charge-insights.types'

// Échelle visuelle Fatigué → Affûté. Bornes alignées sur FRESHNESS
// (charge-thresholds: highFatigue=-25, veryFresh=15) avec de la marge.
const TSB_MIN = -35
const TSB_MAX = 25

export function cursorPctFromTsb(tsb: number): number {
  const clamped = Math.min(TSB_MAX, Math.max(TSB_MIN, tsb))
  return Math.round(((clamped - TSB_MIN) / (TSB_MAX - TSB_MIN)) * 100)
}

export type FormeTone = 'continue' | 'adapt'

export type FormeVerdict = { tone: FormeTone; zone: FreshnessZone }

// Seule la fatigue élevée déclenche « adapte » ; la fatigue normale fait
// partie de l'entraînement (on rassure au lieu d'alarmer).
export function formeVerdict(zone: FreshnessZone): FormeVerdict {
  return { tone: zone === 'high-fatigue' ? 'adapt' : 'continue', zone }
}
```

- [ ] **Step 4: Vérifier le pass**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/mission/forme-verdict.test.ts -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git -C /c/Users/Franc/app-run-mobile add web/lib/mission/forme-verdict.ts web/__tests__/lib/mission/forme-verdict.test.ts
git -C /c/Users/Franc/app-run-mobile commit -m "feat(mission): verdict de forme (curseur TSB + continuer/adapter)"
```

---

### Task 2: Cible hebdo du plan (`lib/mission/weekly-target.ts`)

**Files:**
- Create: `web/lib/mission/weekly-target.ts`
- Test: `web/__tests__/lib/mission/weekly-target.test.ts`

Reprend la logique de `GoalsBlock.computePlanWeeklyFromSnapshot` (non exportée) en version pure/testable : plan actif → phase de la semaine → `resolveWeeklyTarget`.

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// web/__tests__/lib/mission/weekly-target.test.ts
import { resolveMissionWeeklyTarget, expectedWeekFraction } from '@/lib/mission/weekly-target'
import type { TrainingPlan } from '@/types/plan'

function makePlan(): TrainingPlan {
  return {
    id: 'p1', athleteId: 'a1', name: 'Prépa test', goalRaceId: null,
    startDate: '2026-06-01', endDate: '2026-08-30', status: 'active',
    createdAt: '', updatedAt: '',
    phases: [{
      id: 'ph1', type: 'specifique', label: 'Spécifique',
      startDate: '2026-06-01', endDate: '2026-07-12',
      weeklyChargeTarget: 400, weeklyDistanceKmTarget: 50, weeklyElevationMTarget: 2000,
    }],
  }
}

describe('resolveMissionWeeklyTarget', () => {
  it('renvoie la cible de la phase couvrant la semaine courante', () => {
    // 2026-06-12 est un vendredi → lundi de la semaine = 2026-06-08
    expect(resolveMissionWeeklyTarget([makePlan()], '2026-06-12'))
      .toEqual({ km: 50, dPlus: 2000, phaseLabel: 'Spécifique' })
  })
  it('null si aucun plan actif ne couvre la date', () => {
    expect(resolveMissionWeeklyTarget([makePlan()], '2026-12-25')).toBeNull()
    expect(resolveMissionWeeklyTarget([], '2026-06-12')).toBeNull()
  })
})

describe('expectedWeekFraction', () => {
  it('lundi → 1/7, dimanche → 7/7', () => {
    expect(expectedWeekFraction('2026-06-08')).toBeCloseTo(1 / 7) // lundi
    expect(expectedWeekFraction('2026-06-14')).toBeCloseTo(1)     // dimanche
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/mission/weekly-target.test.ts -v`
Expected: FAIL — module introuvable

- [ ] **Step 3: Implémenter**

```ts
// web/lib/mission/weekly-target.ts
// Cible km/D+ de la semaine courante pour le bloc « Cap de la semaine ».
// Pure : reçoit les macrocycles (le composant les charge via getAllMacrocycles()
// ou peekMacros()) et la date du jour en ISO.

import { pickActiveMacrocycle } from '@/lib/plan/storage'
import { resolveWeeklyTarget } from '@/lib/training/phases'
import type { TrainingPlan } from '@/types/plan'

export type MissionWeeklyTarget = { km: number; dPlus: number; phaseLabel: string }

function mondayISO(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`)
  const dow = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() - (dow - 1))
  return d.toISOString().slice(0, 10)
}

export function resolveMissionWeeklyTarget(
  macros: TrainingPlan[],
  todayISO: string,
): MissionWeeklyTarget | null {
  const weekStart = mondayISO(todayISO)
  const plan = pickActiveMacrocycle(macros, weekStart)
  if (!plan) return null
  const phase = plan.phases.find(p => p.startDate <= weekStart && weekStart <= p.endDate)
  if (!phase) return null
  const t = resolveWeeklyTarget(phase, weekStart)
  return { km: t.km, dPlus: t.dPlus, phaseLabel: phase.label }
}

// Fraction de la semaine écoulée fin de journée incluse (lundi = 1/7 …
// dimanche = 1) → position du repère « où tu devrais en être » sur les jauges.
export function expectedWeekFraction(todayISO: string): number {
  const dow = new Date(`${todayISO}T00:00:00Z`).getUTCDay() || 7
  return dow / 7
}
```

- [ ] **Step 4: Vérifier le pass**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/mission/weekly-target.test.ts -v`
Expected: PASS. NB : `pickActiveMacrocycle(macros, weekStartISO)` vient de `lib/plan/storage` (`web/lib/plan/storage.ts:679`) — vérifier sa signature exacte avant d'écrire (elle prend les macros et une date ISO ; si elle filtre sur `status === 'active'` le plan de test ci-dessus est déjà `active`).

- [ ] **Step 5: Commit**

```bash
git -C /c/Users/Franc/app-run-mobile add web/lib/mission/weekly-target.ts web/__tests__/lib/mission/weekly-target.test.ts
git -C /c/Users/Franc/app-run-mobile commit -m "feat(mission): cible hebdo du plan + fraction attendue (cap de la semaine)"
```

---

### Task 3: Progression de prépa (`lib/mission/prepa.ts`)

**Files:**
- Create: `web/lib/mission/prepa.ts`
- Test: `web/__tests__/lib/mission/prepa.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// web/__tests__/lib/mission/prepa.test.ts
import { computePrepaProgress, computePhaseSegments, weekOfPlan } from '@/lib/mission/prepa'
import type { PlannedSession, TrainingPlan } from '@/types/plan'

function session(p: Partial<PlannedSession>): PlannedSession {
  return {
    id: 'x', planId: 'p', date: '2026-06-10', type: 'footing', title: 'S',
    duration: 60, intensity: 2, estimatedCharge: 50, status: 'planned', ...p,
  }
}

describe('computePrepaProgress', () => {
  it('compte faites / total en excluant les miroirs de course', () => {
    const sessions = [
      session({ id: '1', status: 'completed' }),
      session({ id: '2', status: 'completed' }),
      session({ id: '3', status: 'planned' }),
      session({ id: '4', status: 'skipped' }),
      session({ id: '5', templateId: 'race-mirror' }), // exclu
    ]
    expect(computePrepaProgress(sessions)).toEqual({ done: 2, total: 4, pct: 50 })
  })
  it('0 séance → pct 0 sans division par zéro', () => {
    expect(computePrepaProgress([])).toEqual({ done: 0, total: 0, pct: 0 })
  })
})

const plan: TrainingPlan = {
  id: 'p1', athleteId: 'a', name: 'P', goalRaceId: null,
  startDate: '2026-05-04', endDate: '2026-07-26', status: 'active',
  createdAt: '', updatedAt: '',
  phases: [
    { id: 'a1', type: 'foncier',    label: 'Base',       startDate: '2026-05-04', endDate: '2026-05-31', weeklyChargeTarget: 0, weeklyDistanceKmTarget: 0, weeklyElevationMTarget: 0 },
    { id: 'a2', type: 'specifique', label: 'Spécifique', startDate: '2026-06-01', endDate: '2026-07-12', weeklyChargeTarget: 0, weeklyDistanceKmTarget: 0, weeklyElevationMTarget: 0 },
    { id: 'a3', type: 'affutage',   label: 'Affûtage',   startDate: '2026-07-13', endDate: '2026-07-26', weeklyChargeTarget: 0, weeklyDistanceKmTarget: 0, weeklyElevationMTarget: 0 },
  ],
}

describe('computePhaseSegments', () => {
  it('largeurs proportionnelles à la durée, phase active marquée + curseur', () => {
    const segs = computePhaseSegments(plan, '2026-06-12')
    expect(segs).toHaveLength(3)
    expect(segs.map(s => s.active)).toEqual([false, true, false])
    const totalPct = segs.reduce((s, x) => s + x.widthPct, 0)
    expect(totalPct).toBeGreaterThan(99)
    expect(totalPct).toBeLessThan(101)
    // curseur dans la phase active uniquement, entre 0 et 100
    expect(segs[1].cursorPct).toBeGreaterThanOrEqual(0)
    expect(segs[1].cursorPct).toBeLessThanOrEqual(100)
    expect(segs[0].cursorPct).toBeNull()
  })
})

describe('weekOfPlan', () => {
  it('semaine X / Y (1-based)', () => {
    expect(weekOfPlan(plan, '2026-05-04')).toEqual({ week: 1, total: 12 })
    expect(weekOfPlan(plan, '2026-06-12')).toEqual({ week: 6, total: 12 })
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/mission/prepa.test.ts -v`
Expected: FAIL — module introuvable

- [ ] **Step 3: Implémenter**

```ts
// web/lib/mission/prepa.ts
// Bloc « Ma prépa » du Mode Mission : anneau % séances faites + frise de phases.

import { isRaceMirrorSession } from '@/lib/plan/storage'
import type { PlannedSession, TrainingPlan } from '@/types/plan'

const MS_DAY = 86_400_000

export type PrepaProgress = { done: number; total: number; pct: number }

export function computePrepaProgress(sessions: PlannedSession[]): PrepaProgress {
  const real = sessions.filter(s => !isRaceMirrorSession(s))
  const done = real.filter(s => s.status === 'completed').length
  const total = real.length
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
}

export type PhaseSegment = {
  label: string
  widthPct: number
  active: boolean
  cursorPct: number | null   // position du jour dans la phase active, sinon null
}

function days(fromISO: string, toISO: string): number {
  return Math.max(1, Math.round(
    (new Date(`${toISO}T00:00:00Z`).getTime() - new Date(`${fromISO}T00:00:00Z`).getTime()) / MS_DAY,
  ) + 1)
}

export function computePhaseSegments(plan: TrainingPlan, todayISO: string): PhaseSegment[] {
  const totalDays = plan.phases.reduce((s, p) => s + days(p.startDate, p.endDate), 0)
  if (totalDays === 0) return []
  return plan.phases.map(p => {
    const active = p.startDate <= todayISO && todayISO <= p.endDate
    const phaseDays = days(p.startDate, p.endDate)
    return {
      label: p.label,
      widthPct: (phaseDays / totalDays) * 100,
      active,
      cursorPct: active
        ? Math.min(100, Math.max(0, ((days(p.startDate, todayISO) - 1) / phaseDays) * 100))
        : null,
    }
  })
}

export function weekOfPlan(plan: TrainingPlan, todayISO: string): { week: number; total: number } {
  const start = new Date(`${plan.startDate}T00:00:00Z`).getTime()
  const end = new Date(`${plan.endDate}T00:00:00Z`).getTime()
  const today = new Date(`${todayISO}T00:00:00Z`).getTime()
  const total = Math.max(1, Math.ceil((end - start + MS_DAY) / (7 * MS_DAY)))
  const week = Math.min(total, Math.max(1, Math.floor((today - start) / (7 * MS_DAY)) + 1))
  return { week, total }
}
```

- [ ] **Step 4: Vérifier le pass**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/mission/prepa.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C /c/Users/Franc/app-run-mobile add web/lib/mission/prepa.ts web/__tests__/lib/mission/prepa.test.ts
git -C /c/Users/Franc/app-run-mobile commit -m "feat(mission): progression de prépa (anneau + frise de phases)"
```

---

### Task 4: Agrégat triathlon (`lib/mission/tri-week.ts`)

**Files:**
- Create: `web/lib/mission/tri-week.ts`
- Test: `web/__tests__/lib/mission/tri-week.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// web/__tests__/lib/mission/tri-week.test.ts
import { computeTriWeek, formatHoursMin } from '@/lib/mission/tri-week'
import type { SportOverview } from '@/lib/data/dashboard'

function overview(dailyDurationSec: number[]): SportOverview {
  return {
    weekKm: 0, weekDPlus: 0, weekSessions: 0,
    dailyKm: [], dailyDPlus: [], dailyDurationSec, dailyLabels: [],
    ytdKm: 0, ytdDPlus: 0, ytdSessions: 0, monthlyKm: [], monthlyDPlus: [],
    atl: 0, ctl: 0, tsb: 0, weekCes: 0, last7Tsb: [],
    weeklyPoints: [], cumulMonths: [], cumulYears: [],
    workoutTypeBreakdown: [], dailyHistory: [],
  }
}

describe('computeTriWeek', () => {
  it('somme les durées hebdo par discipline', () => {
    const r = computeTriWeek({
      run:  overview([3600, 0, 0, 0, 0, 0, 0]),         // 1h
      ride: overview([0, 7200, 0, 0, 0, 0, 0]),         // 2h
      swim: overview([0, 0, 1800, 0, 0, 0, 0]),         // 30'
      all:  overview([3600, 7200, 1800, 0, 0, 0, 0]),
    } as never)
    expect(r).toEqual({ totalSec: 12600, runSec: 3600, rideSec: 7200, swimSec: 1800 })
  })
})

describe('formatHoursMin', () => {
  it('formate en h/min compactes', () => {
    expect(formatHoursMin(12600)).toBe('3h30')
    expect(formatHoursMin(3600)).toBe('1h')
    expect(formatHoursMin(2700)).toBe('45 min')
    expect(formatHoursMin(0)).toBe('0 min')
  })
})
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/mission/tri-week.test.ts -v`
Expected: FAIL — module introuvable

- [ ] **Step 3: Implémenter**

```ts
// web/lib/mission/tri-week.ts
// Triathlon : le km n'a pas de sens en cumul multi-sport → volume hebdo en
// heures + répartition nat/vélo/cap pour le héros « Ma semaine ».

import type { SportOverview } from '@/lib/data/dashboard'
import type { SportKey } from '@/lib/design/sports'

export type TriWeek = { totalSec: number; runSec: number; rideSec: number; swimSec: number }

function weekSec(o: SportOverview | undefined): number {
  return (o?.dailyDurationSec ?? []).reduce((s, x) => s + x, 0)
}

export function computeTriWeek(overviews: Record<SportKey, SportOverview>): TriWeek {
  const runSec = weekSec(overviews.run)
  const rideSec = weekSec(overviews.ride)
  const swimSec = weekSec(overviews.swim)
  return { totalSec: runSec + rideSec + swimSec, runSec, rideSec, swimSec }
}

export function formatHoursMin(sec: number): string {
  const totalMin = Math.round(sec / 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}
```

- [ ] **Step 4: Vérifier le pass**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/mission/tri-week.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git -C /c/Users/Franc/app-run-mobile add web/lib/mission/tri-week.ts web/__tests__/lib/mission/tri-week.test.ts
git -C /c/Users/Franc/app-run-mobile commit -m "feat(mission): agrégat heures triathlon pour le héros semaine"
```

---

### Task 5: i18n — section `mission` (fr + en)

**Files:**
- Modify: `web/lib/i18n/dictionaries/fr.ts`
- Modify: `web/lib/i18n/dictionaries/en.ts`

`fr.ts` contient un bloc de types en tête (voir `cockpit:` ligne ~23) puis l'objet. Ajouter la clé `mission` aux DEUX (type + `fr` + `en`), en suivant le style existant.

- [ ] **Step 1: Ajouter au type et au dictionnaire fr**

```ts
// Dans le bloc de types (même style que cockpit:) :
mission: {
  cockpitTitle: string; planTitle: string; activitiesTitle: string
  briefingTitle: string; briefingSub: string; briefingNew: string
  formeTitle: string; formeScale: { tired: string; normal: string; fresh: string; sharp: string }
  formeVerdict: Record<string, string>   // clé = FreshnessZone
  formeBadge: Record<string, string>     // clé = FreshnessZone
  weekTitle: string; weekSessionsCount: (n: number) => string
  capTitle: string; capPhasePrefix: string; capVolume: string; capDplus: string
  capMarkerHint: string; capOnTrack: string; capBehind: string
  altitudeTitle: string; altitudeUp: string; altitudeDown: string; altitudeStable: string
  todayTitle: string; restDay: string; intensityLabel: string
  weekPlanTitle: string; statusDone: string; statusToday: string; statusUpcoming: string; statusRest: string
  destinationTitle: string; destinationTableLink: string; destinationTargetPrefix: string
  destinationEmptyTitle: string; destinationEmptyBody: string; destinationEmptyCta: string
  prepaTitle: string; prepaWeekOf: (w: number, total: number) => string
  prepaSessions: (done: number, total: number) => string
  coachButton: string; coachBadge: string
  lastActivityTitle: string; monthTitle: string; recentTitle: string
  allHistory: string; volumeLabel: string; dplusLabel: string; sessionsLabel: string
}
```

```ts
// Dans l'objet fr :
mission: {
  cockpitTitle: 'Cockpit', planTitle: 'Plan', activitiesTitle: 'Activités',
  briefingTitle: 'Briefing du jour', briefingSub: 'Séance, météo, mot du coach', briefingNew: 'Nouveau',
  formeTitle: 'État de forme',
  formeScale: { tired: 'Fatigué', normal: 'Normal', fresh: 'Frais', sharp: 'Affûté' },
  formeBadge: {
    'very-fresh': 'Très frais', fresh: 'Frais', balanced: 'Équilibré',
    'normal-fatigue': 'Légère fatigue', 'high-fatigue': 'Fatigue élevée',
  },
  formeVerdict: {
    'very-fresh': '✓ Tu es très frais — parfait pour une séance clé ou une course.',
    fresh: '✓ Continue comme ça — tu es frais, le plan peut suivre son cours.',
    balanced: '✓ Continue comme ça — charge et récupération sont équilibrées.',
    'normal-fatigue': '✓ Continue comme ça — cette fatigue est normale en pleine prépa. Soigne la récup.',
    'high-fatigue': '⚠ Adapte : allège la prochaine séance ou prends un jour de repos de plus.',
  },
  weekTitle: 'Ma semaine',
  weekSessionsCount: (n: number) => `${n} séance${n > 1 ? 's' : ''}`,
  capTitle: 'Cap de la semaine', capPhasePrefix: 'objectif du plan ·',
  capVolume: 'Volume', capDplus: 'Dénivelé',
  capMarkerHint: 'Repère ┃ = où tu devrais en être aujourd\'hui.',
  capOnTrack: 'Tu es dans l\'axe ✈️', capBehind: 'Un peu de retard — rien d\'alarmant.',
  altitudeTitle: 'Altitude · 6 semaines',
  altitudeUp: '↗ régulier', altitudeDown: '↘ en baisse', altitudeStable: '→ stable',
  todayTitle: 'Aujourd\'hui', restDay: 'Repos', intensityLabel: 'Intensité',
  weekPlanTitle: 'Ma semaine d\'entraînement',
  statusDone: '✓ faite', statusToday: '● auj.', statusUpcoming: 'à venir', statusRest: '—',
  destinationTitle: 'Destination', destinationTableLink: 'Mon tableau de course ›',
  destinationTargetPrefix: 'obj.',
  destinationEmptyTitle: 'Aucune course prévue',
  destinationEmptyBody: 'Choisis ta prochaine destination pour structurer ta prépa.',
  destinationEmptyCta: 'Ajouter une course',
  prepaTitle: 'Ma prépa',
  prepaWeekOf: (w: number, total: number) => `Semaine ${w} / ${total}`,
  prepaSessions: (done: number, total: number) => `${done} séances faites sur ${total}`,
  coachButton: '✨ Ajuster mon plan', coachBadge: 'Coach IA',
  lastActivityTitle: 'Dernière sortie', monthTitle: 'Ce mois-ci', recentTitle: 'Sorties récentes',
  allHistory: 'Tout mon historique →',
  volumeLabel: 'Volume', dplusLabel: 'Dénivelé', sessionsLabel: 'Sorties',
},
```

- [ ] **Step 2: Ajouter l'équivalent anglais dans `en.ts`**

```ts
mission: {
  cockpitTitle: 'Cockpit', planTitle: 'Plan', activitiesTitle: 'Activities',
  briefingTitle: 'Daily briefing', briefingSub: 'Session, weather, coach\'s note', briefingNew: 'New',
  formeTitle: 'Form status',
  formeScale: { tired: 'Tired', normal: 'Normal', fresh: 'Fresh', sharp: 'Peaking' },
  formeBadge: {
    'very-fresh': 'Very fresh', fresh: 'Fresh', balanced: 'Balanced',
    'normal-fatigue': 'Slight fatigue', 'high-fatigue': 'High fatigue',
  },
  formeVerdict: {
    'very-fresh': '✓ Very fresh — perfect for a key session or a race.',
    fresh: '✓ Keep going — you are fresh, stick to the plan.',
    balanced: '✓ Keep going — load and recovery are balanced.',
    'normal-fatigue': '✓ Keep going — this fatigue is normal mid-prep. Mind your recovery.',
    'high-fatigue': '⚠ Adapt: ease the next session or add a rest day.',
  },
  weekTitle: 'My week',
  weekSessionsCount: (n: number) => `${n} session${n > 1 ? 's' : ''}`,
  capTitle: 'Weekly heading', capPhasePrefix: 'plan target ·',
  capVolume: 'Volume', capDplus: 'Elevation',
  capMarkerHint: 'Marker ┃ = where you should be today.',
  capOnTrack: 'Right on course ✈️', capBehind: 'Slightly behind — nothing alarming.',
  altitudeTitle: 'Altitude · 6 weeks',
  altitudeUp: '↗ steady', altitudeDown: '↘ declining', altitudeStable: '→ stable',
  todayTitle: 'Today', restDay: 'Rest', intensityLabel: 'Intensity',
  weekPlanTitle: 'My training week',
  statusDone: '✓ done', statusToday: '● today', statusUpcoming: 'upcoming', statusRest: '—',
  destinationTitle: 'Destination', destinationTableLink: 'My race table ›',
  destinationTargetPrefix: 'goal',
  destinationEmptyTitle: 'No race planned',
  destinationEmptyBody: 'Pick your next destination to structure your prep.',
  destinationEmptyCta: 'Add a race',
  prepaTitle: 'My prep',
  prepaWeekOf: (w: number, total: number) => `Week ${w} / ${total}`,
  prepaSessions: (done: number, total: number) => `${done} of ${total} sessions done`,
  coachButton: '✨ Adjust my plan', coachBadge: 'AI Coach',
  lastActivityTitle: 'Last activity', monthTitle: 'This month', recentTitle: 'Recent activities',
  allHistory: 'Full history →',
  volumeLabel: 'Volume', dplusLabel: 'Elevation', sessionsLabel: 'Activities',
},
```

- [ ] **Step 3: Vérifier la cohérence des types**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit`
Expected: 0 erreur (si `en` est typé `Dict`/satisfies, le compilateur valide la symétrie).

- [ ] **Step 4: Commit**

```bash
git -C /c/Users/Franc/app-run-mobile add web/lib/i18n/dictionaries/fr.ts web/lib/i18n/dictionaries/en.ts
git -C /c/Users/Franc/app-run-mobile commit -m "feat(mission): i18n section mission (fr/en)"
```

---

### Task 6: Écran Cockpit Mission

**Files:**
- Create: `web/components/mission/cards.tsx`
- Create: `web/components/mission/FormeCard.tsx`
- Create: `web/components/mission/MissionCockpit.tsx`
- Modify: `web/app/(main)/dashboard/page.tsx:108-123`
- Test: `web/__tests__/components/mission/MissionCockpit.test.tsx`

**Référence visuelle :** frame « Pilier 1 · Cockpit » de la maquette. Réutiliser `MorningReportTile` tel quel pour le briefing.

- [ ] **Step 1: Cartes partagées**

```tsx
// web/components/mission/cards.tsx
'use client'

// Primitives visuelles des écrans Mission (cf. maquette
// Prompts/mode-mission-3-piliers-mockup-v2.html). Style aligné Deep Mission.

export function MissionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[16px] bg-trail-card border border-trail-border p-4 ${className}`}>
      {children}
    </div>
  )
}

export function MissionCardLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-trail-muted">
      {children}
    </p>
  )
}

export type DayDotState = 'done' | 'today' | 'upcoming' | 'rest'

// Pastille d'un jour de la semaine. `color` = couleur de la discipline du jour
// (défaut --primary) pour l'adaptation tri/vélo.
export function DayDot({ state, color }: { state: DayDotState; color?: string }) {
  const c = color ?? 'var(--primary)'
  const base = 'w-[34px] h-[34px] rounded-full flex items-center justify-center text-[13px] font-bold'
  if (state === 'done') {
    return <span className={base} style={{ background: c, color: 'var(--ink-900)' }}>✓</span>
  }
  if (state === 'today') {
    return (
      <span
        className={base}
        style={{ border: '2px solid var(--primary)', color: 'var(--primary-text)', boxShadow: '0 0 0 4px var(--primary-glow)' }}
      >●</span>
    )
  }
  if (state === 'upcoming') {
    return <span className={base} style={{ border: '2px dashed var(--ink-500)' }} />
  }
  return <span className={base} style={{ background: 'var(--ink-600)', color: 'var(--text-disabled)' }}>–</span>
}

// Jauge horizontale réalisé/objectif avec repère « attendu aujourd'hui ».
export function CapGauge({ pct, markerPct, color }: { pct: number; markerPct: number; color: string }) {
  return (
    <div className="relative h-[10px] rounded-full bg-trail-border">
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }}
      />
      <span
        className="absolute -top-[3px] -bottom-[3px] w-[2px] rounded-[1px]"
        style={{ left: `${Math.min(100, Math.max(0, markerPct))}%`, background: 'var(--text-secondary)' }}
      />
    </div>
  )
}
```

- [ ] **Step 2: FormeCard**

```tsx
// web/components/mission/FormeCard.tsx
'use client'

import { MissionCard, MissionCardLabel } from './cards'
import { computeFreshness } from '@/lib/analytics/charge-insights'
import { cursorPctFromTsb, formeVerdict } from '@/lib/mission/forme-verdict'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { useT } from '@/lib/i18n/I18nProvider'

const ZONE_BADGE_STYLE: Record<string, { bg: string; fg: string; bd: string }> = {
  'high-fatigue':   { bg: 'rgba(248,113,113,0.14)', fg: 'var(--status-danger)',  bd: 'rgba(248,113,113,0.35)' },
  'normal-fatigue': { bg: 'rgba(251,191,36,0.14)',  fg: 'var(--status-warning)', bd: 'rgba(251,191,36,0.35)'  },
  balanced:         { bg: 'rgba(74,222,128,0.14)',  fg: 'var(--status-success)', bd: 'rgba(74,222,128,0.35)'  },
  fresh:            { bg: 'rgba(56,189,248,0.14)',  fg: 'var(--status-info)',    bd: 'rgba(56,189,248,0.35)'  },
  'very-fresh':     { bg: 'rgba(56,189,248,0.14)',  fg: 'var(--status-info)',    bd: 'rgba(56,189,248,0.35)'  },
}

export function FormeCard({ payload }: { payload: ChargeSportPayload }) {
  const M = useT().mission
  const f = computeFreshness(payload.dailyMetrics)
  const verdict = formeVerdict(f.zone)
  const cursor = cursorPctFromTsb(f.tsb)
  const badge = ZONE_BADGE_STYLE[f.zone]

  return (
    <MissionCard>
      <div className="flex items-center justify-between mb-3">
        <MissionCardLabel>{M.formeTitle}</MissionCardLabel>
        <span
          className="text-[11px] font-bold px-2.5 py-[3px] rounded-full border"
          style={{ background: badge.bg, color: badge.fg, borderColor: badge.bd }}
        >
          {M.formeBadge[f.zone]}
        </span>
      </div>
      <div
        className="relative h-[10px] rounded-full mb-1.5"
        style={{ background: 'linear-gradient(90deg,#F87171 0%,#FBBF24 35%,#4ADE80 70%,#38BDF8 100%)' }}
      >
        <span
          className="absolute -top-[4px] w-[18px] h-[18px] rounded-full"
          style={{
            left: `calc(${cursor}% - 9px)`,
            background: badge.fg,
            border: '3px solid var(--trail-text)',
            boxShadow: '0 1px 5px rgba(0,0,0,0.55)',
          }}
        />
      </div>
      <div className="flex justify-between text-[9px] mb-3 text-trail-muted">
        <span>{M.formeScale.tired}</span><span>{M.formeScale.normal}</span>
        <span>{M.formeScale.fresh}</span><span>{M.formeScale.sharp}</span>
      </div>
      <p className="text-[12px] leading-relaxed text-trail-muted">
        <span className="font-bold" style={{ color: verdict.tone === 'adapt' ? 'var(--status-warning)' : 'var(--status-success)' }}>
          {M.formeVerdict[f.zone]}
        </span>
      </p>
    </MissionCard>
  )
}
```

- [ ] **Step 3: MissionCockpit (assemblage)**

```tsx
// web/components/mission/MissionCockpit.tsx
'use client'

// Écran Cockpit du Mode Mission v2 — « je pilote » :
// Briefing → État de forme → Ma semaine → Cap de la semaine → Altitude.
// Spec : docs/superpowers/specs/2026-06-12-mode-mission-v2-3-piliers-design.md

import { useEffect, useState } from 'react'
import { MorningReportTile } from '@/components/cockpit/MorningReportTile'
import { MissionCard, MissionCardLabel, DayDot, CapGauge, type DayDotState } from './cards'
import { FormeCard } from './FormeCard'
import { getAllMacrocycles, getPlannedSessions, isRaceMirrorSession } from '@/lib/plan/storage'
import { resolveMissionWeeklyTarget, expectedWeekFraction, type MissionWeeklyTarget } from '@/lib/mission/weekly-target'
import { computeTriWeek, formatHoursMin } from '@/lib/mission/tri-week'
import { defaultSportForDiscipline } from '@/lib/design/sport-settings'
import type { SportOverview } from '@/lib/data/dashboard'
import type { SportKey } from '@/lib/design/sports'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import type { PlannedSession } from '@/types/plan'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = {
  sportOverviews: Record<SportKey, SportOverview>
  freshnessPayload: ChargeSportPayload | null
  discipline: string | null
}

const SPORT_DOT_COLOR: Record<string, string> = {
  run: 'var(--data-run)', ride: 'var(--data-bike)', swim: 'var(--data-swim)',
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoOfWeekDay(idx: number): string {
  // idx 0..6 = lundi..dimanche de la semaine courante (heure locale).
  const now = new Date()
  const dow = now.getDay() || 7
  const d = new Date(now)
  d.setDate(now.getDate() - (dow - 1) + idx)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function MissionCockpit({ sportOverviews, freshnessPayload, discipline }: Props) {
  const M = useT().mission
  const sport: SportKey = defaultSportForDiscipline(discipline) ?? 'run'
  const isTri = sport === 'all'
  const o = sportOverviews[sport]

  // Cible hebdo + sessions planifiées de la semaine (client, comme les blocs Plan).
  const [target, setTarget] = useState<MissionWeeklyTarget | null>(null)
  const [planned, setPlanned] = useState<PlannedSession[]>([])
  useEffect(() => {
    void (async () => {
      const [macros, sessions] = await Promise.all([
        getAllMacrocycles(),
        getPlannedSessions(isoOfWeekDay(0), isoOfWeekDay(6)),
      ])
      setTarget(resolveMissionWeeklyTarget(macros, todayISO()))
      setPlanned(sessions.filter(s => !isRaceMirrorSession(s)))
    })()
  }, [])

  // États des 7 pastilles : fait (volume ce jour) > aujourd'hui > à venir (séance planifiée) > repos.
  const today = todayISO()
  const dots: { state: DayDotState; color?: string }[] = (o?.dailyLabels ?? ['L','M','M','J','V','S','D']).map((_, i) => {
    const iso = isoOfWeekDay(i)
    const km = o?.dailyKm?.[i] ?? 0
    const dur = o?.dailyDurationSec?.[i] ?? 0
    if (km > 0 || dur > 0) return { state: 'done', color: isTri ? undefined : SPORT_DOT_COLOR[sport] }
    if (iso === today) return { state: 'today' }
    if (iso > today && planned.some(s => s.date === iso)) return { state: 'upcoming' }
    return iso > today ? { state: 'upcoming' } : { state: 'rest' }
  })

  const tri = isTri ? computeTriWeek(sportOverviews) : null
  const frac = expectedWeekFraction(today)
  const volPct = target && target.km > 0 ? ((o?.weekKm ?? 0) / target.km) * 100 : 0
  const dplusPct = target && target.dPlus > 0 ? ((o?.weekDPlus ?? 0) / target.dPlus) * 100 : 0
  const onTrack = target != null && volPct >= frac * 100 - 15

  // Tendance 6 semaines (weeklyPoints contient la série hebdo, on prend les 6 dernières).
  const weekly = (o?.weeklyPoints ?? []).slice(-6)
  const maxKm = Math.max(1, ...weekly.map(w => w.km))
  const trend = weekly.length >= 2
    ? (weekly[weekly.length - 1].km >= weekly[weekly.length - 2].km ? 'up' : 'down')
    : 'stable'

  return (
    <div className="space-y-3">
      <MorningReportTile />

      {freshnessPayload && <FormeCard payload={freshnessPayload} />}

      {/* Ma semaine */}
      <MissionCard>
        <div className="mb-3"><MissionCardLabel>{M.weekTitle}</MissionCardLabel></div>
        <div className="flex justify-between mb-4">
          {dots.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-semibold text-trail-muted">{o?.dailyLabels?.[i] ?? ''}</span>
              <DayDot state={d.state} color={d.color} />
            </div>
          ))}
        </div>
        {isTri && tri ? (
          <div className="flex items-end gap-4">
            <p className="font-display text-[40px] font-bold leading-none text-trail-text">{formatHoursMin(tri.totalSec)}</p>
            <p className="text-[11px] pb-1 font-semibold text-trail-muted">
              <span style={{ color: 'var(--data-swim)' }}>{formatHoursMin(tri.swimSec)} nat</span>
              {' · '}
              <span style={{ color: 'var(--data-bike)' }}>{formatHoursMin(tri.rideSec)} vélo</span>
              {' · '}
              <span style={{ color: 'var(--data-run)' }}>{formatHoursMin(tri.runSec)} cap</span>
            </p>
          </div>
        ) : (
          <div className="flex items-end gap-4">
            <p className="font-display text-[40px] font-bold leading-none text-trail-text">
              {Math.round(o?.weekKm ?? 0)}<span className="text-[20px] text-trail-muted"> km</span>
            </p>
            <div className="pb-0.5">
              <p className="font-display text-[20px] font-semibold leading-none" style={{ color: 'var(--status-info)' }}>
                +{Math.round(o?.weekDPlus ?? 0).toLocaleString('fr-FR')} m
              </p>
              <p className="text-[10px] mt-0.5 uppercase tracking-wider text-trail-muted">
                D+ · {M.weekSessionsCount(o?.weekSessions ?? 0)}
              </p>
            </div>
          </div>
        )}
      </MissionCard>

      {/* Cap de la semaine — seulement si un plan actif fournit une cible */}
      {target && (
        <MissionCard>
          <div className="flex items-center justify-between mb-3">
            <MissionCardLabel>{M.capTitle}</MissionCardLabel>
            <p className="text-[10px] font-semibold text-trail-muted">{M.capPhasePrefix} {target.phaseLabel}</p>
          </div>
          <div className="space-y-3.5">
            <div>
              <div className="flex justify-between text-[12px] mb-1.5">
                <span className="text-trail-muted">{M.capVolume}</span>
                <span className="font-bold text-trail-text">
                  {Math.round(o?.weekKm ?? 0)} <span className="text-trail-muted">/ {target.km} km</span>
                </span>
              </div>
              <CapGauge pct={volPct} markerPct={frac * 100} color="var(--primary)" />
            </div>
            <div>
              <div className="flex justify-between text-[12px] mb-1.5">
                <span className="text-trail-muted">{M.capDplus}</span>
                <span className="font-bold" style={{ color: 'var(--status-info)' }}>
                  {Math.round(o?.weekDPlus ?? 0).toLocaleString('fr-FR')} <span className="text-trail-muted">/ {target.dPlus.toLocaleString('fr-FR')} m</span>
                </span>
              </div>
              <CapGauge pct={dplusPct} markerPct={frac * 100} color="var(--status-info)" />
            </div>
          </div>
          <p className="text-[11px] mt-3 text-trail-muted">
            {M.capMarkerHint} {onTrack ? M.capOnTrack : M.capBehind}
          </p>
        </MissionCard>
      )}

      {/* Altitude · 6 semaines */}
      {weekly.length >= 2 && (
        <MissionCard>
          <div className="flex items-center justify-between mb-3">
            <MissionCardLabel>{M.altitudeTitle}</MissionCardLabel>
            <p className="text-[11px] font-bold" style={{ color: trend === 'up' ? 'var(--status-success)' : trend === 'down' ? 'var(--status-warning)' : 'var(--trail-muted)' }}>
              {trend === 'up' ? M.altitudeUp : trend === 'down' ? M.altitudeDown : M.altitudeStable}
            </p>
          </div>
          <div className="flex items-end gap-2 h-[64px]">
            {weekly.map((w, i) => (
              <div
                key={w.weekLabel}
                className="flex-1 rounded-t"
                style={{
                  height: `${Math.max(6, (w.km / maxKm) * 100)}%`,
                  background: i === weekly.length - 1 ? 'var(--primary)' : 'var(--ink-500)',
                }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[9px] mt-1.5 text-trail-muted">
            {weekly.map((w, i) => (
              <span key={w.weekLabel} style={i === weekly.length - 1 ? { color: 'var(--primary-text)', fontWeight: 700 } : undefined}>
                {w.weekLabel}
              </span>
            ))}
          </div>
        </MissionCard>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Brancher la page dashboard**

Dans `web/app/(main)/dashboard/page.tsx`, remplacer le `return` (lignes 108-123) :

```tsx
  return (
    <div className="px-2 py-2 max-w-lg mx-auto md:max-w-none md:px-6">
      <MorningReportAutoOpen createdAt={user.created_at} />
      {activityCount === 0 && <FirstActivityBanner />}
      {mode === 'mission' ? (
        <div className="max-w-lg mx-auto">
          <MissionCockpit
            sportOverviews={sportOverviews}
            freshnessPayload={freshnessPayload}
            discipline={athleteProfile?.onboarding_discipline ?? null}
          />
        </div>
      ) : (
        <DashboardGrid
          sportOverviews={sportOverviews}
          weekSessions={weekSessions}
          latestPerSport={latestPerSport}
          weekActivities={weekActivities}
          athleteProfile={athleteProfile ?? null}
          discipline={athleteProfile?.onboarding_discipline ?? null}
        />
      )}
    </div>
  )
```

Ajouter l'import : `import { MissionCockpit } from '@/components/mission/MissionCockpit'`.
Ne PAS retirer encore `mode`/`freshnessPayload` de `DashboardGrid` (fait en Task 9). Le fetch `freshnessPayload` (lignes 95-106) reste tel quel.

- [ ] **Step 5: Test de rendu**

```tsx
// web/__tests__/components/mission/MissionCockpit.test.tsx
import { render, screen } from '@testing-library/react'
import { MissionCockpit } from '@/components/mission/MissionCockpit'
import { I18nProvider } from '@/lib/i18n/I18nProvider'

// Le storage plan touche Supabase côté client → mock complet.
jest.mock('@/lib/plan/storage', () => ({
  getAllMacrocycles: jest.fn().mockResolvedValue([]),
  getPlannedSessions: jest.fn().mockResolvedValue([]),
  isRaceMirrorSession: () => false,
}))
jest.mock('@/lib/hooks/useMorningReportSeen', () => ({
  useMorningReportSeen: () => ({ seen: true }),
}))

function overview(partial: Record<string, unknown> = {}) {
  return {
    weekKm: 28, weekDPlus: 1240, weekSessions: 3,
    dailyKm: [10, 0, 8, 0, 0, 0, 0], dailyDPlus: [], dailyDurationSec: [3600, 0, 2400, 0, 0, 0, 0],
    dailyLabels: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
    ytdKm: 0, ytdDPlus: 0, ytdSessions: 0, monthlyKm: [], monthlyDPlus: [],
    atl: 0, ctl: 0, tsb: 0, weekCes: 0, last7Tsb: [],
    weeklyPoints: [
      { weekLabel: 'S-2', km: 30, dPlus: 0 },
      { weekLabel: 'S-1', km: 40, dPlus: 0 },
      { weekLabel: 'S', km: 28, dPlus: 0 },
    ],
    cumulMonths: [], cumulYears: [], workoutTypeBreakdown: [], dailyHistory: [],
    ...partial,
  }
}

const overviews = { run: overview(), ride: overview(), swim: overview(), all: overview() } as never

it('rend le héros semaine (km + D+) et la tendance', async () => {
  render(
    <I18nProvider initialLang="fr">
      <MissionCockpit sportOverviews={overviews} freshnessPayload={null} discipline={null} />
    </I18nProvider>,
  )
  expect(await screen.findByText('Ma semaine')).toBeInTheDocument()
  expect(screen.getByText('28')).toBeInTheDocument()
  expect(screen.getByText(/Altitude/)).toBeInTheDocument()
})

it('triathlon → volume en heures avec répartition', async () => {
  render(
    <I18nProvider initialLang="fr">
      <MissionCockpit sportOverviews={overviews} freshnessPayload={null} discipline="triathlon" />
    </I18nProvider>,
  )
  // 3 sports × 6000 s/semaine chacun = 18000 s = 5h
  expect(await screen.findByText('5h')).toBeInTheDocument()
})
```

NB : vérifier la prop réelle de `I18nProvider` (ouvrir `web/lib/i18n/I18nProvider.tsx`) — si la prop s'appelle autrement (`lang`, `initial`), adapter. Si d'autres tests du repo wrappent déjà un provider, copier leur pattern.

- [ ] **Step 6: Lancer le test**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/components/mission/MissionCockpit.test.tsx -v`
Expected: PASS

- [ ] **Step 7: Vérif visuelle locale**

Run: `cd /c/Users/Franc/app-run-mobile/web && npm run dev`, passer le compte en Mode Mission (Réglages → Mode d'affichage), ouvrir http://localhost:3000/dashboard. Comparer à la maquette (ordre des blocs, couleurs, tailles). Stopper le dev server après.

- [ ] **Step 8: Commit**

```bash
git -C /c/Users/Franc/app-run-mobile add web/components/mission web/app/\(main\)/dashboard/page.tsx web/__tests__/components/mission/MissionCockpit.test.tsx
git -C /c/Users/Franc/app-run-mobile commit -m "feat(mission): écran Cockpit v2 (briefing, forme, semaine, cap, altitude)"
```

---

### Task 7: Écran Plan Mission

**Files:**
- Create: `web/components/mission/MissionPlan.tsx`
- Modify: `web/app/(main)/plan/page.tsx`
- Test: `web/__tests__/components/mission/MissionPlan.test.tsx`

**Référence visuelle :** frame « Pilier 2 · Plan » + variante « état vide » de la maquette.

- [ ] **Step 1: Implémenter MissionPlan**

```tsx
// web/components/mission/MissionPlan.tsx
'use client'

// Écran Plan du Mode Mission v2 — « ma feuille de route, jusqu'à la course » :
// Séance du jour → Semaine → Destination (course) → Ma prépa → Coach IA.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MissionCard, MissionCardLabel } from './cards'
import {
  getAllMacrocycles, getMainRace, getPlannedSessions, isRaceMirrorSession, pickActiveMacrocycle,
} from '@/lib/plan/storage'
import { computePrepaProgress, computePhaseSegments, weekOfPlan } from '@/lib/mission/prepa'
import type { PlannedSession, Race, RaceWaypoint, TrainingPlan } from '@/types/plan'
import { useT } from '@/lib/i18n/I18nProvider'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoOfWeekDay(idx: number): string {
  const now = new Date()
  const dow = now.getDay() || 7
  const d = new Date(now)
  d.setDate(now.getDate() - (dow - 1) + idx)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function formatTarget(min: number | undefined): string | null {
  if (!min || min <= 0) return null
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

function daysUntil(dateISO: string): number {
  const today = new Date(`${todayISO()}T00:00:00`)
  const race = new Date(`${dateISO}T00:00:00`)
  return Math.max(0, Math.round((race.getTime() - today.getTime()) / 86_400_000))
}

// Teinte du héros « séance du jour » selon la discipline (spec : la séance
// porte sa discipline — vélo vert, natation bleu, défaut orange).
function sessionAccent(type: string | undefined): { color: string; glow: string } {
  if (type === 'velo' || type === 'velotaf') return { color: 'var(--data-bike)', glow: 'rgba(39,169,113,0.14)' }
  if (type === 'natation') return { color: 'var(--data-swim)', glow: 'rgba(75,180,230,0.14)' }
  return { color: 'var(--primary)', glow: 'var(--primary-glow)' }
}

export function MissionPlan() {
  const M = useT().mission
  const [planned, setPlanned] = useState<PlannedSession[]>([])
  const [prepaSessions, setPrepaSessions] = useState<PlannedSession[]>([])
  const [race, setRace] = useState<Race | null>(null)
  const [plan, setPlan] = useState<TrainingPlan | null>(null)
  const [waypoints, setWaypoints] = useState<RaceWaypoint[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    void (async () => {
      const today = todayISO()
      const [macros, week, mainRace] = await Promise.all([
        getAllMacrocycles(),
        getPlannedSessions(isoOfWeekDay(0), isoOfWeekDay(6)),
        getMainRace(),
      ])
      const active = pickActiveMacrocycle(macros, today)
      setPlan(active)
      setPlanned(week.filter(s => !isRaceMirrorSession(s)))
      setRace(mainRace)
      if (active) {
        const all = await getPlannedSessions(active.startDate, active.endDate)
        setPrepaSessions(all)
      }
      if (mainRace) {
        try {
          const res = await fetch(`/api/races/${mainRace.id}/waypoints`)
          if (res.ok) {
            const json = (await res.json()) as { waypoints: RaceWaypoint[] }
            setWaypoints(json.waypoints ?? [])
          }
        } catch { /* profil optionnel */ }
      }
      setLoaded(true)
    })()
  }, [])

  const today = todayISO()
  const todaySession = planned.find(s => s.date === today) ?? null
  const prepa = computePrepaProgress(prepaSessions)
  const segments = plan ? computePhaseSegments(plan, today) : []
  const week = plan ? weekOfPlan(plan, today) : null

  // Mini profil : altitude nette cumulée (dPlus - dMoins) par waypoint.
  const profile = waypoints.filter(w => w.dPlus != null).map(w => ({
    km: w.km, alt: (w.dPlus ?? 0) - (w.dMoins ?? 0), ravito: w.type === 'ravito',
  }))
  const maxAlt = Math.max(1, ...profile.map(p => p.alt))
  const maxKm = race?.distance ?? Math.max(1, ...profile.map(p => p.km))
  const pathD = profile.length >= 2
    ? `M0,62 ${profile.map(p => `L${(p.km / maxKm) * 340},${62 - (p.alt / maxAlt) * 50}`).join(' ')} L340,62 Z`
    : null

  if (!loaded) return null

  return (
    <div className="px-3 py-3 max-w-lg mx-auto space-y-3">
      {/* 1 · Séance du jour — teintée par la discipline de la séance */}
      <div
        className="rounded-[16px] border p-5"
        style={{
          background: `linear-gradient(150deg, ${sessionAccent(todaySession?.type).glow} 0%, var(--trail-card) 55%)`,
          borderColor: sessionAccent(todaySession?.type).color,
        }}
      >
        <p className="text-[10px] uppercase tracking-[0.15em] font-bold mb-3" style={{ color: sessionAccent(todaySession?.type).color }}>
          {M.todayTitle}
        </p>
        {todaySession ? (
          <>
            <p className="font-display text-[32px] font-bold leading-none text-trail-text">{todaySession.title}</p>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-[12px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'var(--primary)', color: 'var(--ink-900)' }}>
                {formatTarget(todaySession.duration) ?? `${todaySession.duration} min`}
              </span>
              <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-trail-border text-trail-muted">
                {M.intensityLabel} {'●'.repeat(todaySession.intensity)}{'○'.repeat(5 - todaySession.intensity)}
              </span>
            </div>
            {todaySession.notes && (
              <p className="text-[13px] mt-3.5 leading-relaxed text-trail-muted">{todaySession.notes}</p>
            )}
          </>
        ) : (
          <p className="font-display text-[32px] font-bold leading-none text-trail-muted">{M.restDay}</p>
        )}
      </div>

      {/* 2 · Ma semaine d'entraînement */}
      <MissionCard>
        <div className="mb-3"><MissionCardLabel>{M.weekPlanTitle}</MissionCardLabel></div>
        <div className="space-y-1 text-[13px]">
          {DAY_SHORT.map((label, i) => {
            const iso = isoOfWeekDay(i)
            const s = planned.find(x => x.date === iso) ?? null
            const isToday = iso === today
            return (
              <div
                key={label}
                className={`flex items-center justify-between py-1 ${isToday ? 'px-2 -mx-2 rounded-[10px]' : ''}`}
                style={isToday ? { background: 'var(--primary-glow)' } : undefined}
              >
                <span className={`w-9 ${isToday ? 'font-bold' : ''}`} style={{ color: isToday ? 'var(--primary-text)' : 'var(--trail-muted)' }}>
                  {label}
                </span>
                <span className={`flex-1 ${isToday ? 'font-bold text-trail-text' : s ? 'text-trail-muted' : ''}`}
                      style={!s ? { color: 'var(--text-disabled)' } : undefined}>
                  {s ? s.title : M.restDay}
                </span>
                <span className="font-bold" style={{
                  color: s?.status === 'completed' ? 'var(--status-success)'
                    : isToday ? 'var(--primary-text)' : 'var(--trail-muted)',
                }}>
                  {s?.status === 'completed' ? M.statusDone : isToday ? M.statusToday : s ? M.statusUpcoming : M.statusRest}
                </span>
              </div>
            )
          })}
        </div>
      </MissionCard>

      {/* 3 · Destination */}
      {race ? (
        <Link href={`/plan/courses/${race.id}`} className="block">
          <MissionCard>
            <div className="flex items-center justify-between mb-1">
              <MissionCardLabel>{M.destinationTitle}</MissionCardLabel>
              <p className="text-[11px] font-semibold" style={{ color: 'var(--primary-text)' }}>{M.destinationTableLink}</p>
            </div>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-[36px] font-bold leading-none" style={{ color: 'var(--primary)' }}>
                  J-{daysUntil(race.date)}
                </p>
                <p className="text-[14px] font-bold mt-1.5 text-trail-text">{race.name}</p>
                <p className="text-[11px] mt-0.5 text-trail-muted">
                  {new Date(`${race.date}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  {' · '}{race.distance} km · <span style={{ color: 'var(--status-info)' }}>+{race.elevation.toLocaleString('fr-FR')} m</span>
                  {formatTarget(race.targetDurationMin) && <> · {M.destinationTargetPrefix} {formatTarget(race.targetDurationMin)}</>}
                </p>
              </div>
              {pathD && (
                <svg viewBox="0 0 340 70" className="w-[120px] mt-1 shrink-0">
                  <path d={pathD} fill="rgba(56,189,248,0.16)" stroke="var(--status-info)" strokeWidth="2" />
                  {profile.filter(p => p.ravito).map((p, i) => (
                    <circle key={i} cx={(p.km / maxKm) * 340} cy={62 - (p.alt / maxAlt) * 50} r="5" fill="var(--primary)" />
                  ))}
                </svg>
              )}
            </div>
          </MissionCard>
        </Link>
      ) : (
        <MissionCard className="text-center">
          <p className="text-[24px]">🏁</p>
          <p className="text-[14px] font-semibold mt-1.5 text-trail-text">{M.destinationEmptyTitle}</p>
          <p className="text-[12px] mt-1 text-trail-muted">{M.destinationEmptyBody}</p>
          {/* ?full=1 : ouvre la vue Plan complète (gestion des courses) — /plan nu re-rendrait cet écran */}
          <Link
            href="/plan?full=1"
            className="inline-block mt-3.5 px-5 py-2.5 rounded-full text-[13px] font-bold"
            style={{ background: 'var(--primary)', color: 'var(--ink-900)' }}
          >
            {M.destinationEmptyCta}
          </Link>
        </MissionCard>
      )}

      {/* 4 · Ma prépa */}
      {plan && week && (
        <MissionCard>
          <div className="flex items-center justify-between mb-3">
            <MissionCardLabel>{M.prepaTitle}</MissionCardLabel>
            <p className="text-[11px] font-bold" style={{ color: 'var(--primary-text)' }}>{M.prepaWeekOf(week.week, week.total)}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-[72px] h-[72px] shrink-0">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="var(--trail-border)" strokeWidth="11" />
                <circle
                  cx="60" cy="60" r="52" fill="none" stroke="var(--status-success)" strokeWidth="11"
                  strokeLinecap="round" strokeDasharray={`${(prepa.pct / 100) * 326.7} 326.7`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="font-display text-[18px] font-bold text-trail-text">{prepa.pct}<span className="text-[10px]">%</span></p>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold mb-2 text-trail-text">{M.prepaSessions(prepa.done, prepa.total)}</p>
              <div className="flex gap-1 mb-1.5">
                {segments.map((seg, i) => (
                  <div
                    key={i}
                    className={`h-[7px] relative ${i === 0 ? 'rounded-l-full' : ''} ${i === segments.length - 1 ? 'rounded-r-full' : ''}`}
                    style={{ width: `${seg.widthPct}%`, background: seg.active ? 'var(--primary)' : 'var(--ink-500)' }}
                  >
                    {seg.cursorPct != null && (
                      <span className="absolute -top-[3px] w-[3px] h-[13px] rounded bg-white" style={{ left: `${seg.cursorPct}%` }} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex text-[9px] text-trail-muted">
                {segments.map((seg, i) => (
                  <span key={i} style={{ width: `${seg.widthPct}%`, ...(seg.active ? { color: 'var(--primary-text)', fontWeight: 700 } : {}) }}>
                    {seg.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </MissionCard>
      )}

      {/* 5 · Coach IA (placeholder — le module n'existe pas encore) */}
      <button
        type="button"
        disabled
        className="w-full p-3.5 rounded-2xl flex items-center justify-center gap-2 text-[14px] font-bold opacity-80"
        style={{ border: '1.5px solid var(--primary)', color: 'var(--primary-text)', background: 'transparent' }}
      >
        {M.coachButton}
        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-trail-border text-trail-muted">
          {M.coachBadge}
        </span>
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Brancher la page plan**

`web/app/(main)/plan/page.tsx` — même pattern `?full=1` que l'écran Activités : la vue Expert du plan reste accessible depuis Mission (gestion du plan et des courses, cible de l'état vide Destination) :

```tsx
import PlanClient from './PlanClient'
import { MissionPlan } from '@/components/mission/MissionPlan'
import { getServerAppMode } from '@/lib/preferences/server'

export default async function PlanPage({
  searchParams,
}: { searchParams?: { full?: string } }) {
  const mode = await getServerAppMode()
  if (mode === 'mission' && searchParams?.full !== '1') return <MissionPlan />
  return <PlanClient mode="expert" mission={null} />
}
```

NB : le fetch `onboarding_mission` ne servait qu'au PlanClient en mode mission (bibliothèque curée) — il disparaît avec la branche (on passe `mode="expert"` puisque la vue rendue est toujours la vue complète). `PlanClient` garde sa prop `mission` (cleanup Task 9). Dans `MissionPlan`, le CTA de l'état vide Destination pointe vers `/plan?full=1` (PAS `/plan`, qui re-rendrait l'écran Mission) — remplacer le `href="/plan"` du bloc état vide par `href="/plan?full=1"`.

- [ ] **Step 3: Test de rendu**

```tsx
// web/__tests__/components/mission/MissionPlan.test.tsx
import { render, screen } from '@testing-library/react'
import { MissionPlan } from '@/components/mission/MissionPlan'
import { I18nProvider } from '@/lib/i18n/I18nProvider'

jest.mock('@/lib/plan/storage', () => ({
  getAllMacrocycles: jest.fn().mockResolvedValue([]),
  getPlannedSessions: jest.fn().mockResolvedValue([]),
  getMainRace: jest.fn().mockResolvedValue(null),
  pickActiveMacrocycle: () => null,
  isRaceMirrorSession: () => false,
}))

it('sans plan ni course → Repos + état vide Destination', async () => {
  render(
    <I18nProvider initialLang="fr">
      <MissionPlan />
    </I18nProvider>,
  )
  expect(await screen.findByText('Repos')).toBeInTheDocument()
  expect(screen.getByText('Aucune course prévue')).toBeInTheDocument()
  expect(screen.getByText(/Ajuster mon plan/)).toBeInTheDocument()
})
```

- [ ] **Step 4: Lancer le test**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/components/mission/MissionPlan.test.tsx -v`
Expected: PASS

- [ ] **Step 5: Vérif visuelle locale**

`npm run dev` en Mode Mission → http://localhost:3000/plan. Vérifier : séance du jour (ou Repos), 7 lignes semaine, carte Destination (avec course définie ET sans), anneau + frise, bouton IA désactivé. Stopper le dev server.

- [ ] **Step 6: Commit**

```bash
git -C /c/Users/Franc/app-run-mobile add web/components/mission/MissionPlan.tsx web/app/\(main\)/plan/page.tsx web/__tests__/components/mission/MissionPlan.test.tsx
git -C /c/Users/Franc/app-run-mobile commit -m "feat(mission): écran Plan v2 (séance, semaine, destination, prépa, coach IA)"
```

---

### Task 8: Écran Activités Mission

**Files:**
- Create: `web/components/mission/MissionActivities.tsx`
- Modify: `web/app/(main)/activities/page.tsx`
- Test: `web/__tests__/components/mission/MissionActivities.test.tsx`

**Référence visuelle :** frame « Pilier 3 · Activités ». Pas de score CES affiché (décision spec). Pas de trace de profil (hors périmètre, cf. header).

- [ ] **Step 1: Implémenter MissionActivities**

```tsx
// web/components/mission/MissionActivities.tsx
'use client'

// Écran Activités du Mode Mission v2 — « mon journal de bord » :
// Dernière sortie (héros) → Cumul du mois → Sorties récentes → lien historique.
// Le lien historique pointe vers /activities?full=1 qui rend la liste Expert.

import Link from 'next/link'
import { MissionCard, MissionCardLabel } from './cards'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import { useT } from '@/lib/i18n/I18nProvider'

function dist(a: ActivityRow): number { return (a.manual_distance_m ?? a.distance_m ?? 0) / 1000 }
function elev(a: ActivityRow): number { return a.manual_elevation_gain_m ?? a.elevation_gain_m ?? 0 }
function durSec(a: ActivityRow): number { return a.manual_moving_time_sec ?? a.moving_time_sec ?? 0 }

function formatDur(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}

// start_time = heure locale étiquetée UTC → toujours lire en getters UTC
// (cf. lib/activities/format-datetime.ts).
function dayLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function MissionActivities({ activities }: { activities: ActivityRow[] }) {
  const M = useT().mission
  const last = activities[0] ?? null

  const now = new Date()
  const monthRows = activities.filter(a => {
    const d = new Date(a.start_time)
    return d.getUTCFullYear() === now.getFullYear() && d.getUTCMonth() === now.getMonth()
  })
  const monthKm = monthRows.reduce((s, a) => s + dist(a), 0)
  const monthDPlus = monthRows.reduce((s, a) => s + elev(a), 0)
  const recent = activities.slice(1, 4)

  return (
    <div className="px-3 py-3 max-w-lg mx-auto space-y-3">
      {last && (
        <Link href={`/activities/${last.id}`} className="block">
          <MissionCard className="p-5">
            <div className="mb-2">
              <MissionCardLabel>{M.lastActivityTitle} · {dayLabel(last.start_time)}</MissionCardLabel>
            </div>
            <p className="font-display text-[24px] font-bold leading-tight text-trail-text">{last.name}</p>
            <div className="flex items-end gap-5 mt-3">
              <p className="font-display text-[22px] font-bold leading-none text-trail-text">
                {dist(last).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}<span className="text-[13px] text-trail-muted"> km</span>
              </p>
              <p className="font-display text-[22px] font-bold leading-none" style={{ color: 'var(--status-info)' }}>
                +{Math.round(elev(last))}<span className="text-[13px]"> m</span>
              </p>
              <p className="font-display text-[22px] font-bold leading-none text-trail-text">{formatDur(durSec(last))}</p>
            </div>
          </MissionCard>
        </Link>
      )}

      <MissionCard>
        <div className="mb-3"><MissionCardLabel>{M.monthTitle}</MissionCardLabel></div>
        <div className="flex justify-between">
          <div>
            <p className="font-display text-[24px] font-bold leading-none text-trail-text">
              {Math.round(monthKm)}<span className="text-[13px] text-trail-muted"> km</span>
            </p>
            <p className="text-[10px] mt-1 uppercase tracking-wider text-trail-muted">{M.volumeLabel}</p>
          </div>
          <div>
            <p className="font-display text-[24px] font-bold leading-none" style={{ color: 'var(--status-info)' }}>
              +{Math.round(monthDPlus).toLocaleString('fr-FR')}<span className="text-[13px]"> m</span>
            </p>
            <p className="text-[10px] mt-1 uppercase tracking-wider text-trail-muted">{M.dplusLabel}</p>
          </div>
          <div>
            <p className="font-display text-[24px] font-bold leading-none text-trail-text">{monthRows.length}</p>
            <p className="text-[10px] mt-1 uppercase tracking-wider text-trail-muted">{M.sessionsLabel}</p>
          </div>
        </div>
      </MissionCard>

      {recent.length > 0 && (
        <MissionCard className="px-4 py-2">
          {recent.map(a => (
            <Link key={a.id} href={`/activities/${a.id}`}
                  className="flex items-center justify-between py-[9px] border-t border-trail-border first:border-t-0">
              <div>
                <p className="text-[13px] font-semibold text-trail-text">{a.name}</p>
                <p className="text-[11px] text-trail-muted">{dayLabel(a.start_time)}</p>
              </div>
              <p className="text-[12px] text-right text-trail-muted">
                {dist(a).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km · <span style={{ color: 'var(--status-info)' }}>+{Math.round(elev(a))} m</span>
                <br />{formatDur(durSec(a))}
              </p>
            </Link>
          ))}
        </MissionCard>
      )}

      <Link href="/activities?full=1" className="block w-full text-center text-[13px] font-semibold py-1"
            style={{ color: 'var(--primary-text)' }}>
        {M.allHistory}
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Brancher la page activities**

`web/app/(main)/activities/page.tsx` — ajouter le mode + searchParam :

```tsx
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/database/get-user'
import { createClient } from '@/lib/database/supabase-server'
import { getServerAppMode } from '@/lib/preferences/server'
import ActivitiesClient from './ActivitiesClient'
import { MissionActivities } from '@/components/mission/MissionActivities'
import type { ActivityRow } from '@/components/ui/ActivityCard'

const INITIAL_LIMIT = 300

export default async function ActivitiesPage({
  searchParams,
}: { searchParams?: { full?: string } }) {
  const user = await getServerUser()
  if (!user) redirect('/login')
  const supabase = await createClient()

  const [{ data: rows }, { data: profile }, mode] = await Promise.all([
    supabase
      .from('activities')
      .select('id, name, sport_type, start_time, ces, avg_hr, max_hr, distance_m, elevation_gain_m, moving_time_sec, manual_sport_type, manual_intensity, manual_workout_type, manual_distance_m, manual_moving_time_sec, manual_elevation_gain_m')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('start_time', { ascending: false })
      .limit(INITIAL_LIMIT),
    supabase
      .from('profiles')
      .select('max_hr, resting_hr, aerobic_threshold_hr, threshold_hr, birth_year, hr_zone_method, hr_zones_custom')
      .eq('id', user.id)
      .single(),
    getServerAppMode(),
  ])

  const initial = (rows ?? []) as ActivityRow[]
  const hasMore = initial.length === INITIAL_LIMIT

  if (mode === 'mission' && searchParams?.full !== '1') {
    return <MissionActivities activities={initial} />
  }
  return <ActivitiesClient initial={initial} hasMore={hasMore} athleteProfile={profile} />
}
```

- [ ] **Step 3: Test de rendu**

```tsx
// web/__tests__/components/mission/MissionActivities.test.tsx
import { render, screen } from '@testing-library/react'
import { MissionActivities } from '@/components/mission/MissionActivities'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import type { ActivityRow } from '@/components/ui/ActivityCard'

function act(p: Partial<ActivityRow>): ActivityRow {
  return {
    id: 'a1', name: 'Sortie', sport_type: 'TrailRun',
    start_time: new Date().toISOString(),
    ces: 80, avg_hr: null, distance_m: 14200, elevation_gain_m: 620, moving_time_sec: 5880,
    manual_intensity: null, manual_sport_type: null, manual_workout_type: null,
    manual_distance_m: null, manual_elevation_gain_m: null, manual_moving_time_sec: null,
    ...p,
  } as ActivityRow
}

it('héros dernière sortie + cumul mois, sans CES affiché', () => {
  render(
    <I18nProvider initialLang="fr">
      <MissionActivities activities={[act({ id: '1', name: 'Trail du Salève' }), act({ id: '2', name: 'Footing' })]} />
    </I18nProvider>,
  )
  expect(screen.getByText('Trail du Salève')).toBeInTheDocument()
  expect(screen.getByText('Ce mois-ci')).toBeInTheDocument()
  expect(screen.queryByText(/CES/)).not.toBeInTheDocument()
})
```

- [ ] **Step 4: Lancer le test**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/components/mission/MissionActivities.test.tsx -v`
Expected: PASS

- [ ] **Step 5: Vérif visuelle + commit**

Vérif dev locale (Mode Mission → /activities, puis « Tout mon historique » → liste complète) puis :

```bash
git -C /c/Users/Franc/app-run-mobile add web/components/mission/MissionActivities.tsx web/app/\(main\)/activities/page.tsx web/__tests__/components/mission/MissionActivities.test.tsx
git -C /c/Users/Franc/app-run-mobile commit -m "feat(mission): écran Activités v2 (dernière sortie, cumul mois, liste)"
```

---

### Task 9: Cleanup du chemin `missionVisible`

**Files:**
- Modify: `web/components/cockpit/DashboardGrid.tsx` (retirer `mode`, `freshnessPayload`, `MISSION_VISIBLE`, bloc `freshness`, import `FreshnessCard`/`AppMode`/`ChargeSportPayload`)
- Modify: `web/app/(main)/plan/PlanClient.tsx:57,151,183,204` (retirer la prop `mission`, `simplified={mode === 'mission'}` → `simplified={false}` ou retrait, `missionVisible`)
- Modify: `web/components/blocks/BlockGrid.tsx:29-33,361-…` (retirer la prop `missionVisible` et la branche de rendu Mission)
- Modify: `web/app/(main)/dashboard/page.tsx` (la prop `mode`/`freshnessPayload` n'est plus passée à `DashboardGrid` — déjà fait en Task 6 ; vérifier qu'il ne reste pas d'import mort)

Ces composants ne sont plus jamais rendus en mode Mission → le chemin curé est mort. Attention :
- `ResumeSemaineBlock` garde sa prop `simplified` si elle a d'autres usages — vérifier avec `grep -r "simplified" web/components/plan/` ; si seul PlanClient l'utilisait pour Mission, passer `false` et NE PAS supprimer la prop (hors périmètre).
- `BibliothequeSeancesBlock` garde sa prop `mission` (même raisonnement) ; PlanClient lui passe `null`.
- NE PAS toucher `web/app/cockpit-mission-preview/` ni `components/cockpit/mission-preview/` (page de prévisualisation marketing indépendante).

- [ ] **Step 1: Retirer la branche mission de BlockGrid + props mortes DashboardGrid/PlanClient** (suivre la liste ci-dessus)
- [ ] **Step 2: Chercher les références restantes**

Run: `cd /c/Users/Franc/app-run-mobile/web && grep -rn "missionVisible" app components __tests__ lib`
Expected: aucune occurrence (sinon corriger).

- [ ] **Step 3: Lancer les suites concernées**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/components/blocks __tests__/components/cockpit __tests__/lib/training/mission-curation.test.ts -v --passWithNoTests`
Expected: PASS (adapter les tests qui montaient `missionVisible` s'il y en a — les mettre à jour, pas les supprimer, sauf s'ils ne testaient QUE le chemin mission supprimé).

- [ ] **Step 4: tsc + lint**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit && npx next lint`
Expected: 0 erreur.

- [ ] **Step 5: Commit**

```bash
git -C /c/Users/Franc/app-run-mobile add -A web
git -C /c/Users/Franc/app-run-mobile commit -m "refactor(mission): retire le chemin missionVisible (remplacé par les écrans Mission v2)"
```

---

### Task 10: Documentation, backlog et vérification finale

**Files:**
- Modify: `web/docs/superpowers/specs/2026-06-12-mode-mission-v2-3-piliers-design.md` (bandeau Status)
- Modify: `tasks/backlog.md`

- [ ] **Step 1: Bandeau spec**

Remplacer la ligne de status par :
`> **Status: Implémenté** · YYYY-MM-DD · Code: web/components/mission/ + web/lib/mission/`

- [ ] **Step 2: Backlog**

Ajouter à `tasks/backlog.md` (suivre le format défini en bas de ce fichier) :
- Trace du profil altimétrique sur la dernière sortie (écran Activités Mission) — nécessite les streams.
- Module Coach IA : brancher le bouton « Ajuster mon plan » (écran Plan Mission).

- [ ] **Step 3: Vérification complète**

Run:
```bash
cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit && npx next lint && npx jest __tests__/lib/mission __tests__/components/mission -v
```
Expected: tout PASS, 0 erreur TS/lint.

- [ ] **Step 4: Vérif visuelle de bout en bout**

`npm run dev` : en Mode Mission parcourir Cockpit → Plan → Activités (+ `?full=1`), comparer chaque écran à la maquette ; basculer en Expert et vérifier que dashboard/plan/activities sont inchangés. Stopper le dev server.

- [ ] **Step 5: Commit final**

```bash
git -C /c/Users/Franc/app-run-mobile add web/docs tasks/backlog.md
git -C /c/Users/Franc/app-run-mobile commit -m "docs(mission): spec v2 implémentée + backlog (trace profil, coach IA)"
```

**Déploiement :** push sur GitHub uniquement à la demande de Franck (Vercel auto-déploie). Aucune migration Supabase.
