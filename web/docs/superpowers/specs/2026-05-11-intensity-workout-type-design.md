# Séparation Intensité / Type d'activité

**Date :** 2026-05-11  
**Scope :** `web/` uniquement  
**Approche retenue :** Refacto in-place dans `intensity.ts` (Approche A)

---

## Problème

Le bloc "Intensité" mélange deux notions distinctes :
- L'intensité **physiologique** (basée sur la fréquence cardiaque)
- Le **type de séance** (basé sur le contexte/titre : sortie longue, côtes, fractionné…)

`guessIntensity()` utilise les mots-clés du titre EN PRIORITÉ sur les zones FC, ce qui est incorrect. `INTENSITY_OPTIONS` inclut `sortie_longue` et `cotes` qui ne sont pas des intensités cardio.

---

## Solution

Séparer les deux notions en deux blocs distincts dans l'édition d'activité.

---

## Section 1 — `lib/activities/intensity.ts`

### `IntensityKey` (type TypeScript)

Retirer `sortie_longue`, `cotes`, `autre` :

```ts
export type IntensityKey =
  | 'recuperation' | 'footing' | 'endurance_active' | 'seuil' | 'vma'
```

### `INTENSITY_OPTIONS`

5 options physiologiques uniquement :

| key               | label              | description                          |
|-------------------|--------------------|--------------------------------------|
| `recuperation`    | 😴 Récupération    | très facile, récupération active     |
| `footing`         | 🦶 Footing         | endurance fondamentale               |
| `endurance_active`| 🔄 Endurance active| tempo, effort soutenu mais aérobie  |
| `seuil`           | 🎯 Seuil           | proche du seuil anaérobie            |
| `vma`             | 🔥 VMA             | VO₂max, effort maximal               |

### `guessIntensity()` — nouvelle signature

```ts
export function guessIntensity(
  avgHr?: number | null,
  hrZones?: HrZone[],
): IntensityKey | null
```

- Zéro keyword. Pure HR.
- Retourne `null` si `avgHr` absent, `hrZones` vide, ou zone indéterminable.
- Mapping zone → intensité :
  - Zone 1 → `'recuperation'`
  - Zone 2 → `'footing'`
  - Zone 3 → `'endurance_active'`
  - Zone 4 → `'seuil'`
  - Zone 5 → `'vma'`

### `WorkoutType` (type TypeScript — déjà existant)

```ts
export type WorkoutType =
  | 'sortie_longue' | 'fractionne' | 'cotes' | 'course' | 'runtaf' | 'velotaf'
```

