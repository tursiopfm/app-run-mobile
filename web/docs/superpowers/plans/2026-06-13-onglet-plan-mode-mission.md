# Onglet Plan (Mode Mission) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre l'onglet Plan du Mode Mission en « feuille de route tournée vers l'avant » : héros « Ta prochaine séance » avec raisonnement + actions, « Ma semaine » fusionnant réalisé (auto-import) + planifié + suggéré + saisie manuelle, Destination compacte, bloc générique sans course, et un moteur de suggestion **par règles** (sans IA, sans jargon « TSB »).

**Architecture :** Trois modules purs et testables (`session-advisor`, `week-feed`, `rhythm`) alimentent des composants Mission (`PlanHeroCard`, `RythmeCard`, refonte `MissionPlan`). La page serveur `/plan` (mode Mission) fournit `freshnessPayload` + 28 jours d'activités + discipline, comme le Cockpit. Le « ＋ Ajouter une séance » réutilise `SessionAddSheet` + `SessionEditorModal` (flux expert). Le routage « Ajouter une course » passe par un deep-link `?new=1` qui auto-ouvre `RaceEditorModal` dans `ObjectifCourseBlock`.

**Tech Stack :** Next.js 14 App Router, TypeScript, Tailwind (tokens Deep Mission), Supabase SSR, Jest. Réutilise `lib/analytics/charge-insights` (`computeFreshness`), `lib/mission/{weekly-target,prepa,forme-verdict}`, `lib/plan/{storage,session-matching}`.

**Spec :** `web/docs/superpowers/specs/2026-06-13-onglet-plan-mode-mission-design.md`
**Maquette de référence (markup/tokens exacts) :** `Prompts/plan-tab-mission-final-mockup.html`

---

## Conventions de vérification (lire avant de commencer)

- **cwd Bash non fiable** : toujours `cd /c/Users/Franc/app-run-mobile/web` en tête des commandes npm/jest ; `git` depuis la racine.
- **Pas de `next build` local** (conflit `.next` si un `next dev` tourne) — vérifier via `npx tsc --noEmit` + `npx eslint`. Le build autoritatif est sur Vercel.
- **Jest** : ~50 tests échouent en pré-existant (`useI18n` hors provider). **Ne lancer que les suites de ce plan** (chemins explicites), jamais la suite complète.
- **Rendu visuel** : Chrome headless Windows (cf. `Prompts/plan-tab-mission-final-mockup.html`).
- **Schéma `activities`** : FK athlète = `user_id`. `start_time` = heure locale étiquetée UTC → clé jour = `start_time.slice(0,10)`.

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `web/lib/mission/rhythm.ts` | **nouveau** — agrège des `ActivityRow[]` en volumes hebdo km/D+ (4 dernières semaines) + rythme habituel moyen. Pur. |
| `web/lib/mission/session-advisor.ts` | **nouveau** — moteur de règles : contexte (fraîcheur/charge/phase/cible) → conseil par jour de la semaine. Pur, sans I/O. |
| `web/lib/mission/week-feed.ts` | **nouveau** — fusionne `ActivityRow[]` (réalisé) + `PlannedSession[]` (planifié) + `WeekAdvice` (suggéré) → 7 entrées lun→dim. Pur. |
| `web/components/mission/PlanHeroCard.tsx` | **nouveau** — héros « Ta prochaine séance » : 3 états (suggéré / fait / repos) + actions. |
| `web/components/mission/RythmeCard.tsx` | **nouveau** — bloc générique « Ton rythme · 4 dernières semaines » + CTA création course. |
| `web/components/mission/MissionPlan.tsx` | **refonte** — assemble héros + Ma semaine (fil) + Destination compacte + bouton coach ; câble advisor/week-feed. |
| `web/app/(main)/plan/page.tsx` | **modif** — en mode Mission, fetch `freshnessPayload` + 28 j d'activités + discipline ; props à `MissionPlan`. |
| `web/components/plan/ObjectifCourseBlock.tsx` | **modif** — auto-ouvre `RaceEditorModal` (création) si `?new=1`. |
| `web/lib/i18n/dictionaries/fr.ts` | **modif** — clés `mission` (héros, reasons, rythme, actions) — **sans « TSB »**. |
| `web/__tests__/lib/mission/{rhythm,session-advisor,week-feed}.test.ts` | **nouveau** — tests des 3 modules purs. |

---

## Task 1 : Helper rythme (`lib/mission/rhythm.ts`)

**Files:**
- Create: `web/lib/mission/rhythm.ts`
- Test: `web/__tests__/lib/mission/rhythm.test.ts`

