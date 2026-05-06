# Activity Edit Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un bouton ⋮ sur chaque ActivityCard ouvrant un modal full-screen pour éditer sport, intensité, titre et métriques d'une activité, avec persistance dans Supabase via des colonnes `manual_*`.

**Architecture:** Les overrides utilisateur sont stockés dans 5 colonnes `manual_*` de la table `activities` — ignorées par le sync Strava. L'interface est un overlay `fixed inset-0` (même pattern que `SearchPanel`/`FilterPanel`). La logique de détection d'intensité est extraite dans un module pur testable.

**Tech Stack:** Next.js App Router, Supabase server client, React useState, TypeScript, Tailwind CSS.

---

## File Map

| Fichier | Action |
|---|---|
| `web/lib/activities/intensity.ts` | **Créé** — fonctions pures : `guessIntensity`, `secondsToHMS`, `hmsToSeconds`, constantes |
| `web/__tests__/activities/intensity.test.ts` | **Créé** — tests unitaires |
| `web/app/api/activities/[id]/route.ts` | **Créé** — PATCH + DELETE |
| `web/components/ui/ActivityCard.tsx` | **Modifié** — type étendu, résolution `manual_*`, bouton ⋮ |
| `web/components/ui/EditActivityModal.tsx` | **Créé** — modal complet |
| `web/app/activities/ActivitiesClient.tsx` | **Modifié** — state local, editingActivity, wire modal |
| `web/app/activities/page.tsx` | **Modifié** — select inclut `manual_*` |

---

## Task 1: Migration base de données Supabase

**Files:** Aucun fichier — SQL exécuté dans le dashboard Supabase.

- [ ] **Step 1: Exécuter le SQL dans le Supabase dashboard**

Aller dans Supabase → SQL Editor → New query, exécuter :

```sql
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS manual_sport_type       text,
  ADD COLUMN IF NOT EXISTS manual_intensity        text,
  ADD COLUMN IF NOT EXISTS manual_distance_m       float,
  ADD COLUMN IF NOT EXISTS manual_moving_time_sec  integer,
  ADD COLUMN IF NOT EXISTS manual_elevation_gain_m float;
```

- [ ] **Step 2: Vérifier dans Table Editor**

Ouvrir la table `activities` → confirmer que les 5 colonnes apparaissent avec valeurs NULL.

- [ ] **Step 3: Commit memo**

```bash
git commit --allow-empty -m "chore: supabase migration — manual_* columns added to activities"
```

---

## Task 2: Module de fonctions pures — intensité et temps

**Files:**
- Create: `web/lib/activities/intensity.ts`
- Create: `web/__tests__/activities/intensity.test.ts`

- [ ] **Step 1: Écrire les tests (failing)**

Créer `web/__tests__/activities/intensity.test.ts` :

