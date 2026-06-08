# Onboarding fonctionnel — Lot 2 (Discipline → sport par défaut des blocs) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Faire que la discipline choisie à l'onboarding (`onboarding_discipline`) pilote le **sport affiché par défaut** dans les blocs cockpit sport-aware (radio « Activité par défaut » du `SportSettingsModal`), sans masquer de bloc.

**Architecture:** Lecture-comme-défaut. La page dashboard lit `onboarding_discipline`, le passe à `DashboardGrid`, qui dérive un `defaultSport: SportKey | undefined` via `defaultSportForDiscipline()` et le passe aux 8 blocs sport-aware. Chaque bloc résout son sport via `readSportSettings(KEY, withDefaultSport(DEFAULT_SETTINGS, defaultSport))` : **la perso localStorage de l'utilisateur reste prioritaire**, sinon le `defaultSport` discipline, sinon le défaut figé du bloc.

**Tech Stack:** Next.js 14 App Router, TypeScript, React, Jest + Testing Library.

**Mapping (validé Franck) :** vélo→`ride`, natation→`swim`, triathlon→`all` (tous), **trail/route→`undefined`** (aucune surcharge : chaque bloc garde son défaut — « laisse tous les blocs »). null/inconnu→`undefined`.

**Périmètre :** Lot 2 uniquement. **Aucune migration** (`onboarding_discipline` existe déjà). Pas de masquage de bloc, pas de changement de l'ordre des blocs.

**Worktree :** ce plan s'exécute dans le worktree `worktree-onboarding-lot2-discipline-sport` (isolé d'une session concurrente sur `feat/auth-otp-code`). Le contrôleur fait tous les commits ; les subagents ne lancent **aucune** commande git (lesson 2026-06-05). Avant chaque commit : vérifier `git rev-parse --abbrev-ref HEAD == worktree-onboarding-lot2-discipline-sport`.

**Référence spec :** `web/docs/superpowers/specs/2026-06-08-onboarding-fonctionnel-design.md` section ①.

---

### Task 1: Helpers `defaultSportForDiscipline` + `withDefaultSport`

**Files:**
- Modify: `web/lib/design/sport-settings.ts`
- Test: `web/__tests__/lib/design/sport-settings.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// web/__tests__/lib/design/sport-settings.test.ts
import { defaultSportForDiscipline, withDefaultSport } from '@/lib/design/sport-settings'

describe('defaultSportForDiscipline', () => {
  it('mappe les disciplines mono-sport', () => {
    expect(defaultSportForDiscipline('velo')).toBe('ride')
    expect(defaultSportForDiscipline('natation')).toBe('swim')
    expect(defaultSportForDiscipline('triathlon')).toBe('all')
  })
  it('ne surcharge pas trail/route ni les valeurs inconnues', () => {
    expect(defaultSportForDiscipline('trail')).toBeUndefined()
    expect(defaultSportForDiscipline('route')).toBeUndefined()
    expect(defaultSportForDiscipline(null)).toBeUndefined()
    expect(defaultSportForDiscipline(undefined)).toBeUndefined()
    expect(defaultSportForDiscipline('xxx')).toBeUndefined()
  })
})

describe('withDefaultSport', () => {
  const base = { visible: ['run', 'ride', 'swim', 'all'] as const, default: 'run' as const }
  it('surcharge le default quand un sport est fourni', () => {
    expect(withDefaultSport(base, 'ride')).toEqual({ ...base, default: 'ride' })
  })
  it('renvoie les défauts inchangés quand defaultSport est undefined', () => {
    expect(withDefaultSport(base, undefined)).toBe(base)
  })
})
```

- [ ] **Step 2: Lancer → échec**

Run: `cd /c/Users/Franc/app-run-mobile/.claude/worktrees/onboarding-lot2-discipline-sport/web && npx jest __tests__/lib/design/sport-settings.test.ts`
Expected: FAIL (`defaultSportForDiscipline` / `withDefaultSport` non exportés).

- [ ] **Step 3: Implémenter (ajouter à la fin de `sport-settings.ts`)**

