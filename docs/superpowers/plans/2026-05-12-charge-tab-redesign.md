> **Status: Implémenté** · Date: 2026-05-12 · Code: `web/lib/analytics/charge-insights.ts`, `web/components/charge/`
> *Snapshot de design — pour l'état actuel, voir le code.*

# Charge Tab Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre l'onglet Charge en 12 blocs draggables/masquables avec vocabulaire pédagogique, filtre sport global persistant, et moteur d'insights déterministe — tout en gardant le modèle EWMA 7j/42j existant intact.

**Architecture :** Nouveau module `charge-insights.ts` (fonctions pures testables) + `charge-thresholds.ts` (config). Nouveau loader serveur `getChargePageData` qui pré-calcule 4 datasets (`all|run|ride|swim`). Refacto `DashboardGrid` → `BlockGrid` générique partagé. Page Charge = Server Component + `ChargePageClient` avec localStorage par onglet.

**Tech Stack :** Next.js 14 App Router, TypeScript strict, Supabase (`@supabase/ssr`), Recharts, `@dnd-kit/core` + `@dnd-kit/sortable`, Tailwind, Jest + ts-jest, jsdom.

**Spec source :** [docs/superpowers/specs/2026-05-12-charge-tab-redesign-design.md](../specs/2026-05-12-charge-tab-redesign-design.md)

**Working directory pour toutes les commandes :** `web/` sauf indication contraire.

---

## Phase 1 — Analytics foundation

### Task 1.1 : Seuils centralisés

**Files:**
- Create: `web/lib/analytics/charge-thresholds.ts`

- [ ] **Step 1 : Créer le fichier**

```ts
// web/lib/analytics/charge-thresholds.ts
// Seuils numériques pour le moteur d'insights de la page Charge.
// Modifiables ici sans toucher au reste du code.

export const LOAD_BALANCE = {
  low:      0.75,
  balanced: 1.25,
  high:     1.5,
} as const

export const FRESHNESS = {
  veryFresh:     15,
  fresh:         5,
  normalFatigue: -10,
  highFatigue:   -25,
} as const

export const MONOTONY = {
  variedMax:    1.5,
  repetitiveMin: 2.0,
} as const

export const STRAIN = {
  high: 6000,
} as const

export const RAMP_RATE = {
  fastRise:       0.30,
  controlledRise: 0.10,
  decline:        -0.30,
} as const

export const WINDOWS = {
  short:  7,
  medium: 28,
  long:   70,
} as const
```

- [ ] **Step 2 : Vérifier compilation TypeScript**

Run: `pnpm exec tsc --noEmit -p tsconfig.json` from `web/`
Expected: 0 errors

- [ ] **Step 3 : Commit**

```bash
git add web/lib/analytics/charge-thresholds.ts
git commit -m "feat(analytics): add charge thresholds config"
```

---

### Task 1.2 : Types du module charge-insights

**Files:**
- Create: `web/lib/analytics/charge-insights.types.ts`

- [ ] **Step 1 : Créer les types**

```ts
// web/lib/analytics/charge-insights.types.ts
import type { DailyMetrics, DailyLoad } from './fatigue'

export type SportCategoryKey = 'run' | 'ride' | 'swim' | 'other'

export type CesActivity = {
  id:               string
  rawSportType:     string                  // 'Run', 'TrailRun', 'Ride', etc.
  name:             string
  startDate:        string                  // ISO 8601
  ces:              number                  // peut être 0 ou NaN si absent
  movingTimeSec:    number | null
  distanceMeters:   number | null
  elevationGainM:   number | null
  avgHr:            number | null
  manualIntensity:  string | null
  workoutType:      string | null
}

export type WeeklyLoadByCategory = {
  weekLabel: string          // 'DD/MM'
  weekStart: string          // ISO date du lundi
  run:       number
  ride:      number
  swim:      number
  other:     number
  total:     number
  avg4w:     number          // moyenne CES des 4 semaines glissantes incluant celle-ci
}

export type FreshnessZone = 'very-fresh' | 'fresh' | 'balanced' | 'normal-fatigue' | 'high-fatigue'

export type FreshnessResult = {
  tsb:              number
  deltaVsWeekAgo:   number    // tsb - tsb(7j avant)
  zone:             FreshnessZone
}

export type LoadBalanceResult = {
  ewmaRatio:      number      // ATL / CTL
  sumRatio7vs28:  number      // sum7d / (sum28d / 4)
}

export type SportDistribution = {
  run:    number
  ride:   number
  swim:   number
  other:  number
  total:  number
}

export type IntensityLabel =
  | 'Récupération'
  | 'Footing'
  | 'Endurance active'
  | 'Seuil'
  | 'VMA'
  | 'Non déterminée'

export type IntensityShareCes = {
  label:  IntensityLabel
  ces:    number
}

export type TopActivity = {
  id:               string
  date:             string      // ISO
  sport:            string      // sportLabel humain
  name:             string
  ces:              number
  durationSec:      number
  intensityLabel:   IntensityLabel | null
  typeLabel:        string | null      // workoutType ou null
  share7dPct:       number              // 0..100
}

export type RampRateLabel =
  | 'fast-rise'
  | 'controlled-rise'
  | 'stable'
  | 'progressive-resume'
  | 'declining'
  | 'sharp-decline'

export type RampRateResult = {
  deltaWeekPct:  number         // (curWeek - prevWeek) / prevWeek (ou 0 si prevWeek === 0)
  label:         RampRateLabel
  prevWeekZero:  boolean
}

export type StatusId =
  | 'insufficient'
  | 'overloaded'
  | 'peak'
  | 'loaded'
  | 'under-trained'
  | 'very-fresh'
  | 'light'
  | 'progressing'
  | 'balanced'

export type InsightsResult = {
  status:    StatusId
  headline:  string
  notes:     string[]
}

export type ChargeSportPayload = {
  dailyMetrics:           DailyMetrics[]
  dailyLoads:             DailyLoad[]
  weeklyLoadByCategory:   WeeklyLoadByCategory[]
  sportDistribution:      { '7': SportDistribution; '28': SportDistribution; '70': SportDistribution }
  intensityDistribution:  { '7': IntensityShareCes[]; '28': IntensityShareCes[]; '70': IntensityShareCes[] }
  top:                    TopActivity[]
  monotony7d:             number
  strain7d:               number
  activeDays7d:           number
  peakDay7d:              { date: string; ces: number } | null
  rampRate:               RampRateResult
  insights:               InsightsResult
  noCesActivities7d:      number
  noCesActivities28d:     number
  historyDays:            number
}
```

- [ ] **Step 2 : Vérifier compilation**

Run: `pnpm exec tsc --noEmit -p tsconfig.json` from `web/`
Expected: 0 errors

- [ ] **Step 3 : Commit**

```bash
git add web/lib/analytics/charge-insights.types.ts
git commit -m "feat(analytics): add charge-insights types"
```

---

### Task 1.3 : `getDailyLoadSeries` (TDD)

**Files:**
- Create: `web/lib/analytics/charge-insights.ts`
- Create: `web/__tests__/analytics/charge-insights.test.ts`

- [ ] **Step 1 : Écrire le test failing**

Append to `web/__tests__/analytics/charge-insights.test.ts` :

```ts
import { getDailyLoadSeries } from '@/lib/analytics/charge-insights'
import type { CesActivity } from '@/lib/analytics/charge-insights.types'

function act(partial: Partial<CesActivity> & { startDate: string; ces: number; id?: string }): CesActivity {
  return {
    id:              partial.id ?? `id-${partial.startDate}`,
    rawSportType:    partial.rawSportType ?? 'Run',
    name:            partial.name ?? 'Test',
    startDate:       partial.startDate,
    ces:             partial.ces,
    movingTimeSec:   partial.movingTimeSec ?? 3600,
    distanceMeters:  partial.distanceMeters ?? 10000,
    elevationGainM:  partial.elevationGainM ?? 0,
    avgHr:           partial.avgHr ?? null,
    manualIntensity: partial.manualIntensity ?? null,
    workoutType:     partial.workoutType ?? null,
  }
}

describe('getDailyLoadSeries', () => {
  it('returns empty array for no activities', () => {
    expect(getDailyLoadSeries([], 30)).toEqual([])
  })

  it('aggregates CES by day across activities', () => {
    const acts = [
      act({ startDate: '2026-05-01T08:00:00Z', ces: 50 }),
      act({ startDate: '2026-05-01T16:00:00Z', ces: 30, id: '2' }),
      act({ startDate: '2026-05-02T08:00:00Z', ces: 40, id: '3' }),
    ]
    const series = getDailyLoadSeries(acts, 5, new Date('2026-05-03T00:00:00Z'))
    const map = Object.fromEntries(series.map(d => [d.date, d.ces]))
    expect(map['2026-05-01']).toBe(80)
    expect(map['2026-05-02']).toBe(40)
    expect(map['2026-05-03']).toBe(0)
  })

  it('returns exactly `days` consecutive entries ending today', () => {
    const series = getDailyLoadSeries([], 7, new Date('2026-05-10T12:00:00Z'))
    expect(series).toHaveLength(7)
    expect(series[0].date).toBe('2026-05-04')
    expect(series[6].date).toBe('2026-05-10')
  })

  it('ignores activities outside the window', () => {
    const acts = [act({ startDate: '2026-04-01T08:00:00Z', ces: 999 })]
    const series = getDailyLoadSeries(acts, 7, new Date('2026-05-10T12:00:00Z'))
    expect(series.every(d => d.ces === 0)).toBe(true)
  })
})
```

- [ ] **Step 2 : Lancer le test, voir qu'il échoue**

Run: `pnpm test -- charge-insights` from `web/`
Expected: FAIL (module not found)

- [ ] **Step 3 : Implémenter**

Create `web/lib/analytics/charge-insights.ts` :

```ts
// web/lib/analytics/charge-insights.ts
import type { DailyLoad } from './fatigue'
import type { CesActivity } from './charge-insights.types'

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function isoDateOf(activity: CesActivity): string {
  return activity.startDate.slice(0, 10)
}

export function getDailyLoadSeries(
  activities: CesActivity[],
  days: number,
  now: Date = new Date(),
): DailyLoad[] {
  if (days <= 0) return []
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (days - 1))

  const cesByDate = new Map<string, number>()
  for (const a of activities) {
    if (!Number.isFinite(a.ces) || a.ces == null) continue
    const key = isoDateOf(a)
    if (key < dateKey(start) || key > dateKey(end)) continue
    cesByDate.set(key, (cesByDate.get(key) ?? 0) + a.ces)
  }

  const result: DailyLoad[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const key = dateKey(cursor)
    result.push({ date: key, ces: cesByDate.get(key) ?? 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return result
}
```

- [ ] **Step 4 : Relancer le test**

Run: `pnpm test -- charge-insights` from `web/`
Expected: PASS

- [ ] **Step 5 : Commit**

```bash
git add web/lib/analytics/charge-insights.ts web/lib/analytics/charge-insights.types.ts web/__tests__/analytics/charge-insights.test.ts
git commit -m "feat(analytics): add getDailyLoadSeries"
```

---

### Task 1.4 : `getWeeklyLoadByCategory` (TDD)

**Files:**
- Modify: `web/lib/analytics/charge-insights.ts`
- Modify: `web/__tests__/analytics/charge-insights.test.ts`

- [ ] **Step 1 : Ajouter le test**

Append to `web/__tests__/analytics/charge-insights.test.ts` :

```ts
import { getWeeklyLoadByCategory, type CesActivity as _CA } from '@/lib/analytics/charge-insights'

describe('getWeeklyLoadByCategory', () => {
  it('returns 10 weeks ending in the current ISO week', () => {
    const weeks = getWeeklyLoadByCategory([], 10, new Date('2026-05-12T12:00:00Z'))
    expect(weeks).toHaveLength(10)
    // 2026-05-12 is a Tuesday → ISO week starts Monday 2026-05-11
    expect(weeks[9].weekStart).toBe('2026-05-11')
  })

  it('buckets activities into run/ride/swim/other', () => {
    const acts: CesActivity[] = [
      act({ startDate: '2026-05-12T08:00:00Z', ces: 50, rawSportType: 'Run',        id: '1' }),
      act({ startDate: '2026-05-13T08:00:00Z', ces: 70, rawSportType: 'TrailRun',   id: '2' }),
      act({ startDate: '2026-05-14T08:00:00Z', ces: 40, rawSportType: 'Ride',       id: '3' }),
      act({ startDate: '2026-05-14T16:00:00Z', ces: 30, rawSportType: 'VirtualRide',id: '4' }),
      act({ startDate: '2026-05-15T08:00:00Z', ces: 25, rawSportType: 'Swim',       id: '5' }),
      act({ startDate: '2026-05-16T08:00:00Z', ces: 15, rawSportType: 'Walk',       id: '6' }),
    ]
    const weeks = getWeeklyLoadByCategory(acts, 10, new Date('2026-05-17T12:00:00Z'))
    const current = weeks[weeks.length - 1]
    expect(current.run).toBe(120)
    expect(current.ride).toBe(70)
    expect(current.swim).toBe(25)
    expect(current.other).toBe(15)
    expect(current.total).toBe(230)
  })

  it('computes avg4w as mean of last 4 weeks total (or fewer if start of window)', () => {
    const now = new Date('2026-05-31T12:00:00Z')
    const acts: CesActivity[] = []
    for (let i = 0; i < 4; i++) {
      const monday = new Date(now)
      monday.setUTCDate(monday.getUTCDate() - 7 * i)
      acts.push(act({ startDate: monday.toISOString(), ces: 100 * (i + 1), id: `w${i}` }))
    }
    const weeks = getWeeklyLoadByCategory(acts, 10, now)
    const lastFour = weeks.slice(-4).map(w => w.total)
    expect(lastFour).toEqual([400, 300, 200, 100])
    expect(weeks[weeks.length - 1].avg4w).toBe(250)
  })
})
```

- [ ] **Step 2 : Test fails**

Run: `pnpm test -- charge-insights` from `web/`
Expected: FAIL (function undefined)

- [ ] **Step 3 : Implémenter**

Append to `web/lib/analytics/charge-insights.ts` :

```ts
import type { WeeklyLoadByCategory, SportCategoryKey } from './charge-insights.types'

const RUN_TYPES  = new Set(['Run', 'TrailRun'])
const RIDE_TYPES = new Set(['Ride', 'VirtualRide', 'EBikeRide', 'GravelRide', 'MountainBikeRide'])
const SWIM_TYPES = new Set(['Swim'])

export function classifySportCategory(rawSportType: string): SportCategoryKey {
  if (RUN_TYPES.has(rawSportType))  return 'run'
  if (RIDE_TYPES.has(rawSportType)) return 'ride'
  if (SWIM_TYPES.has(rawSportType)) return 'swim'
  return 'other'
}

function isoMondayOf(d: Date): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = out.getUTCDay()                 // 0 = Sun, 1 = Mon, …
  const diff = dow === 0 ? -6 : 1 - dow
  out.setUTCDate(out.getUTCDate() + diff)
  return out
}

function weekLabel(monday: Date): string {
  const dd = String(monday.getUTCDate()).padStart(2, '0')
  const mm = String(monday.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}

export function getWeeklyLoadByCategory(
  activities: CesActivity[],
  weeks: number,
  now: Date = new Date(),
): WeeklyLoadByCategory[] {
  if (weeks <= 0) return []
  const currentMonday = isoMondayOf(now)
  const result: WeeklyLoadByCategory[] = []

  for (let i = weeks - 1; i >= 0; i--) {
    const monday = new Date(currentMonday)
    monday.setUTCDate(monday.getUTCDate() - 7 * i)
    const nextMonday = new Date(monday)
    nextMonday.setUTCDate(nextMonday.getUTCDate() + 7)

    const slot: WeeklyLoadByCategory = {
      weekStart: dateKey(monday),
      weekLabel: weekLabel(monday),
      run: 0, ride: 0, swim: 0, other: 0, total: 0, avg4w: 0,
    }

    for (const a of activities) {
      const ad = new Date(a.startDate)
      if (ad < monday || ad >= nextMonday) continue
      if (!Number.isFinite(a.ces) || a.ces == null) continue
      const cat = classifySportCategory(a.rawSportType)
      slot[cat] += a.ces
      slot.total += a.ces
    }
    result.push(slot)
  }

  // avg4w: moyenne des totaux sur les 4 dernières semaines incluant la courante
  for (let i = 0; i < result.length; i++) {
    const start = Math.max(0, i - 3)
    const slice = result.slice(start, i + 1)
    const sum = slice.reduce((s, w) => s + w.total, 0)
    result[i].avg4w = Math.round((sum / slice.length) * 10) / 10
  }
  return result
}
```

- [ ] **Step 4 : Tests pass**

Run: `pnpm test -- charge-insights` from `web/`
Expected: PASS (all)

- [ ] **Step 5 : Commit**

```bash
git add web/lib/analytics/charge-insights.ts web/__tests__/analytics/charge-insights.test.ts
git commit -m "feat(analytics): add getWeeklyLoadByCategory + classifySportCategory"
```

---

### Task 1.5 : `computeFreshness` & helpers acute/chronic (TDD)