```ts
import {
  guessIntensity,
  secondsToHMS,
  hmsToSeconds,
  INTENSITY_OPTIONS,
  SPORT_OPTIONS,
} from '@/lib/activities/intensity'

describe('secondsToHMS', () => {
  it('converts seconds to h:mm:ss', () => {
    expect(secondsToHMS(4920)).toBe('1:22:00')
    expect(secondsToHMS(3600)).toBe('1:00:00')
    expect(secondsToHMS(90)).toBe('0:01:30')
    expect(secondsToHMS(0)).toBe('0:00:00')
  })
})

describe('hmsToSeconds', () => {
  it('parses h:mm:ss to seconds', () => {
    expect(hmsToSeconds('1:22:00')).toBe(4920)
    expect(hmsToSeconds('0:01:30')).toBe(90)
    expect(hmsToSeconds('1:00:00')).toBe(3600)
  })
  it('returns null for invalid format', () => {
    expect(hmsToSeconds('82:00')).toBeNull()
    expect(hmsToSeconds('abc')).toBeNull()
    expect(hmsToSeconds('')).toBeNull()
  })
})

describe('guessIntensity', () => {
  it('detects footing keywords', () => {
    expect(guessIntensity('Footing matinal', null, 'Run')).toBe('footing')
    expect(guessIntensity('Récup légère', null, 'Run')).toBe('footing')
  })
  it('detects sortie longue keywords', () => {
    expect(guessIntensity('Sortie longue dimanche', null, 'Run')).toBe('sortie_longue')
    expect(guessIntensity('SL 2h trail', null, 'TrailRun')).toBe('sortie_longue')
  })
  it('detects côtes keywords', () => {
    expect(guessIntensity('Côtes 200m', null, 'Run')).toBe('cotes')
    expect(guessIntensity('Montée répétées', null, 'Run')).toBe('cotes')
  })
  it('detects vma keywords', () => {
    expect(guessIntensity('VMA 400m x8', null, 'Run')).toBe('vma')
    expect(guessIntensity('Séance fractionné', null, 'Run')).toBe('vma')
  })
  it('detects seuil keywords', () => {
    expect(guessIntensity('Seuil 20min', null, 'Run')).toBe('seuil')
    expect(guessIntensity('Tempo run', null, 'Run')).toBe('seuil')
  })
  it('detects runtaf by keyword and sport', () => {
    expect(guessIntensity('Runtaf maison', null, 'Run')).toBe('runtaf')
    expect(guessIntensity('Taf à pied', null, 'Run')).toBe('runtaf')
  })
  it('detects velotaf by keyword and sport', () => {
    expect(guessIntensity('Vélotaf boulot', null, 'Ride')).toBe('velotaf')
    expect(guessIntensity('Taf en vélo', null, 'Ride')).toBe('velotaf')
  })
  it('detects course keywords', () => {
    expect(guessIntensity('Course 10k Lyon', null, 'Run')).toBe('course')
    expect(guessIntensity('Semi-marathon', null, 'Run')).toBe('course')
  })
  it('falls back to CES thresholds when no keyword', () => {
    expect(guessIntensity('Sortie', 130, 'Run')).toBe('seuil')
    expect(guessIntensity('Sortie', 80, 'Run')).toBe('runtaf')
    expect(guessIntensity('Sortie', 50, 'Run')).toBe('footing')
  })
  it('returns autre when no keyword and no CES', () => {
    expect(guessIntensity('Sortie', null, 'Run')).toBe('autre')
  })
})

describe('INTENSITY_OPTIONS', () => {
  it('has 9 entries', () => {
    expect(INTENSITY_OPTIONS).toHaveLength(9)
  })
})

describe('SPORT_OPTIONS', () => {
  it('has 10 entries', () => {
    expect(SPORT_OPTIONS).toHaveLength(10)
  })
})
```

- [ ] **Step 2: Confirmer l'échec**

```bash
cd web && npx jest __tests__/activities/intensity.test.ts --no-coverage 2>&1 | tail -5
```

Expected: FAIL — `Cannot find module '@/lib/activities/intensity'`

- [ ] **Step 3: Créer `web/lib/activities/intensity.ts`**

