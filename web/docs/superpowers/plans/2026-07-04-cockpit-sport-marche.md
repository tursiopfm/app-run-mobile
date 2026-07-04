# Sport « Marche » dans le Cockpit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un sport « Marche » (Walk + Hike) au Cockpit, décoché par défaut, activable via le dialogue « Volume d'activités » de chaque bloc.

**Architecture:** Le modèle sport est centralisé (`web/lib/design/sports.ts`). On étend `SportKey` avec `'walk'`, ce qui force par exhaustivité la mise à jour du data layer, de l'i18n et des `Record<SportKey>`. « Désactivé par défaut » = on ne touche PAS aux `DEFAULT_SETTINGS.visible` des blocs → la case Marche apparaît décochée. Seul WeekBlock (pastilles permanentes, sans dialogue) exclut explicitement Marche.

**Tech Stack:** Next.js 14 App Router, TypeScript, Jest. Spec source : `docs/superpowers/specs/2026-07-04-cockpit-sport-marche-design.md`.

## Global Constraints

- **Marche = `['Walk', 'Hike']`** (types Strava marche + rando).
- **Désactivé par défaut** : NE JAMAIS ajouter `'walk'` aux `DEFAULT_SETTINGS.visible` des blocs, ni à `BASE_VISIBLE` (`sport-settings.ts`). C'est ce qui garantit la case décochée.
- **WeekBlock exclut Marche** de ses pastilles (seul consommateur de `ALL_SPORT_KEYS` à le faire).
- **Aucune migration Supabase** (préférences 100 % localStorage).
- **Couleur** Marche : nouveau token `walkViolet` = `#8B5CF6` (dark) / `#7C56C9` (light). Emoji `🚶`, shortLabel `MAR`.
- **Vérification autoritative** : `npx tsc --noEmit` + `npx eslint` (le build tourne sur Vercel, cf. contrainte Windows). Les commandes `jest`/`tsc`/`npm` se lancent depuis `web/` (cd absolu).
- **Commits** : préparés dans le plan mais **à lancer seulement après feu vert explicite de Franck** (convention projet : pas de commit/push sans demande).

---

### Task 1: Modèle sport central + data + i18n + sites forcés par le compilateur

Tout ce qui doit atterrir ensemble pour que `tsc` reste vert (ajouter `'walk'` à l'union casse la compilation tant que tous les sites exhaustifs ne sont pas couverts). Un seul commit vert.

**Files:**
- Modify: `web/lib/design/sports.ts`
- Modify: `web/lib/design/colors.ts:19` (dark) et `:55` (light)
- Modify: `web/lib/data/dashboard.ts:478-482`
- Modify: `web/lib/design/sports-i18n.ts`
- Modify: `web/lib/i18n/dictionaries/fr.ts:19` (type abbr) et `:1172-1177` (valeurs abbr)
- Modify: `web/lib/i18n/dictionaries/en.ts:26-31` (valeurs abbr)
- Modify: `web/components/cockpit/GoalsBlock.tsx:23-28`
- Modify: `web/app/(main)/dashboard/page.tsx:32`
- Test: `web/__tests__/lib/data/dashboard.test.ts`

**Interfaces:**
- Produces: `SportKey` inclut `'walk'` ; `SPORT_TYPE_MAP.walk = ['Walk','Hike']` ; `SPORT_CONFIG.walk` ; `ALL_SPORT_KEYS = ['run','ride','swim','walk','all']` ; `colors.walkViolet` ; `sportOverviews.walk: SportOverview` ; `t.sports.abbr.walk`.

- [ ] **Step 1 : Écrire le test qui échoue** — ajouter ce test dans `web/__tests__/lib/data/dashboard.test.ts`, à la fin du `describe('getDashboardData', …)` (après le test ligne 104), et ajouter une assertion `walk` au test « all sport keys » existant (ligne 75).

```ts
// À insérer après expect(result.sportOverviews.all).toBeDefined() (ligne ~75) :
    expect(result.sportOverviews.walk).toBeDefined()
```

```ts
// Nouveau test, avant le `})` de fermeture du describe (ligne ~105) :
  it('groups Walk and Hike into sportOverviews.walk (and into all, not run)', async () => {
    const today = new Date().toISOString()
    mockCreateClient.mockResolvedValue(makeSelectMock([
      { id: '1', sport_type: 'Walk', name: 'Marche', start_time: today,
        ces: 10, distance_m: 5000,  elevation_gain_m: 50,  moving_time_sec: 3600 },
      { id: '2', sport_type: 'Hike', name: 'Rando',  start_time: today,
        ces: 30, distance_m: 12000, elevation_gain_m: 800, moving_time_sec: 7200 },
    ]))
    const result = await getDashboardData('user-1')
    expect(result.sportOverviews.walk.weekSessions).toBe(2)
    expect(result.sportOverviews.walk.weekKm).toBeCloseTo(17, 1)
    expect(result.sportOverviews.run.weekSessions).toBe(0)
    expect(result.sportOverviews.all.weekSessions).toBe(2)
  })
```