**Files:**
- Modify: `web/lib/analytics/charge-insights.ts`
- Modify: `web/__tests__/analytics/charge-insights.test.ts`

- [ ] **Step 1 : Test**

Append :

```ts
import { computeFreshness, computeAcuteLoad7d, computeChronicLoad } from '@/lib/analytics/charge-insights'
import { buildDailyMetrics } from '@/lib/analytics/fatigue'

describe('freshness / acute / chronic', () => {
  it('returns zero result for empty metrics', () => {
    const f = computeFreshness([])
    expect(f.tsb).toBe(0)
    expect(f.deltaVsWeekAgo).toBe(0)
    expect(f.zone).toBe('balanced')
  })

  it('zones based on tsb thresholds', () => {
    const loads = Array.from({ length: 50 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      ces: 50,
    }))
    const m = buildDailyMetrics(loads)
    // override latest tsb manually
    m[m.length - 1] = { ...m[m.length - 1], tsb: 20 }
    expect(computeFreshness(m).zone).toBe('very-fresh')

    m[m.length - 1] = { ...m[m.length - 1], tsb: 8 }
    expect(computeFreshness(m).zone).toBe('fresh')

    m[m.length - 1] = { ...m[m.length - 1], tsb: 0 }
    expect(computeFreshness(m).zone).toBe('balanced')

    m[m.length - 1] = { ...m[m.length - 1], tsb: -15 }
    expect(computeFreshness(m).zone).toBe('normal-fatigue')

    m[m.length - 1] = { ...m[m.length - 1], tsb: -30 }
    expect(computeFreshness(m).zone).toBe('high-fatigue')
  })

  it('deltaVsWeekAgo = tsb - tsb 7 days ago', () => {
    const loads = Array.from({ length: 20 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      ces: i < 13 ? 30 : 120,    // load surge in last week
    }))
    const m = buildDailyMetrics(loads)
    const f = computeFreshness(m)
    const seven = m[m.length - 8].tsb
    expect(f.deltaVsWeekAgo).toBeCloseTo(m[m.length - 1].tsb - seven, 1)
  })

  it('computeAcuteLoad7d / computeChronicLoad return latest atl / ctl', () => {
    const loads = Array.from({ length: 50 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      ces: 50,
    }))
    const m = buildDailyMetrics(loads)
    expect(computeAcuteLoad7d(m)).toBeCloseTo(m[m.length - 1].atl, 1)
    expect(computeChronicLoad(m)).toBeCloseTo(m[m.length - 1].ctl, 1)
  })
})
```

- [ ] **Step 2 : Test fails**

Run: `pnpm test -- charge-insights`
Expected: FAIL

- [ ] **Step 3 : Implémenter**

Append to `web/lib/analytics/charge-insights.ts` :

```ts
import type { DailyMetrics } from './fatigue'
import type { FreshnessResult, FreshnessZone } from './charge-insights.types'
import { FRESHNESS } from './charge-thresholds'

function freshnessZoneFor(tsb: number): FreshnessZone {
  if (tsb >= FRESHNESS.veryFresh)     return 'very-fresh'
  if (tsb >= FRESHNESS.fresh)         return 'fresh'
  if (tsb > FRESHNESS.normalFatigue)  return 'balanced'
  if (tsb > FRESHNESS.highFatigue)    return 'normal-fatigue'
  return 'high-fatigue'
}

export function computeAcuteLoad7d(metrics: DailyMetrics[]): number {
  if (metrics.length === 0) return 0
  return metrics[metrics.length - 1].atl
}

export function computeChronicLoad(metrics: DailyMetrics[]): number {
  if (metrics.length === 0) return 0
  return metrics[metrics.length - 1].ctl
}

export function computeFreshness(metrics: DailyMetrics[]): FreshnessResult {
  if (metrics.length === 0) return { tsb: 0, deltaVsWeekAgo: 0, zone: 'balanced' }
  const last = metrics[metrics.length - 1]
  const sevenAgo = metrics[metrics.length - 8] ?? metrics[0]
  const delta = Math.round((last.tsb - sevenAgo.tsb) * 10) / 10
  return { tsb: last.tsb, deltaVsWeekAgo: delta, zone: freshnessZoneFor(last.tsb) }
}
```

- [ ] **Step 4 : Tests pass**

Run: `pnpm test -- charge-insights`
Expected: PASS (all)

- [ ] **Step 5 : Commit**

```bash
git add web/lib/analytics/charge-insights.ts web/__tests__/analytics/charge-insights.test.ts
git commit -m "feat(analytics): add freshness + acute/chronic helpers"
```

---

### Task 1.6 : `computeLoadBalanceRatio` (TDD)

**Files:**
- Modify: `web/lib/analytics/charge-insights.ts`
- Modify: `web/__tests__/analytics/charge-insights.test.ts`

- [ ] **Step 1 : Test**

Append :

```ts
import { computeLoadBalanceRatio } from '@/lib/analytics/charge-insights'

describe('computeLoadBalanceRatio', () => {
  function loadsConst(days: number, ces: number) {
    return Array.from({ length: days }, (_, i) => ({
      date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      ces,
    }))
  }

  it('returns zero ratios for empty input', () => {
    const r = computeLoadBalanceRatio([], [])
    expect(r.ewmaRatio).toBe(0)
    expect(r.sumRatio7vs28).toBe(0)
  })

  it('ewmaRatio = atl / ctl from metrics', () => {
    const m = buildDailyMetrics(loadsConst(50, 50))
    const dl = loadsConst(50, 50)
    const r = computeLoadBalanceRatio(m, dl)
    expect(r.ewmaRatio).toBeCloseTo(m[m.length - 1].atl / m[m.length - 1].ctl, 2)
  })

  it('sumRatio7vs28 = sum7d / (sum28d/4)', () => {
    // 28 jours @ 50 → sum28 = 1400 → avg7 = 350. Derniers 7j @ 100 → sum7 = 700. Ratio = 2.0.
    const days: { date: string; ces: number }[] = []
    for (let i = 0; i < 28; i++) {
      days.push({ date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), ces: i < 21 ? 50 : 100 })
    }
    const m = buildDailyMetrics(days)
    const r = computeLoadBalanceRatio(m, days)
    // sum7 = 700, sum28 = 21*50 + 7*100 = 1050+700 = 1750 → avg7w = 437.5 → ratio = 1.6
    expect(r.sumRatio7vs28).toBeCloseTo(700 / (1750 / 4), 2)
  })
})
```

- [ ] **Step 2 : Test fails**

Run: `pnpm test -- charge-insights`
Expected: FAIL

- [ ] **Step 3 : Implémenter**

Append to `web/lib/analytics/charge-insights.ts` :

```ts
import type { LoadBalanceResult } from './charge-insights.types'

export function computeLoadBalanceRatio(
  metrics: DailyMetrics[],
  dailyLoads: DailyLoad[],
): LoadBalanceResult {
  if (metrics.length === 0 || dailyLoads.length === 0)
    return { ewmaRatio: 0, sumRatio7vs28: 0 }
  const last = metrics[metrics.length - 1]
  const ewmaRatio = last.ctl > 0 ? Math.round((last.atl / last.ctl) * 100) / 100 : 0

  const tail7  = dailyLoads.slice(-7)
  const tail28 = dailyLoads.slice(-28)
  const sum7   = tail7.reduce((s, d) => s + d.ces, 0)
  const sum28  = tail28.reduce((s, d) => s + d.ces, 0)
  const avg7Week = sum28 / 4
  const sumRatio7vs28 = avg7Week > 0 ? Math.round((sum7 / avg7Week) * 100) / 100 : 0

  return { ewmaRatio, sumRatio7vs28 }
}
```

- [ ] **Step 4 : Tests pass**

Run: `pnpm test -- charge-insights`
Expected: PASS

- [ ] **Step 5 : Commit**

```bash
git add web/lib/analytics/charge-insights.ts web/__tests__/analytics/charge-insights.test.ts
git commit -m "feat(analytics): add computeLoadBalanceRatio"
```

---

### Task 1.7 : `computeMonotony7d`, `computeStrain7d`, `activeDays7d`, `peakDay7d` (TDD)

**Files:**
- Modify: `web/lib/analytics/charge-insights.ts`
- Modify: `web/__tests__/analytics/charge-insights.test.ts`

- [ ] **Step 1 : Test**

Append :

```ts
import { computeMonotony7d, computeStrain7d, computeActiveDays7d, computePeakDay7d } from '@/lib/analytics/charge-insights'

describe('monotony / strain / activeDays / peakDay', () => {
  it('monotony = 0 when std is 0 (constant load, all 7 days)', () => {
    const loads = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      ces: 50,
    }))
    // mean = 50, std = 0 → monotony returns large number; we clamp to 0 if std === 0
    // but standard practice is mean/std. With std=0 we return Infinity → clamp to MONOTONY.repetitiveMin
    expect(computeMonotony7d(loads)).toBeGreaterThanOrEqual(2.0)
  })

  it('monotony lower when load varies', () => {
    const loads = [10, 100, 20, 80, 30, 90, 0].map((c, i) => ({
      date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      ces: c,
    }))
    const mono = computeMonotony7d(loads)
    expect(mono).toBeLessThan(1.5)
  })

  it('strain = sum7d × monotony', () => {
    const loads = [10, 100, 20, 80, 30, 90, 0].map((c, i) => ({
      date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      ces: c,
    }))
    const sum = 10 + 100 + 20 + 80 + 30 + 90 + 0
    const expected = sum * computeMonotony7d(loads)
    expect(computeStrain7d(loads)).toBeCloseTo(expected, 0)
  })

  it('activeDays7d counts days with ces > 0', () => {
    const loads = [50, 0, 30, 0, 0, 20, 0].map((c, i) => ({
      date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      ces: c,
    }))
    expect(computeActiveDays7d(loads)).toBe(3)
  })

  it('peakDay7d returns the highest CES day in last 7', () => {
    const loads = [50, 10, 80, 20, 30, 40, 0].map((c, i) => ({
      date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      ces: c,
    }))
    const p = computePeakDay7d(loads)
    expect(p).toEqual({ date: '2026-01-03', ces: 80 })
  })

  it('peakDay7d returns null if all zero', () => {
    const loads = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      ces: 0,
    }))
    expect(computePeakDay7d(loads)).toBeNull()
  })
})
```

- [ ] **Step 2 : Test fails**

Run: `pnpm test -- charge-insights`
Expected: FAIL

- [ ] **Step 3 : Implémenter**

Append to `web/lib/analytics/charge-insights.ts` :

```ts
import { MONOTONY } from './charge-thresholds'

function tail7(loads: DailyLoad[]): DailyLoad[] {
  return loads.slice(-7)
}

function meanStd(values: number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 0 }
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return { mean, std: Math.sqrt(variance) }
}

export function computeMonotony7d(loads: DailyLoad[]): number {
  const window = tail7(loads).map(d => d.ces)
  if (window.length === 0) return 0
  const { mean, std } = meanStd(window)
  if (std === 0) return mean === 0 ? 0 : MONOTONY.repetitiveMin
  return Math.round((mean / std) * 100) / 100
}

export function computeStrain7d(loads: DailyLoad[]): number {
  const sum = tail7(loads).reduce((s, d) => s + d.ces, 0)
  return Math.round(sum * computeMonotony7d(loads))
}

export function computeActiveDays7d(loads: DailyLoad[]): number {
  return tail7(loads).filter(d => d.ces > 0).length
}

export function computePeakDay7d(loads: DailyLoad[]): { date: string; ces: number } | null {
  const w = tail7(loads)
  const best = w.reduce<{ date: string; ces: number } | null>((acc, d) => {
    if (d.ces <= 0) return acc
    if (!acc || d.ces > acc.ces) return { date: d.date, ces: d.ces }
    return acc
  }, null)
  return best
}
```

- [ ] **Step 4 : Tests pass**

Run: `pnpm test -- charge-insights`
Expected: PASS (all)

- [ ] **Step 5 : Commit**

```bash
git add web/lib/analytics/charge-insights.ts web/__tests__/analytics/charge-insights.test.ts
git commit -m "feat(analytics): add monotony/strain/activeDays/peakDay helpers"
```

---

### Task 1.8 : `computeSportDistribution` (TDD)

**Files:**
- Modify: `web/lib/analytics/charge-insights.ts`
- Modify: `web/__tests__/analytics/charge-insights.test.ts`

- [ ] **Step 1 : Test**

Append :

```ts
import { computeSportDistribution } from '@/lib/analytics/charge-insights'

describe('computeSportDistribution', () => {
  it('returns zero distribution for no activities', () => {
    const d = computeSportDistribution([], 7, new Date('2026-05-12T12:00:00Z'))
    expect(d).toEqual({ run: 0, ride: 0, swim: 0, other: 0, total: 0 })
  })

  it('sums CES per category inside window', () => {
    const acts = [
      act({ startDate: '2026-05-12T08:00:00Z', ces: 50, rawSportType: 'Run',     id: '1' }),
      act({ startDate: '2026-05-11T08:00:00Z', ces: 40, rawSportType: 'Ride',    id: '2' }),
      act({ startDate: '2026-05-10T08:00:00Z', ces: 30, rawSportType: 'Swim',    id: '3' }),
      act({ startDate: '2026-05-09T08:00:00Z', ces: 20, rawSportType: 'Walk',    id: '4' }),
      act({ startDate: '2026-04-01T08:00:00Z', ces: 999, rawSportType: 'Run',    id: 'old' }),
    ]
    const d = computeSportDistribution(acts, 7, new Date('2026-05-13T12:00:00Z'))
    expect(d.run).toBe(50)
    expect(d.ride).toBe(40)
    expect(d.swim).toBe(30)
    expect(d.other).toBe(20)
    expect(d.total).toBe(140)
  })
})
```

- [ ] **Step 2 : Test fails**

Run: `pnpm test -- charge-insights`
Expected: FAIL

- [ ] **Step 3 : Implémenter**

Append to `web/lib/analytics/charge-insights.ts` :

```ts
import type { SportDistribution } from './charge-insights.types'

export function computeSportDistribution(
  activities: CesActivity[],
  windowDays: number,
  now: Date = new Date(),
): SportDistribution {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (windowDays - 1))

  const acc: SportDistribution = { run: 0, ride: 0, swim: 0, other: 0, total: 0 }
  for (const a of activities) {
    if (!Number.isFinite(a.ces) || a.ces == null) continue
    const d = a.startDate.slice(0, 10)
    if (d < dateKey(start) || d > dateKey(end)) continue
    const cat = classifySportCategory(a.rawSportType)
    acc[cat] += a.ces
    acc.total += a.ces
  }
  acc.run   = Math.round(acc.run)
  acc.ride  = Math.round(acc.ride)
  acc.swim  = Math.round(acc.swim)
  acc.other = Math.round(acc.other)
  acc.total = Math.round(acc.total)
  return acc
}
```

- [ ] **Step 4 : Tests pass**

Run: `pnpm test -- charge-insights`
Expected: PASS

- [ ] **Step 5 : Commit**

```bash
git add web/lib/analytics/charge-insights.ts web/__tests__/analytics/charge-insights.test.ts
git commit -m "feat(analytics): add computeSportDistribution"
```

---

### Task 1.9 : `computeIntensityDistribution` (TDD)

**Files:**
- Modify: `web/lib/analytics/charge-insights.ts`
- Modify: `web/__tests__/analytics/charge-insights.test.ts`

**Context :** Réutilise la classif HR existante. Étend pour 6 labels (ajoute "Récupération" sous "Footing" via mots-clés + manualIntensity `recuperation` ; ajoute "Endurance active" via zone 2 ou mot-clé "endurance").

- [ ] **Step 1 : Test**

Append :

```ts
import { computeIntensityDistribution } from '@/lib/analytics/charge-insights'
import type { HrZone } from '@/lib/health/hr-zones'

describe('computeIntensityDistribution', () => {
  const zones: HrZone[] = [
    { zone: 1, min: 90,  max: 120, name: 'Z1' },
    { zone: 2, min: 121, max: 140, name: 'Z2' },
    { zone: 3, min: 141, max: 160, name: 'Z3' },
    { zone: 4, min: 161, max: 175, name: 'Z4' },
    { zone: 5, min: 176, max: 200, name: 'Z5' },
  ]

  it('handles empty activities', () => {
    const d = computeIntensityDistribution([], 7, zones, new Date('2026-05-12T12:00:00Z'))
    expect(d).toEqual([])
  })

  it('uses manualIntensity first (recuperation → Récupération)', () => {
    const acts = [act({ startDate: '2026-05-12T08:00:00Z', ces: 50, manualIntensity: 'recuperation' })]
    const d = computeIntensityDistribution(acts, 7, zones, new Date('2026-05-13T12:00:00Z'))
    expect(d.find(x => x.label === 'Récupération')?.ces).toBe(50)
  })

  it('falls back to name keywords', () => {
    const acts = [
      act({ startDate: '2026-05-12T08:00:00Z', ces: 60, name: 'Sortie longue dimanche', id: '1' }),
      act({ startDate: '2026-05-11T08:00:00Z', ces: 40, name: 'VMA 400m × 8',           id: '2' }),
    ]
    const d = computeIntensityDistribution(acts, 7, zones, new Date('2026-05-13T12:00:00Z'))
    // "Sortie longue" maps to "Endurance active" in the new 6-label model
    expect(d.find(x => x.label === 'Endurance active')?.ces).toBe(60)
    expect(d.find(x => x.label === 'VMA')?.ces).toBe(40)
  })

  it('falls back to HR zone when no name/manual hint', () => {
    const acts = [
      act({ startDate: '2026-05-12T08:00:00Z', ces: 30, avgHr: 100, name: '' }),  // z1 → Récup
      act({ startDate: '2026-05-11T08:00:00Z', ces: 30, avgHr: 130, name: '', id: '2' }), // z2 → Endurance active
      act({ startDate: '2026-05-10T08:00:00Z', ces: 30, avgHr: 150, name: '', id: '3' }), // z3 → Footing (note: see mapping)
    ]
    const d = computeIntensityDistribution(acts, 7, zones, new Date('2026-05-13T12:00:00Z'))
    expect(d.find(x => x.label === 'Récupération')?.ces).toBe(30)
    expect(d.find(x => x.label === 'Endurance active')?.ces).toBe(30)
  })

  it('marks as Non déterminée when no signal', () => {
    const acts = [act({ startDate: '2026-05-12T08:00:00Z', ces: 25, name: '', avgHr: null })]
    const d = computeIntensityDistribution(acts, 7, [], new Date('2026-05-13T12:00:00Z'))
    expect(d.find(x => x.label === 'Non déterminée')?.ces).toBe(25)
  })
})
```