```ts
export type IntensityKey =
  | 'footing' | 'sortie_longue' | 'cotes' | 'vma'
  | 'seuil'   | 'runtaf'       | 'velotaf' | 'course' | 'autre'

export type IntensityOption = { key: IntensityKey; label: string }
export type SportOption     = { value: string; label: string }

export const INTENSITY_OPTIONS: IntensityOption[] = [
  { key: 'footing',       label: '🦶 Footing / EF'  },
  { key: 'sortie_longue', label: '🐢 Sortie longue'  },
  { key: 'cotes',         label: '⛰️ Côtes'           },
  { key: 'vma',           label: '🔥 VMA'             },
  { key: 'seuil',         label: '🎯 Seuil'           },
  { key: 'runtaf',        label: '🏢🏃 Runtaf'        },
  { key: 'velotaf',       label: '🏢🚴 Vélotaf'       },
  { key: 'course',        label: '🏁 Course'          },
  { key: 'autre',         label: '❓ Autre'            },
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

export function guessIntensity(name: string, ces: number | null, sport: string): IntensityKey {
  const n = name.toLowerCase()

  if (n.includes('footing') || n.includes(' ef ') || n.includes('endurance facile') || n.includes('récup'))
    return 'footing'
  if (n.includes('sortie longue') || n.includes(' sl ') || n.includes('long run') || n.includes('lsl'))
    return 'sortie_longue'
  if (n.includes('côtes') || n.includes('cotes') || n.includes('cote') || n.includes('montée'))
    return 'cotes'
  if (n.includes('400') || n.includes('200') || n.includes('vma') || n.includes('interval')
      || n.includes('fractionné') || n.includes('répétition'))
    return 'vma'
  if (n.includes('seuil') || n.includes('tempo') || n.includes('threshold'))
    return 'seuil'
  if (n.includes('runtaf') || n.includes('run taf') || (n.includes('taf') && sport === 'Run'))
    return 'runtaf'
  if (n.includes('vélotaf') || n.includes('velotaf') || n.includes('vélo taf')
      || (n.includes('taf') && (sport === 'Ride' || sport === 'EBikeRide')))
    return 'velotaf'
  if (n.includes('course') || n.includes('compet') || n.includes('race')
      || n.includes('10k') || n.includes('semi') || n.includes('marathon'))
    return 'course'

  // CES fallback
  if (ces !== null && ces > 120) return 'seuil'
  if (ces !== null && ces >= 70) return 'runtaf'
  if (ces !== null)              return 'footing'

  return 'autre'
}
```

- [ ] **Step 4: Confirmer les tests passent**

```bash
cd web && npx jest __tests__/activities/intensity.test.ts --no-coverage 2>&1 | tail -10
```

Expected: `Tests: X passed, X total`

- [ ] **Step 5: Commit**

```bash
git add web/lib/activities/intensity.ts web/__tests__/activities/intensity.test.ts
git commit -m "feat(activities): pure functions — guessIntensity, secondsToHMS, hmsToSeconds"
```

---

## Task 3: API Route — PATCH et DELETE

**Files:**
- Create: `web/app/api/activities/[id]/route.ts`

- [ ] **Step 1: Créer le dossier et le fichier**

```bash
mkdir -p web/app/api/activities/[id]
```

Créer `web/app/api/activities/[id]/route.ts` :

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    name?:                    string
    manual_sport_type?:       string | null
    manual_intensity?:        string | null
    manual_distance_m?:       number | null
    manual_moving_time_sec?:  number | null
    manual_elevation_gain_m?: number | null
  }

  const { error } = await supabase
    .from('activities')
    .update(body)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Vérifier compilation TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: aucune erreur liée à `api/activities`.

- [ ] **Step 3: Commit**

```bash
git add "web/app/api/activities"
git commit -m "feat(activities): PATCH + DELETE API routes"
```

---

## Task 4: Étendre ActivityCard — type, résolution effective, bouton ⋮

**Files:**
- Modify: `web/components/ui/ActivityCard.tsx`

- [ ] **Step 1: Remplacer le contenu de `ActivityCard.tsx`**

Écraser `web/components/ui/ActivityCard.tsx` avec :