Retirer `'autre'` du type (l'absence de type = `null`).

### `WORKOUT_TYPE_OPTIONS` (nouvelle constante)

```ts
export const WORKOUT_TYPE_OPTIONS: { value: WorkoutType; label: string; sports?: string[] }[]
```

| value          | label              | sports restreints                          |
|----------------|--------------------|--------------------------------------------|
| `sortie_longue`| 🐢 Sortie longue   | tous                                       |
| `fractionne`   | ⌚ Fractionné      | tous                                       |
| `cotes`        | ⛰️ Côtes            | tous                                       |
| `course`       | 🏆 Course          | tous                                       |
| `runtaf`       | 🏃‍♂️💻 Runtaf       | `Run`, `TrailRun` uniquement               |
| `velotaf`      | 🚴🏻💻 Velotaf      | `Ride`, `EBikeRide`, `VirtualRide` uniquement|

### `guessWorkoutType()` — corrections

Fonction déjà existante, deux corrections :
1. `taf` + `TrailRun` → `runtaf` (manquant)
2. `Home 🏃‍♂️` / `🏃‍♂️ Home` → `runtaf` (manquant)

Priorité de détection (inchangée) :
1. Runtaf / Velotaf (si sport compatible)
2. Côtes
3. Course (exclure "course à pied")
4. Fractionné
5. Sortie longue
6. `null`

---

## Section 2 — Base de données & API

### Migration `011_add_manual_workout_type.sql`

```sql
ALTER TABLE activities ADD COLUMN manual_workout_type text;

-- Récupère les manual_intensity mal catégorisées comme workout_type
UPDATE activities
  SET manual_workout_type = 'sortie_longue', manual_intensity = NULL
  WHERE manual_intensity = 'sortie_longue';

UPDATE activities
  SET manual_workout_type = 'cotes', manual_intensity = NULL
  WHERE manual_intensity = 'cotes';
```

`manual_intensity = 'autre'` → conservé en DB mais ignoré côté UI (affiché comme null).

### API `PATCH /api/activities/[id]`

Ajouter `manual_workout_type?: string | null` dans le body et le `update()` Supabase.

### `ActivityRow` (type TypeScript dans `ActivityCard.tsx`)

Ajouter `manual_workout_type: string | null`.

---

## Section 3 — UI

### `EditActivityModal.tsx`

**Nouvelle prop :** `hrZones: HrZone[]` (défaut `[]`)

**Initialisation intensité :**
```ts
// State: IntensityKey | null
const [intensity, setIntensity] = useState<IntensityKey | null>(
  (a.manual_intensity as IntensityKey | null) ?? guessIntensity(a.avg_hr, hrZones) ?? null
)
```

Si `intensity === null`, aucun chip actif dans le ChipRow Intensité.

**Nouveau bloc "Type"** (sous Intensité) :
- `ChipRow` avec `WORKOUT_TYPE_OPTIONS` filtrées par sport courant
- State : `workoutType: string | null`
- Init : `a.manual_workout_type ?? guessWorkoutType(a.name, effectiveSport) ?? null`
- Si le sport change et que le type sélectionné est incompatible → reset `workoutType` à `null`
- Inclus dans le PATCH : `manual_workout_type: workoutType`

### `ActivityCard.tsx`

- `intensityKey: IntensityKey | null` (était `string`)
- Si `null` → ne pas rendre le bouton emoji intensité (ou afficher `—`)
- Retirer `sortie_longue`, `cotes`, `autre` de `INTENSITY_EMOJI`
- `ActivityRow` : ajouter `manual_workout_type: string | null`

### `ActivityPopups.tsx`

- `IntensityPopup` : ne lister que les 5 zones physiologiques
- `INTENSITY_DESC` : mettre à jour avec les descriptions de la spec, retirer `sortie_longue`/`cotes`/`autre`

### `ActivitiesClient.tsx`

- Passer `hrZones={hrZones}` à `EditActivityModal`
- Ligne ~599 : mettre à jour l'appel `guessIntensity()` pour la nouvelle signature (supprimer les args `name` et `sport`)

---

## Section 4 — Tests

**Fichier :** `web/__tests__/activities/classification.test.ts`

### `guessIntensity()` — tests HR purs

| scenario                                   | attendu           |
|--------------------------------------------|-------------------|
| avgHr en zone 1, hrZones configurées       | `'recuperation'`  |
| avgHr en zone 2                            | `'footing'`       |
| avgHr en zone 3                            | `'endurance_active'` |
| avgHr en zone 4                            | `'seuil'`         |
| avgHr en zone 5                            | `'vma'`           |
| avgHr = null, hrZones configurées          | `null`            |
| avgHr présent, hrZones = []                | `null`            |
| avgHr = undefined, hrZones = undefined     | `null`            |

### `guessWorkoutType()` — tests titre

| titre                           | sport          | attendu          |
|---------------------------------|----------------|------------------|
| `"Sortie longue dimanche"`      | `Run`          | `'sortie_longue'`|
| `"SL trail cool"`               | `TrailRun`     | `'sortie_longue'`|
| `"10x400 VMA"`                  | `Run`          | `'fractionne'`   |
| `"Fractionné 6x1000"`           | `Run`          | `'fractionne'`   |
| `"Séance côtes 10x400"`         | `Run`          | `'cotes'`        |
| `"Hill repeats"`                | `TrailRun`     | `'cotes'`        |
| `"10x400 côte"`                 | `Run`          | `'cotes'`        |
| `"Marathon Paris"`              | `Run`          | `'course'`       |
| `"Semi objectif chrono"`        | `Run`          | `'course'`       |
| `"Runtaf maison bureau"`        | `Run`          | `'runtaf'`       |
| `"taf"`                         | `TrailRun`     | `'runtaf'`       |
| `"Velotaf bureau"`              | `Ride`         | `'velotaf'`      |
| `"taf"`                         | `EBikeRide`    | `'velotaf'`      |
| `"taf"`                         | `WeightTraining`| `null`          |

---

## Migration Supabase — action manuelle requise

La migration `011_add_manual_workout_type.sql` doit être collée manuellement dans le Dashboard Supabase (SQL Editor). Elle n'est PAS auto-appliquée.

---

## Fichiers impactés

| Fichier | Changement |
|---------|-----------|
| `web/lib/activities/intensity.ts` | Refacto `guessIntensity()`, `IntensityKey`, `INTENSITY_OPTIONS`, corrections `guessWorkoutType()`, ajout `WORKOUT_TYPE_OPTIONS` |
| `web/supabase/migrations/011_add_manual_workout_type.sql` | Nouveau fichier |
| `web/app/api/activities/[id]/route.ts` | Ajout `manual_workout_type` dans PATCH |
| `web/components/ui/ActivityCard.tsx` | `ActivityRow` + `intensityKey` nullable + `INTENSITY_EMOJI` |
| `web/components/ui/ActivityPopups.tsx` | `IntensityPopup` + `INTENSITY_DESC` |
| `web/components/ui/EditActivityModal.tsx` | Prop `hrZones`, bloc Type, init intensity nullable |
| `web/app/(main)/activities/ActivitiesClient.tsx` | Pass `hrZones` à modal, fix `guessIntensity` call |
| `web/__tests__/activities/classification.test.ts` | Nouveau fichier tests |

---

## Critères d'acceptation

- [ ] `guessIntensity()` ne contient plus aucun mot-clé
- [ ] `IntensityKey` ne contient plus `sortie_longue`, `cotes`, `autre`
- [ ] Le bloc Type existe dans `EditActivityModal` et est modifiable
- [ ] Runtaf proposé uniquement pour `Run` / `TrailRun`
- [ ] Velotaf proposé uniquement pour `Ride` / `EBikeRide` / `VirtualRide`
- [ ] `manual_workout_type` persisté en DB et dans l'API
- [ ] Import Strava non cassé
- [ ] Tous les tests classification passent
- [ ] Build OK