- [ ] **Step 2 : Test fails**

Run: `pnpm test -- charge-insights`
Expected: FAIL

- [ ] **Step 3 : Implémenter**

Append to `web/lib/analytics/charge-insights.ts` :

```ts
import type { HrZone } from '@/lib/health/hr-zones'
import { hrZoneForAvgHr } from '@/lib/health/hr-zones'
import type { IntensityLabel, IntensityShareCes } from './charge-insights.types'

const INTENSITY_ORDER: IntensityLabel[] = [
  'Récupération', 'Footing', 'Endurance active', 'Seuil', 'VMA', 'Non déterminée',
]

const MANUAL_TO_LABEL: Record<string, IntensityLabel> = {
  recuperation:     'Récupération',
  footing:          'Footing',
  endurance_active: 'Endurance active',
  sortie_longue:    'Endurance active',
  cotes:            'Footing',
  vma:              'VMA',
  seuil:            'Seuil',
  seuil_tempo:      'Seuil',
}

function labelFromName(name: string): IntensityLabel | null {
  const n = name.toLowerCase()
  if (n.includes('récup') || n.includes('recup')) return 'Récupération'
  if (n.includes('footing') || n.includes(' ef ') || n.includes('endurance facile')) return 'Footing'
  if (n.includes('sortie longue') || n.includes(' sl ') || n.includes('long run') || n.includes('endurance')) return 'Endurance active'
  if (n.includes('vma') || n.includes('400') || n.includes('200') || n.includes('fractionné') || n.includes('interval') || n.includes('répétition')) return 'VMA'
  if (n.includes('seuil') || n.includes('tempo') || n.includes('threshold')) return 'Seuil'
  return null
}

function labelFromZone(zone: number): IntensityLabel {
  if (zone <= 1) return 'Récupération'
  if (zone === 2) return 'Endurance active'
  if (zone === 3) return 'Footing'
  if (zone === 4) return 'Seuil'
  return 'VMA'
}

function classifyIntensity(a: CesActivity, zones: HrZone[]): IntensityLabel {
  if (a.manualIntensity && MANUAL_TO_LABEL[a.manualIntensity]) return MANUAL_TO_LABEL[a.manualIntensity]
  const fromName = labelFromName(a.name)
  if (fromName) return fromName
  if (a.avgHr != null && zones.length > 0) {
    const z = hrZoneForAvgHr(a.avgHr, zones)
    if (z !== null) return labelFromZone(z)
  }
  return 'Non déterminée'
}

export function computeIntensityDistribution(
  activities: CesActivity[],
  windowDays: number,
  zones: HrZone[],
  now: Date = new Date(),
): IntensityShareCes[] {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (windowDays - 1))

  const byLabel = new Map<IntensityLabel, number>()
  for (const a of activities) {
    if (!Number.isFinite(a.ces) || a.ces == null) continue
    const d = a.startDate.slice(0, 10)
    if (d < dateKey(start) || d > dateKey(end)) continue
    const label = classifyIntensity(a, zones)
    byLabel.set(label, (byLabel.get(label) ?? 0) + a.ces)
  }
  return INTENSITY_ORDER
    .filter(l => byLabel.has(l))
    .map(l => ({ label: l, ces: Math.round(byLabel.get(l)!) }))
}
```

- [ ] **Step 4 : Tests pass**

Run: `pnpm test -- charge-insights`
Expected: PASS (all)

- [ ] **Step 5 : Commit**

```bash
git add web/lib/analytics/charge-insights.ts web/__tests__/analytics/charge-insights.test.ts
git commit -m "feat(analytics): add computeIntensityDistribution (6-label model)"
```

---

### Task 1.10 : `computeTopLoadActivities` (TDD)

**Files:**
- Modify: `web/lib/analytics/charge-insights.ts`
- Modify: `web/__tests__/analytics/charge-insights.test.ts`

- [ ] **Step 1 : Test**

Append :

```ts
import { computeTopLoadActivities } from '@/lib/analytics/charge-insights'

describe('computeTopLoadActivities', () => {
  it('returns empty for no activities', () => {
    expect(computeTopLoadActivities([], 7, 5, [], new Date('2026-05-12T12:00:00Z'))).toEqual([])
  })

  it('returns top N by CES inside window, with share7dPct', () => {
    const acts = [
      act({ id: '1', startDate: '2026-05-12T08:00:00Z', ces: 80, name: 'A', rawSportType: 'Run',  movingTimeSec: 3600 }),
      act({ id: '2', startDate: '2026-05-11T08:00:00Z', ces: 60, name: 'B', rawSportType: 'Ride', movingTimeSec: 5400 }),
      act({ id: '3', startDate: '2026-05-10T08:00:00Z', ces: 40, name: 'C', rawSportType: 'Run',  movingTimeSec: 2700 }),
      act({ id: '4', startDate: '2026-05-09T08:00:00Z', ces: 20, name: 'D', rawSportType: 'Swim', movingTimeSec: 1800 }),
    ]
    const top = computeTopLoadActivities(acts, 7, 3, [], new Date('2026-05-13T12:00:00Z'))
    expect(top).toHaveLength(3)
    expect(top[0].id).toBe('1')
    expect(top[0].ces).toBe(80)
    expect(top[0].share7dPct).toBe(Math.round((80 / 200) * 100))
  })
})
```

- [ ] **Step 2 : Test fails**

Run: `pnpm test -- charge-insights`
Expected: FAIL

- [ ] **Step 3 : Implémenter**

Append :

```ts
import type { TopActivity } from './charge-insights.types'

const SPORT_LABELS: Record<string, string> = {
  Run: 'Course', TrailRun: 'Trail', Ride: 'Vélo', VirtualRide: 'Home trainer',
  EBikeRide: 'E-Bike', GravelRide: 'Gravel', MountainBikeRide: 'VTT',
  Swim: 'Natation', Walk: 'Marche', Hike: 'Rando', WeightTraining: 'Muscu',
}

export function computeTopLoadActivities(
  activities: CesActivity[],
  windowDays: number,
  n: number,
  zones: HrZone[],
  now: Date = new Date(),
): TopActivity[] {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (windowDays - 1))

  const inWindow = activities.filter(a => {
    if (!Number.isFinite(a.ces) || a.ces == null || a.ces <= 0) return false
    const d = a.startDate.slice(0, 10)
    return d >= dateKey(start) && d <= dateKey(end)
  })
  const totalCes = inWindow.reduce((s, a) => s + a.ces, 0)
  return [...inWindow]
    .sort((a, b) => b.ces - a.ces)
    .slice(0, n)
    .map(a => ({
      id:             a.id,
      date:           a.startDate,
      sport:          SPORT_LABELS[a.rawSportType] ?? a.rawSportType,
      name:           a.name,
      ces:            Math.round(a.ces),
      durationSec:    a.movingTimeSec ?? 0,
      intensityLabel: classifyIntensity(a, zones),
      typeLabel:      a.workoutType ?? null,
      share7dPct:     totalCes > 0 ? Math.round((a.ces / totalCes) * 100) : 0,
    }))
}
```

- [ ] **Step 4 : Tests pass**

Run: `pnpm test -- charge-insights`
Expected: PASS

- [ ] **Step 5 : Commit**

```bash
git add web/lib/analytics/charge-insights.ts web/__tests__/analytics/charge-insights.test.ts
git commit -m "feat(analytics): add computeTopLoadActivities"
```

---

### Task 1.11 : `computeRampRate` (TDD)

**Files:**
- Modify: `web/lib/analytics/charge-insights.ts`
- Modify: `web/__tests__/analytics/charge-insights.test.ts`

- [ ] **Step 1 : Test**

Append :

```ts
import { computeRampRate } from '@/lib/analytics/charge-insights'
import type { WeeklyLoadByCategory } from '@/lib/analytics/charge-insights.types'

describe('computeRampRate', () => {
  function w(total: number): WeeklyLoadByCategory {
    return { weekLabel: '', weekStart: '', run: 0, ride: 0, swim: 0, other: 0, total, avg4w: 0 }
  }

  it('fast-rise above +30%', () => {
    const r = computeRampRate([w(100), w(140)])
    expect(r.label).toBe('fast-rise')
    expect(r.deltaWeekPct).toBeCloseTo(0.4, 2)
  })

  it('controlled-rise between +10% and +30%', () => {
    expect(computeRampRate([w(100), w(120)]).label).toBe('controlled-rise')
  })

  it('stable between -10% and +10%', () => {
    expect(computeRampRate([w(100), w(105)]).label).toBe('stable')
  })

  it('sharp-decline below -30%', () => {
    expect(computeRampRate([w(100), w(50)]).label).toBe('sharp-decline')
  })

  it('progressive-resume when previous week was ~0 and current modest', () => {
    const r = computeRampRate([w(0), w(60)])
    expect(r.prevWeekZero).toBe(true)
    expect(r.label).toBe('progressive-resume')
  })

  it('declining between -30% and -10%', () => {
    expect(computeRampRate([w(100), w(80)]).label).toBe('declining')
  })

  it('returns stable when weeks < 2', () => {
    expect(computeRampRate([]).label).toBe('stable')
    expect(computeRampRate([w(50)]).label).toBe('stable')
  })
})
```

- [ ] **Step 2 : Test fails**

Run: `pnpm test -- charge-insights`
Expected: FAIL

- [ ] **Step 3 : Implémenter**

Append :

```ts
import type { RampRateResult, RampRateLabel } from './charge-insights.types'
import { RAMP_RATE } from './charge-thresholds'

export function computeRampRate(weeks: WeeklyLoadByCategory[]): RampRateResult {
  if (weeks.length < 2) return { deltaWeekPct: 0, label: 'stable', prevWeekZero: false }
  const cur  = weeks[weeks.length - 1].total
  const prev = weeks[weeks.length - 2].total
  const prevZero = prev === 0
  const delta = prevZero ? (cur > 0 ? 1 : 0) : (cur - prev) / prev

  let label: RampRateLabel
  if (prevZero && cur > 0)                          label = 'progressive-resume'
  else if (delta > RAMP_RATE.fastRise)               label = 'fast-rise'
  else if (delta > RAMP_RATE.controlledRise)         label = 'controlled-rise'
  else if (delta >= -RAMP_RATE.controlledRise)       label = 'stable'
  else if (delta > RAMP_RATE.decline)                label = 'declining'
  else                                                label = 'sharp-decline'

  return { deltaWeekPct: Math.round(delta * 1000) / 1000, label, prevWeekZero: prevZero }
}
```

- [ ] **Step 4 : Tests pass**

Run: `pnpm test -- charge-insights`
Expected: PASS

- [ ] **Step 5 : Commit**

```bash
git add web/lib/analytics/charge-insights.ts web/__tests__/analytics/charge-insights.test.ts
git commit -m "feat(analytics): add computeRampRate"
```

---

### Task 1.12 : `computeLoadInsights` (TDD — 9 branches statut)

**Files:**
- Modify: `web/lib/analytics/charge-insights.ts`
- Create: `web/__tests__/analytics/charge-insights-engine.test.ts`

- [ ] **Step 1 : Créer le test**

```ts
// web/__tests__/analytics/charge-insights-engine.test.ts
import { computeLoadInsights } from '@/lib/analytics/charge-insights'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'

function payload(p: Partial<ChargeSportPayload>): ChargeSportPayload {
  return {
    dailyMetrics:          [],
    dailyLoads:            [],
    weeklyLoadByCategory:  [],
    sportDistribution:     { '7': { run: 0, ride: 0, swim: 0, other: 0, total: 0 }, '28': { run: 0, ride: 0, swim: 0, other: 0, total: 0 }, '70': { run: 0, ride: 0, swim: 0, other: 0, total: 0 } },
    intensityDistribution: { '7': [], '28': [], '70': [] },
    top:                   [],
    monotony7d:            1.0,
    strain7d:              0,
    activeDays7d:          0,
    peakDay7d:             null,
    rampRate:              { deltaWeekPct: 0, label: 'stable', prevWeekZero: false },
    insights:              { status: 'balanced', headline: '', notes: [] },
    noCesActivities7d:     0,
    noCesActivities28d:    0,
    historyDays:           60,
    ...p,
  }
}

function metricsWithTsb(tsb: number, ctl = 50) {
  return [{ date: '2026-05-12', dailyLoad: 0, atl: ctl - tsb, ctl, tsb }]
}

describe('computeLoadInsights — status branches', () => {
  it('insufficient when historyDays < 14', () => {
    const r = computeLoadInsights(payload({ historyDays: 7 }))
    expect(r.status).toBe('insufficient')
  })

  it('overloaded when tsb <= -25', () => {
    const r = computeLoadInsights(payload({ dailyMetrics: metricsWithTsb(-30) }))
    expect(r.status).toBe('overloaded')
  })

  it('peak when ewma ratio > 1.5', () => {
    const r = computeLoadInsights(payload({
      dailyMetrics: metricsWithTsb(-5),
      dailyLoads: Array.from({ length: 28 }, (_, i) => ({ date: '', ces: i < 21 ? 30 : 200 })),
    }))
    expect(r.status).toBe('peak')
  })

  it('loaded when tsb <= -10 and ratio ok', () => {
    const r = computeLoadInsights(payload({ dailyMetrics: metricsWithTsb(-15), dailyLoads: Array(28).fill({ date: '', ces: 30 }) }))
    expect(r.status).toBe('loaded')
  })

  it('under-trained when tsb >= 15 and chronic < 30', () => {
    const r = computeLoadInsights(payload({ dailyMetrics: metricsWithTsb(20, 20) }))
    expect(r.status).toBe('under-trained')
  })

  it('very-fresh when tsb >= 15 and chronic ok', () => {
    const r = computeLoadInsights(payload({ dailyMetrics: metricsWithTsb(20, 60) }))
    expect(r.status).toBe('very-fresh')
  })

  it('light when ratio < 0.75', () => {
    const r = computeLoadInsights(payload({
      dailyMetrics: metricsWithTsb(2, 50),
      dailyLoads: Array.from({ length: 28 }, (_, i) => ({ date: '', ces: i < 21 ? 50 : 10 })),
    }))
    expect(r.status).toBe('light')
  })

  it('progressing when ratio in [1.25, 1.5]', () => {
    const r = computeLoadInsights(payload({
      dailyMetrics: metricsWithTsb(-2, 50),
      dailyLoads: Array.from({ length: 28 }, (_, i) => ({ date: '', ces: i < 21 ? 30 : 50 })),
    }))
    expect(r.status).toBe('progressing')
  })

  it('balanced by default', () => {
    const r = computeLoadInsights(payload({ dailyMetrics: metricsWithTsb(0, 50), dailyLoads: Array(28).fill({ date: '', ces: 30 }) }))
    expect(r.status).toBe('balanced')
  })
})

describe('computeLoadInsights — notes', () => {
  it('adds "beaucoup chargé en course" when run/total > 0.7', () => {
    const r = computeLoadInsights(payload({
      historyDays: 60,
      dailyMetrics: metricsWithTsb(0, 50),
      sportDistribution: {
        '7': { run: 80, ride: 10, swim: 5, other: 5, total: 100 },
        '28': { run: 200, ride: 50, swim: 30, other: 20, total: 300 },
        '70': { run: 200, ride: 50, swim: 30, other: 20, total: 300 },
      },
    }))
    expect(r.notes.some(n => n.toLowerCase().includes('course'))).toBe(true)
  })

  it('adds note about activities without CES when noCesActivities28d > 0', () => {
    const r = computeLoadInsights(payload({ noCesActivities28d: 3, historyDays: 60 }))
    expect(r.notes.some(n => n.includes('3'))).toBe(true)
  })

  it('adds "concentrée sur peu de jours" when activeDays7d <= 2 and sum7d > 0', () => {
    const r = computeLoadInsights(payload({
      historyDays: 60,
      dailyLoads: Array.from({ length: 28 }, (_, i) => ({ date: '', ces: i >= 26 ? 200 : 0 })),
      activeDays7d: 2,
    }))
    expect(r.notes.some(n => n.toLowerCase().includes('concentr'))).toBe(true)
  })

  it('adds "peu variée" when monotony >= 2.0', () => {
    const r = computeLoadInsights(payload({ historyDays: 60, monotony7d: 2.5 }))
    expect(r.notes.some(n => n.toLowerCase().includes('vari'))).toBe(true)
  })
})
```