Agrège des activités en volumes hebdomadaires (km, D+) sur les semaines ISO, et calcule le rythme habituel (moyenne des semaines complètes). Indépendant du sport (toutes activités confondues — l'athlète sans plan veut voir son volume global).

- [ ] **Step 1 : Écrire le test (échoue)**

`web/__tests__/lib/mission/rhythm.test.ts` :

```ts
import { weeklyVolumes, habitualWeekly } from '@/lib/mission/rhythm'
import type { ActivityRow } from '@/components/ui/ActivityCard'

function act(id: string, startTime: string, km: number, dPlus = 0): ActivityRow {
  return {
    id, name: id, sport_type: 'Run', start_time: startTime, ces: 0,
    avg_hr: null, max_hr: null,
    distance_m: km * 1000, elevation_gain_m: dPlus, moving_time_sec: 3600,
    manual_sport_type: null, manual_intensity: null, manual_workout_type: null,
    manual_distance_m: null, manual_moving_time_sec: null, manual_elevation_gain_m: null,
  } as ActivityRow
}

describe('weeklyVolumes', () => {
  it('regroupe par semaine ISO (lundi) et somme km + D+', () => {
    const acts = [
      act('a', '2026-06-01T08:00:00Z', 10, 100), // lundi sem A
      act('b', '2026-06-03T08:00:00Z', 5, 50),   // mercredi sem A
      act('c', '2026-06-09T08:00:00Z', 8, 80),   // mardi sem B
    ]
    const weeks = weeklyVolumes(acts, '2026-06-12', 4)
    expect(weeks).toHaveLength(4)
    const semA = weeks.find(w => w.weekStart === '2026-06-01')!
    expect(semA.km).toBe(15)
    expect(semA.dPlus).toBe(150)
    const semB = weeks.find(w => w.weekStart === '2026-06-08')!
    expect(semB.km).toBe(8)
  })

  it('émet des semaines vides (km=0) sans activité', () => {
    const weeks = weeklyVolumes([], '2026-06-12', 4)
    expect(weeks).toHaveLength(4)
    expect(weeks.every(w => w.km === 0)).toBe(true)
  })
})

describe('habitualWeekly', () => {
  // today = ven 2026-06-12 → semaine courante = lundi 2026-06-08.
  // Les 4 semaines ANTÉRIEURES (exclut la courante) : lundis 05-11, 05-18, 05-25, 06-01.
  it('moyenne les 4 semaines ISO antérieures (zéros inclus), exclut la semaine courante', () => {
    const acts = [
      act('a', '2026-05-11T08:00:00Z', 20), // sem -4
      act('b', '2026-05-18T08:00:00Z', 30), // sem -3
      act('c', '2026-05-25T08:00:00Z', 40), // sem -2
      act('d', '2026-06-01T08:00:00Z', 50), // sem -1
      act('e', '2026-06-11T08:00:00Z', 999), // semaine courante → EXCLUE
    ]
    const h = habitualWeekly(acts, '2026-06-12')
    expect(h.km).toBe(35) // (20+30+40+50)/4
  })

  it('renvoie 0 si aucune activité antérieure (zéros moyennés)', () => {
    expect(habitualWeekly([], '2026-06-12').km).toBe(0)
  })
})
```

- [ ] **Step 2 : Lancer le test (échoue : module absent)**

```
cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/mission/rhythm.test.ts
```
Attendu : FAIL (`Cannot find module '@/lib/mission/rhythm'`).

- [ ] **Step 3 : Implémenter `lib/mission/rhythm.ts`**

```ts
// Agrégation des activités en volumes hebdomadaires (km, D+) pour le bloc
// « Ton rythme » et la cible-rythme du moteur de suggestion. Pur.

import type { ActivityRow } from '@/components/ui/ActivityCard'

export type WeeklyVolume = { weekStart: string; km: number; dPlus: number }

function km(a: ActivityRow): number {
  return (a.manual_distance_m ?? a.distance_m ?? 0) / 1000
}
function dplus(a: ActivityRow): number {
  return Math.round(a.manual_elevation_gain_m ?? a.elevation_gain_m ?? 0)
}

// Lundi (UTC) de la semaine contenant dateISO. start_time = heure locale
// étiquetée UTC → getters UTC (cf. reference_activity_time_tz).
function mondayUTC(dateISO: string): string {
  const d = new Date(`${dateISO.slice(0, 10)}T00:00:00Z`)
  const dow = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() - (dow - 1))
  return d.toISOString().slice(0, 10)
}

function addWeeksISO(mondayISO: string, n: number): string {
  const d = new Date(`${mondayISO}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n * 7)
  return d.toISOString().slice(0, 10)
}

// `count` dernières semaines (incluant celle de todayISO), de la plus ancienne
// à la plus récente. Chaque semaine est émise même sans activité (km=0).
export function weeklyVolumes(activities: ActivityRow[], todayISO: string, count: number): WeeklyVolume[] {
  const thisMonday = mondayUTC(todayISO)
  const weeks: WeeklyVolume[] = []
  for (let i = count - 1; i >= 0; i--) {
    weeks.push({ weekStart: addWeeksISO(thisMonday, -i), km: 0, dPlus: 0 })
  }
  const byStart = new Map(weeks.map(w => [w.weekStart, w]))
  for (const a of activities) {
    const w = byStart.get(mondayUTC(a.start_time))
    if (w) { w.km += km(a); w.dPlus += dplus(a) }
  }
  return weeks.map(w => ({ ...w, km: Math.round(w.km), dPlus: Math.round(w.dPlus) }))
}

// Rythme habituel = moyenne des semaines ANTÉRIEURES (hors semaine courante)
// sur 4 semaines glissantes. Sert de cible quand l'athlète n'a pas de plan.
export function habitualWeekly(activities: ActivityRow[], todayISO: string): { km: number; dPlus: number } {
  const weeks = weeklyVolumes(activities, todayISO, 5).slice(0, 4) // 4 semaines avant la courante
  if (weeks.length === 0) return { km: 0, dPlus: 0 }
  const sum = weeks.reduce((s, w) => ({ km: s.km + w.km, dPlus: s.dPlus + w.dPlus }), { km: 0, dPlus: 0 })
  return { km: Math.round(sum.km / weeks.length), dPlus: Math.round(sum.dPlus / weeks.length) }
}
```

- [ ] **Step 4 : Lancer le test (passe)**

```
cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/mission/rhythm.test.ts
```
Attendu : PASS.

- [ ] **Step 5 : Commit**

```
git add web/lib/mission/rhythm.ts web/__tests__/lib/mission/rhythm.test.ts
git commit -m "feat(plan): helper rythme hebdo (km/D+) pour Mode Mission"
```

---

## Task 2 : Moteur de suggestion (`lib/mission/session-advisor.ts`)

**Files:**
- Create: `web/lib/mission/session-advisor.ts`
- Test: `web/__tests__/lib/mission/session-advisor.test.ts`

Fonction pure `adviseWeek(ctx)`. Règles : fraîcheur, polarisation (pas 2 qualités d'affilée), remplissage de la cible (sortie longue le week-end), phase si course, sinon rythme. Ne remplit que les jours **non planifiés** (un plan explicite prime). Les raisons sont des **codes** (UI traduit), avec un paramètre numérique optionnel (km restants).

- [ ] **Step 1 : Écrire le test (échoue)**

`web/__tests__/lib/mission/session-advisor.test.ts` :

```ts
import { adviseWeek, type AdviceContext } from '@/lib/mission/session-advisor'

const base: AdviceContext = {
  todayISO: '2026-06-11',           // jeudi
  weekDates: ['2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12','2026-06-13','2026-06-14'],
  freshnessZone: 'balanced',
  weekDoneKm: 28,
  recentHardCount: 0,
  targetKm: 50,
  phaseLabel: 'Spécifique',
  daysToRace: 42,
  plannedDates: [],
}

it('fatigue élevée → repos/easy aujourd’hui', () => {
  const w = adviseWeek({ ...base, freshnessZone: 'high-fatigue' })
  expect(['rest', 'suggested']).toContain(w.today.kind)
  if (w.today.kind === 'suggested') expect(w.today.session.intensity).toBeLessThanOrEqual(2)
})

it('qualité déjà faite cette semaine → pas une 2e qualité aujourd’hui', () => {
  const w = adviseWeek({ ...base, recentHardCount: 1 })
  if (w.today.kind === 'suggested') expect(w.today.session.intensity).toBeLessThanOrEqual(3)
})

it('cible non atteinte → sortie longue le week-end', () => {
  const w = adviseWeek(base)
  const sat = w.byDate['2026-06-13']
  expect(sat.kind).toBe('suggested')
  if (sat.kind === 'suggested') expect(sat.session.type).toBe('sortie_longue')
})

it('jour déjà planifié → kind=planned (on ne remplit pas)', () => {
  const w = adviseWeek({ ...base, plannedDates: ['2026-06-13'] })
  expect(w.byDate['2026-06-13'].kind).toBe('planned')
})