- [ ] **Step 2 : Lancer le test → doit ÉCHOUER**

Run (depuis `web/`) : `npx jest __tests__/lib/data/dashboard.test.ts -t "Walk and Hike"`
Expected : FAIL — `result.sportOverviews.walk` est `undefined` → `TypeError: Cannot read properties of undefined (reading 'weekSessions')`.

- [ ] **Step 3 : Étendre le modèle central** — `web/lib/design/sports.ts`. Remplacer le fichier par :

```ts
// web/lib/design/sports.ts
import { colors } from './colors'

export type SportKey = 'run' | 'ride' | 'swim' | 'walk' | 'all'

export const SPORT_TYPE_MAP = {
  run:  ['Run', 'TrailRun'],
  ride: ['Ride', 'VirtualRide'],
  swim: ['Swim'],
  walk: ['Walk', 'Hike'],
  all:  null,
} as const

export const SPORT_CONFIG = {
  run:  { label: 'Course',   shortLabel: 'RUN', emoji: '🏃', color: colors.chargeOrange },
  ride: { label: 'Vélo',     shortLabel: 'VÉL', emoji: '🚴', color: colors.bikeGreen   },
  swim: { label: 'Natation', shortLabel: 'NAT', emoji: '🏊', color: colors.swimBlue    },
  walk: { label: 'Marche',   shortLabel: 'MAR', emoji: '🚶', color: colors.walkViolet  },
  all:  { label: 'Toutes',   shortLabel: 'ALL', emoji: '🌎', color: colors.seriesYellow },
} as const

export const ALL_SPORT_KEYS: SportKey[] = ['run', 'ride', 'swim', 'walk', 'all']
```

- [ ] **Step 4 : Ajouter le token couleur** — `web/lib/design/colors.ts`. Dans l'objet `dark`, après la ligne `swimBlue: '#4BB4E6',` (ligne 19), ajouter :

```ts
  walkViolet:       '#8B5CF6',
```

Dans l'objet `light`, après la ligne `swimBlue: '#2A8FC4',` (ligne 55), ajouter :

```ts
  walkViolet:       '#7C56C9',
```

- [ ] **Step 5 : Construire l'overview Marche** — `web/lib/data/dashboard.ts`, dans le littéral `sportOverviews` (ligne 478-482), insérer la ligne `walk` entre `swim` et `all` :

```ts
  const sportOverviews: Record<SportKey, SportOverview> = {
    run:  buildSportOverview(activities, yearActivities, SPORT_TYPE_MAP.run,  monday, nextMonday, janFirst, now),
    ride: buildSportOverview(activities, yearActivities, SPORT_TYPE_MAP.ride, monday, nextMonday, janFirst, now),
    swim: buildSportOverview(activities, yearActivities, SPORT_TYPE_MAP.swim, monday, nextMonday, janFirst, now),
    walk: buildSportOverview(activities, yearActivities, SPORT_TYPE_MAP.walk, monday, nextMonday, janFirst, now),
    all:  buildSportOverview(activities, yearActivities, SPORT_TYPE_MAP.all,  monday, nextMonday, janFirst, now),
  }
```

