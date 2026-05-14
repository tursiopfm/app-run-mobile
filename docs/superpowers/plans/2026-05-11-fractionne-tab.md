> **Status: Implémenté** · Date: 2026-05-11 · Code: `web/components/ui/ActivityFractionneSplits.tsx`
> *Snapshot de design — pour l'état actuel, voir le code.*

# Onglet Fractionné (Laps montre) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un onglet "Fractionné" dans la page détail d'activité affichant les laps montre Strava (bouton LAP) avec détection automatique des blocs rapides et copie des temps.

**Architecture:** Approche minimale — extraction des `laps` du même objet Strava DetailedActivity déjà chargé dans `page.tsx`, mis en cache dans `raw_payload.laps` (même pattern que `splits_metric`), passé au composant client. Nouveau composant `ActivityFractionneSplits` affiche le tableau + détection + copie.

**Tech Stack:** Next.js 14 App Router, TypeScript, Jest + Testing Library, Supabase (JSONB cache), Strava API v3, inline styles (pattern existant du projet)

---

## File Map

| Action | Fichier | Responsabilité |
|--------|---------|----------------|
| Modify | `web/lib/activities/detail.ts` | Ajouter `StravaLap` type + `lapPaceSec`, `detectFastLaps`, `fmtLapDist` |
| Modify | `web/__tests__/activities/detail.test.ts` | Tests des nouvelles fonctions utilitaires |
| Modify | `web/app/(main)/activities/[id]/page.tsx` | Extraire + cacher `laps`, passer en prop |
| Create | `web/components/ui/ActivityFractionneSplits.tsx` | Composant tableau laps + copie |
| Create | `web/__tests__/activities/ActivityFractionneSplits.test.tsx` | Tests composant |
| Modify | `web/app/(main)/activities/[id]/ActivityDetailClient.tsx` | Ajouter tab `fractionne` |

---

## Task 1: Add StravaLap type and utility functions (TDD)

**Files:**
- Modify: `web/lib/activities/detail.ts`
- Modify: `web/__tests__/activities/detail.test.ts`

- [ ] **Step 1.1: Add failing tests for `lapPaceSec`, `detectFastLaps`, `fmtLapDist`**

Append to `web/__tests__/activities/detail.test.ts`:

```typescript
import type { StravaLap } from '@/lib/activities/detail'
import { lapPaceSec, detectFastLaps, fmtLapDist } from '@/lib/activities/detail'

// Fixture helper
function makeLap(overrides: Partial<StravaLap> & { split: number }): StravaLap {
  return {
    id: overrides.split * 100,
    name: `Lap ${overrides.split}`,
    elapsed_time: 600,
    moving_time: 600,
    distance: 1000,
    average_speed: 1000 / 600, // ~1.667 m/s
    total_elevation_gain: 0,
    lap_index: overrides.split - 1,
    ...overrides,
  }
}

// Workout: warm-up / fast / recovery / fast / cool-down
const workoutLaps: StravaLap[] = [
  makeLap({ split: 1, distance: 3360, moving_time: 1187, average_speed: 3360 / 1187 }), // ~353 s/km
  makeLap({ split: 2, distance: 3080, moving_time: 922,  average_speed: 3080 / 922 }),  // ~299 s/km (fast)
  makeLap({ split: 3, distance: 220,  moving_time: 182,  average_speed: 220 / 182 }),   // ~827 s/km (short)
  makeLap({ split: 4, distance: 3080, moving_time: 930,  average_speed: 3080 / 930 }),  // ~302 s/km (fast)
  makeLap({ split: 5, distance: 1920, moving_time: 736,  average_speed: 1920 / 736 }),  // ~383 s/km
]

// ── lapPaceSec ────────────────────────────────────────────────────────────────
describe('lapPaceSec', () => {
  it('returns seconds per km from average_speed', () => {
    // average_speed=3.34 m/s → 1000/3.34 ≈ 299 s/km
    const lap = makeLap({ split: 1, average_speed: 3.34 })
    expect(lapPaceSec(lap)).toBe(299)
  })

  it('returns null when average_speed is 0', () => {
    const lap = makeLap({ split: 1, average_speed: 0 })
    expect(lapPaceSec(lap)).toBeNull()
  })

  it('rounds to nearest integer', () => {
    // 1000 / 2.5 = 400.0
    expect(lapPaceSec(makeLap({ split: 1, average_speed: 2.5 }))).toBe(400)
    // 1000 / 3.0 ≈ 333.33 → 333
    expect(lapPaceSec(makeLap({ split: 1, average_speed: 3.0 }))).toBe(333)
  })
})

// ── detectFastLaps ────────────────────────────────────────────────────────────
describe('detectFastLaps', () => {
  it('detects fast laps (laps 2 and 4 in workout example)', () => {
    const fast = detectFastLaps(workoutLaps)
    expect(fast.has(2)).toBe(true)
    expect(fast.has(4)).toBe(true)
    expect(fast.has(1)).toBe(false)
    expect(fast.has(3)).toBe(false)
    expect(fast.has(5)).toBe(false)
  })

  it('returns empty set when all laps have the same pace', () => {
    const uniform = [
      makeLap({ split: 1, average_speed: 2.5 }),
      makeLap({ split: 2, average_speed: 2.5 }),
      makeLap({ split: 3, average_speed: 2.5 }),
    ]
    expect(detectFastLaps(uniform).size).toBe(0)
  })

  it('returns empty set for 0 or 1 laps', () => {
    expect(detectFastLaps([]).size).toBe(0)
    expect(detectFastLaps([makeLap({ split: 1 })]).size).toBe(0)
  })

  it('ignores laps with average_speed=0 in median calculation', () => {
    const laps = [
      makeLap({ split: 1, average_speed: 0 }),  // invalid
      makeLap({ split: 2, average_speed: 3.5 }), // ~286 s/km (fast)
      makeLap({ split: 3, average_speed: 2.0 }), // 500 s/km (slow)
      makeLap({ split: 4, average_speed: 2.0 }), // 500 s/km (slow)
    ]
    const fast = detectFastLaps(laps)
    expect(fast.has(2)).toBe(true)
    expect(fast.has(1)).toBe(false)
  })
})

// ── fmtLapDist ────────────────────────────────────────────────────────────────
describe('fmtLapDist', () => {
  it('formats >= 1000m as km with 2 decimals', () => {
    expect(fmtLapDist(3360)).toBe('3.36 km')
    expect(fmtLapDist(1000)).toBe('1.00 km')
    expect(fmtLapDist(3080)).toBe('3.08 km')
  })

  it('formats < 1000m as rounded meters', () => {
    expect(fmtLapDist(220)).toBe('220 m')
    expect(fmtLapDist(430)).toBe('430 m')
    expect(fmtLapDist(999)).toBe('999 m')
  })
})
```

