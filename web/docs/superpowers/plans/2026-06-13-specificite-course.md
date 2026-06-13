# Spécificité course — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapter les séances suggérées au profil de la course objectif (distance + D+/km + allure cible) : type de qualité (VMA / seuil / côtes), D+ et taille des sorties longues, et séance « allure course » en phase spécifique — toujours en règles déterministes.

**Architecture:** Un module pur `race-profile.ts` dérive un `RaceProfile` de la `Race`. Le moteur `session-advisor.ts` reçoit ce profil dans son contexte et l'utilise pour choisir la séance de qualité du jour et dimensionner la sortie longue. `MissionPlan` calcule et injecte le profil. Le curseur « forme du jour » gère déjà ces séances (leviers répétitions / D+).

**Tech Stack:** TypeScript, Jest. Étend `web/lib/mission/session-advisor.ts`. Spec : `web/docs/superpowers/specs/2026-06-13-specificite-course-design.md`.

---

## Conventions de vérification

- **cwd Bash non fiable** : préfixer jest/npm par `cd /c/Users/Franc/app-run-mobile/web` ; `git` via `git -C /c/Users/Franc/app-run-mobile`.
- **Pas de `next build` local** — vérifier via `npx tsc --noEmit` (depuis `web/`) + `npx eslint`.
- **Jest** : ~50 échecs i18n PRÉ-EXISTANTS ; ne lancer que les fichiers cités.
- `IntensityLevel` & `SessionType` viennent de `@/types/plan`. `Race`/`RaceType` aussi.

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `web/lib/mission/race-profile.ts` | **nouveau** — `raceProfile(race)` pur → `RaceProfile` |
| `web/lib/mission/session-advisor.ts` | builders VMA/côtes/allure ; `selectQuality()` via profil/phase ; D+ SL via profil ; `AdviceContext += raceProfile` ; `ReasonCode += 3` |
| `web/components/mission/MissionPlan.tsx` | calcule `raceProfile(race)` et l'ajoute au contexte du moteur |
| `web/lib/i18n/dictionaries/{fr,en}.ts` | clés titres (`sessionVMA`/`sessionCotes`/`sessionRacePace`) + chips/why (`vma-speed`/`hill-work`/`race-pace`) |
| `web/__tests__/lib/mission/race-profile.test.ts` | **nouveau** |
| `web/__tests__/lib/mission/session-advisor.test.ts` | cas spécificité |

---

## Task 1 : Module `race-profile.ts`

**Files:**
- Create: `web/lib/mission/race-profile.ts`
- Test: `web/__tests__/lib/mission/race-profile.test.ts`

- [ ] **Step 1 : Écrire le test (échoue)**

`web/__tests__/lib/mission/race-profile.test.ts` :

```ts
import { raceProfile } from '@/lib/mission/race-profile'
import type { Race } from '@/types/plan'

function race(p: Partial<Race>): Race {
  return { id: 'r', name: 'R', date: '2026-09-01', distance: 0, elevation: 0, type: 'trail', isMain: true, priority: 'A', ...p } as Race
}

it('10 km route plat → court, VMA en tête', () => {
  const p = raceProfile(race({ distance: 10, elevation: 50, type: 'route' }))
  expect(p.relief).toBe('flat')
  expect(p.distanceClass).toBe('short')
  expect(p.qualityKinds[0]).toBe('fractionne')
  expect(p.longRunMaxMin).toBe(90)
})

it('marathon route → moyen, seuil en tête + allure cible calculée', () => {
  const p = raceProfile(race({ distance: 42, elevation: 200, type: 'route', targetDurationMin: 210 }))
  expect(p.relief).toBe('flat')
  expect(p.distanceClass).toBe('mid')
  expect(p.qualityKinds[0]).toBe('seuil_tempo')
  expect(p.goalPaceMinPerKm).toBeCloseTo(5, 1)
})

it('trail vallonné → côtes présentes', () => {
  const p = raceProfile(race({ distance: 30, elevation: 900, type: 'trail' }))
  expect(p.relief).toBe('rolling')
  expect(p.qualityKinds).toContain('cotes')
})

it('skyrace → montagne, côtes en tête, D+/km élevé', () => {
  const p = raceProfile(race({ distance: 25, elevation: 1800, type: 'skyrace' }))
  expect(p.relief).toBe('mountain')
  expect(p.qualityKinds[0]).toBe('cotes')
  expect(p.dPlusPerKm).toBeGreaterThan(40)
})

it('ultra montagne → distanceClass ultra, plafond SL élevé', () => {
  const p = raceProfile(race({ distance: 170, elevation: 10000, type: 'ultra' }))
  expect(p.distanceClass).toBe('ultra')
  expect(p.longRunMaxMin).toBe(240)
})

it('sans course → profil neutre', () => {
  const p = raceProfile(null)
  expect(p.qualityKinds).toEqual(['seuil_tempo'])
  expect(p.dPlusPerKm).toBe(20)
  expect(p.longRunMaxMin).toBe(120)
  expect(p.goalPaceMinPerKm).toBeNull()
})
```