- [ ] **Step 2 : Test fails**

Run: `pnpm test -- charge-insights-engine`
Expected: FAIL

- [ ] **Step 3 : Implémenter**

Append to `web/lib/analytics/charge-insights.ts` :

```ts
import type { InsightsResult, StatusId, ChargeSportPayload } from './charge-insights.types'
import { LOAD_BALANCE, FRESHNESS, MONOTONY, STRAIN } from './charge-thresholds'

const HEADLINES: Record<StatusId, string> = {
  insufficient:  "Pas assez de données pour estimer ta forme. Reviens après quelques séances.",
  overloaded:    "Charge élevée à surveiller. Récupération conseillée.",
  peak:          "Pic de charge cette semaine. Reste attentif à la récupération.",
  loaded:        "Fatigue normale d'entraînement. C'est cohérent en phase de charge.",
  'under-trained': "Tu es très frais mais ta base de forme est basse. Tu peux remonter le volume.",
  'very-fresh':  "Tu es bien reposé. Bonne fenêtre pour une séance intense.",
  light:         "Charge récente plus faible que d'habitude. Utile si tu récupères.",
  progressing:   "Progression élevée. Tu charges plus que ta moyenne.",
  balanced:      "Charge équilibrée. Tu peux suivre ton plan normalement.",
}

function pickStatus(p: ChargeSportPayload): StatusId {
  if (p.historyDays < 14) return 'insufficient'
  const last = p.dailyMetrics[p.dailyMetrics.length - 1]
  const tsb = last?.tsb ?? 0
  const ctl = last?.ctl ?? 0
  const ratio = computeLoadBalanceRatio(p.dailyMetrics, p.dailyLoads).sumRatio7vs28

  if (tsb <= FRESHNESS.highFatigue)                              return 'overloaded'
  if (ratio > LOAD_BALANCE.high)                                  return 'peak'
  if (tsb <= FRESHNESS.normalFatigue)                             return 'loaded'
  if (tsb >= FRESHNESS.veryFresh && ctl < 30)                     return 'under-trained'
  if (tsb >= FRESHNESS.veryFresh)                                 return 'very-fresh'
  if (ratio > 0 && ratio < LOAD_BALANCE.low)                      return 'light'
  if (ratio >= LOAD_BALANCE.balanced && ratio <= LOAD_BALANCE.high) return 'progressing'
  return 'balanced'
}

function buildNotes(p: ChargeSportPayload): string[] {
  const notes: string[] = []
  const sd7  = p.sportDistribution['7']
  const sd28 = p.sportDistribution['28']

  if (sd7.total > 0 && sd7.run / sd7.total > 0.7)
    notes.push("Tu as beaucoup chargé en course à pied.")
  if (sd7.total > 0 && sd28.total > 0 && sd7.ride / sd7.total > 0.5 && sd28.ride / sd28.total < 0.3)
    notes.push("La charge vélo compense une baisse de charge running.")

  const sum7 = p.dailyLoads.slice(-7).reduce((s, d) => s + d.ces, 0)
  if (p.activeDays7d <= 2 && sum7 > 0)
    notes.push("Beaucoup de charge concentrée sur peu de jours.")

  if (p.monotony7d >= MONOTONY.repetitiveMin)
    notes.push("Semaine peu variée. Pense à alterner intensités et durées.")
  if (p.strain7d > STRAIN.high)
    notes.push("Semaine très exigeante, prends le temps de récupérer.")

  const intense = p.intensityDistribution['7'].reduce((s, x) => s + (x.label === 'Seuil' || x.label === 'VMA' ? x.ces : 0), 0)
  const total7  = p.intensityDistribution['7'].reduce((s, x) => s + x.ces, 0)
  if (total7 > 0 && intense / total7 > 0.4)
    notes.push("Beaucoup d'intensité haute cette semaine.")

  const sportsCount = [sd7.run, sd7.ride, sd7.swim, sd7.other].filter(v => v > 0).length
  const anyDominant = sd7.total > 0 && [sd7.run, sd7.ride, sd7.swim, sd7.other].some(v => v / sd7.total > 0.4)
  if (sportsCount >= 2 && !anyDominant)
    notes.push("Bonne variété entre sports.")

  if (p.noCesActivities28d > 0)
    notes.push(`${p.noCesActivities28d} activité(s) récente(s) n'ont pas de charge exploitable.`)

  const ctl = p.dailyMetrics[p.dailyMetrics.length - 1]?.ctl ?? 0
  if (ctl < 20 && p.historyDays >= 14)
    notes.push("Ta base de forme est encore basse, progresse graduellement.")

  return notes
}

export function computeLoadInsights(p: ChargeSportPayload): InsightsResult {
  const status = pickStatus(p)
  return { status, headline: HEADLINES[status], notes: buildNotes(p) }
}
```

- [ ] **Step 4 : Tests pass**

Run: `pnpm test -- charge-insights-engine`
Expected: PASS

- [ ] **Step 5 : Lancer toute la suite analytics pour non-régression**

Run: `pnpm test -- analytics` from `web/`
Expected: PASS (toute la suite analytics)

- [ ] **Step 6 : Commit**

```bash
git add web/lib/analytics/charge-insights.ts web/__tests__/analytics/charge-insights-engine.test.ts
git commit -m "feat(analytics): add deterministic load insights engine"
```

---

## Phase 2 — Server loader

### Task 2.1 : `getChargePageData` server function

**Files:**
- Create: `web/lib/data/charge.ts`

**Context :** Pas de TDD ici (intégration Supabase) — on vise une fonction qui assemble les helpers de phase 1.

- [ ] **Step 1 : Lire les patterns existants**

Read: `web/lib/data/dashboard.ts:438-537` (la fonction `getDashboardData`) pour le pattern de fetch + HR zones.

- [ ] **Step 2 : Créer le loader**

```ts
// web/lib/data/charge.ts
import { createClient } from '@/lib/database/supabase-server'
import { buildDailyMetrics, type DailyMetrics, type DailyLoad } from '@/lib/analytics/fatigue'
import { calculateHrZones, type HrZone, type HrZoneMethod } from '@/lib/health/hr-zones'
import {
  getDailyLoadSeries, getWeeklyLoadByCategory,
  computeSportDistribution, computeIntensityDistribution,
  computeTopLoadActivities, computeMonotony7d, computeStrain7d,
  computeActiveDays7d, computePeakDay7d, computeRampRate,
  computeLoadInsights, classifySportCategory,
} from '@/lib/analytics/charge-insights'
import type {
  CesActivity, ChargeSportPayload, SportCategoryKey,
} from '@/lib/analytics/charge-insights.types'

export type ChargeSportFilterKey = 'all' | 'run' | 'ride' | 'swim'

export type ChargePageData = {
  perSport:    Record<ChargeSportFilterKey, ChargeSportPayload>
  generatedAt: string
}

type ActivityRow = {
  id:                string
  sport_type:        string
  name:              string
  start_time:        string
  ces:               number | null
  avg_hr:            number | null
  distance_m:        number | null
  elevation_gain_m:  number | null
  moving_time_sec:   number | null
  manual_intensity:  string | null
  workout_type:      string | null
}

function rowToCesActivity(r: ActivityRow): CesActivity {
  return {
    id:              r.id,
    rawSportType:    r.sport_type,
    name:            r.name,
    startDate:       r.start_time,
    ces:             r.ces ?? 0,
    movingTimeSec:   r.moving_time_sec,
    distanceMeters:  r.distance_m,
    elevationGainM:  r.elevation_gain_m,
    avgHr:           r.avg_hr,
    manualIntensity: r.manual_intensity,
    workoutType:     r.workout_type,
  }
}

function filterByCategory(acts: CesActivity[], cat: SportCategoryKey | 'all'): CesActivity[] {
  if (cat === 'all') return acts
  return acts.filter(a => classifySportCategory(a.rawSportType) === cat)
}

function buildSportPayload(
  acts: CesActivity[],
  zones: HrZone[],
  now: Date,
): ChargeSportPayload {
  const dailyLoads   = getDailyLoadSeries(acts, 90, now)
  const dailyMetrics = buildDailyMetrics(dailyLoads)
  const weeklyLoad   = getWeeklyLoadByCategory(acts, 10, now)
  const rampRate     = computeRampRate(weeklyLoad)
  const historyDays  = dailyMetrics.length

  const sportDist = {
    '7':  computeSportDistribution(acts, 7,  now),
    '28': computeSportDistribution(acts, 28, now),
    '70': computeSportDistribution(acts, 70, now),
  }
  const intensityDist = {
    '7':  computeIntensityDistribution(acts, 7,  zones, now),
    '28': computeIntensityDistribution(acts, 28, zones, now),
    '70': computeIntensityDistribution(acts, 70, zones, now),
  }
  const top = computeTopLoadActivities(acts, 7, 5, zones, now)

  const monotony7d  = computeMonotony7d(dailyLoads)
  const strain7d    = computeStrain7d(dailyLoads)
  const activeDays7d = computeActiveDays7d(dailyLoads)
  const peakDay7d   = computePeakDay7d(dailyLoads)

  const cesMissing = (windowDays: number) => {
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const start = new Date(end); start.setUTCDate(start.getUTCDate() - (windowDays - 1))
    return acts.filter(a => {
      const d = a.startDate.slice(0, 10)
      const inRange = d >= start.toISOString().slice(0, 10) && d <= end.toISOString().slice(0, 10)
      return inRange && (a.ces === 0 || !Number.isFinite(a.ces))
    }).length
  }

  const partial: ChargeSportPayload = {
    dailyMetrics, dailyLoads,
    weeklyLoadByCategory: weeklyLoad,
    sportDistribution:    sportDist,
    intensityDistribution: intensityDist,
    top,
    monotony7d, strain7d, activeDays7d, peakDay7d,
    rampRate,
    insights:           { status: 'balanced', headline: '', notes: [] },
    noCesActivities7d:  cesMissing(7),
    noCesActivities28d: cesMissing(28),
    historyDays,
  }
  partial.insights = computeLoadInsights(partial)
  return partial
}

export async function getChargePageData(userId: string): Promise<ChargePageData> {
  const supabase = await createClient()
  const since = new Date()
  since.setDate(since.getDate() - 90)

  const [{ data: rows }, { data: profile }] = await Promise.all([
    supabase
      .from('activities')
      .select('id, sport_type, name, start_time, ces, avg_hr, distance_m, elevation_gain_m, moving_time_sec, manual_intensity, workout_type')
      .eq('user_id', userId)
      .gte('start_time', since.toISOString())
      .is('deleted_at', null)
      .order('start_time', { ascending: true }),
    supabase
      .from('profiles')
      .select('max_hr, resting_hr, aerobic_threshold_hr, threshold_hr, birth_year')
      .eq('id', userId)
      .single(),
  ])

  const activities = (rows ?? []).map((r) => rowToCesActivity(r as ActivityRow))

  const zones: HrZone[] = (() => {
    if (!profile) return []
    const p = profile as Record<string, number | null>
    let method: HrZoneMethod = 'auto'
    if (p.max_hr && p.aerobic_threshold_hr && p.threshold_hr) method = 'seuils'
    else if (p.max_hr && p.threshold_hr)                      method = 'test30'
    else if (p.max_hr && p.resting_hr)                        method = 'karvonen'
    else if (p.max_hr)                                         method = 'pct_max'
    return calculateHrZones({
      method, maxHr: p.max_hr, restingHr: p.resting_hr,
      aerobicThresholdHr: p.aerobic_threshold_hr, thresholdHr: p.threshold_hr, birthYear: p.birth_year,
    }).zones
  })()

  const now = new Date()
  const perSport: Record<ChargeSportFilterKey, ChargeSportPayload> = {
    all:  buildSportPayload(activities,                                       zones, now),
    run:  buildSportPayload(filterByCategory(activities, 'run'),             zones, now),
    ride: buildSportPayload(filterByCategory(activities, 'ride'),            zones, now),
    swim: buildSportPayload(filterByCategory(activities, 'swim'),            zones, now),
  }

  return { perSport, generatedAt: new Date().toISOString() }
}
```

- [ ] **Step 3 : Vérifier la colonne `workout_type` existe**

Run from project root :
```bash
grep -rn "workout_type" web/lib web/__tests__ 2>&1 | head
```
Expected: au moins une référence (la colonne existe déjà selon les commits récents).

Si la colonne n'existe pas (grep vide) : retirer `workout_type` du SELECT et de `rowToCesActivity` (laisser `workoutType: null`).

- [ ] **Step 4 : Vérifier compilation**

Run: `pnpm exec tsc --noEmit -p tsconfig.json` from `web/`
Expected: 0 errors

- [ ] **Step 5 : Commit**

```bash
git add web/lib/data/charge.ts
git commit -m "feat(data): add getChargePageData server loader"
```

---

## Phase 3 — Refactor BlockGrid générique

### Task 3.1 : Extraire `BlockGrid` depuis `DashboardGrid`

**Files:**
- Create: `web/components/blocks/BlockGrid.tsx`
- Read first: `web/components/cockpit/DashboardGrid.tsx` (référence)

- [ ] **Step 1 : Créer le composant générique**

```tsx
// web/components/blocks/BlockGrid.tsx
'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export type BlockDef = {
  id:     string
  label:  string
  emoji:  string
  render: () => ReactNode
}

type Props = {
  storageKey:    string                  // 'cockpit', 'charge', etc.
  defaultOrder:  string[]
  blocks:        BlockDef[]
  addLabel?:     string
}

function SortableBlock({ id, isDraggingAny, label, children }: {
  id: string
  isDraggingAny: boolean
  label: string
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform:  CSS.Transform.toString(transform),
        transition: isDraggingAny ? transition : undefined,
        opacity:    isDragging ? 0 : 1,
        position:   'relative',
      }}
    >
      <div className="absolute top-0 inset-x-0 z-10 flex justify-center items-center h-5 pointer-events-none">
        <div
          {...attributes}
          {...listeners}
          aria-label={`Déplacer le bloc ${label}`}
          className="cursor-grab active:cursor-grabbing select-none pointer-events-auto px-3 py-1.5"
          style={{ touchAction: 'none' }}
        >
          <div className="flex gap-[3px] opacity-30">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="w-[3px] h-[3px] rounded-full bg-trail-muted" />
            ))}
          </div>
        </div>
      </div>
      <div className="pt-4">{children}</div>
    </div>
  )
}

function DragCard({ label, emoji }: { label: string; emoji: string }) {
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-primary/60 shadow-2xl px-4 py-5 opacity-90">
      <span className="text-[15px] font-semibold text-trail-text">{emoji} {label}</span>
    </div>
  )
}

function AddBlockPanel({
  hiddenBlocks, onRestore, onClose,
}: {
  hiddenBlocks: BlockDef[]
  onRestore: (id: string) => void
  onClose: () => void
}) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div className="bg-trail-card border border-trail-border rounded-t-[20px] w-full max-w-lg p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-trail-border mx-auto mb-4" />
        <h2 className="text-[16px] font-semibold text-trail-text mb-4">Ajouter un bloc</h2>
        <div className="space-y-2">
          {hiddenBlocks.map((b) => (
            <button
              key={b.id}
              onClick={() => { onRestore(b.id); onClose() }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-[10px] bg-trail-surface border border-trail-border hover:border-trail-primary transition-colors text-left"
            >
              <span className="text-[20px]">{b.emoji}</span>
              <span className="text-[14px] font-semibold text-trail-text">{b.label}</span>
              <span className="ml-auto text-trail-primary text-[20px] leading-none">+</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function BlockGrid({ storageKey, defaultOrder, blocks, addLabel = 'Ajouter un bloc' }: Props) {
  const orderStorage  = `${storageKey}_block_order`
  const hiddenStorage = `${storageKey}_hidden_blocks`

  const [order,        setOrder]        = useState<string[]>(defaultOrder)
  const [hidden,       setHidden]       = useState<string[]>([])
  const [activeId,     setActiveId]     = useState<string | null>(null)
  const [showAdd,      setShowAdd]      = useState(false)

  useEffect(() => {
    try {
      const storedOrder = localStorage.getItem(orderStorage)
      if (storedOrder) {
        const parsed = JSON.parse(storedOrder) as string[]
        setOrder([
          ...parsed.filter(id => defaultOrder.includes(id)),
          ...defaultOrder.filter(id => !parsed.includes(id)),
        ])
      }
      const storedHidden = localStorage.getItem(hiddenStorage)
      if (storedHidden) setHidden(JSON.parse(storedHidden) as string[])
    } catch {}
  }, [orderStorage, hiddenStorage, defaultOrder])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 8 } }),
  )

  function handleDragStart(e: DragStartEvent) { setActiveId(e.active.id as string) }
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveId(null)
    if (!over || active.id === over.id) return
    setOrder(prev => {
      const next = arrayMove(prev, prev.indexOf(active.id as string), prev.indexOf(over.id as string))
      localStorage.setItem(orderStorage, JSON.stringify(next))
      return next
    })
  }
  function hide(id: string) {
    setHidden(prev => {
      const next = prev.includes(id) ? prev : [...prev, id]
      localStorage.setItem(hiddenStorage, JSON.stringify(next))
      return next
    })
  }
  function restore(id: string) {
    setHidden(prev => {
      const next = prev.filter(b => b !== id)
      localStorage.setItem(hiddenStorage, JSON.stringify(next))
      return next
    })
  }

  const visibleOrder = order.filter(id => !hidden.includes(id))
  const hiddenBlocks = blocks.filter(b => hidden.includes(b.id))

  const activeBlock = blocks.find(b => b.id === activeId)

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleOrder} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {visibleOrder.map(id => {
              const block = blocks.find(b => b.id === id)
              if (!block) return null
              return (
                <SortableBlock key={id} id={id} label={block.label} isDraggingAny={activeId !== null}>
                  <BlockContext.Provider value={{ hideSelf: () => hide(id) }}>
                    {block.render()}
                  </BlockContext.Provider>
                </SortableBlock>
              )
            })}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
          {activeBlock && <DragCard label={activeBlock.label} emoji={activeBlock.emoji} />}
        </DragOverlay>
      </DndContext>

      {hiddenBlocks.length > 0 && (
        <button
          onClick={() => setShowAdd(true)}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-[12px] border border-dashed border-trail-border text-trail-muted hover:border-trail-primary hover:text-trail-primary transition-colors"
        >
          <span className="text-[20px] leading-none">+</span>
          <span className="text-[14px] font-semibold">{addLabel}</span>
        </button>
      )}
      {showAdd && (
        <AddBlockPanel hiddenBlocks={hiddenBlocks} onRestore={restore} onClose={() => setShowAdd(false)} />
      )}
    </>
  )
}