- [ ] **Step 1.2: Run tests to confirm they fail (functions don't exist yet)**

```bash
cd web && npx jest __tests__/activities/detail.test.ts --no-coverage 2>&1 | tail -10
```

Expected: failures mentioning `lapPaceSec is not a function` (or similar).

- [ ] **Step 1.3: Add StravaLap type and utility functions to `web/lib/activities/detail.ts`**

Add after the `StravaSplit` type (after line 11) and after the existing `splitColor` function:

```typescript
export type StravaLap = {
  id: number
  name: string
  elapsed_time: number
  moving_time: number
  distance: number
  average_speed: number
  total_elevation_gain: number
  lap_index: number
  split: number
  average_heartrate?: number
  max_heartrate?: number
  pace_zone?: number
}

// ── Lap utilities ─────────────────────────────────────────────────────────────

export function lapPaceSec(
  lap: Pick<StravaLap, 'average_speed'>
): number | null {
  if (!lap.average_speed) return null
  return Math.round(1000 / lap.average_speed)
}

export function detectFastLaps(laps: StravaLap[]): Set<number> {
  if (laps.length < 2) return new Set()

  const pacePairs = laps.map(lap => ({
    split: lap.split,
    pace: lap.average_speed > 0 ? 1000 / lap.average_speed : null,
  }))

  const validPaces = pacePairs
    .filter((p): p is { split: number; pace: number } => p.pace !== null)

  if (validPaces.length < 2) return new Set()

  const sorted = [...validPaces.map(p => p.pace)].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]

  const threshold = median * 0.95

  const fast = new Set<number>()
  for (const { split, pace } of validPaces) {
    if (pace < threshold) fast.add(split)
  }
  return fast
}

export function fmtLapDist(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(2)} km`
}
```

- [ ] **Step 1.4: Run tests — all should pass**

```bash
cd web && npx jest __tests__/activities/detail.test.ts --no-coverage 2>&1 | tail -5
```

Expected: `Tests: 25 passed` (14 existing + 11 new).

- [ ] **Step 1.5: Commit**

```bash
cd web && git add lib/activities/detail.ts __tests__/activities/detail.test.ts
git commit -m "feat(fractionne): add StravaLap type + lapPaceSec, detectFastLaps, fmtLapDist"
```

---

## Task 2: Update page.tsx to extract and cache laps

**Files:**
- Modify: `web/app/(main)/activities/[id]/page.tsx`

- [ ] **Step 2.1: Add StravaLap import to page.tsx**

In `web/app/(main)/activities/[id]/page.tsx`, change line 6:

```typescript
// Before:
import type { StravaSplit } from '@/lib/activities/detail'

// After:
import type { StravaSplit, StravaLap } from '@/lib/activities/detail'
```

- [ ] **Step 2.2: Replace the "Fetch splits if needed" block**

Replace the entire block from `// Fetch splits if needed` to the end of the try/catch (lines 31–69) with:

```typescript
// Fetch splits and laps if needed
let splits: StravaSplit[] | null = null
let laps: StravaLap[] | null = null

const rawPayload = activity.raw_payload as Record<string, unknown> | null
const existingSplits = rawPayload?.splits_metric
const existingLaps = rawPayload?.laps

if (Array.isArray(existingSplits)) splits = existingSplits as StravaSplit[]
if (Array.isArray(existingLaps)) laps = existingLaps as StravaLap[]

if ((!splits || !laps) && activity.provider === 'strava' && activity.provider_activity_id) {
  try {
    const token = await getValidStravaToken(user.id)
    const detail = await fetchStravaActivity(token, Number(activity.provider_activity_id))
    const stravaDetail = detail as unknown as {
      splits_metric?: unknown[]
      laps?: unknown[]
      calories?: number
    }

    if (activity.calories == null && stravaDetail.calories != null) {
      await supabase
        .from('activities')
        .update({ calories: stravaDetail.calories })
        .eq('id', id)
        .eq('user_id', user.id)
      activity.calories = stravaDetail.calories
    }

    const payloadPatch: Record<string, unknown> = {}

    if (!splits && Array.isArray(stravaDetail.splits_metric)) {
      splits = stravaDetail.splits_metric as unknown as StravaSplit[]
      payloadPatch.splits_metric = stravaDetail.splits_metric
    }

    if (!laps && Array.isArray(stravaDetail.laps)) {
      laps = stravaDetail.laps as unknown as StravaLap[]
      payloadPatch.laps = stravaDetail.laps
    }

    if (Object.keys(payloadPatch).length > 0) {
      await supabase
        .from('activities')
        .update({
          raw_payload: { ...(rawPayload as object ?? {}), ...payloadPatch },
        })
        .eq('id', id)
        .eq('user_id', user.id)
    }
  } catch {
    // Token expired or rate limited — show page without splits/laps
  }
}
```

- [ ] **Step 2.3: Pass `laps` to ActivityDetailClient**

Change the return line (currently line 77):