```ts
import { colors } from '@/lib/design/colors'
import { sportLabel } from '@/lib/design/labels'

const SPORT_COLORS: Record<string, string> = {
  Run:              colors.chargeOrange,
  TrailRun:         colors.chargeOrange,
  Ride:             colors.seriesGreen,
  GravelRide:       colors.seriesGreen,
  VirtualRide:      colors.seriesGreen,
  EBikeRide:        colors.seriesGreen,
  MountainBikeRide: colors.seriesGreen,
  Swim:             colors.pieVma,
  Walk:             colors.seriesGreen,
  Hike:             colors.seriesGreen,
  WeightTraining:   colors.subtleText,
}

function toHex(color: string, opacity: number): string {
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0')
  return `${color}${alpha}`
}

function TypeBadge({ type }: { type: string }) {
  const color = SPORT_COLORS[type] ?? colors.subtleText
  const label = sportLabel[type] ?? type
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-[3px] text-[14px] font-semibold leading-none border"
      style={{
        backgroundColor: toHex(color, 0.16),
        borderColor:     toHex(color, 0.35),
        color,
      }}
    >
      {label}
    </span>
  )
}

function MetricTile({ label, value, unit, color }: {
  label: string; value: string; unit: string; color: string
}) {
  return (
    <div className="rounded-[10px] bg-trail-surface px-[10px] py-[8px] flex-shrink-0">
      <p className="text-[11px] text-trail-muted">{label}</p>
      <div className="flex items-baseline gap-[3px] mt-[2px]">
        <span className="text-[17px] font-bold" style={{ color }}>{value}</span>
        {unit && <span className="text-[11px] text-trail-muted">{unit}</span>}
      </div>
    </div>
  )
}

function fmt1(v: number): string {
  return (Math.round(v * 10) / 10).toFixed(1)
}

function fmtDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const h = Math.floor(m / 60)
  const rem = m % 60
  return h > 0 ? `${h}h${String(rem).padStart(2, '0')}` : `${m}min`
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mn = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} · ${hh}:${mn}`
}

