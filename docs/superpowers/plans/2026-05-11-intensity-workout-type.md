> **Status: Implémenté** · Date: 2026-05-11 · Code: `web/lib/activities/intensity.ts`
> *Snapshot de design — pour l'état actuel, voir le code.*

# Intensity / Workout-Type Separation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Séparer l'intensité cardiaque (zones FC) du type de séance (mots-clés titre) dans Trail Cockpit web.

**Architecture:** Refacto in-place dans `lib/activities/intensity.ts` — `guessIntensity()` devient pure HR (retourne `IntensityKey | null`), `guessWorkoutType()` corrigé (priorité Runtaf/Velotaf, retourne `null` au lieu de `'autre'`, support TrailRun). Nouveau bloc "Type" dans `EditActivityModal`. Migration Supabase pour colonne `manual_workout_type`.

**Tech Stack:** Next.js 14, TypeScript, Supabase, Jest (tests avec `npx jest` dans `web/`)

---

## File Map

| Action   | Fichier                                                             | Rôle                                    |
|----------|---------------------------------------------------------------------|-----------------------------------------|
| Create   | `web/__tests__/activities/classification.test.ts`                   | Tests unitaires guessIntensity/guessWorkoutType |
| Modify   | `web/lib/activities/intensity.ts`                                   | Refacto IntensityKey, guessIntensity, WorkoutType, guessWorkoutType, WORKOUT_TYPE_OPTIONS |
| Create   | `web/supabase/migrations/011_add_manual_workout_type.sql`           | Colonne manual_workout_type + remap     |
| Modify   | `web/app/api/activities/route.ts`                                   | SELECT_COLS += manual_workout_type      |
| Modify   | `web/app/api/activities/[id]/route.ts`                              | PATCH body += manual_workout_type       |
| Modify   | `web/components/ui/ActivityCard.tsx`                                | ActivityRow type + intensityKey nullable |
| Modify   | `web/components/ui/ActivityPopups.tsx`                              | INTENSITY_DESC / IntensityPopup (5 zones) |
| Modify   | `web/components/ui/EditActivityModal.tsx`                           | hrZones prop + bloc Type                |
| Modify   | `web/app/(main)/activities/ActivitiesClient.tsx`                    | Pass hrZones à modal, fix guessIntensity call |
| Modify   | `web/app/(main)/activities/[id]/ActivityDetailClient.tsx`           | Fix guessIntensity call + pass hrZones  |

---

## Task 1 — Tests de classification (TDD : écrire avant d'implémenter)

**Files:**
- Create: `web/__tests__/activities/classification.test.ts`

- [ ] **Créer le fichier de tests**