```typescript
// Before:
return <ActivityDetailClient activity={activity} splits={splits} athleteProfile={profile} />

// After:
return <ActivityDetailClient activity={activity} splits={splits} laps={laps} athleteProfile={profile} />
```

- [ ] **Step 2.4: TypeScript check**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: error on `ActivityDetailClient` because `laps` prop doesn't exist yet (that's OK — Task 4 will fix it). All other errors should be pre-existing or zero.

- [ ] **Step 2.5: Commit**

```bash
cd web && git add app/\(main\)/activities/\[id\]/page.tsx
git commit -m "feat(fractionne): extract and cache strava laps in raw_payload"
```

---

## Task 3: Create ActivityFractionneSplits component (TDD)

**Files:**
- Create: `web/__tests__/activities/ActivityFractionneSplits.test.tsx`
- Create: `web/components/ui/ActivityFractionneSplits.tsx`

- [ ] **Step 3.1: Write failing tests**

Create `web/__tests__/activities/ActivityFractionneSplits.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ActivityFractionneSplits } from '@/components/ui/ActivityFractionneSplits'
import type { StravaLap } from '@/lib/activities/detail'

function makeLap(overrides: Partial<StravaLap> & { split: number }): StravaLap {
  return {
    id: overrides.split * 100,
    name: `Lap ${overrides.split}`,
    elapsed_time: 600,
    moving_time: 600,
    distance: 1000,
    average_speed: 1000 / 600,
    total_elevation_gain: 0,
    lap_index: overrides.split - 1,
    ...overrides,
  }
}

// Workout laps: echauffement / fast / short recovery / fast / cooldown
const workoutLaps: StravaLap[] = [
  makeLap({ split: 1, distance: 3360, moving_time: 1187, average_speed: 3360 / 1187 }),
  makeLap({ split: 2, distance: 3080, moving_time: 922,  average_speed: 3080 / 922 }),
  makeLap({ split: 3, distance: 220,  moving_time: 182,  average_speed: 220 / 182 }),
  makeLap({ split: 4, distance: 3080, moving_time: 930,  average_speed: 3080 / 930 }),
  makeLap({ split: 5, distance: 1920, moving_time: 736,  average_speed: 1920 / 736 }),
]

// Uniform laps: no fast blocks
const uniformLaps: StravaLap[] = [
  makeLap({ split: 1, average_speed: 2.5 }),
  makeLap({ split: 2, average_speed: 2.5 }),
  makeLap({ split: 3, average_speed: 2.5 }),
]

describe('ActivityFractionneSplits', () => {
  it('renders one row per lap (lap numbers 1–5)', () => {
    render(<ActivityFractionneSplits laps={workoutLaps} />)
    expect(screen.getAllByText('1')[0]).toBeInTheDocument()
    expect(screen.getAllByText('2')[0]).toBeInTheDocument()
    expect(screen.getAllByText('3')[0]).toBeInTheDocument()
    expect(screen.getAllByText('4')[0]).toBeInTheDocument()
    expect(screen.getAllByText('5')[0]).toBeInTheDocument()
  })

  it('formats distance >= 1000m as km', () => {
    render(<ActivityFractionneSplits laps={workoutLaps} />)
    expect(screen.getByText('3.36 km')).toBeInTheDocument()
    expect(screen.getAllByText('3.08 km')).toHaveLength(2)
    expect(screen.getByText('1.92 km')).toBeInTheDocument()
  })

  it('formats distance < 1000m as meters', () => {
    render(<ActivityFractionneSplits laps={workoutLaps} />)
    expect(screen.getByText('220 m')).toBeInTheDocument()
  })

  it('formats lap time as mm:ss', () => {
    render(<ActivityFractionneSplits laps={workoutLaps} />)
    // lap 2: moving_time=922s → 15:22
    expect(screen.getByText('15:22')).toBeInTheDocument()
    // lap 4: moving_time=930s → 15:30
    expect(screen.getByText('15:30')).toBeInTheDocument()
  })

  it('shows RAPIDE badge on fast laps (2 and 4)', () => {
    render(<ActivityFractionneSplits laps={workoutLaps} />)
    const badges = screen.getAllByText('RAPIDE')
    expect(badges).toHaveLength(2)
  })

  it('copy button is enabled when fast laps detected', () => {
    render(<ActivityFractionneSplits laps={workoutLaps} />)
    const btn = screen.getByRole('button')
    expect(btn).not.toBeDisabled()
  })

  it('copy button is disabled when no fast laps (uniform pace)', () => {
    render(<ActivityFractionneSplits laps={uniformLaps} />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
  })

  it('copies fast lap times (mm:ss) to clipboard on click', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(<ActivityFractionneSplits laps={workoutLaps} />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('15:22\n15:30')
    })
  })

  it('shows "Copié !" feedback after successful copy', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(<ActivityFractionneSplits laps={workoutLaps} />)
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Copié !')
    })
  })
})
```