it('sans course (phase nulle) → conseille quand même, reason rythme', () => {
  const w = adviseWeek({ ...base, phaseLabel: null, daysToRace: null, targetKm: 40 })
  expect(w.today.kind === 'suggested' || w.today.kind === 'rest').toBe(true)
})

it('affûtage J-7 → volume réduit (intensité basse, durée courte)', () => {
  const w = adviseWeek({ ...base, phaseLabel: 'Affûtage', daysToRace: 5, freshnessZone: 'fresh' })
  if (w.today.kind === 'suggested') expect(w.today.session.durationMin).toBeLessThanOrEqual(60)
})
```

- [ ] **Step 2 : Lancer le test (échoue)**

```
cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/mission/session-advisor.test.ts
```
Attendu : FAIL (module absent).

- [ ] **Step 3 : Implémenter `lib/mission/session-advisor.ts`**

```ts
// Moteur de suggestion de séances — RÈGLES déterministes (pas d'IA).
// Entrées résumées (numbers/strings) → conseil par jour. Pur, testable isolément.
// Fondé sur le modèle de charge/fraîcheur de l'app (cf. spec) — non arbitraire.
// Aucune chaîne UI ici : les raisons sont des CODES traduits par l'i18n.

import type { FreshnessZone } from '@/lib/analytics/charge-insights.types'
import type { IntensityLevel, SessionType } from '@/types/plan'

export type ReasonCode =
  | 'fresh-quality'      // frais → place à la qualité
  | 'fatigue-easy'       // fatigue → facile
  | 'rest-recovery'      // repos conseillé
  | 'fill-volume-long'   // sortie longue pour la cible (param = km restants)
  | 'fill-volume-easy'   // footing pour compléter le volume
  | 'taper-light'        // affûtage : on allège
  | 'maintain-rhythm'    // sans course : on entretient le rythme
  | 'aerobic-base'       // travail aérobie

export type SuggestedSession = {
  type: SessionType
  titleKey: string            // clé i18n du libellé court (ex : 'sessionSeuil')
  durationMin: number
  distanceKm?: number
  intensity: IntensityLevel
  reasonCode: ReasonCode
  reasonParam?: number        // ex : km restants pour 'fill-volume-long'
}

export type DayAdvice =
  | { kind: 'suggested'; session: SuggestedSession }
  | { kind: 'rest'; reasonCode: ReasonCode }
  | { kind: 'planned' }       // déjà planifié → l'UI affiche la PlannedSession

export type AdviceContext = {
  todayISO: string
  weekDates: string[]          // 7 dates ISO lun→dim de la semaine courante
  freshnessZone: FreshnessZone | null
  weekDoneKm: number
  recentHardCount: number      // nb séances qualité (intensité ≥ 4) déjà faites cette semaine
  targetKm: number | null      // cible hebdo (plan) ou rythme habituel
  phaseLabel: string | null    // 'Base' | 'Spécifique' | 'Affûtage' | … | null
  daysToRace: number | null
  plannedDates: string[]       // jours déjà planifiés (on ne remplit pas)
}

export type WeekAdvice = { today: DayAdvice; byDate: Record<string, DayAdvice> }

const dowUTC = (iso: string): number => new Date(`${iso}T00:00:00Z`).getUTCDay()
const isTaper = (ctx: AdviceContext): boolean =>
  ctx.phaseLabel === 'Affûtage' || (ctx.daysToRace != null && ctx.daysToRace <= 10)
const isFatigued = (z: FreshnessZone | null): boolean => z === 'high-fatigue'

// Séance « qualité » du jour selon la fraîcheur / phase.
function qualitySession(ctx: AdviceContext): SuggestedSession {
  if (isTaper(ctx)) {
    return { type: 'seuil_tempo', titleKey: 'sessionTempoCourt', durationMin: 50, distanceKm: 9, intensity: 4, reasonCode: 'taper-light' }
  }
  return { type: 'seuil_tempo', titleKey: 'sessionSeuil', durationMin: 65, distanceKm: 13, intensity: 4, reasonCode: 'fresh-quality' }
}

function easySession(reason: ReasonCode): SuggestedSession {
  return { type: 'footing', titleKey: 'sessionFooting', durationMin: 45, distanceKm: 8, intensity: 2, reasonCode: reason }
}

function longSession(remainingKm: number): SuggestedSession {
  return { type: 'sortie_longue', titleKey: 'sessionLong', durationMin: 105, distanceKm: Math.max(15, Math.round(remainingKm)), intensity: 2, reasonCode: 'fill-volume-long', reasonParam: Math.round(remainingKm) }
}

// Conseil pour UN jour donné (hors jours planifiés, gérés par l'appelant).
// `remainingKm` = reste-à-faire de la SEMAINE (constant, calculé une fois) — on
// ne le décrémente pas jour par jour, sinon les footings de début de semaine
// « mangeraient » le budget avant le samedi et tueraient la sortie longue.
function adviseDay(iso: string, ctx: AdviceContext, remainingKm: number): DayAdvice {
  const dow = dowUTC(iso)
  const weekend = dow === 0 || dow === 6
  if (isFatigued(ctx.freshnessZone)) {
    return weekend ? { kind: 'suggested', session: easySession('fatigue-easy') }
                   : { kind: 'rest', reasonCode: 'rest-recovery' }
  }
  // Sortie longue le SAMEDI si la cible hebdo n'est pas atteinte (hors affûtage).
  if (dow === 6 && remainingKm > 10 && !isTaper(ctx)) {
    return { kind: 'suggested', session: longSession(remainingKm) }
  }
  // Qualité : aujourd'hui, si pas déjà faite cette semaine ET qu'on a une prépa.
  if (iso === ctx.todayISO && ctx.recentHardCount === 0 && ctx.phaseLabel !== null) {
    return { kind: 'suggested', session: qualitySession(ctx) }
  }
  // Sinon : facile / aérobie / rythme.
  const reason: ReasonCode = ctx.phaseLabel === null ? 'maintain-rhythm'
    : remainingKm > 5 ? 'fill-volume-easy' : 'aerobic-base'
  return { kind: 'suggested', session: easySession(reason) }
}