```ts
// web/__tests__/activities/classification.test.ts
import {
  guessIntensity,
  guessWorkoutType,
} from '@/lib/activities/intensity'
import type { HrZone } from '@/lib/health/hr-zones'

const MOCK_ZONES: HrZone[] = [
  { zone: 1, name: 'Récupération',           min: null, max: 130, color: '#4caf50' },
  { zone: 2, name: 'Endurance fondamentale',  min: 131, max: 148, color: '#38bdf8' },
  { zone: 3, name: 'Endurance active',        min: 149, max: 162, color: '#f59e0b' },
  { zone: 4, name: 'Seuil',                   min: 163, max: 173, color: '#e8651a' },
  { zone: 5, name: 'Très intense',            min: 174, max: 190, color: '#ef4444' },
]

describe('guessIntensity — pure HR', () => {
  it('zone 1 → recuperation', () => {
    expect(guessIntensity(120, MOCK_ZONES)).toBe('recuperation')
  })
  it('zone 2 → footing', () => {
    expect(guessIntensity(140, MOCK_ZONES)).toBe('footing')
  })
  it('zone 3 → endurance_active', () => {
    expect(guessIntensity(155, MOCK_ZONES)).toBe('endurance_active')
  })
  it('zone 4 → seuil', () => {
    expect(guessIntensity(168, MOCK_ZONES)).toBe('seuil')
  })
  it('zone 5 → vma', () => {
    expect(guessIntensity(180, MOCK_ZONES)).toBe('vma')
  })
  it('null avgHr → null', () => {
    expect(guessIntensity(null, MOCK_ZONES)).toBeNull()
  })
  it('hrZones vides → null', () => {
    expect(guessIntensity(140, [])).toBeNull()
  })
  it('aucun argument → null', () => {
    expect(guessIntensity()).toBeNull()
  })
})

describe('guessWorkoutType — détection par titre', () => {
  it('"Sortie longue dimanche" → sortie_longue', () => {
    expect(guessWorkoutType('Sortie longue dimanche', 'Run')).toBe('sortie_longue')
  })
  it('"SL trail cool" → sortie_longue', () => {
    expect(guessWorkoutType('SL trail cool', 'TrailRun')).toBe('sortie_longue')
  })
  it('"10x400 VMA" → fractionne', () => {
    expect(guessWorkoutType('10x400 VMA', 'Run')).toBe('fractionne')
  })
  it('"Fractionné 6x1000" → fractionne', () => {
    expect(guessWorkoutType('Fractionné 6x1000', 'Run')).toBe('fractionne')
  })
  it('"Séance côtes 10x400" → cotes (priorité sur fractionne)', () => {
    expect(guessWorkoutType('Séance côtes 10x400', 'Run')).toBe('cotes')
  })
  it('"Hill repeats" → cotes', () => {
    expect(guessWorkoutType('Hill repeats', 'TrailRun')).toBe('cotes')
  })
  it('"10x400 côte" → cotes (priorité sur fractionne)', () => {
    expect(guessWorkoutType('10x400 côte', 'Run')).toBe('cotes')
  })
  it('"Marathon Paris" → course', () => {
    expect(guessWorkoutType('Marathon Paris', 'Run')).toBe('course')
  })
  it('"Semi objectif chrono" → course', () => {
    expect(guessWorkoutType('Semi objectif chrono', 'Run')).toBe('course')
  })
  it('"Runtaf maison bureau" + Run → runtaf', () => {
    expect(guessWorkoutType('Runtaf maison bureau', 'Run')).toBe('runtaf')
  })
  it('"taf" + TrailRun → runtaf', () => {
    expect(guessWorkoutType('taf', 'TrailRun')).toBe('runtaf')
  })
  it('"Velotaf bureau" + Ride → velotaf', () => {
    expect(guessWorkoutType('Velotaf bureau', 'Ride')).toBe('velotaf')
  })
  it('"taf" + EBikeRide → velotaf', () => {
    expect(guessWorkoutType('taf', 'EBikeRide')).toBe('velotaf')
  })
  it('"taf" + WeightTraining → null', () => {
    expect(guessWorkoutType('taf', 'WeightTraining')).toBeNull()
  })
})
```

- [ ] **Vérifier que les tests échouent (fonction guessIntensity signature différente, guessWorkoutType retourne 'autre' au lieu de null)**

```bash
cd web && npx jest __tests__/activities/classification.test.ts --no-coverage 2>&1 | tail -20
```

Attendu : plusieurs FAIL (signature guessIntensity incorrecte, null vs 'autre')

---

## Task 2 — Refactorer `intensity.ts`

**Files:**
- Modify: `web/lib/activities/intensity.ts`

- [ ] **Remplacer le contenu complet de `intensity.ts`**