// Context to let any block hide itself via useBlockContext().hideSelf().
import { createContext, useContext } from 'react'
const BlockContext = createContext<{ hideSelf: () => void }>({ hideSelf: () => {} })
export function useBlockContext() { return useContext(BlockContext) }
```

- [ ] **Step 2 : Vérifier compilation**

Run: `pnpm exec tsc --noEmit -p tsconfig.json` from `web/`
Expected: 0 errors

- [ ] **Step 3 : Commit**

```bash
git add web/components/blocks/BlockGrid.tsx
git commit -m "refactor(blocks): extract BlockGrid generic component"
```

---

### Task 3.2 : Migrer `DashboardGrid` pour utiliser `BlockGrid`

**Files:**
- Modify: `web/components/cockpit/DashboardGrid.tsx`

- [ ] **Step 1 : Réécrire DashboardGrid**

```tsx
// web/components/cockpit/DashboardGrid.tsx
'use client'

import { BlockGrid, useBlockContext, type BlockDef } from '@/components/blocks/BlockGrid'
import { ActivitiesBlock }  from './ActivitiesBlock'
import { GoalsBlock }       from './GoalsBlock'
import { WeeklyStatsBlock } from './WeeklyStatsBlock'
import { ChargeBlock }      from './ChargeBlock'
import { HistoryBlock }     from './HistoryBlock'
import { CumulBlock }       from './CumulBlock'
import { IntensityBlock }   from './IntensityBlock'
import { WeekBlock }        from './WeekBlock'
import type { SportOverview, DaySession } from '@/lib/data/dashboard'
import type { SportKey } from '@/lib/design/sports'

type Props = {
  sportOverviews: Record<SportKey, SportOverview>
  weekSessions:   DaySession[]
}

const DEFAULT_ORDER = ['activities', 'goals', 'weekly', 'charge', 'history', 'cumul', 'intensity', 'week']

function BlockWithHide({ children }: { children: (onHide: () => void) => React.ReactNode }) {
  const { hideSelf } = useBlockContext()
  return <>{children(hideSelf)}</>
}

export function DashboardGrid({ sportOverviews, weekSessions }: Props) {
  const blocks: BlockDef[] = [
    { id: 'activities', label: 'Activités',        emoji: '🏅', render: () => <BlockWithHide>{(onHide) => <ActivitiesBlock  sportOverviews={sportOverviews} onHide={onHide} />}</BlockWithHide> },
    { id: 'goals',      label: 'Objectifs',        emoji: '🎯', render: () => <BlockWithHide>{(onHide) => <GoalsBlock       sportOverviews={sportOverviews} onHide={onHide} />}</BlockWithHide> },
    { id: 'weekly',     label: 'Volume & Ratio',   emoji: '📊', render: () => <BlockWithHide>{(onHide) => <WeeklyStatsBlock sportOverviews={sportOverviews} onHide={onHide} />}</BlockWithHide> },
    { id: 'charge',     label: 'Charge',           emoji: '⚡', render: () => <BlockWithHide>{(onHide) => <ChargeBlock      sportOverviews={sportOverviews} onHide={onHide} />}</BlockWithHide> },
    { id: 'history',    label: 'Historique',       emoji: '📅', render: () => <BlockWithHide>{(onHide) => <HistoryBlock     sportOverviews={sportOverviews} onHide={onHide} />}</BlockWithHide> },
    { id: 'cumul',      label: 'Cumul mensuel',    emoji: '📈', render: () => <BlockWithHide>{(onHide) => <CumulBlock       sportOverviews={sportOverviews} onHide={onHide} />}</BlockWithHide> },
    { id: 'intensity',  label: 'Intensité',        emoji: '🔥', render: () => <BlockWithHide>{(onHide) => <IntensityBlock   sportOverviews={sportOverviews} onHide={onHide} />}</BlockWithHide> },
    { id: 'week',       label: 'Semaine en cours', emoji: '🗓️', render: () => <WeekBlock sportOverviews={sportOverviews} allSessions={weekSessions} /> },
  ]
  return <BlockGrid storageKey="cockpit" defaultOrder={DEFAULT_ORDER} blocks={blocks} />
}
```

- [ ] **Step 2 : Lancer la suite de tests**

Run: `pnpm test` from `web/`
Expected: PASS (toute la suite, le Cockpit ne devrait pas régresser)

- [ ] **Step 3 : Smoke test manuel**

Start dev: `pnpm dev` from `web/`
Open: `http://localhost:3000/dashboard`
Vérifier : drag des blocs fonctionne, ordre persiste après refresh, masquage/restauration OK.

- [ ] **Step 4 : Commit**

```bash
git add web/components/cockpit/DashboardGrid.tsx
git commit -m "refactor(cockpit): migrate DashboardGrid to shared BlockGrid"
```

---

## Phase 4 — Charge page shell

### Task 4.1 : Étendre `labels.ts` section `charge`

**Files:**
- Modify: `web/lib/design/labels.ts`

- [ ] **Step 1 : Remplacer le bloc `charge`**

Remplacer la section `export const charge = { ... }` actuelle (lignes ~89-124) par :

```ts
// --- Charge tab ---
export const charge = {
  // Section header / filter
  pageTitle:           'Charge',
  sportFilterAll:      'Tout',
  sportFilterRun:      'Course',
  sportFilterRide:     'Vélo',
  sportFilterSwim:     'Natation',
  addBlock:            'Ajouter un bloc',

  // Vocabulary
  recentFatigue:       'Fatigue récente',
  baseFitness:         'Base de forme',
  freshness:           'Fraîcheur',
  acuteLoad:           'Charge 7j',
  chronicLoad:         'Charge 28j',
  loadBalance:         'Équilibre de charge',
  rampRate:            'Progression',

  // Block titles
  blocks: {
    status:                'État du jour',
    acuteChronic:          'Charge 7j vs base habituelle',
    freshness:             'Fraîcheur',
    weeklyLoad:            'Charge hebdomadaire (10 semaines)',
    fitnessFatigue:        'Fatigue vs Base de forme',
    sportDistribution:     'Répartition par sport',
    intensityDistribution: 'Répartition par intensité',
    monotonyStrain:        'Variété & contrainte',
    topActivities:         'Activités les plus chargées',
    heatmap:               'Charge des 28 derniers jours',
    rampRateBlock:         'Progression de charge',
    insights:              'Lecture rapide',
  },

  // Status headlines (matches StatusId in charge-insights.types)
  status: {
    insufficient:    "Pas assez de données pour estimer ta forme. Reviens après quelques séances.",
    overloaded:      "Charge élevée à surveiller. Récupération conseillée.",
    peak:            "Pic de charge cette semaine. Reste attentif à la récupération.",
    loaded:          "Fatigue normale d'entraînement. C'est cohérent en phase de charge.",
    'under-trained': "Tu es très frais mais ta base de forme est basse. Tu peux remonter le volume.",
    'very-fresh':    "Tu es bien reposé. Bonne fenêtre pour une séance intense.",
    light:           "Charge récente plus faible que d'habitude. Utile si tu récupères.",
    progressing:     "Progression élevée. Tu charges plus que ta moyenne.",
    balanced:        "Charge équilibrée. Tu peux suivre ton plan normalement.",
  },

  // Freshness zone short labels (used by gauge)
  freshnessZone: {
    'very-fresh':     'Très frais',
    fresh:            'Frais',
    balanced:         'Équilibré',
    'normal-fatigue': 'Fatigue normale',
    'high-fatigue':   'Fatigue élevée',
  },

  // Ramp rate labels (matches RampRateLabel)
  ramp: {
    'fast-rise':           'Hausse rapide',
    'controlled-rise':     'Progression maîtrisée',
    'stable':              'Charge stable',
    'progressive-resume':  'Reprise progressive',
    'declining':           'Charge en baisse',
    'sharp-decline':       'Baisse de charge',
  },

  // Bottom-sheet help text (per block)
  help: {
    status:                "Synthèse de ta charge actuelle, basée sur le rapport entre ta fatigue récente (≈7j) et ta base de forme (≈42j). Les valeurs techniques ATL/CTL/TSB sont disponibles dans le tooltip.",
    acuteChronic:          "Compare ta charge récente à ta charge habituelle. Un ratio > 1.5 indique un pic ; < 0.75 une période plus légère. Sert d'indicateur, pas de diagnostic.",
    freshness:             "Différence entre ta base de forme et ta fatigue récente (TSB en jargon). Très négatif = fatigue marquée ; très positif = grande fraîcheur (mais attention à l'inactivité prolongée).",
    weeklyLoad:            "Charge totale par semaine, séparée par sport. La ligne montre la moyenne glissante sur 4 semaines.",
    fitnessFatigue:        "Fatigue récente (ATL — 7j) vs Base de forme (CTL — 42j) sur 70 jours.",
    sportDistribution:     "Part de chaque sport dans ta charge totale. Change la fenêtre via les boutons 7j / 28j / 10 sem.",
    intensityDistribution: "Répartition de la charge par zone d'intensité (basée sur les zones cardiaques, le nom de l'activité ou l'intensité manuelle).",
    monotonyStrain:        "La monotonie mesure la variété de tes journées (charge mean / std). La contrainte combine volume et monotonie. Une semaine très chargée et peu variée est plus difficile à absorber.",
    topActivities:         "Les activités qui pèsent le plus dans ta charge des 7 derniers jours.",
    heatmap:               "Une case par jour sur les 28 derniers jours. Intensité de couleur = charge du jour.",
    rampRateBlock:         "Évolution de ta charge hebdomadaire. \"Hausse rapide\" = +30% en une semaine. Indicateur d'observation, pas de diagnostic.",
    insights:              "Notes générées automatiquement à partir de tes données. Pas de prédiction médicale, juste des observations.",
  },

  // Common short labels reused
  notEnoughData:        'Pas encore assez de données pour calculer la charge.',
  loadingError:         "Impossible de charger ta charge. Réessaie.",
  noActivitiesForSport: (sport: string) => `Pas encore assez de données ${sport} pour calculer la charge.`,
} as const
```

- [ ] **Step 2 : Vérifier que rien ne casse côté Cockpit**

Run: `pnpm exec tsc --noEmit -p tsconfig.json` from `web/`
Expected: erreurs possibles dans l'ancien `charge/page.tsx` qui utilise les anciennes clés — c'est OK, la page sera réécrite.

Si erreur dans d'autres composants (autres que `web/app/(main)/charge/page.tsx`) : ajouter les anciennes clés en plus pour éviter de casser le Cockpit. Vérifier avec :

```bash
grep -rn "charge\\." web/components web/app --include='*.tsx' --include='*.ts' | grep -v node_modules
```

- [ ] **Step 3 : Commit**

```bash
git add web/lib/design/labels.ts
git commit -m "feat(labels): expand charge section with new vocabulary"
```

---

### Task 4.2 : `SportSegmentedTabs` component

**Files:**
- Create: `web/components/charge/SportSegmentedTabs.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
// web/components/charge/SportSegmentedTabs.tsx
'use client'

import { SPORT_CONFIG, type SportKey } from '@/lib/design/sports'
import { charge as chargeLabels } from '@/lib/design/labels'
import { colors } from '@/lib/design/colors'

type Props = {
  sport:    SportKey
  onChange: (k: SportKey) => void
}

const TABS: { key: SportKey; label: string }[] = [
  { key: 'all',  label: chargeLabels.sportFilterAll },
  { key: 'run',  label: chargeLabels.sportFilterRun },
  { key: 'ride', label: chargeLabels.sportFilterRide },
  { key: 'swim', label: chargeLabels.sportFilterSwim },
]

export function SportSegmentedTabs({ sport, onChange }: Props) {
  return (
    <div
      className="sticky top-0 z-20 bg-trail-bg/95 backdrop-blur supports-[backdrop-filter]:bg-trail-bg/80 pb-2 pt-2 px-1"
      role="tablist"
      aria-label="Filtre sport"
    >
      <div className="flex gap-1 rounded-[10px] bg-trail-card border border-trail-border p-1">
        {TABS.map(({ key, label }) => {
          const active = sport === key
          const cfg = SPORT_CONFIG[key]
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(key)}
              className={[
                'flex-1 px-2 py-2 rounded-[8px] text-[12px] font-semibold transition-colors',
                active ? 'text-white' : 'text-trail-muted hover:text-trail-text',
              ].join(' ')}
              style={active ? { backgroundColor: cfg.color } : undefined}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier compilation**

Run: `pnpm exec tsc --noEmit -p tsconfig.json` from `web/`
Expected: 0 errors

- [ ] **Step 3 : Commit**

```bash
git add web/components/charge/SportSegmentedTabs.tsx
git commit -m "feat(charge): add SportSegmentedTabs"
```

---

### Task 4.3 : `ChargePageClient` shell + nouvelle page

**Files:**
- Create: `web/app/(main)/charge/ChargePageClient.tsx`
- Modify: `web/app/(main)/charge/page.tsx`

- [ ] **Step 1 : Créer ChargePageClient (shell sans blocs encore)**

```tsx
// web/app/(main)/charge/ChargePageClient.tsx
'use client'

import { useState, useEffect } from 'react'
import { BlockGrid, type BlockDef } from '@/components/blocks/BlockGrid'
import { SportSegmentedTabs } from '@/components/charge/SportSegmentedTabs'
import type { SportKey } from '@/lib/design/sports'
import type { ChargePageData, ChargeSportFilterKey } from '@/lib/data/charge'
import { charge as chargeLabels } from '@/lib/design/labels'

const SPORT_STORAGE = 'charge_sport_filter'

const DEFAULT_ORDER = [
  'status', 'acute-chronic', 'freshness', 'weekly-load',
  'fitness-fatigue', 'sport-distribution', 'intensity-distribution', 'monotony-strain',
  'top-activities', 'heatmap-28d', 'ramp-rate', 'insights',
]

type Props = { data: ChargePageData }

function isSportKey(v: string): v is SportKey {
  return v === 'all' || v === 'run' || v === 'ride' || v === 'swim'
}

export function ChargePageClient({ data }: Props) {
  const [sport, setSport] = useState<SportKey>('all')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SPORT_STORAGE)
      if (stored && isSportKey(stored)) setSport(stored)
    } catch {}
  }, [])

  function handleSportChange(k: SportKey) {
    setSport(k)
    try { localStorage.setItem(SPORT_STORAGE, k) } catch {}
  }

  const payload = data.perSport[sport as ChargeSportFilterKey]

  // Placeholder blocks — implémentés en Phase 5/6/7
  const blocks: BlockDef[] = DEFAULT_ORDER.map(id => ({
    id,
    label:  (chargeLabels.blocks as Record<string, string>)[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] ?? id,
    emoji:  '⚡',
    render: () => (
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-3 text-[12px] text-trail-muted">
        [{id}] placeholder
      </div>
    ),
  }))

  if (payload.historyDays === 0) {
    return (
      <div className="px-3 py-3 max-w-lg mx-auto">
        <SportSegmentedTabs sport={sport} onChange={handleSportChange} />
        <div className="rounded-[12px] bg-trail-card border border-trail-border p-4 text-center text-trail-muted text-[13px]">
          {chargeLabels.noActivitiesForSport(sport === 'all' ? 'toute activité' : sport)}
        </div>
      </div>
    )
  }

  return (
    <div className="px-3 py-3 max-w-lg mx-auto">
      <SportSegmentedTabs sport={sport} onChange={handleSportChange} />
      <BlockGrid storageKey="charge" defaultOrder={DEFAULT_ORDER} blocks={blocks} />
    </div>
  )
}
```

- [ ] **Step 2 : Réécrire la page**

```tsx
// web/app/(main)/charge/page.tsx
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/database/get-user'
import { getChargePageData } from '@/lib/data/charge'
import { ChargePageClient } from './ChargePageClient'