- [ ] **Step 2 : Lancer (échoue : module absent)**

```
cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/mission/race-profile.test.ts
```

- [ ] **Step 3 : Implémenter `web/lib/mission/race-profile.ts`**

```ts
// Profil de la course objectif → leviers d'adaptation des séances. Pur.
import type { Race, SessionType } from '@/types/plan'

export type Relief = 'flat' | 'rolling' | 'mountain'
export type DistanceClass = 'short' | 'mid' | 'long' | 'ultra'

export type RaceProfile = {
  relief: Relief
  distanceClass: DistanceClass
  dPlusPerKm: number               // relief réel borné [0,80]
  goalPaceMinPerKm: number | null  // targetDurationMin / distance
  qualityKinds: SessionType[]      // types de qualité privilégiés (ordre = priorité)
  longRunMaxMin: number            // plafond durée sortie longue
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const LONG_MAX: Record<DistanceClass, number> = { short: 90, mid: 150, long: 210, ultra: 240 }

const NEUTRAL: RaceProfile = {
  relief: 'flat', distanceClass: 'mid', dPlusPerKm: 20, goalPaceMinPerKm: null,
  qualityKinds: ['seuil_tempo'], longRunMaxMin: 120,
}

function qualityKindsFor(relief: Relief, distanceClass: DistanceClass): SessionType[] {
  if (relief === 'mountain') return ['cotes', 'seuil_tempo']
  if (relief === 'rolling') return ['seuil_tempo', 'cotes']
  return distanceClass === 'short' ? ['fractionne', 'seuil_tempo'] : ['seuil_tempo', 'fractionne']
}

export function raceProfile(race: Race | null): RaceProfile {
  if (!race || !race.distance) return NEUTRAL
  const ratio = race.elevation / Math.max(1, race.distance)
  let relief: Relief = ratio < 15 ? 'flat' : ratio < 35 ? 'rolling' : 'mountain'
  if (race.type === 'skyrace' && relief !== 'mountain') relief = 'mountain'
  if (race.type === 'ultra' && relief === 'flat') relief = 'rolling'
  let distanceClass: DistanceClass =
    race.distance <= 15 ? 'short' : race.distance <= 42 ? 'mid' : race.distance <= 80 ? 'long' : 'ultra'
  if (race.type === 'ultra' && (distanceClass === 'short' || distanceClass === 'mid')) distanceClass = 'long'
  const goalPaceMinPerKm = race.targetDurationMin && race.targetDurationMin > 0
    ? race.targetDurationMin / race.distance
    : null
  return {
    relief, distanceClass,
    dPlusPerKm: clamp(Math.round(ratio), 0, 80),
    goalPaceMinPerKm,
    qualityKinds: qualityKindsFor(relief, distanceClass),
    longRunMaxMin: LONG_MAX[distanceClass],
  }
}
```

- [ ] **Step 4 : Lancer (passe)**

```
cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/mission/race-profile.test.ts
```

- [ ] **Step 5 : Commit**

```
git -C /c/Users/Franc/app-run-mobile add web/lib/mission/race-profile.ts web/__tests__/lib/mission/race-profile.test.ts
git -C /c/Users/Franc/app-run-mobile commit -m "feat(plan): race-profile (relief/distance/allure) pour spécificité course"
```

---

## Task 2 : Clés i18n (titres + raisons)

**Files:**
- Modify: `web/lib/i18n/dictionaries/fr.ts` (objet `mission`)
- Modify: `web/lib/i18n/dictionaries/en.ts` (objet `mission`)

`sessionTitles`, `reasonChips`, `reasonWhy` sont des `Record<string,string>` → **pas de changement d'interface**, on ajoute juste des entrées.

- [ ] **Step 1 : `fr.ts` — ajouter dans `sessionTitles`** (après `sessionLong`) :

```ts
      sessionVMA: '10×400m VMA',
      sessionCotes: '6×2min côtes',
      sessionRacePace: 'Allure course 3×10\'',
```

- [ ] **Step 2 : `fr.ts` — ajouter dans `reasonChips`** (après `'aerobic-base'`) :