```ts
import type { HrZone } from '@/lib/health/hr-zones'
import { hrZoneForAvgHr } from '@/lib/health/hr-zones'

export type IntensityKey =
  | 'recuperation' | 'footing' | 'endurance_active' | 'seuil' | 'vma'

export type WorkoutType =
  | 'sortie_longue' | 'fractionne' | 'cotes' | 'course' | 'runtaf' | 'velotaf'

export type IntensityOption   = { key: IntensityKey; label: string }
export type SportOption       = { value: string; label: string }
export type WorkoutTypeOption = { value: WorkoutType; label: string; sports?: string[] }

export const INTENSITY_OPTIONS: IntensityOption[] = [
  { key: 'recuperation',     label: '😴 Récupération'    },
  { key: 'footing',          label: '🦶 Footing'          },
  { key: 'endurance_active', label: '🔄 Endurance active' },
  { key: 'seuil',            label: '🎯 Seuil'            },
  { key: 'vma',              label: '🔥 VMA'              },
]

export const WORKOUT_TYPE_OPTIONS: WorkoutTypeOption[] = [
  { value: 'sortie_longue', label: '🐢 Sortie longue' },
  { value: 'fractionne',    label: '⌚ Fractionné'    },
  { value: 'cotes',         label: '⛰️ Côtes'          },
  { value: 'course',        label: '🏆 Course'         },
  { value: 'runtaf',        label: '🏃‍♂️💻 Runtaf',  sports: ['Run', 'TrailRun'] },
  { value: 'velotaf',       label: '🚴🏻💻 Velotaf', sports: ['Ride', 'EBikeRide', 'VirtualRide'] },
]

export const SPORT_OPTIONS: SportOption[] = [
  { value: 'Run',            label: 'Running'         },
  { value: 'TrailRun',       label: 'Trail'           },
  { value: 'Walk',           label: 'Marche'          },
  { value: 'Hike',           label: 'Randonnée'       },
  { value: 'Ride',           label: 'Vélo'            },
  { value: 'VirtualRide',    label: 'Vélo virtuel'    },
  { value: 'EBikeRide',      label: 'Vélo électrique' },
  { value: 'Swim',           label: 'Natation'        },
  { value: 'WeightTraining', label: 'Muscu'           },
  { value: 'Workout',        label: 'Autre'           },
]

export function secondsToHMS(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function hmsToSeconds(hms: string): number | null {
  const match = hms.match(/^(\d+):(\d{2}):(\d{2})$/)
  if (!match) return null
  return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3])
}

function zoneToIntensity(zone: number): IntensityKey {
  if (zone <= 1) return 'recuperation'
  if (zone === 2) return 'footing'
  if (zone === 3) return 'endurance_active'
  if (zone === 4) return 'seuil'
  return 'vma'
}

export function guessIntensity(
  avgHr?:   number | null,
  hrZones?: HrZone[],
): IntensityKey | null {
  if (avgHr == null || !hrZones || hrZones.length === 0) return null
  const zone = hrZoneForAvgHr(avgHr, hrZones)
  if (zone === null) return null
  return zoneToIntensity(zone)
}

const RUN_SPORTS  = new Set(['Run', 'TrailRun'])
const BIKE_SPORTS = new Set(['Ride', 'EBikeRide', 'VirtualRide'])

export function guessWorkoutType(name: string, sport: string): WorkoutType | null {
  const n = name.toLowerCase()

  // 1. Runtaf (Run / TrailRun uniquement)
  if (RUN_SPORTS.has(sport)) {
    if (n.includes('runtaf') || n.includes('run taf')
        || name.includes('Home 🏃‍♂️') || name.includes('🏃‍♂️ Home')
        || n.includes('taf'))
      return 'runtaf'
  }

  // 2. Velotaf (vélo uniquement)
  if (BIKE_SPORTS.has(sport)) {
    if (n.includes('vélotaf') || n.includes('velotaf') || n.includes('vélo taf')
        || name.includes('Home 🚴🏻') || name.includes('🚴🏻 Home')
        || n.includes('taf'))
      return 'velotaf'
  }

  // 3. Côtes / montées (priorité sur fractionné)
  if (n.includes('côtes') || n.includes('cotes') || n.includes('côte') || n.includes('cote')
      || n.includes('montée') || n.includes('montee') || n.includes('hill'))
    return 'cotes'

  // 4. Fractionné / intervalles
  if (/(?<!\d)(200|300|400|500|800|1000)(?!\d)/.test(n)
      || n.includes('vma') || n.includes('interval') || n.includes('fractionné')
      || n.includes('fractionnée') || n.includes('répétition') || n.includes('repetition'))
    return 'fractionne'

  // 5. Compétition — exclure "course à pied"
  const isCourseAPied = n.includes('course à pied') || n.includes('course a pied')
  if (!isCourseAPied) {
    if (n.includes('race') || n.includes('compét') || n.includes('compet')
        || n.includes('dossard') || n.includes('chrono') || n.includes(' pb ')
        || n.includes(' pr ') || /\b10k\b/.test(n) || n.includes('semi')
        || n.includes('marathon'))
      return 'course'
  }

  // 6. Sortie longue
  if (n.includes('sortie longue') || /\bsl\b/.test(n) || n.includes('long run') || n.includes('lsl'))
    return 'sortie_longue'

  return null
}
```

- [ ] **Lancer les tests de classification**

```bash
cd web && npx jest __tests__/activities/classification.test.ts --no-coverage 2>&1 | tail -30
```

Attendu : tous les tests PASS (16 tests)

- [ ] **Commit**

```bash
cd web && git add lib/activities/intensity.ts __tests__/activities/classification.test.ts && git commit -m "feat: guessIntensity pure HR + guessWorkoutType null fallback + TrailRun support"
```

---

## Task 3 — Migration Supabase

**Files:**
- Create: `web/supabase/migrations/011_add_manual_workout_type.sql`

- [ ] **Créer le fichier de migration**