```ts
import type { SportKey } from '@/lib/design/sports'

/**
 * Sport par défaut à appliquer aux blocs cockpit selon la discipline
 * d'onboarding. `undefined` = pas de surcharge (le bloc garde son défaut).
 * trail/route restent sur le défaut par bloc (« laisse tous les blocs »).
 */
export function defaultSportForDiscipline(
  discipline: string | null | undefined,
): SportKey | undefined {
  switch (discipline) {
    case 'velo':      return 'ride'
    case 'natation':  return 'swim'
    case 'triathlon': return 'all'
    default:          return undefined
  }
}

/**
 * Renvoie une copie des `defaults` avec `default` surchargé par `defaultSport`
 * s'il est fourni. Sinon renvoie `defaults` inchangé (même référence).
 */
export function withDefaultSport<T extends { default: SportKey }>(
  defaults: T,
  defaultSport?: SportKey,
): T {
  return defaultSport ? { ...defaults, default: defaultSport } : defaults
}
```

> Note : `sport-settings.ts` n'importe rien aujourd'hui. Ajouter l'import `SportKey`. Vérifier l'absence de dépendance circulaire (`lib/design/sports` n'importe pas `sport-settings`).

- [ ] **Step 4: Lancer → succès**

Run: `cd /c/Users/Franc/app-run-mobile/.claude/worktrees/onboarding-lot2-discipline-sport/web && npx jest __tests__/lib/design/sport-settings.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit (contrôleur)**

```
git add web/lib/design/sport-settings.ts web/__tests__/lib/design/sport-settings.test.ts
git commit -m "feat(cockpit): helpers defaultSportForDiscipline + withDefaultSport (Lot 2)"
```

---

### Task 2: Câbler `discipline` → `DashboardGrid` → `defaultSport`

**Files:**
- Modify: `web/app/(main)/dashboard/page.tsx`
- Modify: `web/components/cockpit/DashboardGrid.tsx`

- [ ] **Step 1: page.tsx — lire `onboarding_discipline`**

Dans la requête `profiles` (`.select('max_hr, resting_hr, aerobic_threshold_hr, threshold_hr, birth_year, onboarding_completed_at, hr_zone_method, hr_zones_custom')`), ajouter `onboarding_discipline` à la liste des colonnes sélectionnées.

- [ ] **Step 2: page.tsx — passer la prop**

Sur le `<DashboardGrid ... />`, ajouter `discipline={athleteProfile?.onboarding_discipline ?? null}`.

- [ ] **Step 3: DashboardGrid.tsx — accepter `discipline`, dériver `defaultSport`, le passer aux 8 blocs**

- Importer : `import { defaultSportForDiscipline } from '@/lib/design/sport-settings'` et `import type { SportKey } from '@/lib/design/sports'` (si pas déjà importé — `SportKey` l'est déjà).
- Ajouter `discipline?: string | null` au type `Props`.
- Déstructurer `discipline` dans la signature de `DashboardGrid({ ..., discipline })`.
- Calculer en tête de fonction : `const defaultSport = defaultSportForDiscipline(discipline)`.
- Ajouter la prop `defaultSport={defaultSport}` aux 8 blocs sport-aware de la liste `blocks` : `ActivitiesBlock`, `LastActivityBlock`, `WeeklyStatsBlock`, `GoalsBlock`, `ChargeBlock`, `HistoryBlock`, `CumulBlock`, `IntensityBlock`. (Ne PAS l'ajouter à `MorningReportTile`, `WeekBlock`, `WeekActivitiesBlock`, `FreshnessCard` qui ne sont pas sport-aware.)

Exemple pour une ligne (les autres suivent le même schéma — ajouter `defaultSport={defaultSport}` à l'appel du composant) :
```tsx
{ id: 'activities', label: L.activities, emoji: '🏅', render: () => <BlockWithHide>{(onHide) => <ActivitiesBlock sportOverviews={sportOverviews} defaultSport={defaultSport} onHide={onHide} />}</BlockWithHide> },
```

- [ ] **Step 4: tsc**

Run: `cd /c/Users/Franc/app-run-mobile/.claude/worktrees/onboarding-lot2-discipline-sport/web && npx tsc --noEmit`
Expected : erreurs UNIQUEMENT sur les 8 blocs (prop `defaultSport` pas encore dans leurs Props) — elles seront résolues à la Task 3. (Si d'autres erreurs, corriger.)

- [ ] **Step 5: Commit (après Task 3 verte — voir note)**

> Ce commit dépend de la Task 3 (sinon tsc casse). Committer Task 2 + Task 3 ensemble (voir Task 3 Step 4).

---

### Task 3: Appliquer `defaultSport` dans les 8 blocs sport-aware

**Files (chacun modifié à l'identique) :**
- `web/components/cockpit/ActivitiesBlock.tsx` (KEY `cockpit_activities_settings`)
- `web/components/cockpit/LastActivityBlock.tsx` (KEY `cockpit_last_activity_settings`)
- `web/components/cockpit/WeeklyStatsBlock.tsx` (KEY `cockpit_weekly_settings`)
- `web/components/cockpit/GoalsBlock.tsx` (KEY `cockpit_goals_settings`)
- `web/components/cockpit/ChargeBlock.tsx` (KEY `cockpit_charge_settings`)
- `web/components/cockpit/HistoryBlock.tsx` (KEY `cockpit_history_settings`)
- `web/components/cockpit/CumulBlock.tsx` (KEY `cockpit_cumul_settings`)
- `web/components/cockpit/IntensityBlock.tsx` (KEY `cockpit_intensity_settings`)

**Recette identique pour chaque bloc :**

- [ ] **Step 1 (par bloc) : importer `withDefaultSport`**
Ajouter à l'import existant depuis `@/lib/design/sport-settings` : `import { readSportSettings, withDefaultSport } from '@/lib/design/sport-settings'`. S'assurer que `SportKey` est importé depuis `@/lib/design/sports` (déjà le cas dans tous ces blocs).

- [ ] **Step 2 (par bloc) : ajouter la prop `defaultSport`**
Dans le type `Props` du bloc, ajouter `defaultSport?: SportKey`. Déstructurer `defaultSport` dans la signature du composant.

- [ ] **Step 3 (par bloc) : injecter le défaut aux sites de lecture**
Chaque bloc appelle `readSportSettings(STORAGE_KEY, DEFAULT_SETTINGS)` à **deux endroits** (lazy init de `settings`, et lazy init de `currentIdx`/équivalent). Remplacer **chaque** occurrence de `readSportSettings(STORAGE_KEY, DEFAULT_SETTINGS)` par :
```ts
readSportSettings(STORAGE_KEY, withDefaultSport(DEFAULT_SETTINGS, defaultSport))
```
(Pour `GoalsBlock`, la constante de clé s'appelle `SETTINGS_KEY` ; pour `CumulBlock`, `DEFAULT_SETTINGS` contient aussi `yearWindow` — `withDefaultSport` préserve les autres champs, donc la même substitution s'applique telle quelle. Vérifier qu'aucun autre `readSportSettings` du bloc n'est oublié, y compris dans un `useEffect` de re-lecture comme dans `GoalsBlock`.)

- [ ] **Step 4 : tsc + lint + commit Task 2 + Task 3**

Run:
```
cd /c/Users/Franc/app-run-mobile/.claude/worktrees/onboarding-lot2-discipline-sport/web && npx tsc --noEmit
```
Expected : aucune erreur.

Vérifier `git rev-parse --abbrev-ref HEAD` == `worktree-onboarding-lot2-discipline-sport`, puis :
```
git add web/app/(main)/dashboard/page.tsx web/components/cockpit/DashboardGrid.tsx web/components/cockpit/ActivitiesBlock.tsx web/components/cockpit/LastActivityBlock.tsx web/components/cockpit/WeeklyStatsBlock.tsx web/components/cockpit/GoalsBlock.tsx web/components/cockpit/ChargeBlock.tsx web/components/cockpit/HistoryBlock.tsx web/components/cockpit/CumulBlock.tsx web/components/cockpit/IntensityBlock.tsx
git commit -m "feat(cockpit): discipline d'onboarding pilote le sport par défaut des blocs (Lot 2)"
```

---

### Task 4: Test d'intégration léger + Mode Mission + vérif finale

**Files:**
- Test: `web/__tests__/components/cockpit/default-sport.test.tsx`
- Modify (si besoin) : `web/components/cockpit/DashboardGrid.tsx` (MISSION_VISIBLE hérite déjà du même `defaultSport` via les blocs — rien à changer si les blocs sont rendus par les mêmes composants en Mode Mission).

- [ ] **Step 1 : test d'intégration sur un bloc représentatif**

Vérifier qu'un bloc sport-aware, sans réglage localStorage, affiche le sport dérivé de la discipline. Exemple avec `WeeklyStatsBlock` (titre = libellé du sport actif) :

```tsx
// web/__tests__/components/cockpit/default-sport.test.tsx
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n/I18nProvider'
import { WeeklyStatsBlock } from '@/components/cockpit/WeeklyStatsBlock'
import type { SportOverview } from '@/lib/data/dashboard'
import type { SportKey } from '@/lib/design/sports'

const emptyOverview = (): SportOverview => ({
  // remplir avec une forme minimale valide selon le type SportOverview réel
  weeklyPoints: [],
} as unknown as SportOverview)

const overviews = {
  run: emptyOverview(), ride: emptyOverview(), swim: emptyOverview(), all: emptyOverview(),
} as Record<SportKey, SportOverview>

beforeEach(() => localStorage.clear())

it('défaut Vélo : le bloc affiche Vélo quand defaultSport=ride et pas de réglage local', () => {
  render(<I18nProvider><WeeklyStatsBlock sportOverviews={overviews} defaultSport="ride" /></I18nProvider>)
  expect(screen.getByText(/vélo/i)).toBeInTheDocument()
})
```

> Si le rendu réel de `WeeklyStatsBlock` exige une forme `SportOverview` plus complète (ex. `weeklyPoints` non vide), adapter le mock minimal pour éviter un crash — l'objectif du test est seulement de vérifier le **sport actif par défaut**, pas le graphe. Si un autre bloc est plus simple à monter (ex. `LastActivityBlock`), l'utiliser à la place. **Suivre TDD** : écrire le test, le voir échouer (defaultSport pas encore appliqué si lancé avant Task 3 — sinon vérifier qu'il passe après).

- [ ] **Step 2 : lancer les tests Lot 2**

Run: `cd /c/Users/Franc/app-run-mobile/.claude/worktrees/onboarding-lot2-discipline-sport/web && npx jest __tests__/lib/design/sport-settings.test.ts __tests__/components/cockpit/default-sport.test.tsx`
Expected : PASS.

- [ ] **Step 3 : lint des fichiers touchés**

Run: `cd .../web && npx next lint --file components/cockpit/DashboardGrid.tsx` (et idéalement les 8 blocs). Expected : pas d'erreur.

- [ ] **Step 4 : commit test**

```
git add web/__tests__/components/cockpit/default-sport.test.tsx
git commit -m "test(cockpit): défaut sport par discipline (Lot 2)"
```

- [ ] **Step 5 : cocher le suivi**

Dans `tasks/onboarding-fonctionnel-suivi.md` (présent dans le worktree via la base master), passer les items du **Lot 2** en `[x]` avec date + SHA. Commit :
```
git add tasks/onboarding-fonctionnel-suivi.md
git commit -m "docs(onboarding): coche Lot 2 dans le suivi"
```

- [ ] **Step 6 : push branche + build Vercel + merge**

Push `worktree-onboarding-lot2-discipline-sport` → attendre le build Vercel preview vert → fast-forward sur `master` (via `git push origin worktree-onboarding-lot2-discipline-sport:master` si ff possible, sinon décider). Vérification manuelle : créer/utiliser un compte avec discipline=vélo → le cockpit affiche Vélo par défaut sur les blocs ; trail → inchangé.

---

## Self-review (couverture spec Lot 2)

- **① Discipline → sport par défaut des blocs** : Tasks 1-3. ✓
- **Mapping validé** (velo/natation/tri override ; trail/route no-op) : Task 1. ✓
- **Perso localStorage prioritaire** : `withDefaultSport` n'agit que sur les `defaults` passés à `readSportSettings`, qui sont écrasés par le localStorage stocké (`{ ...defaults, ...stored }`). ✓
- **Pas de masquage / pas de migration** : confirmé. ✓
- **Mode Mission** : les blocs Mission sont les mêmes composants → héritent du `defaultSport`. Pas de changement dédié (Task 4 note). ✓