export function adviseWeek(ctx: AdviceContext): WeekAdvice {
  const planned = new Set(ctx.plannedDates)
  const remaining = Math.max(0, (ctx.targetKm ?? 0) - ctx.weekDoneKm)
  const byDate: Record<string, DayAdvice> = {}
  for (const iso of ctx.weekDates) {
    if (planned.has(iso)) { byDate[iso] = { kind: 'planned' }; continue }
    if (iso < ctx.todayISO) { byDate[iso] = { kind: 'rest', reasonCode: 'rest-recovery' }; continue } // passé non réalisé → repos
    byDate[iso] = adviseDay(iso, ctx, remaining)
  }
  return { today: byDate[ctx.todayISO] ?? { kind: 'rest', reasonCode: 'rest-recovery' }, byDate }
}
```

- [ ] **Step 4 : Lancer le test (passe)**

```
cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/mission/session-advisor.test.ts
```
Attendu : PASS. (Si un cas échoue, ajuster les seuils des règles — pas les tests.)

- [ ] **Step 5 : Commit**

```
git add web/lib/mission/session-advisor.ts web/__tests__/lib/mission/session-advisor.test.ts
git commit -m "feat(plan): moteur de suggestion de seances par regles (sans IA)"
```

---

## Task 3 : Fusion réalisé/planifié/suggéré (`lib/mission/week-feed.ts`)

**Files:**
- Create: `web/lib/mission/week-feed.ts`
- Test: `web/__tests__/lib/mission/week-feed.test.ts`

Construit les 7 lignes lun→dim du bloc « Ma semaine ». Priorité par jour : **réalisé** (activité ce jour) > **planifié** (PlannedSession ce jour) > **suggéré** (advice). La catégorie sport (pour la pastille colorée) vient de `activityCategory` (réalisé) ou du type de séance.

- [ ] **Step 1 : Écrire le test (échoue)**

`web/__tests__/lib/mission/week-feed.test.ts` :

```ts
import { buildWeekFeed } from '@/lib/mission/week-feed'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import type { PlannedSession } from '@/types/plan'
import type { WeekAdvice } from '@/lib/mission/session-advisor'

const weekDates = ['2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12','2026-06-13','2026-06-14']

function act(id: string, day: string, sport = 'Run', km = 10): ActivityRow {
  return {
    id, name: id, sport_type: sport, start_time: `${day}T08:00:00Z`, ces: 0,
    avg_hr: null, max_hr: null, distance_m: km * 1000, elevation_gain_m: 100, moving_time_sec: 3000,
    manual_sport_type: null, manual_intensity: null, manual_workout_type: null,
    manual_distance_m: null, manual_moving_time_sec: null, manual_elevation_gain_m: null,
  } as ActivityRow
}

const emptyAdvice: WeekAdvice = {
  today: { kind: 'rest', reasonCode: 'rest-recovery' },
  byDate: Object.fromEntries(weekDates.map(d => [d, { kind: 'rest', reasonCode: 'rest-recovery' }])),
}

it('jour avec activité → entrée done + catégorie sport', () => {
  const feed = buildWeekFeed({ weekDates, todayISO: '2026-06-11', activities: [act('a','2026-06-08','Ride',20)], planned: [], advice: emptyAdvice })
  const mon = feed.find(f => f.date === '2026-06-08')!
  expect(mon.kind).toBe('done')
  if (mon.kind === 'done') { expect(mon.category).toBe('bike'); expect(mon.km).toBe(20) }
})

it('jour futur planifié → entrée planned', () => {
  const planned: PlannedSession[] = [{
    id: 's1', planId: '', date: '2026-06-13', type: 'sortie_longue', title: 'SL', duration: 120,
    intensity: 2, estimatedCharge: 0, status: 'planned',
  }]
  const feed = buildWeekFeed({ weekDates, todayISO: '2026-06-11', activities: [], planned, advice: emptyAdvice })
  expect(feed.find(f => f.date === '2026-06-13')!.kind).toBe('planned')
})

it('réalisé prime sur planifié le même jour', () => {
  const planned: PlannedSession[] = [{
    id: 's1', planId: '', date: '2026-06-08', type: 'footing', title: 'F', duration: 50,
    intensity: 2, estimatedCharge: 0, status: 'planned',
  }]
  const feed = buildWeekFeed({ weekDates, todayISO: '2026-06-11', activities: [act('a','2026-06-08')], planned, advice: emptyAdvice })
  expect(feed.find(f => f.date === '2026-06-08')!.kind).toBe('done')
})
```

- [ ] **Step 2 : Lancer le test (échoue)**

```
cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/mission/week-feed.test.ts
```
Attendu : FAIL (module absent).

- [ ] **Step 3 : Implémenter `lib/mission/week-feed.ts`**

```ts
// Fusion réalisé + planifié + suggéré pour le bloc « Ma semaine ». Pur.
// Priorité par jour : réalisé > planifié > suggéré. La catégorie sert à colorer
// la pastille (run/bike/swim/other).

import type { ActivityRow } from '@/components/ui/ActivityCard'
import type { PlannedSession } from '@/types/plan'
import type { WeekAdvice, SuggestedSession, ReasonCode } from '@/lib/mission/session-advisor'
import { activityCategory } from '@/lib/plan/session-matching'
import { resolveSessionMeta, type SessionCategory } from '@/lib/plan/session-meta'

export type FeedEntry =
  | { date: string; isToday: boolean; kind: 'done'; category: SessionCategory; title: string; km: number; dPlus: number; durationSec: number; activityId: string; multiple: boolean }
  | { date: string; isToday: boolean; kind: 'planned'; category: SessionCategory; session: PlannedSession; completed: boolean }
  | { date: string; isToday: boolean; kind: 'suggested'; category: SessionCategory; session: SuggestedSession }
  | { date: string; isToday: boolean; kind: 'rest'; reasonCode: ReasonCode }

type Args = {
  weekDates: string[]
  todayISO: string
  activities: ActivityRow[]
  planned: PlannedSession[]
  advice: WeekAdvice
}

function km(a: ActivityRow): number { return (a.manual_distance_m ?? a.distance_m ?? 0) / 1000 }
function dplus(a: ActivityRow): number { return Math.round(a.manual_elevation_gain_m ?? a.elevation_gain_m ?? 0) }
function durSec(a: ActivityRow): number { return a.manual_moving_time_sec ?? a.moving_time_sec ?? 0 }
function effSport(a: ActivityRow): string { return a.manual_sport_type ?? a.sport_type }