```sql
-- 011_add_manual_workout_type.sql
-- Ajoute la colonne manual_workout_type pour séparer le type de séance de l'intensité cardio.
-- Les manual_intensity mal catégorisées (sortie_longue, cotes) sont rapatriées en workout_type.
ALTER TABLE activities ADD COLUMN IF NOT EXISTS manual_workout_type text;

UPDATE activities
  SET manual_workout_type = 'sortie_longue', manual_intensity = NULL
  WHERE manual_intensity = 'sortie_longue';

UPDATE activities
  SET manual_workout_type = 'cotes', manual_intensity = NULL
  WHERE manual_intensity = 'cotes';
```

- [ ] **Commit** (ne pas appliquer en DB maintenant — cf. note ci-dessous)

```bash
cd web && git add supabase/migrations/011_add_manual_workout_type.sql && git commit -m "feat(db): migration 011 — add manual_workout_type column"
```

> ⚠️ **Action manuelle requise :** coller ce SQL dans le Dashboard Supabase → SQL Editor avant de tester en production. La colonne n'est pas encore créée tant que tu ne l'appliques pas.

---

## Task 4 — Mettre à jour les routes API

**Files:**
- Modify: `web/app/api/activities/route.ts` (lignes 5)
- Modify: `web/app/api/activities/[id]/route.ts` (lignes 14–29)

- [ ] **`route.ts` — ajouter `manual_workout_type` dans SELECT_COLS**

Dans `web/app/api/activities/route.ts`, remplacer la ligne 5 :

```ts
// Avant
const SELECT_COLS = 'id, name, sport_type, start_time, ces, avg_hr, distance_m, elevation_gain_m, moving_time_sec, manual_sport_type, manual_intensity, manual_distance_m, manual_moving_time_sec, manual_elevation_gain_m'

// Après
const SELECT_COLS = 'id, name, sport_type, start_time, ces, avg_hr, distance_m, elevation_gain_m, moving_time_sec, manual_sport_type, manual_intensity, manual_workout_type, manual_distance_m, manual_moving_time_sec, manual_elevation_gain_m'
```

- [ ] **`[id]/route.ts` — ajouter `manual_workout_type` dans le PATCH**

Dans `web/app/api/activities/[id]/route.ts`, remplacer le bloc body + update (lignes 14–29) :

```ts
  const body = await request.json() as {
    name?:                    string
    manual_sport_type?:       string | null
    manual_intensity?:        string | null
    manual_workout_type?:     string | null
    manual_distance_m?:       number | null
    manual_moving_time_sec?:  number | null
    manual_elevation_gain_m?: number | null
  }

  const { name, manual_sport_type, manual_intensity, manual_workout_type,
          manual_distance_m, manual_moving_time_sec, manual_elevation_gain_m } = body

  const { error } = await supabase
    .from('activities')
    .update({ name, manual_sport_type, manual_intensity, manual_workout_type,
              manual_distance_m, manual_moving_time_sec, manual_elevation_gain_m })
    .eq('id', id)
    .eq('user_id', user.id)
```

- [ ] **Commit**

```bash
cd web && git add app/api/activities/route.ts app/api/activities/\[id\]/route.ts && git commit -m "feat(api): add manual_workout_type to activities routes"
```

---

## Task 5 — Mettre à jour `ActivityCard.tsx` et `ActivityPopups.tsx`

**Files:**
- Modify: `web/components/ui/ActivityCard.tsx`
- Modify: `web/components/ui/ActivityPopups.tsx`

- [ ] **`ActivityCard.tsx` — 4 changements**

**1. Ajouter `manual_workout_type` à `ActivityRow` (ligne 117) :**

```ts
export type ActivityRow = {
  id:                      string
  sport_type:              string
  name:                    string
  start_time:              string
  ces:                     number | null
  avg_hr:                  number | null
  distance_m:              number | null
  elevation_gain_m:        number | null
  moving_time_sec:         number | null
  manual_sport_type:       string | null
  manual_intensity:        string | null
  manual_workout_type:     string | null
  manual_distance_m:       number | null
  manual_moving_time_sec:  number | null
  manual_elevation_gain_m: number | null
}
```

**2. Mettre à jour `INTENSITY_EMOJI` (ligne 11) — retirer les workout types :**

```ts
const INTENSITY_EMOJI: Record<string, string> = {
  recuperation:     '😴',
  footing:          '🦶',
  endurance_active: '🔄',
  seuil:            '🎯',
  vma:              '🔥',
}
```

**3. Mettre à jour le calcul `intensityKey` (ligne 158) — nouvelle signature guessIntensity :**