- [ ] **Step 6 : Couvrir les switches i18n** — `web/lib/design/sports-i18n.ts`. Dans `sportLabel`, ajouter le `case 'walk'` avant `case 'all'` :

```ts
    case 'swim': return t.sports.swim
    case 'walk': return t.sports.walk
    case 'all':  return t.sports.all
```

Dans `sportShortLabel`, ajouter le `case 'walk'` avant `case 'all'` :

```ts
    case 'swim': return t.sports.abbr.swim
    case 'walk': return t.sports.abbr.walk
    case 'all':  return t.sports.abbr.all
```

- [ ] **Step 7 : Étendre le type + les valeurs `abbr`** — `web/lib/i18n/dictionaries/fr.ts`.

Type (ligne 19) : `abbr: { run: string; bike: string; swim: string; all: string }` → ajouter `walk` :

```ts
    abbr: { run: string; bike: string; swim: string; walk: string; all: string }
```

Valeurs (ligne 1172-1177) : ajouter `walk` après `swim` :

```ts
    abbr: {
      run:  'RUN',
      bike: 'VÉLO',
      swim: 'NATATION',
      walk: 'MARCHE',
      all:  'TOUTES',
    },
```

- [ ] **Step 8 : Valeur `abbr.walk` anglaise** — `web/lib/i18n/dictionaries/en.ts` (ligne 26-31), ajouter `walk` après `swim` :

```ts
    abbr: {
      run:  'RUN',
      bike: 'BIKE',
      swim: 'SWIM',
      walk: 'WALK',
      all:  'ALL',
    },
```

- [ ] **Step 9 : Objectif par défaut Marche** — `web/components/cockpit/GoalsBlock.tsx` (ligne 23-28), ajouter l'entrée `walk` :

```ts
const DEFAULT_GOALS: Record<SportKey, Goals> = {
  run:  { weekKm: 50,  weekDPlus: 2000, yearKm: 1000 },
  ride: { weekKm: 100, weekDPlus: 2000, yearKm: 3000 },
  swim: { weekKm: 5,   weekDPlus: 0,    yearKm: 150  },
  walk: { weekKm: 20,  weekDPlus: 500,  yearKm: 500  },
  all:  { weekKm: 150, weekDPlus: 4000, yearKm: 4000 },
}
```

- [ ] **Step 10 : Piège du cast `as` — `latestPerSport`** — `web/app/(main)/dashboard/page.tsx` (ligne 32). Le cast `as Record<SportKey, …>` masque l'exhaustivité : sans `'walk'` ici, `latestPerSport.walk` serait `undefined` et « Dernière activité » planterait quand Franck coche Marche. Ajouter `'walk'` :

```ts
  const keys: SportKey[] = ['run', 'ride', 'swim', 'walk', 'all']
```

- [ ] **Step 11 : Lancer le test → doit PASSER**

Run (depuis `web/`) : `npx jest __tests__/lib/data/dashboard.test.ts`
Expected : PASS (tous les tests du fichier, dont « Walk and Hike »).

- [ ] **Step 12 : Vérifier la compilation + le lint**

Run (depuis `web/`) : `npx tsc --noEmit`
Expected : aucune erreur (exhaustivité `SportKey` couverte partout).

Run (depuis `web/`) : `npx eslint lib/design/sports.ts lib/design/colors.ts lib/data/dashboard.ts lib/design/sports-i18n.ts lib/i18n/dictionaries/fr.ts lib/i18n/dictionaries/en.ts components/cockpit/GoalsBlock.tsx "app/(main)/dashboard/page.tsx"`
Expected : aucune erreur.

