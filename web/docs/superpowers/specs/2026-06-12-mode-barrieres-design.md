# Mode barrières — objectif calé sur les barrières horaires

> **Status: Spec** · 2026-06-12 · Code cible : `web/lib/plan/barrier-lock.ts` (nouveau),
> `web/components/plan/WaypointsTable.tsx`,
> `web/app/(main)/plan/courses/[id]/print/page.tsx`,
> `web/components/plan/PacingStrategyCard.tsx`,
> `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx`,
> `web/lib/i18n/dictionaries/{fr,en}.ts`.

## Problème

Dans le **Tableau de course** (onglet Plan), la colonne **Obj** projette l'heure de
passage à chaque point en répartissant le temps cible par **effort-km (distance + D+/100)
+ fade** (`estimatePassageTimes`, `lib/plan/pacing.ts`). La colonne **BH** affiche la
barrière horaire de la course.

Cas réel (Grand Raid, copié de Garmin) : départ **19:00** vendredi, **barrière d'arrivée
13:00 dimanche = 42 h**, objectif saisi **42h00**. Comme l'objectif vise le temps **maximum**,
la stratégie « Finir fort » (fade négatif → début plus lent) charge le début : point 2
(Séné Barrarac'h) projette **Obj 3h36** alors que sa **barrière est à 22:30 = 3h30**.
**3h36 > 3h30 ⇒ on est éliminé** : impossible.

**Cause racine** : quand l'objectif total **égale** la barrière finale, il reste **zéro
marge**. Tout décalage (fade, pondération D+) projette forcément un Obj **au-delà** d'au
moins une barrière intermédiaire. Dans ce cas la stratégie d'allure n'a aucun degré de
liberté : la seule trajectoire cohérente est de passer **exactement** à chaque barrière.

## Décisions (issues du brainstorming)

- **Déclenchement** : **automatique**, à la minute près. On bascule en « mode barrières »
  dès que `|objectif_total − barrière_d_arrivée| ≤ 60 s`.
- **Points sans barrière horaire** (ex. Locmariaquer, Pont de Kerino) : Obj calculé **au
  prorata de la distance seule** entre les barrières encadrantes — **aucune adaptation au
  D+**. Les points **avec** barrière restent **exacts**.
- **Bloc « Stratégie d'allure »** : **grisé + note** explicative ; courbe d'allure masquée
  (elle dépend du fade, ignoré dans ce mode). Le curseur n'a plus d'effet.

## Architecture

### 1. Nouveau module pur `web/lib/plan/barrier-lock.ts`

Isolé, sans dépendance React, testable unitairement. Réutilise `parseClockToElapsed` de
`lib/plan/waypoint-view.ts` et `estimatePassageTimes` de `lib/plan/pacing.ts`.

Forme d'entrée (sous-ensemble de `RaceWaypoint`) :

```ts
interface LockWaypoint {
  km: number
  dPlus: number | null
  targetOverrideSec: number | null
  cutoffRaw: string | null
  cutoffKind: 'clock_time' | 'elapsed' | 'unknown' | null
}
```

Fonctions exportées :

- **`barrierElapsedSeries(waypoints, startTime?): (number | null)[]`**
  Pour chaque point, secondes écoulées depuis le départ de sa barrière, `null` si absente.
  Parcours **monotone** (l'écoulé d'une barrière est toujours ≥ celui de la précédente) pour
  lever l'ambiguïté du jour :
  - `cutoffKind === 'elapsed'` → `HH:MM` interprété directement en secondes écoulées (pas
    besoin de `startTime`).
  - sinon (`clock_time`/`unknown`) → `parseClockToElapsed(startTime, 'HH:MM', prevElapsed)` ;
    `null` si `startTime` absent.

- **`arrivalBarrierSec(waypoints, startTime?): number | null`**
  Écoulé de la barrière du **dernier** point (arrivée) via `barrierElapsedSeries`. `null` si
  l'arrivée n'a pas de barrière exploitable.

- **`isBarrierLocked(waypoints, startTime, targetDurationMin): boolean`**
  `true` ssi `targetDurationMin != null`, `arrivalBarrierSec != null`, et
  `|arrivalBarrierSec − targetDurationMin·60| ≤ 60`.

- **`resolveElapsed(waypoints, startTime, targetDurationMin, fade): { elapsed: number[] | null; locked: boolean }`**
  **Point d'entrée unique** consommé par l'UI. `targetDurationMin == null` → `{ elapsed: null,
  locked: false }`.
  - **Mode barrières** (`isBarrierLocked` vrai) : `locked: true`. Ancres = `targetOverrideSec
    ?? barrière` à chaque point qui en a une, **départ = 0**, **arrivée = `targetDurationMin·60`**
    (= sa barrière). Les **trous** (points sans ancre) sont interpolés **au prorata de la
    distance** entre les deux ancres encadrantes :
    `elapsed[k] = elapsed[ia] + (elapsed[ib] − elapsed[ia]) · (km[k] − km[ia]) / (km[ib] − km[ia])`.
    Résultats arrondis à la seconde.
  - **Mode normal** : `locked: false`, `elapsed = estimatePassageTimes(...)` (effort-km + fade,
    inchangé).

### 2. Source de vérité unique (écran + PDF)

`WaypointsTable` ([`:124`](../../../components/plan/WaypointsTable.tsx)) **et** la carte
`/print` ([`:170`](../../../app/(main)/plan/courses/[id]/print/page.tsx)) remplacent leur appel
direct à `estimatePassageTimes` par **`resolveElapsed`** (en passant `cutoffRaw`/`cutoffKind`
en plus de `km`/`dPlus`/`targetOverrideSec`, et `startTime`). Les deux ont déjà `startTime`
sous la main. → colonne **Obj identique à l'écran et à l'impression**.

`estimatePassageTimes` **reste inchangé** : encore utilisé en interne par `resolveElapsed`
(mode normal) et directement par `PacingStrategyCard` pour la **courbe** (qui n'est affichée
qu'en mode normal).

### 3. Bloc « Stratégie d'allure » grisé + note

`PacingStrategyCard` gagne une prop **`barrierLocked?: boolean`**. Quand `true` :
- curseur **désactivé** (réutilise le style `:disabled`/`opacity` existant) ;
- `PaceCurve` **et** le bloc « méthode » **masqués** (dépendent du fade) ;
- phrase remplacée par la **note** : *« Objectif = barrière finale → heures calées sur les
  barrières (zéro marge). »* ;
- badge du résumé (`.psum-cur`) → libellé **« Barrières »** dans une **variante neutre/info**
  (nouvelle classe CSS `.v-lock`, ton `--trail-muted`).
- L'édition **objectif / départ** dans l'en-tête reste active : modifier l'objectif pour qu'il
  ne corresponde plus à la barrière finale **ressort automatiquement** du mode (re-render).

`CoursePageClient` calcule
`const barrierLocked = isBarrierLocked(waypoints, race.startTime, race.targetDurationMin)` et
le passe à `PacingStrategyCard`. Aucun changement de `race` persisté : le mode est **dérivé**,
jamais stocké.

### 4. i18n

Nouvelles clés sous `plan` dans `dictionaries/fr.ts` **et** `en.ts` :
- `pacingLockedNote` — la note ci-dessus.
- `pacingLockedBadge` — « Barrières » / « Cutoffs ».

## Flux de données

```
race.startTime + race.targetDurationMin + waypoints(cutoffRaw/kind, km, dPlus, override)
   │
   ├─ CoursePageClient → isBarrierLocked(...) ─→ PacingStrategyCard barrierLocked
   │
   └─ WaypointsTable / print  → resolveElapsed(...) → { elapsed, locked }
                                       │
              locked ? ancres barrières + interpolation distance
                     : estimatePassageTimes (effort-km + fade)
                                       │
                              colonne Obj (écran = PDF)
```

## Cas limites

- **Arrivée sans barrière** exploitable → non verrouillé → mode normal.
- **`startTime` absent** et barrières en `clock_time` → non verrouillé (impossible de
  convertir). Barrières en `elapsed` restent gérées sans `startTime`.
- **Override manuel** d'un Obj en mode barrières : `targetOverrideSec` **prime** sur la
  barrière (ancre prioritaire).
- **Objectif modifié** via `TimeEditModal` pour ne plus matcher la barrière finale → le mode
  redevient normal automatiquement (dérivé, pas de persistance).
- **Sous-texte de la colonne Obj** (durée de tronçon) : inchangé — il dérive de `elapsed[i] −
  elapsed[i−1]`, cohérent dans les deux modes.

## Tests

`web/__tests__/lib/plan/barrier-lock.test.ts` (logique pure, pas de rendu) :

- **`isBarrierLocked`** : cas Grand Raid (objectif 42h00, arrivée 13:00 J+2, départ 19:00) →
  `true` ; objectif 40h00 (≠ barrière) → `false` ; arrivée sans barrière → `false` ;
  `startTime` absent + barrière horloge → `false`.
- **`resolveElapsed` verrouillé** : sur le tableau Grand Raid, point 2 = **12 600 s (3h30)**
  et **non 3h36** ; arrivée = `targetDurationMin·60` ; un point **sans** barrière entre deux
  barrières est interpolé **au prorata de la distance** (vérifier une valeur calculée à la
  main) ; un `targetOverrideSec` posé sur un point intermédiaire est respecté.
- **`resolveElapsed` non verrouillé** : objectif < barrière finale → `locked:false` et
  `elapsed` identique à `estimatePassageTimes`.
- **Passage de minuit** : barrière dont l'heure d'horloge tombe le lendemain → écoulé
  monotone correct.

Vérif manuelle : ouvrir la course Grand Raid, objectif 42h00 → bloc allure grisé + note,
colonne Obj alignée sur les BH (point 2 = 3h30) ; baisser l'objectif à 40h → bloc allure
réactivé, répartition effort-km de retour.

## Hors scope (YAGNI)

- **Pas** de « clamp » général des Obj sous leurs barrières en mode normal — on ne traite que
  le cas exact `objectif == barrière finale` demandé.
- **Pas** de bascule manuelle (le déclenchement est automatique).
- **Pas** de migration Supabase (mode dérivé, rien de persisté).

## Fichiers touchés

- `web/lib/plan/barrier-lock.ts` — **nouveau** module pur.
- `web/components/plan/WaypointsTable.tsx` — `elapsed` via `resolveElapsed` (+ `cutoffRaw`/
  `cutoffKind` dans le map).
- `web/app/(main)/plan/courses/[id]/print/page.tsx` — `elapsed` via `resolveElapsed`.
- `web/components/plan/PacingStrategyCard.tsx` — prop `barrierLocked`, état grisé + note,
  badge `.v-lock`, masquage courbe/méthode.
- `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx` — calcul `isBarrierLocked` →
  prop `barrierLocked`.
- `web/lib/i18n/dictionaries/fr.ts` + `en.ts` — `pacingLockedNote`, `pacingLockedBadge`.
- `web/__tests__/lib/plan/barrier-lock.test.ts` — **nouveau** test.