```ts
      'vma-speed': 'VMA',
      'hill-work': 'côtes',
      'race-pace': 'allure course',
```

- [ ] **Step 3 : `fr.ts` — ajouter dans `reasonWhy`** (après `'aerobic-base'`) :

```ts
      'vma-speed': 'Travail de VMA pour la vitesse de base.',
      'hill-work': 'Côtes : spécifique au dénivelé de ta course.',
      'race-pace': 'À l’allure de ta course objectif.',
```

- [ ] **Step 4 : `en.ts` — mêmes clés** dans `sessionTitles` / `reasonChips` / `reasonWhy` :

```ts
      // sessionTitles
      sessionVMA: '10×400m intervals',
      sessionCotes: '6×2min hills',
      sessionRacePace: 'Race pace 3×10\'',
      // reasonChips
      'vma-speed': 'speed',
      'hill-work': 'hills',
      'race-pace': 'race pace',
      // reasonWhy
      'vma-speed': 'VMA work for top-end speed.',
      'hill-work': 'Hills: specific to your race’s elevation.',
      'race-pace': 'At your goal race pace.',
```

- [ ] **Step 5 : Vérifier tsc**

```
cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit 2>&1 | grep -iE "dictionaries" ; echo exit=$?
```
Attendu : aucune ligne (exit 1).

- [ ] **Step 6 : Commit**

```
git -C /c/Users/Franc/app-run-mobile add web/lib/i18n/dictionaries/fr.ts web/lib/i18n/dictionaries/en.ts
git -C /c/Users/Franc/app-run-mobile commit -m "i18n(plan): séances spécificité course (VMA/côtes/allure)"
```

---

## Task 3 : Moteur — profil dans le contexte, sélection de qualité, D+ des SL

**Files:**
- Modify: `web/lib/mission/session-advisor.ts`
- Test: `web/__tests__/lib/mission/session-advisor.test.ts`

- [ ] **Step 1 : Écrire les tests (échouent)** — ajouter à `session-advisor.test.ts`.

D'abord, le `base` existant n'a pas `raceProfile` : ajouter un profil neutre au `base` et importer le type.

En tête du fichier, étendre l'import :
```ts
import { adviseWeek, applySlider, type AdviceContext, type SliderBase } from '@/lib/mission/session-advisor'
import type { RaceProfile } from '@/lib/mission/race-profile'
```

Ajouter une constante profil neutre et l'injecter au `base` (le `base` est l'objet `AdviceContext` partagé des tests existants — ajouter la propriété) :
```ts
const NEUTRAL_PROFILE: RaceProfile = {
  relief: 'flat', distanceClass: 'mid', dPlusPerKm: 20, goalPaceMinPerKm: null,
  qualityKinds: ['seuil_tempo'], longRunMaxMin: 120,
}
```
puis dans l'objet `base`, ajouter `raceProfile: NEUTRAL_PROFILE,`.

Nouveaux tests :
```ts
describe('spécificité course', () => {
  const mountain: RaceProfile = { relief: 'mountain', distanceClass: 'ultra', dPlusPerKm: 55, goalPaceMinPerKm: null, qualityKinds: ['cotes', 'seuil_tempo'], longRunMaxMin: 240 }
  const flatShort: RaceProfile = { relief: 'flat', distanceClass: 'short', dPlusPerKm: 5, goalPaceMinPerKm: null, qualityKinds: ['fractionne', 'seuil_tempo'], longRunMaxMin: 90 }

  it('course montagne → la qualité du jour privilégie les côtes', () => {
    const w = adviseWeek({ ...base, raceProfile: mountain })
    if (w.today.kind === 'suggested') expect(['cotes', 'seuil_tempo']).toContain(w.today.session.type)
  })

  it('10 km plat → la qualité peut être de la VMA (fractionné)', () => {
    // on balaie plusieurs « aujourd'hui » (semaines différentes) → au moins une VMA
    const days = ['2026-06-09', '2026-06-16', '2026-06-23']
    const types = days.map(d => {
      const w = adviseWeek({ ...base, todayISO: d, weekDates: weekFrom(d), raceProfile: flatShort })
      return w.today.kind === 'suggested' ? w.today.session.type : 'rest'
    })
    expect(types).toContain('fractionne')
  })

  it('sortie longue : le D+ suit le relief de la course', () => {
    const w = adviseWeek({ ...base, raceProfile: mountain })
    const sat = w.byDate['2026-06-13']
    if (sat.kind === 'suggested' && sat.session.type === 'sortie_longue') {
      expect(sat.session.elevationM!).toBeGreaterThan((sat.session.distanceKm ?? 0) * 30)
    }
  })

  it('phase spécifique + allure cible connue → séance allure course', () => {
    const profile: RaceProfile = { ...flatShort, distanceClass: 'mid', goalPaceMinPerKm: 5, qualityKinds: ['seuil_tempo', 'fractionne'] }
    const w = adviseWeek({ ...base, phaseType: 'specifique', daysToRace: 30, raceProfile: profile })
    if (w.today.kind === 'suggested') expect(w.today.session.reasonCode).toBe('race-pace')
  })
})
```