- [ ] **Step 3.2: Run tests to confirm they fail**

```bash
cd web && npx jest __tests__/activities/ActivityFractionneSplits.test.tsx --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `ActivityFractionneSplits` module not found.

- [ ] **Step 3.3: Create `web/components/ui/ActivityFractionneSplits.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { StravaLap } from '@/lib/activities/detail'
import { lapPaceSec, detectFastLaps, fmtPaceSec, fmtLapDist } from '@/lib/activities/detail'

export function ActivityFractionneSplits({ laps }: { laps: StravaLap[] }) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)

  const fastSplits = detectFastLaps(laps)
  const hasFastLaps = fastSplits.size > 0

  async function handleCopy() {
    const text = laps
      .filter(lap => fastSplits.has(lap.split))
      .map(lap => fmtPaceSec(lap.moving_time))
      .join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyError(true)
      setTimeout(() => setCopyError(false), 2000)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Summary line */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--trail-muted)' }}>{laps.length} blocs</span>
        {hasFastLaps && (
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e8651a' }}>
            {fastSplits.size} bloc{fastSplits.size > 1 ? 's' : ''} rapide{fastSplits.size > 1 ? 's' : ''} détecté{fastSplits.size > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Header row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '28px 1fr 52px 68px 36px',
        padding: '4px 0 8px',
        borderBottom: '1px solid var(--trail-border)',
        marginBottom: 2,
      }}>
        {['#', 'Distance', 'Temps', 'Allure', 'D+'].map(h => (
          <span key={h} style={{
            fontSize: 11, fontWeight: 700,
            color: 'var(--trail-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
          }}>
            {h}
          </span>
        ))}
      </div>

      {/* Lap rows */}
      {laps.map(lap => {
        const pace = lapPaceSec(lap)
        const isFast = fastSplits.has(lap.split)
        const elev = Math.round(lap.total_elevation_gain)

        return (
          <div
            key={lap.id ?? lap.split}
            style={{
              display: 'grid',
              gridTemplateColumns: '28px 1fr 52px 68px 36px',
              alignItems: 'center',
              padding: '8px 0',
              paddingLeft: isFast ? 6 : 0,
              borderBottom: '1px solid var(--trail-border)',
              borderLeft: isFast ? '3px solid #e8651a' : '3px solid transparent',
              background: isFast ? 'rgba(232,101,26,0.07)' : 'transparent',
            }}
          >
            {/* # badge */}
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: isFast ? 'rgba(232,101,26,0.22)' : 'var(--trail-card)',
              border: `1px solid ${isFast ? 'rgba(232,101,26,0.55)' : 'var(--trail-border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
              color: isFast ? '#e8651a' : 'var(--trail-muted)',
              flexShrink: 0,
            }}>
              {lap.split}
            </div>

            {/* Distance + RAPIDE badge */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--trail-text)' }}>
                {fmtLapDist(lap.distance)}
              </span>
              {isFast && (
                <span style={{
                  fontSize: 10, fontWeight: 800,
                  color: '#e8651a',
                  background: 'rgba(232,101,26,0.15)',
                  borderRadius: 3,
                  padding: '1px 4px',
                  width: 'fit-content',
                  letterSpacing: '0.4px',
                }}>
                  RAPIDE
                </span>
              )}
            </div>

            {/* Temps */}
            <span style={{
              fontSize: 13,
              fontWeight: isFast ? 800 : 500,
              color: isFast ? 'var(--trail-text)' : 'var(--trail-muted)',
            }}>
              {fmtPaceSec(lap.moving_time)}
            </span>

            {/* Allure */}
            <span style={{ fontSize: 12, color: 'var(--trail-muted)' }}>
              {pace ? `${fmtPaceSec(pace)}/km` : '—'}
            </span>

            {/* D+ */}
            <span style={{ fontSize: 12, color: elev > 0 ? '#8bc34a' : 'var(--trail-border)' }}>
              {elev > 0 ? `+${elev}m` : ''}
            </span>
          </div>
        )
      })}

      {/* Copy button */}
      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          disabled={!hasFastLaps}
          onClick={handleCopy}
          style={{
            width: '100%',
            padding: '10px 16px',
            background: hasFastLaps ? 'rgba(232,101,26,0.18)' : 'var(--trail-card)',
            border: `1px solid ${hasFastLaps ? 'rgba(232,101,26,0.4)' : 'var(--trail-border)'}`,
            borderRadius: 10,
            color: hasFastLaps ? '#e8651a' : 'var(--trail-muted)',
            fontSize: 13, fontWeight: 800,
            cursor: hasFastLaps ? 'pointer' : 'default',
          }}
        >
          {copyError
            ? 'Impossible de copier'
            : copied
            ? 'Copié !'
            : hasFastLaps
            ? `Copier les temps rapides (${fastSplits.size})`
            : 'Aucun bloc rapide détecté'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3.4: Run tests — all should pass**

```bash
cd web && npx jest __tests__/activities/ActivityFractionneSplits.test.tsx --no-coverage 2>&1 | tail -8
```

Expected: `Tests: 9 passed, 9 total`.

- [ ] **Step 3.5: Commit**

```bash
cd web && git add components/ui/ActivityFractionneSplits.tsx __tests__/activities/ActivityFractionneSplits.test.tsx
git commit -m "feat(fractionne): add ActivityFractionneSplits component with fast-lap detection and copy"
```

---

## Task 4: Add "Fractionné" tab to ActivityDetailClient

**Files:**
- Modify: `web/app/(main)/activities/[id]/ActivityDetailClient.tsx`

- [ ] **Step 4.1: Add imports**

In `ActivityDetailClient.tsx`, change the existing `StravaSplit` import (line 13) and add the new component import:

```typescript
// Line 7 area — add ActivityFractionneSplits import:
import { ActivitySplits } from '@/components/ui/ActivitySplits'
import { ActivityFractionneSplits } from '@/components/ui/ActivityFractionneSplits'  // ADD
import { ActivityHeartRateZones } from '@/components/ui/ActivityHeartRateZones'

// Line 13 area — extend StravaLap import:
import type { StravaSplit, StravaLap } from '@/lib/activities/detail'
```

- [ ] **Step 4.2: Extend Tab type (line 246)**

```typescript
// Before:
type Tab = 'splits' | 'zones' | 'stats'

// After:
type Tab = 'splits' | 'fractionne' | 'zones' | 'stats'
```

- [ ] **Step 4.3: Add `laps` prop to the component function signature (line 256–264)**

```typescript
// Before:
export function ActivityDetailClient({
  activity,
  splits,
  athleteProfile,
}: {
  activity:       ActivityDetail
  splits:         StravaSplit[] | null
  athleteProfile: AthleteHrProfile
}) {

// After:
export function ActivityDetailClient({
  activity,
  splits,
  laps,
  athleteProfile,
}: {
  activity:       ActivityDetail
  splits:         StravaSplit[] | null
  laps:           StravaLap[] | null
  athleteProfile: AthleteHrProfile
}) {
```

- [ ] **Step 4.4: Add `showFractionne` and update `activeTab` default (after line 282)**

```typescript
// After:  const showSplits = splits !== null && splits.length > 0
  const showZones  = a.avg_hr !== null && a.max_hr !== null

// Add:
  const showFractionne = laps !== null && laps.length >= 2

// Change activeTab initial state (line 285):
// Before:
  const [activeTab, setActiveTab] = useState<Tab>(showSplits ? 'splits' : showZones ? 'zones' : 'stats')
// After:
  const [activeTab, setActiveTab] = useState<Tab>(
    showSplits ? 'splits' : showFractionne ? 'fractionne' : showZones ? 'zones' : 'stats'
  )
```

- [ ] **Step 4.5: Add "Fractionné" tab button (after the "Splits" button, ~line 461)**

After the `{showSplits && (<button ...>Splits</button>)}` block, add:

```tsx
{showFractionne && (
  <button
    onClick={() => setActiveTab('fractionne')}
    style={{
      flex: 1, padding: '9px 0',
      fontSize: 14, fontWeight: 700, textAlign: 'center',
      textTransform: 'uppercase', letterSpacing: '0.9px',
      color: activeTab === 'fractionne' ? '#e8651a' : 'var(--trail-muted)',
      background: 'none', border: 'none',
      borderBottom: activeTab === 'fractionne' ? '2px solid #e8651a' : '2px solid transparent',
      cursor: 'pointer',
    }}
  >
    Fractionné
  </button>
)}
```

- [ ] **Step 4.6: Add "Fractionné" tab content (in the `<div style={{ paddingTop: 12 }}>` section, ~line 494)**

After `{activeTab === 'splits' && showSplits && (...)}`, add:

```tsx
{activeTab === 'fractionne' && showFractionne && (
  <ActivityFractionneSplits laps={laps!} />
)}
```

- [ ] **Step 4.7: TypeScript check — zero errors expected**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4.8: Commit**

```bash
cd web && git add app/\(main\)/activities/\[id\]/ActivityDetailClient.tsx
git commit -m "feat(fractionne): add Fractionné tab with laps display in ActivityDetailClient"
```

---

## Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 5.1: Run all tests**

```bash
cd web && npx jest --no-coverage 2>&1 | tail -12
```

Expected: all suites pass, zero failures.

- [ ] **Step 5.2: TypeScript check**

```bash
cd web && npx tsc --noEmit 2>&1
```

Expected: no output (zero errors).

- [ ] **Step 5.3: Build check**

```bash
cd web && npx next build 2>&1 | tail -15
```

Expected: successful build, no errors.

- [ ] **Step 5.4: Final commit (if needed)**

Only if there are any last-minute fixes:

```bash
cd web && git add -p
git commit -m "fix(fractionne): address build/type issues"
```

---

## Summary

| Tâche | Fichiers |
|-------|---------|
| Types + utilities | `lib/activities/detail.ts`, `__tests__/activities/detail.test.ts` |
| Extraction laps Strava + cache | `app/(main)/activities/[id]/page.tsx` |
| Composant table + copie | `components/ui/ActivityFractionneSplits.tsx`, `__tests__/activities/ActivityFractionneSplits.test.tsx` |
| Onglet dans ActivityDetailClient | `app/(main)/activities/[id]/ActivityDetailClient.tsx` |

**Aucune migration Supabase. Aucune table créée. Aucun appel API supplémentaire.**

---

## Limitations connues

- `total_elevation_gain` dans les laps Strava est toujours positif (dénivelé montée uniquement). La colonne D+ n'affiche que les montées.
- `average_heartrate` par lap n'est pas affiché (non demandé dans le spec).
- La détection des blocs rapides (médiane × 0,95) peut ne pas détecter les blocs rapides si l'activité est une sortie régulière sans vrai fractionné — le bouton de copie sera désactivé dans ce cas.
- Pour les activités Strava sans laps personnalisés (1 seul lap auto = toute la sortie), l'onglet est masqué.