export default async function ChargePage() {
  const user = await getServerUser()
  if (!user) redirect('/login')
  const data = await getChargePageData(user.id)
  return <ChargePageClient data={data} />
}
```

- [ ] **Step 3 : Vérifier compilation**

Run: `pnpm exec tsc --noEmit -p tsconfig.json` from `web/`
Expected: 0 errors

- [ ] **Step 4 : Smoke test manuel**

Start dev: `pnpm dev` from `web/`
Open: `http://localhost:3000/charge`
Vérifier : page charge avec 4 tabs en haut, 12 placeholders, drag fonctionne, le filtre sport persiste après refresh.

- [ ] **Step 5 : Commit**

```bash
git add web/app/\(main\)/charge/ChargePageClient.tsx web/app/\(main\)/charge/page.tsx
git commit -m "feat(charge): add page shell with SportSegmentedTabs and placeholder blocks"
```

---

## Phase 5 — Blocs 1 à 4

**Pattern commun à tous les blocs :** chaque bloc est un composant `'use client'` dans `web/components/charge/blocks/` qui reçoit `{ payload: ChargeSportPayload, sportLabel: string }`. Le bouton ⋮ + icône ⓘ sont gérés via un wrapper `<BlockCard>` partagé.

### Task 5.1 : Wrappers `BlockCard` + `BlockHelpSheet`

**Files:**
- Create: `web/components/charge/BlockCard.tsx`
- Create: `web/components/charge/BlockHelpSheet.tsx`

- [ ] **Step 1 : BlockHelpSheet**

```tsx
// web/components/charge/BlockHelpSheet.tsx
'use client'

import { createPortal } from 'react-dom'

type Props = { title: string; body: string; onClose: () => void }

export function BlockHelpSheet({ title, body, onClose }: Props) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-trail-card border border-trail-border rounded-t-[20px] w-full max-w-lg p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-trail-border mx-auto mb-4" />
        <h2 className="text-[16px] font-semibold text-trail-text mb-3">{title}</h2>
        <p className="text-[13px] text-trail-muted leading-[19px]">{body}</p>
        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-[10px] bg-trail-surface border border-trail-border text-[14px] font-semibold text-trail-text"
        >
          Fermer
        </button>
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 2 : BlockCard wrapper**

```tsx
// web/components/charge/BlockCard.tsx
'use client'

import { useState, type ReactNode } from 'react'
import { useBlockContext } from '@/components/blocks/BlockGrid'
import { BlockHelpSheet } from './BlockHelpSheet'

type Props = {
  title:     string
  helpTitle: string
  helpBody:  string
  children:  ReactNode
  rightSlot?: ReactNode
}

export function BlockCard({ title, helpTitle, helpBody, children, rightSlot }: Props) {
  const { hideSelf } = useBlockContext()
  const [showHelp, setShowHelp] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      <div className="flex items-center justify-between mb-[6px]">
        <h3 className="text-[13px] font-semibold text-trail-text">{title}</h3>
        <div className="flex items-center gap-1">
          {rightSlot}
          <button
            aria-label="Aide sur ce bloc"
            onClick={() => setShowHelp(true)}
            className="text-trail-muted hover:text-trail-text w-7 h-7 flex items-center justify-center text-[14px]"
          >ⓘ</button>
          <div className="relative">
            <button
              aria-label="Menu du bloc"
              onClick={() => setShowMenu(s => !s)}
              className="text-trail-muted hover:text-trail-text w-7 h-7 flex items-center justify-center text-[18px] leading-none"
            >⋮</button>
            {showMenu && (
              <div
                className="absolute right-0 mt-1 w-32 rounded-[8px] bg-trail-surface border border-trail-border shadow-lg z-30"
                onMouseLeave={() => setShowMenu(false)}
              >
                <button
                  onClick={() => { setShowMenu(false); hideSelf() }}
                  className="w-full px-3 py-2 text-left text-[12px] text-trail-text hover:bg-trail-card"
                >Masquer</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {children}
      {showHelp && <BlockHelpSheet title={helpTitle} body={helpBody} onClose={() => setShowHelp(false)} />}
    </div>
  )
}
```

- [ ] **Step 3 : Vérifier compilation**

Run: `pnpm exec tsc --noEmit -p tsconfig.json` from `web/`
Expected: 0 errors

- [ ] **Step 4 : Commit**

```bash
git add web/components/charge/BlockCard.tsx web/components/charge/BlockHelpSheet.tsx
git commit -m "feat(charge): add BlockCard wrapper + BlockHelpSheet"
```

---

### Task 5.2 : Bloc 1 — `LoadStatusCard`

**Files:**
- Create: `web/components/charge/blocks/LoadStatusCard.tsx`
- Modify: `web/app/(main)/charge/ChargePageClient.tsx`

- [ ] **Step 1 : Composant**

```tsx
// web/components/charge/blocks/LoadStatusCard.tsx
'use client'

import { BlockCard } from '../BlockCard'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { charge as L } from '@/lib/design/labels'
import { colors } from '@/lib/design/colors'

const STATUS_COLOR: Record<string, string> = {
  insufficient:    colors.subtleText,
  overloaded:      colors.runRed,
  peak:            colors.seriesYellow,
  loaded:          colors.seriesYellow,
  'under-trained': colors.seriesBlue,
  'very-fresh':    colors.seriesBlue,
  light:           colors.subtleText,
  progressing:     colors.chargeOrange,
  balanced:        colors.greenOk,
}

function toHex(c: string, op: number) {
  return `${c}${Math.round(op * 255).toString(16).padStart(2, '0')}`
}

export function LoadStatusCard({ payload }: { payload: ChargeSportPayload }) {
  const last = payload.dailyMetrics[payload.dailyMetrics.length - 1]
  const atl  = Math.round(last?.atl ?? 0)
  const ctl  = Math.round(last?.ctl ?? 0)
  const tsb  = Math.round(last?.tsb ?? 0)
  const color = STATUS_COLOR[payload.insights.status] ?? colors.greenOk
  const statusLabel = (L.status as Record<string, string>)[payload.insights.status] ?? ''

  return (
    <BlockCard title={L.blocks.status} helpTitle={L.blocks.status} helpBody={L.help.status}>
      <div className="flex items-center justify-between">
        <div className="flex-1 pr-3">
          <p className="text-[15px] font-bold text-trail-text">{L.blocks.status}</p>
          <p className="text-[11px] text-trail-muted mt-1 leading-[16px]">{payload.insights.headline}</p>
        </div>
        <span
          className="inline-flex items-center rounded-full px-3 py-[6px] text-[11px] font-semibold leading-none flex-shrink-0"
          style={{
            backgroundColor: toHex(color, 0.15),
            color,
            border:          `1px solid ${toHex(color, 0.5)}`,
          }}
        >
          {statusLabel}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="rounded-[10px] bg-trail-surface px-2 py-2 text-center" title={`ATL: ${atl}`}>
          <p className="text-[10px] text-trail-muted">{L.recentFatigue}</p>
          <p className="text-[18px] font-black mt-0.5" style={{ color: colors.chargeOrange }}>{atl}</p>
        </div>
        <div className="rounded-[10px] bg-trail-surface px-2 py-2 text-center" title={`CTL: ${ctl}`}>
          <p className="text-[10px] text-trail-muted">{L.baseFitness}</p>
          <p className="text-[18px] font-black mt-0.5" style={{ color: colors.seriesBlue }}>{ctl}</p>
        </div>
        <div className="rounded-[10px] bg-trail-surface px-2 py-2 text-center" title={`TSB: ${tsb}`}>
          <p className="text-[10px] text-trail-muted">{L.freshness}</p>
          <p className="text-[18px] font-black mt-0.5" style={{ color }}>{tsb}</p>
        </div>
      </div>
    </BlockCard>
  )
}
```

- [ ] **Step 2 : Brancher dans ChargePageClient**

Dans `web/app/(main)/charge/ChargePageClient.tsx`, remplacer la définition de `blocks` par :

```tsx
import { LoadStatusCard } from '@/components/charge/blocks/LoadStatusCard'

// ... dans ChargePageClient :

const blocks: BlockDef[] = [
  { id: 'status', label: chargeLabels.blocks.status, emoji: '⚡', render: () => <LoadStatusCard payload={payload} /> },
  // les autres placeholders restent en attendant
  ...DEFAULT_ORDER.slice(1).map(id => ({
    id,
    label: (chargeLabels.blocks as Record<string, string>)[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] ?? id,
    emoji: '⚡',
    render: () => (
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-3 text-[12px] text-trail-muted">[{id}] placeholder</div>
    ),
  })),
]
```

- [ ] **Step 3 : Smoke test manuel**

`pnpm dev`, ouvrir `/charge` : vérifier que le bloc Status s'affiche avec le statut, les 3 chiffres, le tooltip ATL/CTL/TSB au hover. Test le bouton ⓘ (bottom-sheet) et le menu ⋮ (Masquer).

- [ ] **Step 4 : Commit**

```bash
git add web/components/charge/blocks/LoadStatusCard.tsx web/app/\(main\)/charge/ChargePageClient.tsx
git commit -m "feat(charge): add LoadStatusCard block"
```

---

### Task 5.3 : Bloc 2 — `AcuteChronicCard`

**Files:**
- Create: `web/components/charge/blocks/AcuteChronicCard.tsx`
- Modify: `web/app/(main)/charge/ChargePageClient.tsx`

- [ ] **Step 1 : Composant**

```tsx
// web/components/charge/blocks/AcuteChronicCard.tsx
'use client'

import { BlockCard } from '../BlockCard'
import { computeLoadBalanceRatio } from '@/lib/analytics/charge-insights'
import { LOAD_BALANCE } from '@/lib/analytics/charge-thresholds'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { charge as L } from '@/lib/design/labels'
import { colors } from '@/lib/design/colors'

function pct(r: number): string {
  return `${Math.round(r * 100)}%`
}

function zoneOf(r: number): { label: string; color: string } {
  if (r === 0)                       return { label: '—',                 color: colors.subtleText }
  if (r < LOAD_BALANCE.low)          return { label: 'Charge faible',     color: colors.subtleText }
  if (r < LOAD_BALANCE.balanced)     return { label: 'Équilibrée',         color: colors.greenOk    }
  if (r < LOAD_BALANCE.high)         return { label: 'Progression élevée', color: colors.chargeOrange }
  return                              { label: 'Pic de charge',           color: colors.runRed    }
}

export function AcuteChronicCard({ payload }: { payload: ChargeSportPayload }) {
  const sum7  = Math.round(payload.dailyLoads.slice(-7).reduce((s, d) => s + d.ces, 0))
  const sum28 = Math.round(payload.dailyLoads.slice(-28).reduce((s, d) => s + d.ces, 0))
  const ratio = computeLoadBalanceRatio(payload.dailyMetrics, payload.dailyLoads).sumRatio7vs28
  const zone  = zoneOf(ratio)

  return (
    <BlockCard title={L.blocks.acuteChronic} helpTitle={L.blocks.acuteChronic} helpBody={L.help.acuteChronic}>
      <div className="grid grid-cols-2 gap-3 mt-1">
        <div className="rounded-[10px] bg-trail-surface px-3 py-2">
          <p className="text-[10px] text-trail-muted">{L.acuteLoad}</p>
          <p className="text-[22px] font-black mt-0.5 text-trail-text">{sum7}</p>
        </div>
        <div className="rounded-[10px] bg-trail-surface px-3 py-2">
          <p className="text-[10px] text-trail-muted">{L.chronicLoad}</p>
          <p className="text-[22px] font-black mt-0.5 text-trail-text">{sum28}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[11px] text-trail-muted">{L.loadBalance}</span>
        <span className="text-[14px] font-bold" style={{ color: zone.color }}>{pct(ratio)}</span>
        <span className="text-[11px] font-semibold" style={{ color: zone.color }}>· {zone.label}</span>
      </div>
      <p className="mt-2 text-[11px] text-trail-muted leading-[16px]">
        Tes 7 derniers jours représentent <strong className="text-trail-text">{pct(ratio)}</strong> de ta charge habituelle sur 28 jours.
      </p>
    </BlockCard>
  )
}
```

- [ ] **Step 2 : Brancher dans ChargePageClient**

Remplacer le placeholder `'acute-chronic'` :

```tsx
import { AcuteChronicCard } from '@/components/charge/blocks/AcuteChronicCard'
// dans blocks[]:
{ id: 'acute-chronic', label: chargeLabels.blocks.acuteChronic, emoji: '⚖️', render: () => <AcuteChronicCard payload={payload} /> },
```

- [ ] **Step 3 : Smoke test manuel**

Vérifier l'affichage : 2 chiffres, ratio en %, libellé de zone, phrase pédagogique.

- [ ] **Step 4 : Commit**

```bash
git add web/components/charge/blocks/AcuteChronicCard.tsx web/app/\(main\)/charge/ChargePageClient.tsx
git commit -m "feat(charge): add AcuteChronicCard block"
```

---

### Task 5.4 : Bloc 3 — `FreshnessCard` (jauge)

**Files:**
- Create: `web/components/charge/Gauge.tsx`
- Create: `web/components/charge/blocks/FreshnessCard.tsx`
- Modify: `web/app/(main)/charge/ChargePageClient.tsx`

- [ ] **Step 1 : Gauge réutilisable**

```tsx
// web/components/charge/Gauge.tsx
'use client'

type Zone = { from: number; to: number; color: string; label?: string }

type Props = {
  value: number
  min: number
  max: number
  zones: Zone[]
  height?: number
}

export function Gauge({ value, min, max, zones, height = 14 }: Props) {
  const clamped = Math.max(min, Math.min(max, value))
  const pct = ((clamped - min) / (max - min)) * 100
  return (
    <div className="w-full" style={{ height }}>
      <div className="relative w-full rounded-full overflow-hidden bg-trail-surface" style={{ height }}>
        {zones.map((z, i) => {
          const left  = ((z.from - min) / (max - min)) * 100
          const width = ((z.to - z.from) / (max - min)) * 100
          return (
            <div
              key={i}
              style={{ left: `${left}%`, width: `${width}%`, backgroundColor: z.color, opacity: 0.35 }}
              className="absolute top-0 bottom-0"
              aria-hidden
            />
          )
        })}
        <div
          className="absolute top-[-3px] bottom-[-3px] w-[3px] rounded-full bg-trail-text"
          style={{ left: `calc(${pct}% - 1.5px)` }}
          aria-label={`Valeur ${value}`}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : FreshnessCard**

```tsx
// web/components/charge/blocks/FreshnessCard.tsx
'use client'

import { BlockCard } from '../BlockCard'
import { Gauge } from '../Gauge'
import { computeFreshness } from '@/lib/analytics/charge-insights'
import { FRESHNESS } from '@/lib/analytics/charge-thresholds'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { charge as L } from '@/lib/design/labels'
import { colors } from '@/lib/design/colors'

const ZONE_INTERPRET: Record<string, string> = {
  'very-fresh':     "Tu es très frais. Attention au sous-entraînement si cette situation dure trop longtemps.",
  fresh:            "Tu es bien reposé.",
  balanced:         "Charge et forme équilibrées.",
  'normal-fatigue': "Fatigue normale d'entraînement. Cohérent en phase de charge.",
  'high-fatigue':   "Fatigue élevée. Pense à insérer une journée de récupération.",
}

export function FreshnessCard({ payload }: { payload: ChargeSportPayload }) {
  const f = computeFreshness(payload.dailyMetrics)
  const zoneLabel = L.freshnessZone[f.zone]

  const min = -40, max = 30
  const zones = [
    { from: min,                       to: FRESHNESS.highFatigue,    color: colors.runRed },
    { from: FRESHNESS.highFatigue,     to: FRESHNESS.normalFatigue,  color: colors.seriesYellow },
    { from: FRESHNESS.normalFatigue,   to: FRESHNESS.fresh,          color: colors.greenOk },
    { from: FRESHNESS.fresh,           to: max,                      color: colors.seriesBlue },
  ]
  const arrow = f.deltaVsWeekAgo > 1 ? '↗' : f.deltaVsWeekAgo < -1 ? '↘' : '→'

  return (
    <BlockCard title={L.blocks.freshness} helpTitle={L.blocks.freshness} helpBody={L.help.freshness}>
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <p className="text-[22px] font-black text-trail-text">{Math.round(f.tsb)}</p>
          <p className="text-[12px] font-semibold text-trail-text">{zoneLabel}</p>
        </div>
        <span className="text-[12px] text-trail-muted">
          {arrow} {f.deltaVsWeekAgo > 0 ? '+' : ''}{f.deltaVsWeekAgo} vs J-7
        </span>
      </div>
      <Gauge value={f.tsb} min={min} max={max} zones={zones} />
      <p className="mt-3 text-[11px] text-trail-muted leading-[16px]">{ZONE_INTERPRET[f.zone]}</p>
    </BlockCard>
  )
}
```

- [ ] **Step 3 : Brancher**

```tsx
import { FreshnessCard } from '@/components/charge/blocks/FreshnessCard'
// dans blocks[]:
{ id: 'freshness', label: chargeLabels.blocks.freshness, emoji: '🌬️', render: () => <FreshnessCard payload={payload} /> },
```

- [ ] **Step 4 : Smoke test manuel**

Vérifier : la jauge a 4 zones colorées, la flèche tendance s'affiche, la phrase d'interprétation est lisible.

- [ ] **Step 5 : Commit**

```bash
git add web/components/charge/Gauge.tsx web/components/charge/blocks/FreshnessCard.tsx web/app/\(main\)/charge/ChargePageClient.tsx
git commit -m "feat(charge): add FreshnessCard with horizontal gauge"
```

---

### Task 5.5 : Bloc 4 — `WeeklyLoadChart` (bar empilé)

**Files:**
- Create: `web/components/charge/blocks/WeeklyLoadChart.tsx`
- Modify: `web/app/(main)/charge/ChargePageClient.tsx`

- [ ] **Step 1 : Composant**

```tsx
// web/components/charge/blocks/WeeklyLoadChart.tsx
'use client'

import { BlockCard } from '../BlockCard'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { charge as L } from '@/lib/design/labels'
import { colors } from '@/lib/design/colors'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Line, ComposedChart, ResponsiveContainer, CartesianGrid,
} from 'recharts'

const SPORT_COLORS = {
  run:   colors.chargeOrange,
  ride:  colors.seriesGreen,
  swim:  colors.seriesBlue,
  other: colors.subtleText,
}

export function WeeklyLoadChart({ payload }: { payload: ChargeSportPayload }) {
  const data = payload.weeklyLoadByCategory.map(w => ({
    week:  w.weekLabel,
    run:   Math.round(w.run),
    ride:  Math.round(w.ride),
    swim:  Math.round(w.swim),
    other: Math.round(w.other),
    avg4w: Math.round(w.avg4w),
  }))

  return (
    <BlockCard title={L.blocks.weeklyLoad} helpTitle={L.blocks.weeklyLoad} helpBody={L.help.weeklyLoad}>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={colors.border} strokeDasharray="2 2" />
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: colors.subtleText }} />
            <YAxis tick={{ fontSize: 10, fill: colors.subtleText }} />
            <Tooltip
              contentStyle={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.border}`, fontSize: 12 }}
              labelStyle={{ color: colors.text }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="run"   stackId="a" fill={SPORT_COLORS.run}   name="Course" />
            <Bar dataKey="ride"  stackId="a" fill={SPORT_COLORS.ride}  name="Vélo" />
            <Bar dataKey="swim"  stackId="a" fill={SPORT_COLORS.swim}  name="Natation" />
            <Bar dataKey="other" stackId="a" fill={SPORT_COLORS.other} name="Autres" />
            <Line type="monotone" dataKey="avg4w" stroke={colors.text} strokeWidth={1.5} dot={false} name="Moy 4 sem." />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </BlockCard>
  )
}
```

- [ ] **Step 2 : Brancher**

```tsx
import { WeeklyLoadChart } from '@/components/charge/blocks/WeeklyLoadChart'
// dans blocks[]:
{ id: 'weekly-load', label: chargeLabels.blocks.weeklyLoad, emoji: '📊', render: () => <WeeklyLoadChart payload={payload} /> },
```

- [ ] **Step 3 : Smoke test manuel**

Vérifier : barres empilées, ligne moyenne 4 sem, tooltip lisible, légende compacte.

- [ ] **Step 4 : Commit**

```bash
git add web/components/charge/blocks/WeeklyLoadChart.tsx web/app/\(main\)/charge/ChargePageClient.tsx
git commit -m "feat(charge): add WeeklyLoadChart stacked bar"
```

---

## Phase 6 — Blocs 5 à 8

### Task 6.1 : Bloc 5 — `FitnessFatigueChart`

**Files:**
- Create: `web/components/charge/blocks/FitnessFatigueChart.tsx`
- Modify: `web/app/(main)/charge/ChargePageClient.tsx`

- [ ] **Step 1 : Composant**

```tsx
// web/components/charge/blocks/FitnessFatigueChart.tsx
'use client'