Helper `weekFrom(d)` (lundi→dimanche de la semaine ISO de `d`) à ajouter en haut du fichier de test :
```ts
function weekFrom(iso: string): string[] {
  const d = new Date(`${iso}T00:00:00Z`); const dow = d.getUTCDay() || 7
  const mon = new Date(d); mon.setUTCDate(d.getUTCDate() - (dow - 1))
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(mon); x.setUTCDate(mon.getUTCDate() + i); return x.toISOString().slice(0, 10) })
}
```

- [ ] **Step 2 : Lancer (échoue : `raceProfile` inconnu du type / sélection non implémentée)**

```
cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/mission/session-advisor.test.ts
```

- [ ] **Step 3 : Implémenter dans `session-advisor.ts`**

(a) Importer le type en tête :
```ts
import type { RaceProfile } from '@/lib/mission/race-profile'
```

(b) Étendre `ReasonCode` (ajouter trois codes) :
```ts
  | 'vma-speed'
  | 'hill-work'
  | 'race-pace'
```

(c) Ajouter `raceProfile` à `AdviceContext` (après `plannedDates`/`hasPlannedLongRun`) :
```ts
  raceProfile: RaceProfile
```

(d) Nouveaux builders (à côté de `qualitySession`/`easySession`/`longSession`) :
```ts
function vmaSession(): SuggestedSession {
  return { type: 'fractionne', titleKey: 'sessionVMA', durationMin: 60, distanceKm: 11, intensity: 5, reasonCode: 'vma-speed' }
}
function cotesSession(): SuggestedSession {
  return { type: 'cotes', titleKey: 'sessionCotes', durationMin: 60, distanceKm: 10, intensity: 4, reasonCode: 'hill-work', elevationM: 350 }
}
function racePaceSession(p: RaceProfile): SuggestedSession {
  const distanceKm = Math.round(55 / ((p.goalPaceMinPerKm ?? 5.5) + 0.5))
  return { type: 'course', titleKey: 'sessionRacePace', durationMin: 55, distanceKm, intensity: 3, reasonCode: 'race-pace' }
}

const weekIndex = (iso: string): number => Math.floor(new Date(`${iso}T00:00:00Z`).getTime() / (7 * 86_400_000))

// Sélection de la séance de qualité du jour selon le profil course + la phase.
function selectQuality(ctx: AdviceContext): SuggestedSession {
  if (isTaper(ctx)) return qualitySession(ctx)                 // affûtage : tempo court (existant)
  const p = ctx.raceProfile
  if (ctx.phaseType === 'specifique' && p.goalPaceMinPerKm != null) return racePaceSession(p)
  const kinds = p.qualityKinds.length ? p.qualityKinds : ['seuil_tempo']
  const kind = kinds[weekIndex(ctx.todayISO) % kinds.length]   // alternance au fil des semaines
  if (kind === 'fractionne') return vmaSession()
  if (kind === 'cotes') return cotesSession()
  return qualitySession(ctx)
}
```

(e) Dans `adviseDay`, remplacer l'appel qualité :
```ts
  if (iso === ctx.todayISO && !weekend && ctx.recentHardCount === 0 && ctx.phaseType !== null) {
    return { kind: 'suggested', session: selectQuality(ctx) }
  }
```
(remplace `qualitySession(ctx)` par `selectQuality(ctx)`.)

(f) `longSession` prend désormais le contexte (pour le profil) : changer la signature et l'appel.
Nouvelle signature :
```ts
function longSession(ctx: AdviceContext): SuggestedSession {
  const km = Math.min(32, Math.max(16, Math.round((ctx.targetKm ?? 0) * 0.3)))
  const durationMin = Math.min(Math.round(km * PACE_MIN_PER_KM[2]), ctx.raceProfile.longRunMaxMin)
  return { type: 'sortie_longue', titleKey: 'sessionLong', durationMin, distanceKm: km, intensity: 2, reasonCode: 'fill-volume-long', elevationM: Math.round(km * ctx.raceProfile.dPlusPerKm) }
}
```
Et dans `adviseDay`, l'appel sortie longue :
```ts
  if (dow === 6 && !ctx.hasPlannedLongRun && !isTaper(ctx) && remainingKm > 12) {
    return { kind: 'suggested', session: longSession(ctx) }
  }
```