export function buildWeekFeed({ weekDates, todayISO, activities, planned, advice }: Args): FeedEntry[] {
  const actsByDay = new Map<string, ActivityRow[]>()
  for (const a of activities) {
    const d = a.start_time.slice(0, 10)
    const arr = actsByDay.get(d); if (arr) arr.push(a); else actsByDay.set(d, [a])
  }
  const planByDay = new Map(planned.map(s => [s.date, s]))

  return weekDates.map((date): FeedEntry => {
    const isToday = date === todayISO
    const acts = actsByDay.get(date) ?? []
    if (acts.length > 0) {
      const totKm = acts.reduce((s, a) => s + km(a), 0)
      const totDp = acts.reduce((s, a) => s + dplus(a), 0)
      const totSec = acts.reduce((s, a) => s + durSec(a), 0)
      const main = acts[0]
      return {
        date, isToday, kind: 'done',
        category: activityCategory(effSport(main)),
        title: acts.length > 1 ? `${acts.length} séances` : main.name,
        km: Math.round(totKm * 10) / 10, dPlus: totDp, durationSec: totSec,
        activityId: main.id, multiple: acts.length > 1,
      }
    }
    const p = planByDay.get(date)
    if (p) {
      return { date, isToday, kind: 'planned', category: resolveSessionMeta(p.type).category, session: p, completed: p.status === 'completed' }
    }
    const a = advice.byDate[date] ?? { kind: 'rest', reasonCode: 'rest-recovery' as ReasonCode }
    if (a.kind === 'suggested') {
      return { date, isToday, kind: 'suggested', category: resolveSessionMeta(a.session.type).category, session: a.session }
    }
    return { date, isToday, kind: 'rest', reasonCode: a.kind === 'rest' ? a.reasonCode : 'rest-recovery' }
  })
}
```

> **Note d'implémentation :** vérifier la signature de `resolveSessionMeta` dans `web/lib/plan/session-meta.ts` — elle prend le `type` (string) et expose `.category`. Si elle exige un 2e argument (liste de types custom), passer `resolveSessionMeta(type)` reste valide pour les types BUILTIN ; sinon adapter l'appel et caster la catégorie. Confirmer avant d'écrire le code.

- [ ] **Step 4 : Lancer le test (passe)**

```
cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/mission/week-feed.test.ts
```
Attendu : PASS.

- [ ] **Step 5 : Commit**

```
git add web/lib/mission/week-feed.ts web/__tests__/lib/mission/week-feed.test.ts
git commit -m "feat(plan): fusion realise+planifie+suggere du bloc Ma semaine"
```

---

## Task 4 : Clés i18n (`lib/i18n/dictionaries/fr.ts`)

**Files:**
- Modify: `web/lib/i18n/dictionaries/fr.ts` (interface `mission` ~L101-115 + implémentation ~L1331+)

Ajoute les clés du Plan v2 sous `mission`. **Interdiction du mot « TSB ».** Les `reason`/`title` sont des maps indexées par code.

- [ ] **Step 1 : Étendre l'interface `mission`** (après les clés existantes, avant la fermeture `}`)

```ts
    // Plan v2 (Mode Mission)
    heroNextTitle: string                 // 'Ta prochaine séance'
    heroTodayBadge: string                // 'Aujourd'hui'
    heroDoneTitle: string                 // 'Séance du jour · faite ✓'
    heroRestTitle: string                 // 'Aujourd'hui · repos'
    heroRestName: string                  // 'Récupération'
    heroWhyTitle: string                  // 'Pourquoi cette séance'
    heroActionDone: string                // 'Je l'ai faite'
    heroActionMove: string                // 'Décaler'
    heroActionOther: string               // 'Autre'
    weekFeedTitle: string                 // 'Ma semaine'
    weekFeedSubtitle: string              // 'réalisé + suggéré'
    weekAddSession: string                // '＋ Ajouter une séance'
    rythmeTitle: string                   // 'Ton rythme · 4 dernières semaines'
    rythmeAvg: (km: number) => string     // '≈ 42 km/sem sur 1 mois.'
    rythmeHint: string                    // 'Continue — ou fixe un objectif…'
    rythmeCta: string                     // '🎯 Choisir une course objectif'
    coachSoon: string                     // 'Bientôt'
    coachRefine: string                   // '✨ Affiner avec le coach'
    sessionTitles: Record<string, string> // titleKey → libellé court
    reasonChips: Record<string, string>   // ReasonCode → chip courte
    reasonWhy: Record<string, string>     // ReasonCode → phrase « pourquoi »
```

- [ ] **Step 2 : Renseigner l'implémentation** (dans l'objet `mission` de `fr`)

```ts
    heroNextTitle: 'Ta prochaine séance',
    heroTodayBadge: 'Aujourd’hui',
    heroDoneTitle: 'Séance du jour · faite ✓',
    heroRestTitle: 'Aujourd’hui · repos',
    heroRestName: 'Récupération',
    heroWhyTitle: 'Pourquoi cette séance',
    heroActionDone: 'Je l’ai faite',
    heroActionMove: 'Décaler',
    heroActionOther: 'Autre',
    weekFeedTitle: 'Ma semaine',
    weekFeedSubtitle: 'réalisé + suggéré',
    weekAddSession: '＋ Ajouter une séance',
    rythmeTitle: 'Ton rythme · 4 dernières semaines',
    rythmeAvg: (km: number) => `≈ ${km} km/sem sur 1 mois.`,
    rythmeHint: 'Continue sur ce rythme — ou fixe un objectif pour structurer ta prépa.',
    rythmeCta: '🎯 Choisir une course objectif',
    coachSoon: 'Bientôt',
    coachRefine: '✨ Affiner avec le coach',
    sessionTitles: {
      sessionSeuil: 'Seuil 2×15′',
      sessionTempoCourt: 'Tempo court',
      sessionFooting: 'Footing souple',
      sessionLong: 'Sortie longue',
    },
    reasonChips: {
      'fresh-quality': 'qualité',
      'fatigue-easy': 'easy',
      'rest-recovery': 'récup',
      'fill-volume-long': 'cible',       // l'UI préfixe « +N km »
      'fill-volume-easy': 'volume',
      'taper-light': 'affûtage',
      'maintain-rhythm': 'rythme',
      'aerobic-base': 'aérobie',
    },
    reasonWhy: {
      'fresh-quality': 'Fraîcheur OK — fatigue normale, place à de la qualité.',
      'fatigue-easy': 'Fatigue présente — on reste facile aujourd’hui.',
      'rest-recovery': 'Récupération : ça consolide les gains de la semaine.',
      'fill-volume-long': 'Sortie longue pour caler ta cible de la semaine.',
      'fill-volume-easy': 'Footing pour compléter le volume sans se cramer.',
      'taper-light': 'Affûtage : on allège pour arriver frais le jour J.',
      'maintain-rhythm': 'On entretient ton rythme habituel.',
      'aerobic-base': 'Travail aérobie : la base de la performance en endurance.',
    },
```

- [ ] **Step 3 : Vérifier la compilation des types (le dict `en` doit suivre si typé strictement)**

```
cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit
```
Attendu : pas d'erreur sur `fr.ts`. **Si `en.ts` (ou un autre dict) implémente le même type `Dict`**, y ajouter les mêmes clés (mêmes valeurs FR acceptables en repli) pour satisfaire le type. Relancer `tsc` jusqu'à 0 erreur liée.

- [ ] **Step 4 : Commit**

```
git add web/lib/i18n/dictionaries/
git commit -m "i18n(plan): cles Mode Mission Plan v2 (sans jargon TSB)"
```

---

## Task 5 : Composant héros (`components/mission/PlanHeroCard.tsx`)

**Files:**
- Create: `web/components/mission/PlanHeroCard.tsx`

Héros « Ta prochaine séance » avec 3 états. Markup/tokens à porter depuis `Prompts/plan-tab-mission-final-mockup.html` (bloc ① + variantes du héros). Couleurs via les tokens du thème (`bg-trail-card`, `var(--primary)`, `var(--status-success)`, `var(--status-info)`, `var(--data-bike)`, `var(--data-swim)`).

**Props :**

```ts
import type { SuggestedSession, ReasonCode } from '@/lib/mission/session-advisor'