import { BlockCard } from '../BlockCard'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { charge as L } from '@/lib/design/labels'
import { colors } from '@/lib/design/colors'
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'

export function FitnessFatigueChart({ payload }: { payload: ChargeSportPayload }) {
  const data = payload.dailyMetrics.slice(-70).map(m => ({
    date: m.date.slice(5),
    atl:  Math.round(m.atl),
    ctl:  Math.round(m.ctl),
    tsb:  Math.round(m.tsb),
  }))

  return (
    <BlockCard title={L.blocks.fitnessFatigue} helpTitle={L.blocks.fitnessFatigue} helpBody={L.help.fitnessFatigue}>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={colors.border} strokeDasharray="2 2" />
            <XAxis dataKey="date" interval={6} tick={{ fontSize: 10, fill: colors.subtleText }} />
            <YAxis tick={{ fontSize: 10, fill: colors.subtleText }} />
            <Tooltip
              contentStyle={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.border}`, fontSize: 12 }}
              labelStyle={{ color: colors.text }}
              formatter={(v: number, n) =>
                n === 'atl' ? [v, 'Fatigue récente (ATL)']
                : n === 'ctl' ? [v, 'Base de forme (CTL)']
                : [v, 'Fraîcheur (TSB)']
              }
            />
            <Area dataKey="tsb" type="monotone" fill={colors.seriesBlue} stroke="none" fillOpacity={0.08} />
            <Line dataKey="atl" type="monotone" stroke={colors.chargeOrange} strokeWidth={2} dot={false} />
            <Line dataKey="ctl" type="monotone" stroke={colors.seriesBlue}    strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-3 mt-2">
        <span className="flex items-center gap-1.5 text-[11px] text-trail-muted">
          <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: colors.chargeOrange }} />{L.recentFatigue}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-trail-muted">
          <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: colors.seriesBlue }} />{L.baseFitness}
        </span>
      </div>
    </BlockCard>
  )
}
```

- [ ] **Step 2 : Brancher**

```tsx
import { FitnessFatigueChart } from '@/components/charge/blocks/FitnessFatigueChart'
// dans blocks[]:
{ id: 'fitness-fatigue', label: chargeLabels.blocks.fitnessFatigue, emoji: '📈', render: () => <FitnessFatigueChart payload={payload} /> },
```

- [ ] **Step 3 : Commit**

```bash
git add web/components/charge/blocks/FitnessFatigueChart.tsx web/app/\(main\)/charge/ChargePageClient.tsx
git commit -m "feat(charge): add FitnessFatigueChart"
```

---

### Task 6.2 : Bloc 6 — `SportDistributionChart` (donut + filtre 7/28/70)

**Files:**
- Create: `web/components/charge/blocks/SportDistributionChart.tsx`
- Modify: `web/app/(main)/charge/ChargePageClient.tsx`

- [ ] **Step 1 : Composant**

```tsx
// web/components/charge/blocks/SportDistributionChart.tsx
'use client'

import { useState } from 'react'
import { BlockCard } from '../BlockCard'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { charge as L } from '@/lib/design/labels'
import { colors } from '@/lib/design/colors'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

type Win = '7' | '28' | '70'

const SPORT_COLORS = {
  run:   colors.chargeOrange,
  ride:  colors.seriesGreen,
  swim:  colors.seriesBlue,
  other: colors.subtleText,
}

const LABELS = { run: 'Course', ride: 'Vélo', swim: 'Natation', other: 'Autres' } as const

export function SportDistributionChart({ payload }: { payload: ChargeSportPayload }) {
  const [win, setWin] = useState<Win>('28')
  const d = payload.sportDistribution[win]
  const data = (['run', 'ride', 'swim', 'other'] as const)
    .map(k => ({ name: LABELS[k], value: d[k], color: SPORT_COLORS[k] }))
    .filter(s => s.value > 0)

  return (
    <BlockCard
      title={L.blocks.sportDistribution}
      helpTitle={L.blocks.sportDistribution}
      helpBody={L.help.sportDistribution}
      rightSlot={
        <div className="flex gap-1 mr-1">
          {(['7', '28', '70'] as Win[]).map(w => (
            <button
              key={w}
              onClick={() => setWin(w)}
              className={`text-[10px] px-1.5 py-0.5 rounded-[6px] ${win === w ? 'bg-trail-surface text-trail-text' : 'text-trail-muted'}`}
            >
              {w === '7' ? '7j' : w === '28' ? '28j' : '10 sem.'}
            </button>
          ))}
        </div>
      }
    >
      {d.total === 0 ? (
        <p className="text-[12px] text-trail-muted text-center py-6">{L.notEnoughData}</p>
      ) : (
        <div className="flex items-center gap-3">
          <div style={{ width: 140, height: 140 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius={42} outerRadius={64} paddingAngle={2}>
                  {data.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.border}`, fontSize: 12 }}
                  formatter={(v: number, n) => [`${v} CES`, n]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex-1 space-y-1.5 text-[12px] text-trail-text">
            {data.map(s => (
              <li key={s.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                <span className="flex-1">{s.name}</span>
                <span className="font-semibold">{Math.round((s.value / d.total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </BlockCard>
  )
}
```

- [ ] **Step 2 : Brancher**

```tsx
import { SportDistributionChart } from '@/components/charge/blocks/SportDistributionChart'
// dans blocks[]:
{ id: 'sport-distribution', label: chargeLabels.blocks.sportDistribution, emoji: '🥧', render: () => <SportDistributionChart payload={payload} /> },
```

- [ ] **Step 3 : Smoke test**

Vérifier : donut + légende avec %, switch 7j/28j/10sem fonctionne.

- [ ] **Step 4 : Commit**

```bash
git add web/components/charge/blocks/SportDistributionChart.tsx web/app/\(main\)/charge/ChargePageClient.tsx
git commit -m "feat(charge): add SportDistributionChart with 7/28/70 filter"
```

---

### Task 6.3 : Bloc 7 — `IntensityDistributionChart` (barres horiz)

**Files:**
- Create: `web/components/charge/blocks/IntensityDistributionChart.tsx`
- Modify: `web/app/(main)/charge/ChargePageClient.tsx`

- [ ] **Step 1 : Composant**

```tsx
// web/components/charge/blocks/IntensityDistributionChart.tsx
'use client'

import { useState } from 'react'
import { BlockCard } from '../BlockCard'
import type { ChargeSportPayload, IntensityLabel } from '@/lib/analytics/charge-insights.types'
import { charge as L } from '@/lib/design/labels'
import { colors } from '@/lib/design/colors'

type Win = '7' | '28' | '70'

const INTENSITY_COLORS: Record<IntensityLabel, string> = {
  'Récupération':     colors.greenOk,
  'Footing':          colors.pieFooting,
  'Endurance active': colors.pieSortieLongue,
  'Seuil':            colors.pieSeuil,
  'VMA':              colors.pieVma,
  'Non déterminée':   colors.subtleText,
}

export function IntensityDistributionChart({ payload }: { payload: ChargeSportPayload }) {
  const [win, setWin] = useState<Win>('28')
  const data = payload.intensityDistribution[win]
  const total = data.reduce((s, x) => s + x.ces, 0)

  const intenseShare = data
    .filter(x => x.label === 'Seuil' || x.label === 'VMA')
    .reduce((s, x) => s + x.ces, 0)
  const intenseRatio = total > 0 ? intenseShare / total : 0
  const note =
    total === 0                ? null :
    intenseRatio > 0.4          ? "Beaucoup de charge en intensité haute." :
    intenseRatio < 0.1          ? "Majorité de charge en endurance fondamentale." :
                                   "Mix équilibré entre endurance et intensité."

  return (
    <BlockCard
      title={L.blocks.intensityDistribution}
      helpTitle={L.blocks.intensityDistribution}
      helpBody={L.help.intensityDistribution}
      rightSlot={
        <div className="flex gap-1 mr-1">
          {(['7', '28', '70'] as Win[]).map(w => (
            <button
              key={w}
              onClick={() => setWin(w)}
              className={`text-[10px] px-1.5 py-0.5 rounded-[6px] ${win === w ? 'bg-trail-surface text-trail-text' : 'text-trail-muted'}`}
            >
              {w === '7' ? '7j' : w === '28' ? '28j' : '10 sem.'}
            </button>
          ))}
        </div>
      }
    >
      {total === 0 ? (
        <p className="text-[12px] text-trail-muted text-center py-6">{L.notEnoughData}</p>
      ) : (
        <>
          <ul className="space-y-1.5 mt-1">
            {data.map(x => {
              const pct = Math.round((x.ces / total) * 100)
              return (
                <li key={x.label}>
                  <div className="flex items-center text-[12px] text-trail-text">
                    <span className="w-2.5 h-2.5 rounded-sm mr-2" style={{ backgroundColor: INTENSITY_COLORS[x.label] }} />
                    <span className="flex-1">{x.label}</span>
                    <span className="font-semibold">{pct}%</span>
                  </div>
                  <div className="mt-0.5 h-1.5 rounded-full bg-trail-surface overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: INTENSITY_COLORS[x.label] }} />
                  </div>
                </li>
              )
            })}
          </ul>
          {note && <p className="mt-3 text-[11px] text-trail-muted leading-[16px]">{note}</p>}
        </>
      )}
    </BlockCard>
  )
}
```

- [ ] **Step 2 : Brancher**

```tsx
import { IntensityDistributionChart } from '@/components/charge/blocks/IntensityDistributionChart'
// dans blocks[]:
{ id: 'intensity-distribution', label: chargeLabels.blocks.intensityDistribution, emoji: '🔥', render: () => <IntensityDistributionChart payload={payload} /> },
```

- [ ] **Step 3 : Commit**

```bash
git add web/components/charge/blocks/IntensityDistributionChart.tsx web/app/\(main\)/charge/ChargePageClient.tsx
git commit -m "feat(charge): add IntensityDistributionChart"
```

---

### Task 6.4 : Bloc 8 — `MonotonyStrainCard`

**Files:**
- Create: `web/components/charge/blocks/MonotonyStrainCard.tsx`
- Modify: `web/app/(main)/charge/ChargePageClient.tsx`

- [ ] **Step 1 : Composant**

```tsx
// web/components/charge/blocks/MonotonyStrainCard.tsx
'use client'

import { BlockCard } from '../BlockCard'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { MONOTONY, STRAIN } from '@/lib/analytics/charge-thresholds'
import { charge as L } from '@/lib/design/labels'
import { colors } from '@/lib/design/colors'

function fmtDate(iso: string): string {
  if (!iso) return '—'
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function MonotonyStrainCard({ payload }: { payload: ChargeSportPayload }) {
  const monoColor   = payload.monotony7d >= MONOTONY.repetitiveMin ? colors.runRed
                    : payload.monotony7d > MONOTONY.variedMax     ? colors.seriesYellow
                    : colors.greenOk
  const strainColor = payload.strain7d > STRAIN.high                ? colors.runRed
                    : payload.strain7d > STRAIN.high * 0.7         ? colors.seriesYellow
                    : colors.greenOk

  return (
    <BlockCard title={L.blocks.monotonyStrain} helpTitle={L.blocks.monotonyStrain} helpBody={L.help.monotonyStrain}>
      <div className="grid grid-cols-2 gap-2 mt-1">
        <div className="rounded-[10px] bg-trail-surface px-3 py-2">
          <p className="text-[10px] text-trail-muted">Variété de charge</p>
          <p className="text-[18px] font-black mt-0.5" style={{ color: monoColor }}>{payload.monotony7d.toFixed(2)}</p>
          <p className="text-[10px] text-trail-muted mt-0.5">monotony 7j</p>
        </div>
        <div className="rounded-[10px] bg-trail-surface px-3 py-2">
          <p className="text-[10px] text-trail-muted">Contrainte semaine</p>
          <p className="text-[18px] font-black mt-0.5" style={{ color: strainColor }}>{payload.strain7d}</p>
          <p className="text-[10px] text-trail-muted mt-0.5">strain 7j</p>
        </div>
        <div className="rounded-[10px] bg-trail-surface px-3 py-2">
          <p className="text-[10px] text-trail-muted">Jours actifs</p>
          <p className="text-[18px] font-black mt-0.5 text-trail-text">{payload.activeDays7d}/7</p>
        </div>
        <div className="rounded-[10px] bg-trail-surface px-3 py-2">
          <p className="text-[10px] text-trail-muted">Plus grosse journée</p>
          <p className="text-[18px] font-black mt-0.5 text-trail-text">
            {payload.peakDay7d ? payload.peakDay7d.ces : 0}
          </p>
          <p className="text-[10px] text-trail-muted mt-0.5">
            {payload.peakDay7d ? fmtDate(payload.peakDay7d.date) : '—'}
          </p>
        </div>
      </div>
    </BlockCard>
  )
}
```

- [ ] **Step 2 : Brancher**

```tsx
import { MonotonyStrainCard } from '@/components/charge/blocks/MonotonyStrainCard'
// dans blocks[]:
{ id: 'monotony-strain', label: chargeLabels.blocks.monotonyStrain, emoji: '🌡️', render: () => <MonotonyStrainCard payload={payload} /> },
```

- [ ] **Step 3 : Commit**

```bash
git add web/components/charge/blocks/MonotonyStrainCard.tsx web/app/\(main\)/charge/ChargePageClient.tsx
git commit -m "feat(charge): add MonotonyStrainCard"
```

---

## Phase 7 — Blocs 9 à 12

### Task 7.1 : Bloc 9 — `TopLoadActivitiesCard`

**Files:**
- Create: `web/components/charge/blocks/TopLoadActivitiesCard.tsx`
- Modify: `web/app/(main)/charge/ChargePageClient.tsx`

- [ ] **Step 1 : Composant**

```tsx
// web/components/charge/blocks/TopLoadActivitiesCard.tsx
'use client'

import Link from 'next/link'
import { BlockCard } from '../BlockCard'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { charge as L } from '@/lib/design/labels'
import { colors } from '@/lib/design/colors'

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function TopLoadActivitiesCard({ payload }: { payload: ChargeSportPayload }) {
  if (payload.top.length === 0) {
    return (
      <BlockCard title={L.blocks.topActivities} helpTitle={L.blocks.topActivities} helpBody={L.help.topActivities}>
        <p className="text-[12px] text-trail-muted text-center py-4">{L.notEnoughData}</p>
      </BlockCard>
    )
  }
  return (
    <BlockCard title={L.blocks.topActivities} helpTitle={L.blocks.topActivities} helpBody={L.help.topActivities}>
      <ul className="space-y-1.5 mt-1">
        {payload.top.map(a => (
          <li key={a.id}>
            <Link href={`/activities/${a.id}`} className="block rounded-[10px] bg-trail-surface px-3 py-2 hover:border-trail-primary border border-transparent transition-colors">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-semibold text-trail-text truncate">{a.name || `${a.sport} ${fmtDate(a.date)}`}</span>
                <span className="text-[12px] font-bold flex-shrink-0" style={{ color: colors.chargeOrange }}>{a.ces} CES</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-trail-muted mt-0.5">
                <span>{fmtDate(a.date)}</span>
                <span>·</span>
                <span>{a.sport}</span>
                <span>·</span>
                <span>{fmtDuration(a.durationSec)}</span>
                {a.intensityLabel && <><span>·</span><span>{a.intensityLabel}</span></>}
                {a.typeLabel && <><span>·</span><span>{a.typeLabel}</span></>}
                <span className="ml-auto font-semibold text-trail-text">{a.share7dPct}% / 7j</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </BlockCard>
  )
}
```

- [ ] **Step 2 : Brancher**

```tsx
import { TopLoadActivitiesCard } from '@/components/charge/blocks/TopLoadActivitiesCard'
// dans blocks[]:
{ id: 'top-activities', label: chargeLabels.blocks.topActivities, emoji: '🏅', render: () => <TopLoadActivitiesCard payload={payload} /> },
```

- [ ] **Step 3 : Commit**

```bash
git add web/components/charge/blocks/TopLoadActivitiesCard.tsx web/app/\(main\)/charge/ChargePageClient.tsx
git commit -m "feat(charge): add TopLoadActivitiesCard"
```

---

### Task 7.2 : Bloc 10 — `LoadHeatmap28d`

**Files:**
- Create: `web/components/charge/blocks/LoadHeatmap28d.tsx`
- Modify: `web/app/(main)/charge/ChargePageClient.tsx`

- [ ] **Step 1 : Composant**

```tsx
// web/components/charge/blocks/LoadHeatmap28d.tsx
'use client'

import { useState } from 'react'
import { BlockCard } from '../BlockCard'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { charge as L } from '@/lib/design/labels'
import { colors } from '@/lib/design/colors'

const DAYS_HEADER = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function LoadHeatmap28d({ payload }: { payload: ChargeSportPayload }) {
  const cells = payload.dailyLoads.slice(-28)
  const max   = Math.max(1, ...cells.map(c => c.ces))
  const [tip, setTip] = useState<{ date: string; ces: number } | null>(null)

  // Group into rows of 7 starting from the most ancient
  const rows: typeof cells[] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))

  return (
    <BlockCard title={L.blocks.heatmap} helpTitle={L.blocks.heatmap} helpBody={L.help.heatmap}>
      <div className="grid grid-cols-7 gap-1 mt-1">
        {DAYS_HEADER.map((d, i) => (
          <div key={i} className="text-[10px] text-trail-muted text-center">{d}</div>
        ))}
        {rows.flat().map((c, i) => {
          const opacity = c.ces === 0 ? 0.08 : 0.2 + (c.ces / max) * 0.8
          return (
            <button
              key={i}
              onMouseEnter={() => setTip({ date: c.date, ces: Math.round(c.ces) })}
              onMouseLeave={() => setTip(null)}
              onClick={() => setTip(t => t?.date === c.date ? null : { date: c.date, ces: Math.round(c.ces) })}
              aria-label={`${fmtDate(c.date)} : ${Math.round(c.ces)} CES`}
              className="aspect-square rounded-[4px]"
              style={{ backgroundColor: colors.chargeOrange, opacity }}
            />
          )
        })}
      </div>
      <div className="flex justify-between items-center mt-3 text-[11px] text-trail-muted">
        <span>Moins</span>
        <div className="flex gap-1">
          {[0.15, 0.35, 0.55, 0.75, 0.95].map((o, i) => (
            <span key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors.chargeOrange, opacity: o }} />
          ))}
        </div>
        <span>Plus</span>
      </div>
      {tip && (
        <p className="mt-2 text-[11px] text-trail-text text-center">
          <strong>{fmtDate(tip.date)}</strong> · {tip.ces} CES
        </p>
      )}
    </BlockCard>
  )
}
```

- [ ] **Step 2 : Brancher**

```tsx
import { LoadHeatmap28d } from '@/components/charge/blocks/LoadHeatmap28d'
// dans blocks[]:
{ id: 'heatmap-28d', label: chargeLabels.blocks.heatmap, emoji: '🗓️', render: () => <LoadHeatmap28d payload={payload} /> },
```

- [ ] **Step 3 : Commit**

```bash
git add web/components/charge/blocks/LoadHeatmap28d.tsx web/app/\(main\)/charge/ChargePageClient.tsx
git commit -m "feat(charge): add LoadHeatmap28d"
```

---

### Task 7.3 : Bloc 11 — `RampRateCard`

**Files:**
- Create: `web/components/charge/blocks/RampRateCard.tsx`
- Modify: `web/app/(main)/charge/ChargePageClient.tsx`

- [ ] **Step 1 : Composant**

```tsx
// web/components/charge/blocks/RampRateCard.tsx
'use client'

import { BlockCard } from '../BlockCard'
import type { ChargeSportPayload, RampRateLabel } from '@/lib/analytics/charge-insights.types'
import { charge as L } from '@/lib/design/labels'
import { colors } from '@/lib/design/colors'

const COLOR_BY_LABEL: Record<RampRateLabel, string> = {
  'fast-rise':           colors.runRed,
  'controlled-rise':     colors.chargeOrange,
  'stable':              colors.greenOk,
  'progressive-resume':  colors.seriesBlue,
  'declining':           colors.seriesYellow,
  'sharp-decline':       colors.subtleText,
}

export function RampRateCard({ payload }: { payload: ChargeSportPayload }) {
  const pct = Math.round(payload.rampRate.deltaWeekPct * 100)
  const color = COLOR_BY_LABEL[payload.rampRate.label]
  const txt = L.ramp[payload.rampRate.label]

  return (
    <BlockCard title={L.blocks.rampRateBlock} helpTitle={L.blocks.rampRateBlock} helpBody={L.help.rampRateBlock}>
      <div className="flex items-baseline gap-3">
        <p className="text-[28px] font-black" style={{ color }}>
          {pct > 0 ? '+' : ''}{pct}%
        </p>
        <p className="text-[14px] font-semibold text-trail-text">{txt}</p>
      </div>
      <p className="mt-2 text-[11px] text-trail-muted leading-[16px]">
        Variation de la charge totale entre la semaine en cours et la précédente.
      </p>
    </BlockCard>
  )
}
```

- [ ] **Step 2 : Brancher**

```tsx
import { RampRateCard } from '@/components/charge/blocks/RampRateCard'
// dans blocks[]:
{ id: 'ramp-rate', label: chargeLabels.blocks.rampRateBlock, emoji: '↗️', render: () => <RampRateCard payload={payload} /> },
```

- [ ] **Step 3 : Commit**

```bash
git add web/components/charge/blocks/RampRateCard.tsx web/app/\(main\)/charge/ChargePageClient.tsx
git commit -m "feat(charge): add RampRateCard"
```

---

### Task 7.4 : Bloc 12 — `LoadInsightsCard`

**Files:**
- Create: `web/components/charge/blocks/LoadInsightsCard.tsx`
- Modify: `web/app/(main)/charge/ChargePageClient.tsx`

- [ ] **Step 1 : Composant**

```tsx
// web/components/charge/blocks/LoadInsightsCard.tsx
'use client'

import { BlockCard } from '../BlockCard'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { charge as L } from '@/lib/design/labels'

export function LoadInsightsCard({ payload }: { payload: ChargeSportPayload }) {
  const notes = payload.insights.notes
  return (
    <BlockCard title={L.blocks.insights} helpTitle={L.blocks.insights} helpBody={L.help.insights}>
      {notes.length === 0 ? (
        <p className="text-[12px] text-trail-muted py-2">Rien à signaler cette semaine.</p>
      ) : (
        <ul className="space-y-2 mt-1">
          {notes.map((n, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] text-trail-text leading-[18px]">
              <span className="text-trail-muted">•</span>
              <span className="flex-1">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </BlockCard>
  )
}
```

- [ ] **Step 2 : Brancher**

```tsx
import { LoadInsightsCard } from '@/components/charge/blocks/LoadInsightsCard'
// dans blocks[]:
{ id: 'insights', label: chargeLabels.blocks.insights, emoji: '💡', render: () => <LoadInsightsCard payload={payload} /> },
```

- [ ] **Step 3 : Nettoyer ChargePageClient — plus de placeholders**

Vérifier que tous les 12 IDs ont une vraie `render: () => <... />` (pas de placeholder restant). La construction du tableau `blocks` doit être de 12 entrées explicites maintenant.

- [ ] **Step 4 : Smoke test complet**

`pnpm dev`, `/charge` :
- Filtre sport : 4 tabs fonctionnent
- 12 blocs s'affichent
- Drag réordonne et persiste
- Masquer un bloc, voir le "+" en bas
- ⓘ ouvre la bottom-sheet
- Tester avec `?sport=run` mentalement (changer manuellement le tab)
- Rafraîchir : ordre et sport persistent

- [ ] **Step 5 : Commit**

```bash
git add web/components/charge/blocks/LoadInsightsCard.tsx web/app/\(main\)/charge/ChargePageClient.tsx
git commit -m "feat(charge): add LoadInsightsCard and finalize 12-block layout"
```

---

## Phase 8 — Relabel Cockpit ChargeBlock + finition

### Task 8.1 : Relabeler `ChargeBlock` du Cockpit

**Files:**
- Modify: `web/components/cockpit/ChargeBlock.tsx`

- [ ] **Step 1 : Mettre à jour les labels dans ChargeBlock**

Modifier la grille des 4 KPIs (lignes ~103-108) :

```tsx
<CompactMetricCard unit="ATL"    value={sov.atl}     description={L.recentFatigue}  color={colors.chargeOrange}  />
<CompactMetricCard unit="CTL"    value={sov.ctl}     description={L.baseFitness}    color={colors.seriesBlue}    />
<CompactMetricCard unit="TSB"    value={sov.tsb}     description={L.freshness}      color={tsbColor}             />
<CompactMetricCard unit="Suffer" value={sov.weekCes} description="Charge sem."      color={colors.seriesYellow}  />
```

Ajouter l'import en haut du fichier :

```tsx
import { charge as L } from '@/lib/design/labels'
```

- [ ] **Step 2 : Lancer la suite de tests**

Run: `pnpm test` from `web/`
Expected: PASS

- [ ] **Step 3 : Smoke test Cockpit**

`pnpm dev`, `/dashboard` : vérifier que le ChargeBlock affiche maintenant "Fatigue récente / Base de forme / Fraîcheur" sous les chiffres ATL/CTL/TSB.

- [ ] **Step 4 : Commit**

```bash
git add web/components/cockpit/ChargeBlock.tsx
git commit -m "chore(labels): relabel ChargeBlock cockpit to new vocabulary"
```

---

### Task 8.2 : Vérification finale globale

**Files:** (aucun)

- [ ] **Step 1 : Tests**

Run: `pnpm test` from `web/`
Expected: PASS

- [ ] **Step 2 : Type check**

Run: `pnpm exec tsc --noEmit -p tsconfig.json` from `web/`
Expected: 0 errors

- [ ] **Step 3 : Lint**

Run: `pnpm lint` from `web/`
Expected: 0 errors (warnings tolérés)

- [ ] **Step 4 : Build**

Run: `pnpm build` from `web/`
Expected: success

- [ ] **Step 5 : Test manuel exhaustif sur dev server**

`pnpm dev` from `web/`, ouvrir `/charge` et tester :

1. Les 4 tabs sport changent l'affichage instantanément.
2. Drag d'un bloc : ordre persiste après refresh.
3. Masquer le bloc Status (le plus pédagogique) : "+ Ajouter un bloc" apparaît.
4. Restaurer Status via le panel.
5. ⓘ sur Fraîcheur ouvre une bottom-sheet lisible.
6. SportDistributionChart : switch 7j / 28j / 10 sem fonctionne et change le donut.
7. IntensityDistributionChart : pareil, switch fonctionne.
8. Top activités : tap sur une carte → navigation vers `/activities/[id]`.
9. Heatmap : tap sur une case → label charge + date apparaît.
10. Filtre "Vélo" → tous les blocs se mettent à jour, blocs cohérents.

Sur `/dashboard` : vérifier que le Cockpit ChargeBlock affiche les nouveaux labels et que rien d'autre n'a régressé (drag, ordre, autres blocs).

- [ ] **Step 6 : Cocher la lessons file**

Si quelque chose s'est mal passé pendant l'implémentation, ajouter une entrée à `tasks/lessons.md` au format demandé par CLAUDE.md.

- [ ] **Step 7 : Push & deploy**

```bash
git push origin master
```

Vercel auto-deploy via push (per memory `feedback_deployment.md`). Surveiller le déploiement.

---

## Self-Review

### Spec coverage

| Spec section | Task(s) qui couvre |
|---|---|
| charge-insights.ts module | 1.3–1.12 |
| charge-thresholds.ts | 1.1 |
| Types charge-insights | 1.2 |
| getChargePageData server loader | 2.1 |
| BlockGrid générique extrait | 3.1, 3.2 |
| SportSegmentedTabs | 4.2 |
| ChargePageClient shell | 4.3 |
| Vocabulaire centralisé labels.ts | 4.1 |
| Bloc 1 LoadStatusCard | 5.2 |
| Bloc 2 AcuteChronicCard | 5.3 |
| Bloc 3 FreshnessCard + Gauge | 5.4 |
| Bloc 4 WeeklyLoadChart | 5.5 |
| Bloc 5 FitnessFatigueChart | 6.1 |
| Bloc 6 SportDistributionChart | 6.2 |
| Bloc 7 IntensityDistributionChart | 6.3 |
| Bloc 8 MonotonyStrainCard | 6.4 |
| Bloc 9 TopLoadActivitiesCard | 7.1 |
| Bloc 10 LoadHeatmap28d | 7.2 |
| Bloc 11 RampRateCard | 7.3 |
| Bloc 12 LoadInsightsCard | 7.4 |
| BlockHelpSheet (ⓘ) | 5.1 |
| BlockCard wrapper | 5.1 |
| Relabel Cockpit ChargeBlock | 8.1 |
| Tests unitaires analytics | 1.3–1.12 |
| Persistence sport filter | 4.3 |
| Persistence drag/hide par onglet | 3.1 (storageKey) |
| Build / lint / test final | 8.2 |
| Déploiement Vercel via push | 8.2 |

Aucune section non couverte.

### Notes connues du plan

- Le type `WorkoutType` n'est pas explicitement défini : on accepte `workout_type` comme string libre côté DB (table `activities` possède déjà la colonne selon les commits récents). Si pas présent → la Task 2.1 Step 3 indique le fallback.
- Le test sur `WeeklyLoadByCategory` utilise des dates UTC pour éviter les ambiguïtés ISO week ; à ajuster si la timezone du dev pose problème.
- Les seuils chiffrés (STRAIN.high = 6000, RAMP_RATE.fastRise = 0.30) sont des points de départ à recalibrer après usage réel.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-12-charge-tab-redesign.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Je dispatch un fresh subagent par task, review entre les tasks, itération rapide.

**2. Inline Execution** — Exécution dans cette session avec checkpoints.

D'après la mémoire (feedback_execution_mode.md) tu choisis toujours Subagent-driven — confirme et je lance.