- [ ] **Step 13 : Commit** *(après feu vert de Franck)*

```bash
git add web/lib/design/sports.ts web/lib/design/colors.ts web/lib/data/dashboard.ts web/lib/design/sports-i18n.ts web/lib/i18n/dictionaries/fr.ts web/lib/i18n/dictionaries/en.ts web/components/cockpit/GoalsBlock.tsx "web/app/(main)/dashboard/page.tsx" web/__tests__/lib/data/dashboard.test.ts
git commit -m "feat(cockpit): ajoute le sport Marche (Walk+Hike), décoché par défaut"
```

---

### Task 2: WeekBlock exclut la pastille Marche

Le bloc « Semaine » affiche une pastille par sport, **toujours visible** (pas de dialogue à cases). Marche étant opt-in, il ne doit pas y apparaître.

**Files:**
- Modify: `web/components/cockpit/WeekBlock.tsx:57`

**Interfaces:**
- Consumes: `ALL_SPORT_KEYS` (Task 1, inclut désormais `'walk'`).

- [ ] **Step 1 : Filtrer `walk` du rendu des pastilles** — `web/components/cockpit/WeekBlock.tsx`. Remplacer la ligne 57 :

```tsx
          {ALL_SPORT_KEYS.map((sport) => {
```

par (avec commentaire) :

```tsx
          {/* Marche = sport opt-in (activable via le dialogue des autres blocs), jamais une pastille permanente ici. */}
          {ALL_SPORT_KEYS.filter((sport) => sport !== 'walk').map((sport) => {
```

`activeSport` s'initialise sur `defaultSport ?? 'run'` (jamais `'walk'`), donc aucun risque de sélection Marche.

- [ ] **Step 2 : Vérifier la compilation**

Run (depuis `web/`) : `npx tsc --noEmit`
Expected : aucune erreur.

Run (depuis `web/`) : `npx eslint components/cockpit/WeekBlock.tsx`
Expected : aucune erreur.

- [ ] **Step 3 : Vérification visuelle** (Franck) : bloc « Semaine » n'affiche que RUN / VÉLO / NAT / ALL (pas de Marche) ; le dialogue « Volume d'activités » des autres blocs montre une case **Marche décochée** ; la cocher fait apparaître le sport Marche (avec ses km/D+ marche+rando) dans le carrousel.

- [ ] **Step 4 : Commit** *(après feu vert de Franck)*

```bash
git add web/components/cockpit/WeekBlock.tsx
git commit -m "feat(cockpit): exclut Marche des pastilles du bloc Semaine"
```

---

## Self-Review

**Spec coverage :**
- Modèle central (SportKey/map/config/keys) → Task 1 Step 3. ✅
- Couleur `walkViolet` → Task 1 Step 4. ✅
- Data layer walk overview → Task 1 Step 5. ✅
- i18n (`abbr.walk` + switches) → Task 1 Steps 6-8. ✅
- `DEFAULT_GOALS.walk` (forcé compilo) → Task 1 Step 9. ✅
- Piège `latestPerSport` (cast) → Task 1 Step 10. ✅
- Désactivé par défaut (ne PAS toucher `visible[]`/`BASE_VISIBLE`) → Global Constraints + aucun step ne les modifie. ✅
- WeekBlock exclut Marche → Task 2 Step 1. ✅
- 0 migration, mocks `as never` protégés → Global Constraints (aucun test à modifier hors dashboard). ✅

**Placeholder scan :** aucun TBD/TODO ; chaque step porte le code exact. ✅

**Type consistency :** `SportKey` gagne `'walk'` (Step 3) ; tous les sites exhaustifs couverts (`sportOverviews` Step 5, `DEFAULT_GOALS` Step 9, switches Step 6, `abbr` type Step 7) ; `colors.walkViolet` défini (Step 4) avant usage dans `SPORT_CONFIG` (Step 3, même commit) ; `t.sports.abbr.walk` défini (Steps 7-8) avant usage (Step 6). ✅