function fmtPace(distM: number | null, timeSec: number | null): string {
  if (!distM || !timeSec || distM < 1) return '—'
  const paceMin = (timeSec / 60) / (distM / 1000)
  const mins = Math.floor(paceMin)
  const secs = Math.round((paceMin - mins) * 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function fmtSpeed(distM: number | null, timeSec: number | null): string {
  if (!distM || !timeSec) return '—'
  return ((distM / 1000) / (timeSec / 3600)).toFixed(1)
}

function fourthMetric(sport: string, distM: number | null, timeSec: number | null, ces: number | null) {
  if (sport === 'Run' || sport === 'TrailRun') {
    return { label: 'Allure', value: fmtPace(distM, timeSec), unit: '/km', color: colors.text }
  }
  if (sport === 'Ride' || sport === 'GravelRide' || sport === 'VirtualRide') {
    return { label: 'Vitesse', value: fmtSpeed(distM, timeSec), unit: 'km/h', color: colors.text }
  }
  return { label: 'CES', value: ces != null ? Math.round(ces).toString() : '—', unit: '', color: colors.text }
}

export type ActivityRow = {
  id:                      string
  sport_type:              string
  name:                    string
  start_time:              string
  ces:                     number | null
  distance_m:              number | null
  elevation_gain_m:        number | null
  moving_time_sec:         number | null
  manual_sport_type:       string | null
  manual_intensity:        string | null
  manual_distance_m:       number | null
  manual_moving_time_sec:  number | null
  manual_elevation_gain_m: number | null
}

export function ActivityCard({
  activity: a,
  onEdit,
}: {
  activity: ActivityRow
  onEdit?: (a: ActivityRow) => void
}) {
  const effectiveSport     = a.manual_sport_type     ?? a.sport_type
  const effectiveDistance  = a.manual_distance_m     ?? a.distance_m
  const effectiveDuration  = a.manual_moving_time_sec ?? a.moving_time_sec
  const effectiveElevation = a.manual_elevation_gain_m ?? a.elevation_gain_m

  const km    = effectiveDistance  != null ? fmt1(effectiveDistance / 1000)           : '—'
  const dPlus = effectiveElevation != null ? Math.round(effectiveElevation).toString() : '—'
  const dur   = fmtDuration(effectiveDuration)
  const ces   = a.ces != null ? Math.round(a.ces).toString() : '—'
  const fourth = fourthMetric(effectiveSport, effectiveDistance, effectiveDuration, a.ces)

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[6px]">
            <TypeBadge type={effectiveSport} />
            <span className="text-[14px] text-trail-muted">{fmtDate(a.start_time)}</span>
          </div>
          <p className="text-[18px] font-medium truncate mt-[6px]" style={{ color: colors.chargeOrange }}>
            {a.name}
          </p>
          <div className="flex gap-[6px] mt-[4px] overflow-x-auto pb-0.5">
            <MetricTile label="Distance"    value={km}           unit="km"         color={colors.chargeOrange} />
            <MetricTile label="Durée"       value={dur}          unit=""           color={colors.seriesGreen}  />
            <MetricTile label="D+"          value={dPlus}        unit="m"          color={colors.seriesBlue}   />
            <MetricTile label={fourth.label} value={fourth.value} unit={fourth.unit} color={fourth.color}      />
          </div>
        </div>

        <div className="flex flex-col items-end flex-shrink-0 gap-1">
          <span className="text-[18px] font-bold" style={{ color: colors.seriesYellow }}>
            ⚡: {ces}
          </span>
          {onEdit && (
            <button
              onClick={() => onEdit(a)}
              aria-label="Modifier l'activité"
              style={{
                color:      colors.subtleText,
                cursor:     'pointer',
                background: 'none',
                border:     'none',
                padding:    '2px 4px',
                fontSize:   '20px',
                lineHeight: 1,
              }}
            >
              ⋮
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier compilation**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add web/components/ui/ActivityCard.tsx
git commit -m "feat(activities): extend ActivityRow with manual_* + add ⋮ edit button"
```

---

## Task 5: Créer EditActivityModal

**Files:**
- Create: `web/components/ui/EditActivityModal.tsx`

- [ ] **Step 1: Créer `web/components/ui/EditActivityModal.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { colors } from '@/lib/design/colors'
import {
  guessIntensity,
  secondsToHMS,
  hmsToSeconds,
  INTENSITY_OPTIONS,
  SPORT_OPTIONS,
  type IntensityKey,
} from '@/lib/activities/intensity'
import type { ActivityRow } from '@/components/ui/ActivityCard'

function fmtModalDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mn = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()} · ${hh}:${mn}`
}

function si(): React.CSSProperties {
  return { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, outline: 'none' }
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-[12px] border p-4 space-y-3"
      style={{ backgroundColor: colors.cardBg, borderColor: colors.border }}
    >
      <p className="text-[15px] font-bold text-trail-text">{title}</p>
      {children}
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[12px] text-trail-muted">{label}</p>
      {children}
    </div>
  )
}

function ChipRow({
  options,
  selected,
  onSelect,
}: {
  options:  { value: string; label: string }[]
  selected: string
  onSelect: (v: string) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {options.map(({ value, label }) => {
        const active = selected === value
        return (
          <button
            key={value}
            onClick={() => onSelect(value)}
            className="rounded-full px-4 py-[6px] border text-[13px] font-semibold flex-shrink-0"
            style={{
              backgroundColor: active ? `${colors.chargeOrange}26` : 'transparent',
              borderColor:     active ? colors.chargeOrange : colors.border,
              color:           active ? colors.chargeOrange : colors.subtleText,
              cursor:          'pointer',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

type Props = {
  activity:  ActivityRow
  onSaved:   (updated: ActivityRow) => void
  onDeleted: () => void
  onClose:   () => void
}

export function EditActivityModal({ activity: a, onSaved, onDeleted, onClose }: Props) {
  const effectiveSport     = a.manual_sport_type     ?? a.sport_type
  const effectiveDistance  = a.manual_distance_m     ?? a.distance_m
  const effectiveDuration  = a.manual_moving_time_sec ?? a.moving_time_sec
  const effectiveElevation = a.manual_elevation_gain_m ?? a.elevation_gain_m

  const [name,      setName]      = useState(a.name)
  const [distKm,    setDistKm]    = useState(
    effectiveDistance  != null ? (effectiveDistance / 1000).toFixed(1)  : ''
  )
  const [duration,  setDuration]  = useState(
    effectiveDuration  != null ? secondsToHMS(effectiveDuration) : '0:00:00'
  )
  const [elevM,     setElevM]     = useState(
    effectiveElevation != null ? String(Math.round(effectiveElevation)) : ''
  )
  const [sport,     setSport]     = useState(effectiveSport)
  const [intensity, setIntensity] = useState<IntensityKey>(
    (a.manual_intensity as IntensityKey | null) ?? guessIntensity(a.name, a.ces, effectiveSport)
  )
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  async function handleSave() {
    const distM   = distKm ? parseFloat(distKm) * 1000 : null
    const timeSec = hmsToSeconds(duration)
    const elev    = elevM  ? parseFloat(elevM)         : null

    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/activities/${a.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name,
          manual_sport_type:       sport,
          manual_intensity:        intensity,
          manual_distance_m:       distM,
          manual_moving_time_sec:  timeSec,
          manual_elevation_gain_m: elev,
        }),
      })
      if (!res.ok) throw new Error('Erreur lors de la sauvegarde')
      onSaved({
        ...a,
        name,
        manual_sport_type:       sport,
        manual_intensity:        intensity,
        manual_distance_m:       distM,
        manual_moving_time_sec:  timeSec,
        manual_elevation_gain_m: elev,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/activities/${a.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erreur lors de la suppression')
      onDeleted()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
      setSaving(false)
    }
  }

  const inputCls = 'rounded-[8px] border px-3 py-[8px] text-[14px] w-full'
  const btnBase  = 'flex-1 py-3 rounded-[12px] text-[14px] font-bold'

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: colors.background }}>

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ backgroundColor: colors.headerBg, borderColor: colors.border }}
      >
        <button onClick={onClose} className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M5 12L12 19M5 12L12 5"
              stroke={colors.subtleText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[16px] font-semibold text-trail-text">Modifier l&apos;activité</span>
        </button>
        <span className="text-[13px] text-trail-muted">{fmtModalDate(a.start_time)}</span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-3">

        {/* Activité */}
        <SectionCard title="Activité">
          <FieldRow label="Titre">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className={inputCls}
              style={si()}
            />
          </FieldRow>
        </SectionCard>

        {/* Métriques */}
        <SectionCard title="Métriques">
          <FieldRow label="Distance (km)">
            <input
              type="text"
              inputMode="decimal"
              value={distKm}
              onChange={e => setDistKm(e.target.value)}
              className={inputCls}
              style={si()}
              placeholder="0.0"
            />
          </FieldRow>
          <FieldRow label="Durée (hh:mm:ss)">
            <input
              type="text"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              className={inputCls}
              style={si()}
              placeholder="0:00:00"
            />
          </FieldRow>
          <FieldRow label="Dénivelé positif (m)">
            <input
              type="text"
              inputMode="decimal"
              value={elevM}
              onChange={e => setElevM(e.target.value)}
              className={inputCls}
              style={si()}
              placeholder="0"
            />
          </FieldRow>
        </SectionCard>

        {/* Sport */}
        <SectionCard title="Sport">
          <ChipRow
            options={SPORT_OPTIONS}
            selected={sport}
            onSelect={setSport}
          />
        </SectionCard>

        {/* Intensité */}
        <SectionCard title="Intensité">
          <ChipRow
            options={INTENSITY_OPTIONS.map(i => ({ value: i.key, label: i.label }))}
            selected={intensity}
            onSelect={v => setIntensity(v as IntensityKey)}
          />
        </SectionCard>

        {/* Erreur */}
        {error && (
          <p className="text-[13px] px-1" style={{ color: '#ef4444' }}>{error}</p>
        )}

        {/* Footer */}
        <div className="flex gap-2 pb-4">
          <button
            onClick={handleDelete}
            disabled={saving}
            className={btnBase}
            style={{
              backgroundColor: '#ef4444',
              color:           '#fff',
              cursor:          saving ? 'not-allowed' : 'pointer',
              opacity:         saving ? 0.7 : 1,
            }}
          >
            Supprimer
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className={btnBase}
            style={{
              border:          `1px solid ${colors.border}`,
              color:           colors.subtleText,
              backgroundColor: 'transparent',
              cursor:          'pointer',
            }}
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={btnBase}
            style={{
              backgroundColor: colors.chargeOrange,
              color:           '#fff',
              cursor:          saving ? 'not-allowed' : 'pointer',
              opacity:         saving ? 0.7 : 1,
            }}
          >
            {saving ? '…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier compilation**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add web/components/ui/EditActivityModal.tsx
git commit -m "feat(activities): EditActivityModal — sport/intensité/métriques/delete"
```

---

## Task 6: Mettre à jour ActivitiesClient

**Files:**
- Modify: `web/app/activities/ActivitiesClient.tsx`

- [ ] **Step 1: Ajouter imports**

En haut de `web/app/activities/ActivitiesClient.tsx`, après la ligne `import { ActivityCard, ActivityRow } from '@/components/ui/ActivityCard'`, ajouter :

```ts
import { EditActivityModal } from '@/components/ui/EditActivityModal'
```

- [ ] **Step 2: Convertir prop → local state et ajouter editingActivity**

Remplacer le début de la fonction `ActivitiesClient` (lignes 472–476) :

```ts
// AVANT
export default function ActivitiesClient({ activities }: { activities: ActivityRow[] }) {
  const [panel,  setPanel]  = useState<'none' | 'search' | 'filter'>('none')
  const [search, setSearch] = useState<SearchState>(DEFAULT_SEARCH)
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER)
```

```ts
// APRÈS
export default function ActivitiesClient({ activities: initialActivities }: { activities: ActivityRow[] }) {
  const [localActivities, setLocalActivities] = useState<ActivityRow[]>(initialActivities)
  const [panel,           setPanel]           = useState<'none' | 'search' | 'filter'>('none')
  const [search,          setSearch]          = useState<SearchState>(DEFAULT_SEARCH)
  const [filter,          setFilter]          = useState<FilterState>(DEFAULT_FILTER)
  const [editingActivity, setEditingActivity] = useState<ActivityRow | null>(null)
```

- [ ] **Step 3: Ajouter les handlers save/delete**

Après les déclarations de state (avant le `useMemo` de `sportTypes`), ajouter :

```ts
function handleSaved(updated: ActivityRow) {
  setLocalActivities(prev => prev.map(a => a.id === updated.id ? updated : a))
  setEditingActivity(null)
}

function handleDeleted(id: string) {
  setLocalActivities(prev => prev.filter(a => a.id !== id))
  setEditingActivity(null)
}
```

- [ ] **Step 4: Remplacer les références à `activities` par `localActivities`**

Dans le corps de `ActivitiesClient`, remplacer (3 endroits) :

| Ligne | Avant | Après |
|---|---|---|
| `sportTypes` useMemo | `for (const a of activities)` | `for (const a of localActivities)` |
| `filtered` useMemo | `let list = applySearch([...activities], search)` | `let list = applySearch([...localActivities], search)` |
| SearchPanel prop | `activities={activities}` | `activities={localActivities}` |
| Empty state check | `activities.length === 0` | `localActivities.length === 0` |

- [ ] **Step 5: Ajouter `onEdit` sur la liste principale**

Remplacer (ligne ~611) :

```tsx
// AVANT
{filtered.map(a => <ActivityCard key={a.id} activity={a} />)}
```

```tsx
// APRÈS
{filtered.map(a => (
  <ActivityCard key={a.id} activity={a} onEdit={setEditingActivity} />
))}
```

- [ ] **Step 6: Rendre le modal dans le fragment**

Dans le `return (...)`, juste avant la fermeture `</>`, ajouter :

```tsx
{editingActivity && (
  <EditActivityModal
    activity={editingActivity}
    onSaved={handleSaved}
    onDeleted={() => handleDeleted(editingActivity.id)}
    onClose={() => setEditingActivity(null)}
  />
)}
```

- [ ] **Step 7: Vérifier compilation**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: aucune erreur.

- [ ] **Step 8: Commit**

```bash
git add web/app/activities/ActivitiesClient.tsx
git commit -m "feat(activities): wire EditActivityModal into ActivitiesClient with optimistic updates"
```

---

## Task 7: Mettre à jour page.tsx — fetch manual_* columns

**Files:**
- Modify: `web/app/activities/page.tsx`

- [ ] **Step 1: Étendre le select**

Dans `web/app/activities/page.tsx`, remplacer la ligne `.select(...)` :

```ts
// AVANT
.select('id, name, sport_type, start_time, ces, distance_m, elevation_gain_m, moving_time_sec')
```

```ts
// APRÈS
.select('id, name, sport_type, start_time, ces, distance_m, elevation_gain_m, moving_time_sec, manual_sport_type, manual_intensity, manual_distance_m, manual_moving_time_sec, manual_elevation_gain_m')
```

- [ ] **Step 2: Vérifier compilation**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: aucune erreur.

- [ ] **Step 3: Lancer le dev server et tester**

```bash
cd web && npm run dev
```

Ouvrir `http://localhost:3000/activities` et vérifier :

1. ✅ Chaque ActivityCard affiche un bouton `⋮` en haut à droite
2. ✅ Clic `⋮` → modal "Modifier l'activité" s'ouvre avec la flèche retour et la date
3. ✅ Titre pré-rempli avec le nom de l'activité
4. ✅ Distance en km, Durée en **hh:mm:ss** (ex: `1:22:00`), D+ en mètres pré-remplis
5. ✅ Chips Sport scrollables — le sport actuel est sélectionné (orange)
6. ✅ Chips Intensité scrollables — intensité auto-détectée selon le titre
7. ✅ Clic "Enregistrer" → appel PATCH, modal se ferme, carte mise à jour
8. ✅ Clic "Supprimer" (rouge) → appel DELETE, activité disparaît de la liste
9. ✅ Clic "Annuler" ou flèche → modal se ferme sans changement

- [ ] **Step 4: Commit final**

```bash
git add web/app/activities/page.tsx
git commit -m "feat(activities): fetch manual_* columns in page query"
```

---

## Self-Review

### Spec coverage

| Spec section | Task |
|---|---|
| DB migration 5 colonnes `manual_*` | Task 1 ✅ |
| PATCH + DELETE API avec auth `user_id` | Task 3 ✅ |
| `ActivityRow` étendu avec `manual_*` | Task 4 ✅ |
| Résolution `manual_X ?? strava_X` dans la carte | Task 4 ✅ |
| Bouton `⋮` optionnel sur la carte | Task 4 ✅ |
| Modal full-screen `fixed inset-0` | Task 5 ✅ |
| 10 chips Sport scrollables | Task 2 + 5 ✅ |
| 9 chips Intensité scrollables | Task 2 + 5 ✅ |
| Durée format `hh:mm:ss` (secondsToHMS / hmsToSeconds) | Task 2 + 5 ✅ |
| Bouton Supprimer rouge `#ef4444` | Task 5 ✅ |
| Bouton Annuler + Enregistrer orange | Task 5 ✅ |
| Détection auto intensité (mots-clés + CES fallback) | Task 2 ✅ |
| `localActivities` state dans ActivitiesClient | Task 6 ✅ |
| Mise à jour optimiste après save + delete | Task 6 ✅ |
| Page fetch `manual_*` columns | Task 7 ✅ |

### Placeholder scan

Aucun "TBD", "TODO", ou étape sans code.

### Type consistency

- `ActivityRow` défini dans Task 4 → utilisé dans Tasks 5, 6 ✅
- `IntensityKey` défini dans Task 2 → utilisé dans Task 5 ✅
- `EditActivityModal` props `onSaved(updated: ActivityRow)` / `onDeleted()` → consommés dans Task 6 ✅
- `handleDeleted(id: string)` → appelé avec `editingActivity.id` dans Task 6 ✅
- `SPORT_OPTIONS` type `{ value: string; label: string }[]` → compatible `ChipRow` dans Task 5 ✅
