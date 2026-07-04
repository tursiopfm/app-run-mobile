# Design — Sport « Marche » dans le Cockpit (désactivé par défaut)

> **Status: Implémenté** · 2026-07-04 · Code: `web/lib/design/sports.ts`, `web/lib/design/colors.ts`, `web/lib/data/dashboard.ts`, `web/lib/design/sports-i18n.ts`, `web/lib/i18n/dictionaries/{fr,en}.ts`, `web/components/cockpit/GoalsBlock.tsx`, `web/app/(main)/dashboard/page.tsx`, `web/components/cockpit/WeekBlock.tsx`
>
> Date : 2026-07-04 · Auteur : Franck + Claude

## Contexte & objectif

Ajouter un cinquième sport **« Marche »** aux blocs du Cockpit, **désactivé par
défaut**. L'utilisateur l'active via le dialogue « Volume d'activités » (icône ⋮
de chaque bloc) — la même fenêtre qui pilote déjà Course / Vélo / Natation /
Toutes.

Décisions validées avec Franck :

1. **« Marche » = `Walk` + `Hike`** (marche ET randonnée regroupées sous une seule
   catégorie).
2. **Tous les blocs pilotés par sport** proposent la case Marche, **bloc Charge
   inclus**.
3. **Bloc « Semaine » (WeekBlock)** : **n'affiche PAS** Marche. Ce bloc montre
   des pastilles sport toujours visibles (pas de dialogue à cases) ; Marche étant
   un sport **opt-in** (activable seulement via le dialogue des autres blocs), il
   reste à ses 4 pastilles `run / ride / swim / all`.

## Principe : pourquoi c'est un changement central

Le modèle sport est factorisé dans `web/lib/design/sports.ts` :
`SportKey`, `SPORT_TYPE_MAP`, `SPORT_CONFIG`, `ALL_SPORT_KEYS`. Les 8 blocs à
dialogue lisent `allKeys={ALL_SPORT_KEYS}` et affichent une case par clé, cochée
si la clé est dans leur `visible[]` (persisté en localStorage). Donc :