- [ ] **Step 4 : Lancer (passe)**

```
cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/mission/session-advisor.test.ts
```
Attendu : PASS (anciens + nouveaux). Ajuster les seuils de règles si besoin, jamais les tests.

- [ ] **Step 5 : Commit**

```
git -C /c/Users/Franc/app-run-mobile add web/lib/mission/session-advisor.ts web/__tests__/lib/mission/session-advisor.test.ts
git -C /c/Users/Franc/app-run-mobile commit -m "feat(plan): moteur — qualité selon le profil course + D+ SL calé sur la course"
```

---

## Task 4 : Câblage `MissionPlan`

**Files:**
- Modify: `web/components/mission/MissionPlan.tsx`

- [ ] **Step 1 : Importer `raceProfile`** (à côté des autres imports `@/lib/mission/*`) :

```ts
import { raceProfile } from '@/lib/mission/race-profile'
```

- [ ] **Step 2 : Ajouter `raceProfile` au contexte du moteur.**
Dans le `useMemo` `ctx` (celui qui retourne `{ todayISO, weekDates, ... daysToRace }`), ajouter au retour :

```ts
    return {
      todayISO: today, weekDates, freshnessZone, weekDoneKm, recentHardCount,
      targetKm, phaseType, daysToRace: race ? daysUntil(race.date) : null,
      raceProfile: raceProfile(race),
    }
```
(et s'assurer que `race` est bien dans le tableau de dépendances du `useMemo` — il y est déjà.)

- [ ] **Step 3 : Vérifier tsc + eslint**

```
cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit 2>&1 | grep -E "MissionPlan|session-advisor|race-profile" ; echo exit=$?
cd /c/Users/Franc/app-run-mobile/web && npx eslint components/mission/MissionPlan.tsx lib/mission/session-advisor.ts lib/mission/race-profile.ts
```
Attendu : tsc grep exit 1 (aucune erreur) ; eslint propre.

- [ ] **Step 4 : Commit**

```
git -C /c/Users/Franc/app-run-mobile add web/components/mission/MissionPlan.tsx
git -C /c/Users/Franc/app-run-mobile commit -m "feat(plan): MissionPlan injecte le profil course dans le moteur"
```

---

## Task 5 : Vérification finale

- [ ] **Step 1 : tsc complet**

```
cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit 2>&1 | grep -c "error TS"
```
Attendu : `0`.

- [ ] **Step 2 : Suites Jest du plan**

```
cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/mission/ __tests__/components/mission/MissionPlan.test.tsx
```
Attendu : toutes PASS.

- [ ] **Step 3 : Vérif « zéro TSB »** (les nouvelles chaînes ne mentionnent pas TSB)

```
cd /c/Users/Franc/app-run-mobile/web && grep -in "tsb" lib/mission/race-profile.ts lib/mission/session-advisor.ts | grep -iv "import"
```
Attendu : aucune occurrence pertinente.

- [ ] **Step 4 : Vérif visuelle** (`npm run dev`, mode Mission) : créer une course 10 km route → la qualité du jour peut être VMA ; une course type UTMB (gros D+) → côtes + sorties longues à fort D+ ; vérifier que le curseur adapte bien le nb de reps (VMA/côtes) et le D+ (SL).

- [ ] **Step 5 : Marquer la spec Implémenté**
Ajouter en tête de `web/docs/superpowers/specs/2026-06-13-specificite-course-design.md` :
`> **Status: Implémenté** · 2026-06-XX · Code: web/lib/mission/race-profile.ts + session-advisor.ts`

- [ ] **Step 6 : Finaliser** via `superpowers:finishing-a-development-branch` (push master → déploiement Vercel). Pas de migration Supabase.

---

## Notes

- Le curseur (`applySlider`) gère déjà ces séances : « 10×400m VMA », « 6×2min côtes », « Allure course 3×10' » → levier **répétitions** ; sorties longues à D+ → levier **D+**. Rien à modifier côté curseur.
- `racePaceSession` n'est proposée qu'en phase `specifique` avec un objectif de temps ; sinon on retombe sur l'alternance VMA/seuil/côtes du profil.
- La VMA/les côtes ne sont proposées que les jours de qualité (semaine, pas de qualité déjà faite, hors affûtage) — la logique de fréquence existante est inchangée.