```ts
const intensityKey = (a.manual_intensity as IntensityKey | null) ?? guessIntensity(a.avg_hr, hrZones)
```

**4. Rendre le bouton emoji conditionnel (ligne 225) — ne pas afficher si null :**

Remplacer le bouton intensité (bloc `<button onClick={...} setPopup('intensity')}>`) :

```tsx
{intensityKey && (
  <button
    onClick={(e) => { e.stopPropagation(); setPopup('intensity') }}
    className="flex items-center justify-center text-[18px] leading-none"
    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
  >
    {INTENSITY_EMOJI[intensityKey] ?? '❓'}
  </button>
)}
```

- [ ] **`ActivityPopups.tsx` — mettre à jour `INTENSITY_EMOJI` et `INTENSITY_DESC` (lignes 7–27)**

```ts
const INTENSITY_EMOJI: Record<string, string> = {
  recuperation:     '😴',
  footing:          '🦶',
  endurance_active: '🔄',
  seuil:            '🎯',
  vma:              '🔥',
}

const INTENSITY_DESC: Record<string, string> = {
  recuperation:     'très facile, récupération active',
  footing:          'endurance fondamentale',
  endurance_active: 'tempo, effort soutenu mais aérobie',
  seuil:            'proche du seuil anaérobie',
  vma:              'VO₂max, effort maximal',
}
```

- [ ] **Commit**

```bash
cd web && git add components/ui/ActivityCard.tsx components/ui/ActivityPopups.tsx && git commit -m "feat(ui): ActivityRow + intensityKey nullable + 5-zone intensity display"
```

---

## Task 6 — Mettre à jour `EditActivityModal.tsx`

**Files:**
- Modify: `web/components/ui/EditActivityModal.tsx`

- [ ] **Mise à jour des imports (lignes 3–12)**

```ts
import { useState } from 'react'
import { colors } from '@/lib/design/colors'
import {
  guessIntensity,
  guessWorkoutType,
  secondsToHMS,
  hmsToSeconds,
  INTENSITY_OPTIONS,
  WORKOUT_TYPE_OPTIONS,
  SPORT_OPTIONS,
  type IntensityKey,
} from '@/lib/activities/intensity'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import type { HrZone } from '@/lib/health/hr-zones'
```

- [ ] **Mettre à jour le type `Props` (ligne 82)**

```ts
type Props = {
  activity:  ActivityRow
  hrZones?:  HrZone[]
  onSaved:   (updated: ActivityRow) => void
  onDeleted: () => void
  onClose:   () => void
}
```

- [ ] **Mettre à jour la déstructuration et les states (lignes 89–117)**

```ts
export function EditActivityModal({ activity: a, hrZones = [], onSaved, onDeleted, onClose }: Props) {
  const effectiveSport     = a.manual_sport_type     ?? a.sport_type
  const effectiveDistance  = a.manual_distance_m     ?? a.distance_m
  const effectiveDuration  = a.manual_moving_time_sec ?? a.moving_time_sec
  const effectiveElevation = a.manual_elevation_gain_m ?? a.elevation_gain_m

  const [name,        setName]        = useState(a.name)
  const [distKm,      setDistKm]      = useState(
    effectiveDistance  != null ? (effectiveDistance / 1000).toFixed(1)  : ''
  )
  const [duration,    setDuration]    = useState(
    effectiveDuration  != null ? secondsToHMS(effectiveDuration) : '0:00:00'
  )
  const [elevM,       setElevM]       = useState(
    effectiveElevation != null ? String(Math.round(effectiveElevation)) : ''
  )
  const [sport,       setSport]       = useState(effectiveSport)
  const [intensity,   setIntensity]   = useState<IntensityKey | null>(
    (a.manual_intensity as IntensityKey | null) ?? guessIntensity(a.avg_hr, hrZones) ?? null
  )
  const [workoutType, setWorkoutType] = useState<string | null>(
    a.manual_workout_type ?? guessWorkoutType(a.name, effectiveSport) ?? null
  )
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  function availableWorkoutTypes(s: string) {
    return WORKOUT_TYPE_OPTIONS.filter(o => !o.sports || o.sports.includes(s))
  }

  function handleSportChange(s: string) {
    setSport(s)
    if (workoutType) {
      const opt = WORKOUT_TYPE_OPTIONS.find(o => o.value === workoutType)
      if (opt?.sports && !opt.sports.includes(s)) setWorkoutType(null)
    }
  }
```

- [ ] **Mettre à jour `handleSave` — inclure `manual_workout_type` (lignes 120–155)**