- Ajouter `walk` au modèle central → la case Marche apparaît **automatiquement**
  dans le dialogue des 8 blocs, **Charge inclus**. `ALL_SPORT_KEYS` inclut `walk`
  (sert d'`allKeys` aux 8 dialogues **et** de garde-fou `.includes` dans Goals).
- **Exception WeekBlock** : c'est le seul consommateur de `ALL_SPORT_KEYS` qui
  doit **exclure** Marche (pastilles permanentes ≠ sport opt-in) → il filtre
  `walk` localement.
- **« Désactivé par défaut »** = ne PAS ajouter `walk` aux
  `DEFAULT_SETTINGS.visible` des blocs (qui restent `['run','ride','swim','all']`).
  La case apparaît donc **décochée**. Le localStorage des utilisateurs existants
  ne contient pas `walk` non plus → **zéro impact tant que Franck ne coche pas**.

## Changements — production

### 1. Modèle central — `web/lib/design/sports.ts`

- `SportKey` : ajouter `'walk'` → `'run' | 'ride' | 'swim' | 'walk' | 'all'`.
- `SPORT_TYPE_MAP.walk = ['Walk', 'Hike']` (types Strava).
- `SPORT_CONFIG.walk = { label: 'Marche', shortLabel: 'MAR', emoji: '🚶', color: colors.walkViolet }`.
- `ALL_SPORT_KEYS = ['run', 'ride', 'swim', 'walk', 'all']` — Marche insérée
  **avant** « Toutes », comme dans la maquette/capture.

### 2. Couleur — `web/lib/design/colors.ts`

Ajouter un token dédié `walkViolet` dans **`dark` ET `light`** (chaque sport a
déjà son token : `bikeGreen`, `swimBlue`…) :

- `dark.walkViolet = '#8B5CF6'`
- `light.walkViolet = '#7C56C9'`

Violet = distinct des 4 couleurs sport existantes (orange / vert / bleu / jaune).

### 3. Données — `web/lib/data/dashboard.ts`

Dans le littéral `sportOverviews: Record<SportKey, SportOverview>` (~ligne 478),
ajouter :

```ts
walk: buildSportOverview(activities, yearActivities, SPORT_TYPE_MAP.walk, monday, nextMonday, janFirst, now),
```

Le compilateur l'exige (Record exhaustif). « Toutes » (`SPORT_TYPE_MAP.all = null`)
continue d'inclure les marches — **inchangé**.

### 4. i18n — `fr.ts`, `en.ts`, `sports-i18n.ts`

- `sports.walk` : la valeur existe déjà (`'Marche'` / `'Walk'`) → rien à ajouter.
- **`sports.abbr`** ne contient PAS `walk` (type `{ run; bike; swim; all }`).
  Ajouter `walk: string` au **type** `abbr` + la valeur dans les deux dicos :
  `'MAR'` (fr) / `'WLK'` (en).
- `sports-i18n.ts` : ajouter `case 'walk': return t.sports.walk` dans `sportLabel`
  et `case 'walk': return t.sports.abbr.walk` dans `sportShortLabel` (le compilo
  force ces cases, la fonction doit retourner un `string`).

### 5. `DEFAULT_GOALS` — `web/components/cockpit/GoalsBlock.tsx` (~ligne 23)

`Record<SportKey, Goals>` exhaustif → le compilo force une entrée `walk`. Valeurs :

```ts
walk: { weekKm: 20, weekDPlus: 500, yearKm: 500 },
```

### 6. WeekBlock — exclure Marche des pastilles — `web/components/cockpit/WeekBlock.tsx` (~ligne 57)

`ALL_SPORT_KEYS.map(...)` → filtrer `walk` (seul bloc qui l'exclut) :

```ts
{ALL_SPORT_KEYS.filter((sport) => sport !== 'walk').map((sport) => {
```

Ajouter un commentaire court : Marche est opt-in, activable via le dialogue des
autres blocs, jamais une pastille permanente ici. `activeSport` s'initialise sur
`defaultSport ?? 'run'` (jamais `'walk'`), donc aucun risque de sélection Marche.

## Changements — les 2 pièges que le compilateur NE signale PAS

Ces sites utilisent un cast `as` qui masque l'exhaustivité — **à corriger à la
main**, sinon bug runtime :

### A. `fetchLatestPerSport` — `web/app/(main)/dashboard/page.tsx` (~ligne 32)

```ts
const keys: SportKey[] = ['run', 'ride', 'swim', 'walk', 'all']  // ajouter 'walk'
```

Sans ça, `latestPerSport.walk` = `undefined` → le bloc « Dernière activité »
planterait/afficherait vide dès que Franck coche Marche.

### B. Vérifier les autres `as Record<SportKey>` / `as never`

- Mocks de test `tri-week.test.ts` (`as never`) et `MissionCockpit.test.tsx`
  (`as never`) : le cast **protège** de `tsc` → **aucune modif requise**.
- `mission/goals.ts` (`Partial<Record<SportKey, …>>`) : Partial → OK.

## Ce qui NE change pas

- Aucune migration Supabase (préférences 100 % localStorage).
- Aucun impact sur les utilisateurs existants tant que Marche n'est pas cochée.
- Agrégation CES / charge : les marches ont déjà un CES et sont déjà dans
  « Toutes » ; le filtre Marche est une simple vue supplémentaire.
- `BASE_VISIBLE` / `applyDisciplineDefaultToCockpit` (`sport-settings.ts`) :
  **inchangés** (Marche off par défaut, on ne l'ajoute pas au fallback).

## Blocs concernés (récapitulatif)

| Bloc | Dialogue à cases | Effet de l'ajout |
|------|:---:|---|
| Activités, Dernière activité, Objectifs, Stats hebdo, Charge, Historique, Cumul, Intensité | ✅ | Case Marche **décochée** par défaut, activable |
| Semaine (WeekBlock) | ❌ (pastilles) | **Marche exclue** (reste à 4 pastilles) |
| WeekActivities, Rapport matinal | — (pas de sport) | Aucun |

## Vérification

- `npx tsc --noEmit` (autoritatif — le build tourne sur Vercel, cf. contrainte
  Windows) : doit être vert, exhaustivité `SportKey` couverte.
- `npx eslint` sur les fichiers touchés.
- `npx jest __tests__/lib/data/dashboard.test.ts __tests__/lib/design/sport-settings.test.ts`
  : verts (les mocks `as never` protègent le reste).
- Vérif visuelle Franck : ouvrir le dialogue « Volume d'activités » d'un bloc →
  la case **Marche** apparaît décochée ; la cocher fait apparaître le sport
  (avec ses km/D+ de marche+rando) dans le carrousel.

## Drift notes

- **Abréviation `sports.abbr.walk`** : la §4 mentionnait `'MAR'` (fr) / `'WLK'`
  (en). L'implémentation a retenu `'MARCHE'` (fr) / `'WALK'` (en), conforme au
  plan et cohérent avec le style existant des abbr fr (`VÉLO`, `NATATION`,
  `TOUTES` sont des mots pleins). `SPORT_CONFIG.walk.shortLabel = 'MAR'` reste
  défini par parité avec les autres sports mais n'est pas affiché (le rendu passe
  par `sportShortLabel` → `t.sports.abbr.walk`).