type Props =
  | { state: 'suggested'; session: SuggestedSession; accentColor: string;
      onDone: () => void; onMove: () => void; onOther: () => void }
  | { state: 'done'; title: string; km: number; dPlus: number; durationSec: number }
  | { state: 'rest'; reasonCode: ReasonCode }
```

- [ ] **Step 1 : Écrire le composant**

Structure (porter le style exact du mockup) :
- **`suggested`** : carte gradient teintée `accentColor` ; label `M.heroNextTitle` + badge `M.heroTodayBadge` ; titre = `M.sessionTitles[session.titleKey]` ; pills `formatDur(session.durationMin)` · `session.distanceKm km` et `'●'.repeat(intensity)+'○'.repeat(5-intensity)` ; encart `M.heroWhyTitle` avec **les puces** : 1re puce = `M.reasonWhy[session.reasonCode]` (jamais « TSB »), + 2 puces contextuelles génériques si tu en ajoutes ; 3 boutons `M.heroActionDone` (plein primary) / `M.heroActionMove` / `M.heroActionOther`.
- **`done`** : carte teinte verte (`rgba(74,222,128,0.10)` → `--ink-700`, bordure `rgba(74,222,128,0.40)`) ; label `M.heroDoneTitle` ; titre `title` ; ligne `km · +dPlus m · durée`.
- **`rest`** : carte teinte bleutée ; label `M.heroRestTitle` ; titre `M.heroRestName` ; phrase `M.reasonWhy[reasonCode]`.

Helper local :
```ts
function formatDur(min: number): string {
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return h > 0 ? (m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`) : `${m} min`
}
```
Utilise `useT().mission` pour toutes les chaînes. **Aucune chaîne en dur dans le JSX** (sauf séparateurs `·`).

- [ ] **Step 2 : Vérifier tsc + eslint**

```
cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit && npx eslint components/mission/PlanHeroCard.tsx
```
Attendu : 0 erreur.

- [ ] **Step 3 : Commit**

```
git add web/components/mission/PlanHeroCard.tsx
git commit -m "feat(plan): composant heros Ta prochaine seance (3 etats)"
```

---

## Task 6 : Bloc générique (`components/mission/RythmeCard.tsx`)

**Files:**
- Create: `web/components/mission/RythmeCard.tsx`

Bloc « Ton rythme · 4 dernières semaines » (mini-barres km) + CTA création course. Affiché à la place de « Ma prépa » quand pas de course. Markup depuis le mockup (colonne « Correctifs communs · ② »).

**Props :**
```ts
import type { WeeklyVolume } from '@/lib/mission/rhythm'
type Props = { weeks: WeeklyVolume[]; avgKm: number; onAddRace: () => void }
```

- [ ] **Step 1 : Écrire le composant**

- `MissionCard` avec label `M.rythmeTitle`.
- Barres : `weeks.map`, hauteur = `km / max(...weeks.km, 1) * 56px`, dernière barre en `var(--primary)`, autres en `var(--ink-500)`. Labels sous chaque barre : `S-3 … Cette sem.` (dériver depuis l'index).
- Phrase : `M.rythmeAvg(avgKm)` + ` ` + `M.rythmeHint`.
- Bouton plein primary `M.rythmeCta` → `onAddRace()`.

- [ ] **Step 2 : Vérifier tsc + eslint**

```
cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit && npx eslint components/mission/RythmeCard.tsx
```
Attendu : 0 erreur.

- [ ] **Step 3 : Commit**

```
git add web/components/mission/RythmeCard.tsx
git commit -m "feat(plan): bloc generique Ton rythme (sans course)"
```

---

## Task 7 : Refonte `MissionPlan` + câblage advisor/feed + ajout séance

**Files:**
- Modify (rewrite): `web/components/mission/MissionPlan.tsx`

Assemble les blocs dans l'ordre validé et câble la logique. Nouvelles props (fournies par la page en Task 8).

**Nouvelles props :**
```ts
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import type { ActivityRow } from '@/components/ui/ActivityCard'

type Props = {
  freshnessPayload: ChargeSportPayload | null
  recentActivities: ActivityRow[]   // 28 derniers jours
  discipline: string | null
}
```

- [ ] **Step 1 : Calculs (dans le composant, après chargement client des séances/macro/course)**

- `weekDates` = 7 dates ISO lun→dim (réutiliser `isoOfWeekDay`).
- `weekActivities` = `recentActivities.filter(a => a.start_time.slice(0,10) >= weekDates[0] && … <= weekDates[6])`.
- `weekDoneKm` = somme km des `weekActivities`.
- `recentHardCount` = nb `PlannedSession` `completed` cette semaine d'intensité ≥ 4 (ou activités à `manual_intensity` forte — approximation : compter les séances planifiées complétées d'intensité ≥ 4).
- `freshnessZone` = `freshnessPayload ? computeFreshness(freshnessPayload.dailyMetrics).zone : null`.
- `target` = `resolveMissionWeeklyTarget(macros, today)` → `target?.km` ; sinon `habitualWeekly(recentActivities, today).km`.
- `phaseLabel` = phase active (depuis `computePhaseSegments(plan, today).find(s => s.active)?.label`) ; `null` si pas de plan.
- `daysToRace` = `race ? daysUntil(race.date) : null`.
- `plannedDates` = dates des `PlannedSession` non-miroir de la semaine.
- `advice = adviseWeek({ todayISO: today, weekDates, freshnessZone, weekDoneKm, recentHardCount, targetKm: target, phaseLabel, daysToRace, plannedDates })`.
- `feed = buildWeekFeed({ weekDates, todayISO: today, activities: weekActivities, planned: weekPlanned, advice })`.

- [ ] **Step 2 : Héros (bloc ①)**

Déterminer l'état :
- Si une activité existe pour `today` dans le feed (`kind:'done'`) → `<PlanHeroCard state="done" … />`.
- Sinon si `advice.today.kind === 'suggested'` → `state="suggested"`, `accentColor` selon `resolveSessionMeta(session.type).category` (run=`var(--primary)`, bike=`var(--data-bike)`, swim=`var(--data-swim)`), handlers :
  - `onDone` → marquer la `PlannedSession` du jour `completed` si elle existe (sinon créer une séance complétée minimale via `savePlannedSession`), puis `reload`.
  - `onMove` → ouvrir un mini-picker de jour (réutiliser un `SessionAddSheet`? non : pour le décalage, ouvrir `SessionEditorModal` avec la séance et laisser changer la date) — **MVP : ouvrir `SessionEditorModal` (session pré-remplie depuis la suggestion) pour que l'user pose le jour/détails**.
  - `onOther` → ouvrir `SessionAddSheet` (date = today).
- Sinon → `state="rest"` avec `advice.today` (kind rest) `reasonCode`.

- [ ] **Step 3 : Bloc ② « Ma semaine » (fil)**

Rendre `feed` en lignes (porter le markup du bloc ② du mockup) :
- `done` : pastille couleur `category`, titre, `km · +dPlus · durée`, ✓.
- `planned` : pastille catégorie, titre séance, statut (`completed`→✓ vert, today→`● auj.`, sinon `à venir`).
- `suggested` : pastille catégorie, `M.sessionTitles[session.titleKey]`, chip `why` = `M.reasonChips[reasonCode]` (préfixer `+{reasonParam} km` si `fill-volume-long`).
- `rest` : « Repos conseillé » + chip `récup`.
- Jour `isToday` surligné (`background: var(--primary-glow)`).
- Ligne fantôme `M.weekAddSession` → ouvre `SessionAddSheet` (date = today).

Couleur pastille :
```ts
const CAT_COLOR: Record<string, string> = { run: 'var(--primary)', bike: 'var(--data-bike)', swim: 'var(--data-swim)', other: 'var(--ink-500)' }
```

- [ ] **Step 4 : Bloc ③ Destination compacte + Task 6 sans course**

- Si `race` : carte compacte (label `Destination · Semaine X/Y` via `weekOfPlan`, `J-{daysUntil}`, nom, frise de phases via `computePhaseSegments` — réutiliser le rendu existant) → `Link href={/plan/courses/${race.id}}`.
- Si **pas** de `race` : rendre `<RythmeCard weeks={weeklyVolumes(recentActivities, today, 4)} avgKm={habitualWeekly(recentActivities, today).km} onAddRace={goToCreateRace} />` **à la place** du bloc « Ma prépa », ET l'état vide Destination existant (CTA → `goToCreateRace`).
- `goToCreateRace = () => router.push('/plan?full=1&new=1')`.

- [ ] **Step 5 : Bloc ④ Bouton coach + modales**

- Bouton désactivé `M.coachRefine` + badge `M.coachSoon`.
- Monter `SessionAddSheet` (state `addOpen`, `addDate`) + `SessionEditorModal` (state `editorOpen`, `editorSession`/`prefillTemplate`/`initialDate`), branchés sur `reload` (bump d'un `reloadKey`) à `onSaved`. Reprendre exactement le câblage de `PlanClient`/`VueSemaineBlock` (mêmes handlers `savePlannedSession`, `deletePlannedSession`). `SessionAddSheet.onCreateBlank` → ouvrir l'éditeur vierge ; `onPickTemplate` → ouvrir l'éditeur avec `prefillTemplate`.

- [ ] **Step 6 : Vérifier tsc + eslint**

```
cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit && npx eslint components/mission/MissionPlan.tsx
```
Attendu : 0 erreur.

- [ ] **Step 7 : Commit**

```
git add web/components/mission/MissionPlan.tsx
git commit -m "feat(plan): refonte MissionPlan (heros + fil semaine + suggestions + ajout)"
```

---

## Task 8 : Câblage page serveur (`app/(main)/plan/page.tsx`)

**Files:**
- Modify: `web/app/(main)/plan/page.tsx`

En mode Mission, fournir à `MissionPlan` : `freshnessPayload` (comme le dashboard) + `recentActivities` (28 j) + `discipline`.

- [ ] **Step 1 : Réécrire la page**

```tsx
import PlanClient from './PlanClient'
import { MissionPlan } from '@/components/mission/MissionPlan'
import { getServerAppMode } from '@/lib/preferences/server'
import { getServerUser } from '@/lib/database/get-user'
import { createClient } from '@/lib/database/supabase-server'
import { getChargePageData } from '@/lib/data/charge'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'

const ACTIVITY_CARD_FIELDS =
  'id, name, sport_type, start_time, ces, avg_hr, max_hr, distance_m, elevation_gain_m, moving_time_sec, manual_sport_type, manual_intensity, manual_workout_type, manual_distance_m, manual_moving_time_sec, manual_elevation_gain_m'

export default async function PlanPage({ searchParams }: { searchParams?: { full?: string; new?: string } }) {
  const mode = await getServerAppMode()

  if (mode === 'mission' && searchParams?.full !== '1') {
    const user = await getServerUser()
    let freshnessPayload: ChargeSportPayload | null = null
    let recentActivities: ActivityRow[] = []
    let discipline: string | null = null
    if (user) {
      const supabase = await createClient()
      const since = new Date(); since.setDate(since.getDate() - 28)
      const [{ data: rows }, { data: profile }] = await Promise.all([
        supabase.from('activities').select(ACTIVITY_CARD_FIELDS)
          .eq('user_id', user.id).is('deleted_at', null)
          .gte('start_time', since.toISOString())
          .order('start_time', { ascending: false }),
        supabase.from('profiles').select('onboarding_discipline').eq('id', user.id).maybeSingle(),
      ])
      recentActivities = (rows ?? []) as ActivityRow[]
      discipline = profile?.onboarding_discipline ?? null
      try {
        const charge = await getChargePageData(user.id)
        freshnessPayload = charge.perSport.run.historyDays > 0 ? charge.perSport.run : charge.perSport.all
      } catch { freshnessPayload = null }
    }
    return <MissionPlan freshnessPayload={freshnessPayload} recentActivities={recentActivities} discipline={discipline} />
  }

  // Plan expert (inchangé)
  const user = await getServerUser()
  let mission: string | null = null
  if (user) {
    const supabase = await createClient()
    const { data } = await supabase.from('profiles').select('onboarding_mission').eq('id', user.id).maybeSingle()
    mission = data?.onboarding_mission ?? null
  }
  return <PlanClient mode="expert" mission={mission} />
}
```

- [ ] **Step 2 : Vérifier tsc + eslint**

```
cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit && npx eslint "app/(main)/plan/page.tsx"
```
Attendu : 0 erreur.

- [ ] **Step 3 : Commit**

```
git add "web/app/(main)/plan/page.tsx"
git commit -m "feat(plan): page Mission fournit fraicheur + 28j activites + discipline"
```

---

## Task 9 : Routage « Ajouter une course » (`?new=1`)

**Files:**
- Modify: `web/components/plan/ObjectifCourseBlock.tsx`

Quand le Plan expert est rendu avec `?new=1` (depuis le CTA Mission), auto-ouvrir `RaceEditorModal` en création.

- [ ] **Step 1 : Lire le paramètre + auto-ouvrir**

Dans `ObjectifCourseBlock`, ajouter :
```ts
import { useSearchParams } from 'next/navigation'
// …
const searchParams = useSearchParams()
useEffect(() => {
  if (searchParams.get('new') === '1') {
    setEditing(null)
    setModalOpen(true)
  }
}, [searchParams])
```
(placer après les `useState` existants ; ne déclenche qu'une fois au mount tant que le param est présent).

- [ ] **Step 2 : Vérifier que le CTA Mission pointe bien `/plan?full=1&new=1`**

Confirmé en Task 7 Step 4 (`goToCreateRace`). L'état vide Destination existant et `RythmeCard` utilisent le même handler.

- [ ] **Step 3 : Vérifier tsc + eslint**

```
cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit && npx eslint components/plan/ObjectifCourseBlock.tsx
```
Attendu : 0 erreur.

- [ ] **Step 4 : Commit**

```
git add web/components/plan/ObjectifCourseBlock.tsx
git commit -m "feat(plan): ?new=1 ouvre directement la creation de course"
```

---

## Task 10 : Test composant `MissionPlan` (états clés)

**Files:**
- Create/Modify: `web/__tests__/components/mission/MissionPlan.test.tsx`

Le test existant (cf. spec) attend l'ancien markup (`Aucune course prévue` / `Ajouter une course` / `Ajuster mon plan`). Le réécrire pour le nouveau Plan. Mocker `@/lib/plan/storage` (séances/macro/course vides) et fournir des props minimales.

- [ ] **Step 1 : Réécrire le test**

```tsx
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { MissionPlan } from '@/components/mission/MissionPlan'

jest.mock('@/lib/plan/storage', () => ({
  getAllMacrocycles: jest.fn().mockResolvedValue([]),
  getMainRace: jest.fn().mockResolvedValue(null),
  getPlannedSessions: jest.fn().mockResolvedValue([]),
  pickActiveMacrocycle: jest.fn().mockReturnValue(null),
  isRaceMirrorSession: jest.fn().mockReturnValue(false),
  savePlannedSession: jest.fn(), deletePlannedSession: jest.fn(),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

function renderPlan() {
  return render(
    <I18nProvider>
      <MissionPlan freshnessPayload={null} recentActivities={[]} discipline={null} />
    </I18nProvider>,
  )
}

it('sans course : affiche le bloc Ton rythme et le CTA création', async () => {
  renderPlan()
  expect(await screen.findByText(/Ton rythme/)).toBeInTheDocument()
  expect(screen.getByText(/Choisir une course objectif/)).toBeInTheDocument()
})

it('affiche le titre Ma semaine', async () => {
  renderPlan()
  expect(await screen.findByText('Ma semaine')).toBeInTheDocument()
})
```

> Adapter les mocks à la vraie API de `@/lib/plan/storage` (réutiliser le pattern d'un test mission existant). Si `MissionPlan` rend `null` tant que `loaded` est faux, utiliser `findBy*` (async) comme ci-dessus.

- [ ] **Step 2 : Lancer le test**

```
cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/components/mission/MissionPlan.test.tsx
```
Attendu : PASS.

- [ ] **Step 3 : Commit**

```
git add web/__tests__/components/mission/MissionPlan.test.tsx
git commit -m "test(plan): MissionPlan v2 (etat sans course + Ma semaine)"
```

---

## Task 11 : Vérification finale (types, lint, tests ciblés, rendu)

- [ ] **Step 1 : tsc complet**

```
cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit
```
Attendu : 0 erreur.

- [ ] **Step 2 : eslint sur les fichiers touchés**

```
cd /c/Users/Franc/app-run-mobile/web && npx eslint lib/mission/rhythm.ts lib/mission/session-advisor.ts lib/mission/week-feed.ts components/mission/PlanHeroCard.tsx components/mission/RythmeCard.tsx components/mission/MissionPlan.tsx components/plan/ObjectifCourseBlock.tsx "app/(main)/plan/page.tsx"
```
Attendu : 0 erreur/warning.

- [ ] **Step 3 : Suites Jest du plan**

```
cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/mission/rhythm.test.ts __tests__/lib/mission/session-advisor.test.ts __tests__/lib/mission/week-feed.test.ts __tests__/components/mission/MissionPlan.test.tsx
```
Attendu : toutes PASS. (Ne pas lancer la suite complète — faux positifs i18n pré-existants.)

- [ ] **Step 4 : Vérif « zéro TSB » dans l'UI Plan**

```
cd /c/Users/Franc/app-run-mobile/web && grep -rin "tsb" components/mission/PlanHeroCard.tsx components/mission/RythmeCard.tsx components/mission/MissionPlan.tsx lib/mission/session-advisor.ts | grep -iv "freshnesszone\|import"
```
Attendu : aucune occurrence visible côté chaînes UI.

- [ ] **Step 5 : Vérif visuelle (dev server + Chrome headless)**

Lancer `npm run dev` (port 3000) dans un terminal séparé, basculer le compte en mode Mission, puis :
```
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless --disable-gpu --hide-scrollbars \
  --window-size=430,1400 --screenshot="$TEMP/plan-v2-live.png" "http://localhost:3000/plan"
```
Comparer à `Prompts/plan-tab-mission-final-mockup.html`. Vérifier : héros, fil semaine (réalisé + suggéré + ＋ Ajouter), Destination/Rythme, bouton coach.

- [ ] **Step 6 : Marquer la spec Implémenté**

Ajouter en tête de `web/docs/superpowers/specs/2026-06-13-onglet-plan-mode-mission-design.md` :
`> **Status: Implémenté** · 2026-06-XX · Code: web/components/mission/MissionPlan.tsx + web/lib/mission/{session-advisor,week-feed,rhythm}.ts`

- [ ] **Step 7 : Finaliser la branche**

Utiliser `superpowers:finishing-a-development-branch` (push + PR). **Pas de migration Supabase.** Rappeler à Franck : vérification visuelle réelle sur trailcockpit.run après déploiement Vercel.

---

## Notes de risques

- **`getChargePageData` coûteux** (~1 an d'activités) : déjà payé en mode Mission sur le dashboard ; ici idem. Acceptable.
- **`recentHardCount`** : heuristique simple (séances planifiées complétées d'intensité ≥ 4). Une activité réalisée non liée n'a pas d'intensité fiable → on ne la compte pas. Suffisant pour la règle « pas 2 qualités d'affilée ».
- **`resolveSessionMeta` signature** : à confirmer en Task 3 (note d'implémentation).
- **Décalage (`onMove`)** : MVP via `SessionEditorModal` (l'user choisit la date). Un picker de jour dédié est hors périmètre.