Dans le `JSON.stringify`, ajouter `manual_workout_type: workoutType` :

```ts
body: JSON.stringify({
  name,
  manual_sport_type:       sport,
  manual_intensity:        intensity,
  manual_workout_type:     workoutType,
  manual_distance_m:       distM,
  manual_moving_time_sec:  timeSec,
  manual_elevation_gain_m: elev,
}),
```

Et dans `onSaved({...})` ajouter `manual_workout_type: workoutType`.

- [ ] **Supprimer la fonction `availableIntensities` obsolète (ligne 110)**

Supprimer :
```ts
function availableIntensities(_s: string) {
  return INTENSITY_OPTIONS
}
```

- [ ] **Mettre à jour le bloc Intensité dans le JSX (lignes 262–269)**

Remplacer le `ChipRow` Intensité (qui utilisait `availableIntensities`) :

```tsx
{/* Intensité */}
<SectionCard title="Intensité">
  <ChipRow
    options={INTENSITY_OPTIONS.map(i => ({ value: i.key, label: i.label }))}
    selected={intensity ?? ''}
    onSelect={v => setIntensity(v as IntensityKey)}
  />
</SectionCard>

{/* Type */}
<SectionCard title="Type">
  <ChipRow
    options={availableWorkoutTypes(sport).map(o => ({ value: o.value, label: o.label }))}
    selected={workoutType ?? ''}
    onSelect={v => setWorkoutType(v === workoutType ? null : v)}
  />
</SectionCard>
```

Note : `onSelect` du bloc Type permet la dé-sélection (re-clic = null).

- [ ] **Commit**

```bash
cd web && git add components/ui/EditActivityModal.tsx && git commit -m "feat(ui): EditActivityModal — hrZones prop + bloc Type + intensity pure HR init"
```

---

## Task 7 — Mettre à jour `ActivitiesClient.tsx` et `ActivityDetailClient.tsx`

**Files:**
- Modify: `web/app/(main)/activities/ActivitiesClient.tsx`
- Modify: `web/app/(main)/activities/[id]/ActivityDetailClient.tsx`

- [ ] **`ActivitiesClient.tsx` — 2 changements**

**1. Passer `hrZones` à `EditActivityModal` (ligne 782) :**

```tsx
<EditActivityModal
  activity={editingActivity}
  hrZones={hrZones}
  onSaved={handleSaved}
  onDeleted={() => handleDeleted(editingActivity.id)}
  onClose={() => setEditingActivity(null)}
/>
```

**2. Corriger l'appel `guessIntensity` dans le filtre (ligne 599) :**

```ts
const key = (a.manual_intensity ?? guessIntensity(a.avg_hr, hrZones))
```

- [ ] **`ActivityDetailClient.tsx` — 2 changements**

**1. Corriger l'appel `guessIntensity` (ligne 304) :**

```ts
const intensityKey = a.manual_intensity ?? guessIntensity(a.avg_hr, hrZones)
```

**2. Passer `hrZones` à `EditActivityModal` (ligne 515) :**

```tsx
<EditActivityModal
  activity={activityAsActivityRow}
  hrZones={hrZones}
  onSaved={() => { router.refresh(); setShowEdit(false) }}
  onDeleted={() => { router.push('/activities'); setShowEdit(false) }}
  onClose={() => setShowEdit(false)}
/>
```

- [ ] **Commit**

```bash
cd web && git add "app/(main)/activities/ActivitiesClient.tsx" "app/(main)/activities/[id]/ActivityDetailClient.tsx" && git commit -m "feat(ui): pass hrZones to EditActivityModal, fix guessIntensity signature"
```

---

## Task 8 — Vérification finale : tests, TypeScript, build

- [ ] **Lancer tous les tests**

```bash
cd web && npx jest --no-coverage 2>&1 | tail -20
```

Attendu : tous les tests PASS

- [ ] **Vérifier TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -40
```

Attendu : 0 erreur

- [ ] **Build**

```bash
cd web && npm run build 2>&1 | tail -30
```

Attendu : build OK sans erreur

- [ ] **Commit final si des corrections ont été nécessaires**

```bash
cd web && git add -p && git commit -m "fix: type adjustments after intensity/workout-type separation"
```

---

## Note finale : migration Supabase

⚠️ Rappel : coller le contenu de `supabase/migrations/011_add_manual_workout_type.sql` dans le **Dashboard Supabase → SQL Editor** avant de déployer. La colonne `manual_workout_type` doit exister en base pour que le PATCH et le SELECT fonctionnent.
