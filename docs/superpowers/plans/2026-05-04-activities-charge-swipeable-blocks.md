# Blocs Activités & Charge — Swipeable multi-sport — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer les blocs Activités et Charge du cockpit web en carousels swipeables multi-sport avec sélection configurable (⋮), et corriger le rendu des tuiles KPI.

**Architecture:** Approche A — données calculées côté serveur. `getDashboardData` retourne `sportOverviews: Record<SportKey, SportOverview>` avec EWMA sport-spécifique. Deux nouveaux Client Components (`ActivitiesBlock`, `ChargeBlock`) reçoivent ces données et gèrent le carousel CSS scroll-snap + localStorage. `dailyMetrics` est conservé pour `/charge` page (graphiques en série temporelle).

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, React 18 (useState/useEffect/useRef), Jest pour les tests de la couche données.

---

## File Map

| Action | Fichier |
|--------|---------|
| **Créer** | `web/lib/design/sports.ts` |
| **Créer** | `web/components/cockpit/SportSettingsModal.tsx` |
| **Créer** | `web/components/cockpit/ActivitiesBlock.tsx` |
| **Créer** | `web/components/cockpit/ChargeBlock.tsx` |
| **Modifier** | `web/lib/data/dashboard.ts` |
| **Modifier** | `web/__tests__/lib/data/dashboard.test.ts` |
| **Modifier** | `web/app/dashboard/page.tsx` |
| **Modifier** | `web/components/ui/CockpitKpiTile.tsx` |
| **Modifier** | `web/components/ui/BarStrip.tsx` |

---

## Task 1: Sports constants (`web/lib/design/sports.ts`)

**Files:**
- Create: `web/lib/design/sports.ts`

- [ ] **Step 1: Créer le fichier**

```typescript
// web/lib/design/sports.ts
import { colors } from './colors'

export type SportKey = 'run' | 'ride' | 'swim' | 'all'

export const SPORT_TYPE_MAP: Record<SportKey, string[] | null> = {
  run:  ['Run', 'TrailRun'],
  ride: ['Ride', 'VirtualRide'],
  swim: ['Swim'],
  all:  null,
}

export const SPORT_CONFIG: Record<SportKey, {
  label:      string
  shortLabel: string
  emoji:      string
  color:      string
}> = {
  run:  { label: 'Course',   shortLabel: 'RUN', emoji: '🏃', color: colors.chargeOrange },
  ride: { label: 'Vélo',     shortLabel: 'VÉL', emoji: '🚴', color: colors.seriesBlue   },
  swim: { label: 'Natation', shortLabel: 'NAT', emoji: '🏊', color: colors.seriesGreen  },
  all:  { label: 'Toutes',   shortLabel: 'ALL', emoji: '⚡', color: colors.seriesYellow },
}

export const ALL_SPORT_KEYS: SportKey[] = ['run', 'ride', 'swim', 'all']
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd c:/Users/Franc/app-run-mobile/web && npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add web/lib/design/sports.ts
git commit -m "feat(sports): add SportKey, SPORT_CONFIG, SPORT_TYPE_MAP constants"
```

---

## Task 2: Dashboard data layer — types + implémentation + tests

**Files:**
- Modify: `web/lib/data/dashboard.ts`
- Modify: `web/__tests__/lib/data/dashboard.test.ts`

### 2a — Écrire les tests en premier (TDD)

- [ ] **Step 1: Écrire les tests échouants**

Remplacer le contenu de `web/__tests__/lib/data/dashboard.test.ts` par :

```typescript
import { getDashboardData } from '@/lib/data/dashboard'
import { createClient } from '@/lib/database/supabase-server'

jest.mock('@/lib/database/supabase-server', () => ({ createClient: jest.fn() }))
const mockCreateClient = createClient as jest.Mock

function makeSelectMock(rows: unknown[]) {
  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: rows, error: null }),
          }),
        }),
      }),
    }),
  }
}

beforeEach(() => jest.clearAllMocks())

describe('getDashboardData', () => {
  it('returns 60 daily metrics (all zeros) when no activities', async () => {
    mockCreateClient.mockResolvedValue(makeSelectMock([]))
    const result = await getDashboardData('user-1')
    expect(result.hasActivities).toBe(false)
    expect(result.recentActivities).toHaveLength(0)
    expect(result.dailyMetrics).toHaveLength(60)
    expect(result.dailyMetrics.every((m) => m.atl === 0 && m.ctl === 0)).toBe(true)
  })

  it('computes non-zero ATL from a recent activity', async () => {
    const today = new Date().toISOString()
    mockCreateClient.mockResolvedValue(makeSelectMock([
      { id: '1', sport_type: 'Run', name: 'Run', start_time: today,
        ces: 60, distance_m: 10000, elevation_gain_m: 100, moving_time_sec: 3600 },
    ]))
    const result = await getDashboardData('user-1')
    expect(result.hasActivities).toBe(true)
    const latest = result.dailyMetrics[result.dailyMetrics.length - 1]
    expect(latest.atl).toBeGreaterThan(0)
  })

  it('returns sportOverviews for all sport keys', async () => {
    mockCreateClient.mockResolvedValue(makeSelectMock([]))
    const result = await getDashboardData('user-1')
    expect(result.sportOverviews).toBeDefined()
    expect(result.sportOverviews.run).toBeDefined()
    expect(result.sportOverviews.ride).toBeDefined()
    expect(result.sportOverviews.swim).toBeDefined()
    expect(result.sportOverviews.all).toBeDefined()
  })

  it('filters weekSessions by sport type in sportOverviews', async () => {
    const today = new Date().toISOString()
    mockCreateClient.mockResolvedValue(makeSelectMock([
      { id: '1', sport_type: 'Run',  name: 'Run',  start_time: today,
        ces: 60, distance_m: 10000, elevation_gain_m: 100, moving_time_sec: 3600 },
      { id: '2', sport_type: 'Ride', name: 'Ride', start_time: today,
        ces: 40, distance_m: 20000, elevation_gain_m: 200, moving_time_sec: 3600 },
    ]))
    const result = await getDashboardData('user-1')
    expect(result.sportOverviews.run.weekSessions).toBe(1)
    expect(result.sportOverviews.ride.weekSessions).toBe(1)
    expect(result.sportOverviews.swim.weekSessions).toBe(0)
    expect(result.sportOverviews.all.weekSessions).toBe(2)
  })

  it('sportOverviews.run.weekKm sums only Run/TrailRun distance', async () => {
    const today = new Date().toISOString()
    mockCreateClient.mockResolvedValue(makeSelectMock([
      { id: '1', sport_type: 'Run',  name: 'Run',  start_time: today,
        ces: 60, distance_m: 10000, elevation_gain_m: 0, moving_time_sec: 3600 },
      { id: '2', sport_type: 'Ride', name: 'Ride', start_time: today,
        ces: 40, distance_m: 30000, elevation_gain_m: 0, moving_time_sec: 3600 },
    ]))
    const result = await getDashboardData('user-1')
    expect(result.sportOverviews.run.weekKm).toBeCloseTo(10, 1)
    expect(result.sportOverviews.all.weekKm).toBeCloseTo(40, 1)
  })
})
```

- [ ] **Step 2: Lancer les tests — vérifier qu'ils échouent sur les nouveaux tests**

```bash
cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/data/dashboard.test.ts
```

Expected: les 2 premiers tests PASS, les 3 nouveaux FAIL (`sportOverviews is not defined`).

### 2b — Implémenter

- [ ] **Step 3: Remplacer le contenu de `web/lib/data/dashboard.ts`**

```typescript
import { createClient } from '@/lib/database/supabase-server'
import { buildDailyMetrics, type DailyLoad, type DailyMetrics } from '@/lib/analytics/fatigue'
import { type SportKey, SPORT_TYPE_MAP } from '@/lib/design/sports'

export type ActivityRow = {
  id: string
  sport_type: string
  name: string
  start_time: string
  ces: number | null
  distance_m: number | null
  elevation_gain_m: number | null
  moving_time_sec: number | null
}

export type DaySession = {
  day: string
  label: string
  volumeKm: number
  dPlus: number
}

export type SportOverview = {
  weekKm: number
  weekDPlus: number
  weekSessions: number
  dailyKm: number[]
  dailyDPlus: number[]
  ytdKm: number
  ytdDPlus: number
  monthlyKm: number[]
  atl: number
  ctl: number
  tsb: number
  weekCes: number
  last7Tsb: number[]
}

export type IntensityShare = {
  label: string
  km: number
}

export type WeeklyPoint = {
  weekLabel: string
  km: number
  dPlus: number
}

export type MonthSeries = {
  label: string
  color: string
  dailyCumul: number[]
}

export type DashboardData = {
  dailyMetrics: DailyMetrics[]          // kept for /charge page charts
  recentActivities: ActivityRow[]
  hasActivities: boolean
  sportOverviews: Record<SportKey, SportOverview>
  weekSessions: DaySession[]
  intensityBreakdown: IntensityShare[]
  weeklyPoints: WeeklyPoint[]
  cumulMonths: MonthSeries[]
}

const DAY_ABBR = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function toMonIndex(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const jsDay = d.getDay()
  const diff = jsDay === 0 ? -6 : 1 - jsDay
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function mondayOfCurrentWeek(): Date {
  const now = new Date()
  const idx = toMonIndex(now.getDay())
  const mon = new Date(now)
  mon.setDate(now.getDate() - idx)
  mon.setHours(0, 0, 0, 0)
  return mon
}

function getIntensityLabel(ces: number): string {
  if (ces <= 30)  return 'Footing'
  if (ces <= 60)  return 'Sortie longue'
  if (ces <= 100) return 'Seuil'
  if (ces <= 150) return 'VMA'
  return 'Runtaf'
}

function buildWindowedLoads(rows: ActivityRow[], days: number): DailyLoad[] {
  const loadMap = new Map<string, number>()
  for (const row of rows) {
    const date = row.start_time.slice(0, 10)
    loadMap.set(date, (loadMap.get(date) ?? 0) + (row.ces ?? 0))
  }
  const result: DailyLoad[] = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const date = d.toISOString().slice(0, 10)
    result.push({ date, ces: loadMap.get(date) ?? 0 })
  }
  return result
}

function filterSport(activities: ActivityRow[], types: string[] | null): ActivityRow[] {
  if (!types) return activities
  return activities.filter((a) => types.includes(a.sport_type))
}

function buildSportOverview(
  all365: ActivityRow[],
  types: string[] | null,
  monday: Date,
  nextMonday: Date,
  janFirst: Date,
): SportOverview {
  const acts = filterSport(all365, types)

  // Week stats
  const weekActs = acts.filter((a) => {
    const t = new Date(a.start_time)
    return t >= monday && t < nextMonday
  })
  const dailyKm    = Array(7).fill(0) as number[]
  const dailyDPlus = Array(7).fill(0) as number[]
  let weekKm = 0, weekDPlus = 0, weekSessions = 0
  for (const a of weekActs) {
    const idx = toMonIndex(new Date(a.start_time).getDay())
    const km  = (a.distance_m ?? 0) / 1000
    const dp  = a.elevation_gain_m ?? 0
    dailyKm[idx]    += km
    dailyDPlus[idx] += dp
    weekKm    += km
    weekDPlus += dp
    weekSessions++
  }
  const weekCes = Math.round(weekActs.reduce((s, a) => s + (a.ces ?? 0), 0))

  // YTD stats
  const ytdActs = acts.filter((a) => new Date(a.start_time) >= janFirst)
  const ytdKm    = Math.round(ytdActs.reduce((s, a) => s + (a.distance_m ?? 0) / 1000, 0) * 10) / 10
  const ytdDPlus = Math.round(ytdActs.reduce((s, a) => s + (a.elevation_gain_m ?? 0), 0))
  const monthlyKm = Array(12).fill(0) as number[]
  for (const a of ytdActs) {
    monthlyKm[new Date(a.start_time).getMonth()] += (a.distance_m ?? 0) / 1000
  }
  for (let i = 0; i < 12; i++) monthlyKm[i] = Math.round(monthlyKm[i] * 10) / 10

  // EWMA sport-spécifique
  const loads   = buildWindowedLoads(acts, 60)
  const metrics = buildDailyMetrics(loads)
  const latest  = metrics[metrics.length - 1] ?? { atl: 0, ctl: 0, tsb: 0 }
  const last7Tsb = metrics.slice(-7).map((m) => m.tsb)

  return {
    weekKm: Math.round(weekKm * 10) / 10,
    weekDPlus: Math.round(weekDPlus),
    weekSessions,
    dailyKm,
    dailyDPlus,
    ytdKm,
    ytdDPlus,
    monthlyKm,
    atl: latest.atl,
    ctl: latest.ctl,
    tsb: latest.tsb,
    weekCes,
    last7Tsb,
  }
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const supabase = await createClient()

  const yearAgo = new Date()
  yearAgo.setDate(yearAgo.getDate() - 365)

  const { data: rows } = await supabase
    .from('activities')
    .select('id, sport_type, name, start_time, ces, distance_m, elevation_gain_m, moving_time_sec')
    .eq('user_id', userId)
    .gte('start_time', yearAgo.toISOString())
    .order('start_time', { ascending: true })

  const activities = (rows ?? []) as ActivityRow[]

  // Global EWMA (60-day window) — kept for /charge page
  const globalLoads = buildWindowedLoads(activities, 60)
  const dailyMetrics = buildDailyMetrics(globalLoads)

  // Recent activities (last 7 days)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const recentActivities = activities
    .filter((r) => new Date(r.start_time) >= sevenDaysAgo)
    .reverse()

  // Date anchors
  const monday = mondayOfCurrentWeek()
  const nextMonday = new Date(monday)
  nextMonday.setDate(nextMonday.getDate() + 7)
  const janFirst = new Date(new Date().getFullYear(), 0, 1)

  // Sport overviews (4× buildSportOverview)
  const sportOverviews: Record<SportKey, SportOverview> = {
    run:  buildSportOverview(activities, SPORT_TYPE_MAP.run,  monday, nextMonday, janFirst),
    ride: buildSportOverview(activities, SPORT_TYPE_MAP.ride, monday, nextMonday, janFirst),
    swim: buildSportOverview(activities, SPORT_TYPE_MAP.swim, monday, nextMonday, janFirst),
    all:  buildSportOverview(activities, SPORT_TYPE_MAP.all,  monday, nextMonday, janFirst),
  }

  // Week sessions for WeekTable (all sports)
  const weekActivities = activities.filter((r) => {
    const t = new Date(r.start_time)
    return t >= monday && t < nextMonday
  })
  const sessionsByDay = new Map<number, { label: string; km: number; dPlus: number }>()
  for (const a of weekActivities) {
    const dayIdx = toMonIndex(new Date(a.start_time).getDay())
    const km = (a.distance_m ?? 0) / 1000
    const dp = a.elevation_gain_m ?? 0
    const existing = sessionsByDay.get(dayIdx)
    if (existing) {
      existing.km    += km
      existing.dPlus += dp
      existing.label  = existing.label || a.name
    } else {
      sessionsByDay.set(dayIdx, { label: a.name, km, dPlus: dp })
    }
  }
  const weekSessions: DaySession[] = Array.from({ length: 7 }, (_, i) => {
    const s = sessionsByDay.get(i)
    return {
      day:      DAY_ABBR[i],
      label:    s?.label ?? '',
      volumeKm: s ? Math.round(s.km * 10) / 10 : 0,
      dPlus:    s ? Math.round(s.dPlus) : 0,
    }
  })

  // Weekly points (last 10 ISO weeks, all sports — for combo/ratio charts)
  const weekMap = new Map<string, { ts: number; km: number; dPlus: number }>()
  for (const a of activities) {
    const ws = getWeekStart(new Date(a.start_time))
    const isoKey = ws.toISOString().slice(0, 10)
    const entry = weekMap.get(isoKey) ?? { ts: ws.getTime(), km: 0, dPlus: 0 }
    entry.km    += (a.distance_m       ?? 0) / 1000
    entry.dPlus += (a.elevation_gain_m ?? 0)
    weekMap.set(isoKey, entry)
  }
  const weeklyPoints: WeeklyPoint[] = Array.from(weekMap.entries())
    .map(([isoKey, data]) => {
      const [, m, d] = isoKey.split('-')
      return { weekLabel: `${d}/${m}`, ts: data.ts, km: Math.round(data.km * 10) / 10, dPlus: Math.round(data.dPlus) }
    })
    .sort((a, b) => a.ts - b.ts)
    .slice(-10)
    .map(({ weekLabel, km, dPlus }) => ({ weekLabel, km, dPlus }))

  // Cumulative km per month (last 4 months, all sports)
  const MONTH_CUMUL_COLORS = ['#4ADE80', '#FF6B35', '#F87171', '#38BDF8']
  const MONTH_SHORT_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  const nowDate = new Date()
  const monthActivityIndex = new Map<string, ActivityRow[]>()
  for (const a of activities) {
    const ad = new Date(a.start_time)
    const key = `${ad.getFullYear()}-${ad.getMonth()}`
    const arr = monthActivityIndex.get(key)
    if (arr) arr.push(a)
    else monthActivityIndex.set(key, [a])
  }
  const cumulMonths: MonthSeries[] = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - 3 + i, 1)
    const year  = d.getFullYear()
    const month = d.getMonth()
    const isCurrentMonth = year === nowDate.getFullYear() && month === nowDate.getMonth()
    const lastDay = isCurrentMonth ? nowDate.getDate() : new Date(year, month + 1, 0).getDate()
    const dailyKm = Array(lastDay).fill(0) as number[]
    const monthActivities = monthActivityIndex.get(`${year}-${month}`) ?? []
    for (const a of monthActivities) {
      const dayIdx = new Date(a.start_time).getDate() - 1
      if (dayIdx < lastDay) dailyKm[dayIdx] += (a.distance_m ?? 0) / 1000
    }
    const dailyCumul: number[] = []
    let cumul = 0
    for (let day = 0; day < lastDay; day++) {
      cumul += dailyKm[day]
      dailyCumul.push(Math.round(cumul * 10) / 10)
    }
    return { label: `${MONTH_SHORT_FR[month]} ${year}`, color: MONTH_CUMUL_COLORS[i], dailyCumul }
  })

  // Intensity breakdown (last 30 days, all sports)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const recent30 = activities.filter((r) => new Date(r.start_time) >= thirtyDaysAgo)
  const intensityMap = new Map<string, number>()
  for (const a of recent30) {
    if (!a.ces || !a.distance_m) continue
    const label = getIntensityLabel(a.ces)
    intensityMap.set(label, (intensityMap.get(label) ?? 0) + a.distance_m / 1000)
  }
  const intensityOrder = ['Footing', 'Sortie longue', 'Seuil', 'VMA', 'Runtaf']
  const intensityBreakdown: IntensityShare[] = intensityOrder
    .filter((l) => intensityMap.has(l))
    .map((l) => ({ label: l, km: Math.round((intensityMap.get(l) ?? 0) * 10) / 10 }))

  return {
    dailyMetrics,
    recentActivities,
    hasActivities: activities.length > 0,
    sportOverviews,
    weekSessions,
    intensityBreakdown,
    weeklyPoints,
    cumulMonths,
  }
}
```

- [ ] **Step 4: Lancer les tests**

```bash
cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/data/dashboard.test.ts
```

Expected: tous les 5 tests PASS.

- [ ] **Step 5: Vérifier TypeScript**

```bash
cd c:/Users/Franc/app-run-mobile/web && npx tsc --noEmit
```

Expected: erreurs TypeScript uniquement sur `dashboard/page.tsx` (anciens champs supprimés). Normal — on les corrige au Task 6.

- [ ] **Step 6: Commit**

```bash
git add web/lib/data/dashboard.ts web/__tests__/lib/data/dashboard.test.ts
git commit -m "feat(data): add SportOverview + sportOverviews to getDashboardData"
```

---

## Task 3: `SportSettingsModal` component

**Files:**
- Create: `web/components/cockpit/SportSettingsModal.tsx`

- [ ] **Step 1: Créer le composant**

```typescript
// web/components/cockpit/SportSettingsModal.tsx
'use client'

import { useState } from 'react'
import { SPORT_CONFIG, ALL_SPORT_KEYS, type SportKey } from '@/lib/design/sports'

type Props = {
  title:      string
  allKeys:    SportKey[]
  visible:    SportKey[]
  defaultKey: SportKey
  onSave:     (visible: SportKey[], defaultKey: SportKey) => void
  onClose:    () => void
}

export function SportSettingsModal({ title, allKeys, visible, defaultKey, onSave, onClose }: Props) {
  const [localVisible, setLocalVisible] = useState<SportKey[]>(visible)
  const [localDefault, setLocalDefault] = useState<SportKey>(defaultKey)

  function toggleVisible(key: SportKey) {
    const next = localVisible.includes(key)
      ? localVisible.filter((k) => k !== key)
      : [...localVisible, key].sort((a, b) => allKeys.indexOf(a) - allKeys.indexOf(b))
    setLocalVisible(next)
    if (!next.includes(localDefault)) {
      setLocalDefault(next[0] ?? key)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-trail-card border border-trail-border rounded-[16px] p-5 w-[320px] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[16px] font-semibold text-trail-text mb-4">{title}</h2>

        <p className="text-[12px] font-semibold text-trail-muted mb-2">Activités à afficher</p>
        <div className="space-y-2 mb-1">
          {allKeys.map((key) => {
            const cfg = SPORT_CONFIG[key]
            return (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localVisible.includes(key)}
                  onChange={() => toggleVisible(key)}
                  className="w-4 h-4"
                />
                <span className="text-[15px]">{cfg.emoji}</span>
                <span className="text-[14px] text-trail-text">{cfg.label}</span>
              </label>
            )
          })}
        </div>
        <p className="text-[11px] text-trail-muted mb-4">Tout décocher masque ce bloc dans le Cockpit</p>

        <p className="text-[12px] font-semibold text-trail-muted mb-1">Activité par défaut</p>
        <p className="text-[11px] text-trail-muted mb-2">Affichée en premier dans le Cockpit</p>
        <div className="space-y-2 mb-5">
          {allKeys.map((key) => {
            const cfg = SPORT_CONFIG[key]
            const isVisible = localVisible.includes(key)
            return (
              <label
                key={key}
                className={`flex items-center gap-3 cursor-pointer ${!isVisible ? 'opacity-40' : ''}`}
              >
                <input
                  type="radio"
                  name="default-sport"
                  value={key}
                  checked={localDefault === key}
                  onChange={() => setLocalDefault(key)}
                  disabled={!isVisible}
                  className="w-4 h-4"
                />
                <span className="text-[15px]">{cfg.emoji}</span>
                <span className="text-[14px] text-trail-text">{cfg.label}</span>
              </label>
            )
          })}
        </div>

        <button
          onClick={() => onSave(localVisible, localDefault)}
          className="w-full py-2 rounded-[10px] bg-trail-primary text-white font-semibold text-[14px]"
        >
          Fermer
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd c:/Users/Franc/app-run-mobile/web && npx tsc --noEmit
```

Expected: mêmes erreurs que précédemment sur page.tsx (pas de nouvelles erreurs).

- [ ] **Step 3: Commit**

```bash
git add web/components/cockpit/SportSettingsModal.tsx
git commit -m "feat(cockpit): add SportSettingsModal component"
```

---

## Task 4: `ActivitiesBlock` component

**Files:**
- Create: `web/components/cockpit/ActivitiesBlock.tsx`

- [ ] **Step 1: Créer le composant**

```typescript
// web/components/cockpit/ActivitiesBlock.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import type { SportOverview } from '@/lib/data/dashboard'
import { SPORT_CONFIG, ALL_SPORT_KEYS, type SportKey } from '@/lib/design/sports'
import { CockpitKpiTile } from '@/components/ui/CockpitKpiTile'
import { TsbBadge } from '@/components/ui/TsbBadge'
import { SportSettingsModal } from './SportSettingsModal'
import { colors } from '@/lib/design/colors'

type Settings = { visible: SportKey[]; default: SportKey }
const DEFAULT_SETTINGS: Settings = { visible: ['run', 'ride', 'swim', 'all'], default: 'run' }
const STORAGE_KEY = 'cockpit_activities_settings'

function normalize(arr: number[]): number[] {
  const max = Math.max(...arr, 0.001)
  return arr.map((v) => v / max)
}

function normalizeTsb(arr: number[]): number[] {
  const min = Math.min(...arr)
  const max = Math.max(...arr)
  const range = (max - min) || 0.001
  return arr.map((v) => (v - min) / range)
}

type Props = { sportOverviews: Record<SportKey, SportOverview> }

export function ActivitiesBlock({ sportOverviews }: Props) {
  const [settings,    setSettings]    = useState<Settings>(DEFAULT_SETTINGS)
  const [currentIdx,  setCurrentIdx]  = useState(0)
  const [showModal,   setShowModal]   = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return
    try {
      const merged: Settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
      setSettings(merged)
      const idx = merged.visible.indexOf(merged.default)
      if (idx > 0) {
        setCurrentIdx(idx)
        requestAnimationFrame(() => {
          const el = scrollRef.current
          if (el) el.scrollLeft = idx * el.clientWidth
        })
      }
    } catch { /* ignore malformed localStorage */ }
  }, [])

  const visibleSports = settings.visible.filter((k) => k in sportOverviews)
  if (visibleSports.length === 0) return null
  const safeIdx = Math.min(currentIdx, visibleSports.length - 1)
  const activeSport = visibleSports[safeIdx]
  const cfg = SPORT_CONFIG[activeSport]

  function handleScroll() {
    const el = scrollRef.current
    if (!el || el.clientWidth === 0) return
    setCurrentIdx(Math.min(Math.round(el.scrollLeft / el.clientWidth), visibleSports.length - 1))
  }

  function scrollTo(idx: number) {
    scrollRef.current?.scrollTo({ left: idx * (scrollRef.current.clientWidth), behavior: 'smooth' })
    setCurrentIdx(idx)
  }

  function handleSave(visible: SportKey[], defaultKey: SportKey) {
    const next: Settings = { visible, default: defaultKey }
    setSettings(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setShowModal(false)
    const newIdx = Math.max(0, visible.indexOf(defaultKey))
    setCurrentIdx(newIdx)
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) el.scrollLeft = newIdx * el.clientWidth
    })
  }

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-[6px]">
        <div className="flex items-center gap-1">
          <span className="text-[16px] font-semibold text-trail-muted">Activités —</span>
          <span className="text-[16px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
          <span className="text-[16px] ml-0.5">{cfg.emoji}</span>
        </div>
        <div className="flex items-center gap-2">
          <TsbBadge tsb={sportOverviews.all.tsb} />
          <button
            onClick={() => setShowModal(true)}
            className="text-trail-muted hover:text-trail-text px-1 text-[18px] leading-none"
            aria-label="Paramètres activités"
          >
            ⋮
          </button>
        </div>
      </div>

      {/* Carousel */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
      >
        {visibleSports.map((sportKey) => {
          const scfg = SPORT_CONFIG[sportKey]
          const sov  = sportOverviews[sportKey]
          const kmNorm   = normalize(sov.dailyKm)
          const kmLabels = sov.dailyKm.map((v) => v > 0 ? `${Math.round(v * 10) / 10}` : '')
          const dpNorm   = normalize(sov.dailyDPlus)
          const dpLabels = sov.dailyDPlus.map((v) => v > 0 ? `${Math.round(v)}` : '')
          const mNorm    = normalize(sov.monthlyKm)
          const mLabels  = sov.monthlyKm.map((v) => v > 0 ? `${Math.round(v)}` : '')
          const tsbNorm  = normalizeTsb(sov.last7Tsb)
          const tsbLabs  = sov.last7Tsb.map((v) => `${Math.round(v)}`)

          return (
            <div
              key={sportKey}
              style={{ flexShrink: 0, width: '100%', scrollSnapAlign: 'start' }}
            >
              <div className="grid grid-cols-2 gap-[6px]">
                <CockpitKpiTile
                  title="SEMAINE"
                  subline={`${sov.weekSessions} séance${sov.weekSessions !== 1 ? 's' : ''}`}
                  barValues={kmNorm} barLabels={kmLabels} barColor={scfg.color}
                >
                  <div className="flex items-baseline gap-[3px]">
                    <span className="text-[21px] font-black leading-none text-trail-text">{sov.weekKm}</span>
                    <span className="text-[14px] text-trail-muted">km</span>
                  </div>
                </CockpitKpiTile>

                <CockpitKpiTile
                  title="D+ SEMAINE"
                  subline="Dénivelé positif"
                  barValues={dpNorm} barLabels={dpLabels} barColor={colors.seriesBlue}
                >
                  <div className="flex items-baseline gap-[3px]">
                    <span className="text-[21px] font-black leading-none text-trail-text">{sov.weekDPlus}</span>
                    <span className="text-[14px] text-trail-muted">m</span>
                  </div>
                </CockpitKpiTile>
              </div>

              <div className="h-[6px]" />

              <div className="grid grid-cols-2 gap-[6px]">
                <CockpitKpiTile
                  title="ANNÉE"
                  subline={`D+ ${sov.ytdDPlus.toLocaleString('fr-FR')} m`}
                  barValues={mNorm} barLabels={mLabels} barColor={scfg.color}
                >
                  <div className="flex items-baseline gap-[3px]">
                    <span className="text-[18px] font-black leading-none text-trail-text">{sov.ytdKm}</span>
                    <span className="text-[14px] text-trail-muted">km</span>
                  </div>
                </CockpitKpiTile>

                <CockpitKpiTile
                  icon="⚡"
                  title={`CHARGE (${scfg.shortLabel})`}
                  subline={`TSB ${Math.round(sov.tsb)} • 7 derniers jours`}
                  barValues={tsbNorm} barLabels={tsbLabs} barColor={colors.seriesYellow}
                >
                  <div className="flex items-baseline gap-[2px] flex-nowrap">
                    <span className="text-[13px] font-bold" style={{ color: colors.chargeOrange }}>ATL </span>
                    <span className="text-[21px] font-black leading-none" style={{ color: colors.chargeOrange }}>{Math.round(sov.atl)}</span>
                    <span className="text-[13px] text-trail-muted mx-[3px]">·</span>
                    <span className="text-[13px] font-bold" style={{ color: colors.seriesBlue }}>CTL </span>
                    <span className="text-[21px] font-black leading-none" style={{ color: colors.seriesBlue }}>{Math.round(sov.ctl)}</span>
                  </div>
                </CockpitKpiTile>
              </div>
            </div>
          )
        })}
      </div>

      {/* Dots */}
      {visibleSports.length > 1 && (
        <div className="flex justify-center gap-[6px] mt-[8px]">
          {visibleSports.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              aria-label={`Sport ${i + 1}`}
              className={`w-[6px] h-[6px] rounded-full transition-colors ${
                i === safeIdx ? 'bg-trail-text' : 'bg-trail-border'
              }`}
            />
          ))}
        </div>
      )}

      {showModal && (
        <SportSettingsModal
          title="Volume d'activités"
          allKeys={ALL_SPORT_KEYS}
          visible={settings.visible}
          defaultKey={settings.default}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd c:/Users/Franc/app-run-mobile/web && npx tsc --noEmit
```

Expected: mêmes erreurs que précédemment sur page.tsx uniquement.

- [ ] **Step 3: Commit**

```bash
git add web/components/cockpit/ActivitiesBlock.tsx
git commit -m "feat(cockpit): add ActivitiesBlock swipeable multi-sport carousel"
```

---

## Task 5: `ChargeBlock` component

**Files:**
- Create: `web/components/cockpit/ChargeBlock.tsx`

- [ ] **Step 1: Créer le composant**

```typescript
// web/components/cockpit/ChargeBlock.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import type { SportOverview } from '@/lib/data/dashboard'
import { SPORT_CONFIG, ALL_SPORT_KEYS, type SportKey } from '@/lib/design/sports'
import { CompactMetricCard } from '@/components/ui/CompactMetricCard'
import { SportSettingsModal } from './SportSettingsModal'
import { colors } from '@/lib/design/colors'

type Settings = { visible: SportKey[]; default: SportKey }
const DEFAULT_SETTINGS: Settings = { visible: ['all', 'run', 'ride', 'swim'], default: 'all' }
const STORAGE_KEY = 'cockpit_charge_settings'

type Props = { sportOverviews: Record<SportKey, SportOverview> }

export function ChargeBlock({ sportOverviews }: Props) {
  const [settings,   setSettings]   = useState<Settings>(DEFAULT_SETTINGS)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [showModal,  setShowModal]  = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return
    try {
      const merged: Settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
      setSettings(merged)
      const idx = merged.visible.indexOf(merged.default)
      if (idx > 0) {
        setCurrentIdx(idx)
        requestAnimationFrame(() => {
          const el = scrollRef.current
          if (el) el.scrollLeft = idx * el.clientWidth
        })
      }
    } catch { /* ignore malformed localStorage */ }
  }, [])

  const visibleSports = settings.visible.filter((k) => k in sportOverviews)
  if (visibleSports.length === 0) return null
  const safeIdx = Math.min(currentIdx, visibleSports.length - 1)
  const activeSport = visibleSports[safeIdx]
  const cfg = SPORT_CONFIG[activeSport]

  function handleScroll() {
    const el = scrollRef.current
    if (!el || el.clientWidth === 0) return
    setCurrentIdx(Math.min(Math.round(el.scrollLeft / el.clientWidth), visibleSports.length - 1))
  }

  function scrollTo(idx: number) {
    scrollRef.current?.scrollTo({ left: idx * (scrollRef.current.clientWidth), behavior: 'smooth' })
    setCurrentIdx(idx)
  }

  function handleSave(visible: SportKey[], defaultKey: SportKey) {
    const next: Settings = { visible, default: defaultKey }
    setSettings(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setShowModal(false)
    const newIdx = Math.max(0, visible.indexOf(defaultKey))
    setCurrentIdx(newIdx)
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) el.scrollLeft = newIdx * el.clientWidth
    })
  }

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-[6px]">
        <p className="text-[13px] font-semibold text-trail-text">
          Charge d'entraînement —{' '}
          <span style={{ color: cfg.color }}>{cfg.label}</span>
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="text-trail-muted hover:text-trail-text px-1 text-[18px] leading-none"
          aria-label="Paramètres charge"
        >
          ⋮
        </button>
      </div>

      {/* Carousel */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
      >
        {visibleSports.map((sportKey) => {
          const sov      = sportOverviews[sportKey]
          const tsbColor = sov.tsb >= 0 ? colors.greenOk : colors.runRed
          return (
            <div
              key={sportKey}
              style={{ flexShrink: 0, width: '100%', scrollSnapAlign: 'start' }}
            >
              <div className="grid grid-cols-2 gap-2 mt-1">
                <CompactMetricCard unit="ATL"    value={sov.atl}     description="Fatigue 7j"  color={colors.chargeOrange}  />
                <CompactMetricCard unit="CTL"    value={sov.ctl}     description="Fitness 28j" color={colors.seriesBlue}    />
                <CompactMetricCard unit="TSB"    value={sov.tsb}     description="Forme"        color={tsbColor}             />
                <CompactMetricCard unit="Suffer" value={sov.weekCes} description="Charge sem." color={colors.seriesYellow}  />
              </div>
            </div>
          )
        })}
      </div>

      {/* Dots */}
      {visibleSports.length > 1 && (
        <div className="flex justify-center gap-[6px] mt-[8px]">
          {visibleSports.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              aria-label={`Sport ${i + 1}`}
              className={`w-[6px] h-[6px] rounded-full transition-colors ${
                i === safeIdx ? 'bg-trail-text' : 'bg-trail-border'
              }`}
            />
          ))}
        </div>
      )}

      {showModal && (
        <SportSettingsModal
          title="Charge d'entraînement"
          allKeys={ALL_SPORT_KEYS}
          visible={settings.visible}
          defaultKey={settings.default}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd c:/Users/Franc/app-run-mobile/web && npx tsc --noEmit
```

Expected: mêmes erreurs sur page.tsx uniquement.

- [ ] **Step 3: Commit**

```bash
git add web/components/cockpit/ChargeBlock.tsx
git commit -m "feat(cockpit): add ChargeBlock swipeable multi-sport carousel"
```

---

## Task 6: Brancher dans `dashboard/page.tsx`

**Files:**
- Modify: `web/app/dashboard/page.tsx`

- [ ] **Step 1: Remplacer le contenu complet de `web/app/dashboard/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/navigation/AppShell'
import { CockpitChartCard } from '@/components/charts/CockpitChartCard'
import { CockpitLineChart } from '@/components/charts/CockpitLineChart'
import { CockpitComboChart } from '@/components/charts/CockpitComboChart'
import { CockpitCumulChart } from '@/components/charts/CockpitCumulChart'
import { CockpitPieChart, type PieSlice } from '@/components/charts/CockpitPieChart'
import { WeekTable } from '@/components/ui/WeekTable'
import { GoalsBlock } from '@/components/cockpit/GoalsBlock'
import { HistoryPillsBlock } from '@/components/cockpit/HistoryPillsBlock'
import { ActivitiesBlock } from '@/components/cockpit/ActivitiesBlock'
import { ChargeBlock } from '@/components/cockpit/ChargeBlock'
import { createClient } from '@/lib/database/supabase-server'
import { getDashboardData } from '@/lib/data/dashboard'
import { colors } from '@/lib/design/colors'

const INTENSITY_COLORS: Record<string, string> = {
  'Footing':       colors.pieFooting,
  'Sortie longue': colors.pieSortieLongue,
  'Seuil':         colors.pieSeuil,
  'VMA':           colors.pieVma,
  'Runtaf':        colors.pieRuntaf,
}

function SectionCard({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      {title && (
        <p className="text-[13px] font-semibold text-trail-text mb-[6px] leading-tight">{title}</p>
      )}
      {children}
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const {
    sportOverviews,
    weekSessions,
    intensityBreakdown,
    weeklyPoints,
    cumulMonths,
  } = await getDashboardData(user.id)

  // Intensity pie
  const pieData: PieSlice[] = intensityBreakdown.map((s) => ({
    label: s.label,
    value: s.km,
    color: INTENSITY_COLORS[s.label] ?? colors.pieAutre,
  }))

  // Run/D+ 10 weeks combo data
  const comboData = weeklyPoints.map((w) => ({ label: w.weekLabel, dPlus: w.dPlus, km: w.km }))

  // Ratio D+/km line data
  const ratioData = weeklyPoints.map((w) => ({
    date:  w.weekLabel,
    ratio: w.km > 0 ? Math.round((w.dPlus / w.km) * 10) / 10 : 0,
  }))

  // HistoryPills
  const weekPills = weeklyPoints.map((w) => ({ label: w.weekLabel, km: w.km, dPlus: w.dPlus }))

  return (
    <AppShell>
      <div className="px-2 py-2 space-y-2 max-w-lg mx-auto">

        {/* ── 1. Activités (swipeable multi-sport) ── */}
        <ActivitiesBlock sportOverviews={sportOverviews} />

        {/* ── 2. Objectifs (configurable) ── */}
        <GoalsBlock
          weekKm={sportOverviews.run.weekKm}
          weekDPlus={sportOverviews.run.weekDPlus}
          yearKm={sportOverviews.run.ytdKm}
        />

        {/* ── 3. Run / D+ — 10 semaines ── */}
        <CockpitChartCard
          minHeight={220}
          titleSlot={
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[16px] font-bold" style={{ color: colors.chargeOrange }}>RUN km</span>
              <span className="text-[16px] font-semibold text-trail-muted"> / </span>
              <span className="text-[16px] font-bold" style={{ color: colors.seriesBlue }}>D+</span>
              <span className="text-[16px] font-semibold text-trail-muted"> — 10 semaines</span>
            </div>
          }
        >
          <CockpitComboChart data={comboData} />
        </CockpitChartCard>

        {/* ── 4. Ratio D+/km — 10 semaines ── */}
        <CockpitChartCard title="Ratio RUN D+/km — 10 semaines" minHeight={220}>
          <CockpitLineChart
            data={ratioData}
            series={[{ key: 'ratio', label: 'D+/km', color: colors.seriesGreen }]}
            xInterval={0}
            height={220}
          />
        </CockpitChartCard>

        {/* ── 5. Charge d'entraînement (swipeable multi-sport) ── */}
        <ChargeBlock sportOverviews={sportOverviews} />

        {/* ── 6. Historique Running ── */}
        <HistoryPillsBlock
          daySessions={weekSessions.map((s) => ({ label: s.day, volumeKm: s.volumeKm, dPlus: s.dPlus }))}
          weeklyPoints={weekPills}
          monthlyRunKm={sportOverviews.run.monthlyKm}
        />

        {/* ── 7. Cumul km par mois ── */}
        <CockpitChartCard
          minHeight={220}
          titleSlot={
            <div className="flex items-center justify-between mb-1">
              <span className="text-[16px] font-bold" style={{ color: colors.chargeOrange }}>
                Cumul km par mois — Course
              </span>
            </div>
          }
        >
          <CockpitCumulChart months={cumulMonths} height={220} />
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {cumulMonths.map((m) => (
              <span key={m.label} className="flex items-center gap-1 text-[11px] text-trail-muted">
                <span className="inline-block w-3 h-[3px] rounded-full" style={{ backgroundColor: m.color }} />
                {m.label}
              </span>
            ))}
          </div>
        </CockpitChartCard>

        {/* ── 8. Répartition intensité 30j ── */}
        <CockpitChartCard title="Répartition intensité — 30j glissants">
          <CockpitPieChart data={pieData} />
        </CockpitChartCard>

        {/* ── 9. Semaine en cours ── */}
        <SectionCard title="Semaine en cours">
          <WeekTable sessions={weekSessions} />
        </SectionCard>

      </div>
    </AppShell>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript — zéro erreur attendu**

```bash
cd c:/Users/Franc/app-run-mobile/web && npx tsc --noEmit
```

Expected: aucune erreur TypeScript.

- [ ] **Step 3: Lancer les tests**

```bash
cd c:/Users/Franc/app-run-mobile/web && npx jest
```

Expected: tous les tests PASS.

- [ ] **Step 4: Lancer le build Next.js**

```bash
cd c:/Users/Franc/app-run-mobile/web && npm run build
```

Expected: build réussi, aucune erreur de compilation.

- [ ] **Step 5: Commit**

```bash
git add web/app/dashboard/page.tsx
git commit -m "feat(dashboard): wire ActivitiesBlock and ChargeBlock, remove old inline blocks"
```

---

## Task 7: Font fixes — `CockpitKpiTile` + `BarStrip`

**Files:**
- Modify: `web/components/ui/CockpitKpiTile.tsx`
- Modify: `web/components/ui/BarStrip.tsx`

- [ ] **Step 1: Modifier `CockpitKpiTile.tsx`**

Remplacer le contenu par :

```typescript
// web/components/ui/CockpitKpiTile.tsx
// Mirror of CockpitKpiTile composable in DashboardScreen.kt (line 8425).
// Compound tile: period label + content slot + subline + BarStrip.
// Note: bg = trail-surface (NOT trail-card), radius = rounded-[10px].

import type { ReactNode } from 'react'
import { BarStrip } from './BarStrip'

type CockpitKpiTileProps = {
  icon?:      string
  title:      string
  subline:    string
  barValues:  number[]
  barLabels:  string[]
  barColor:   string
  children:   ReactNode
  className?: string
}

export function CockpitKpiTile({
  icon,
  title,
  subline,
  barValues,
  barLabels,
  barColor,
  children,
  className = '',
}: CockpitKpiTileProps) {
  return (
    <div className={`rounded-[10px] bg-trail-surface border border-trail-border px-2 py-[8px] flex flex-col ${className}`}>
      {/* Period label row */}
      <div className="flex items-center gap-[3px]">
        {icon && <span className="text-[14px] leading-none">{icon}</span>}
        <span className="text-[11px] font-semibold text-trail-muted leading-tight truncate" style={{ maxWidth: '100%' }}>
          {title}
        </span>
      </div>

      <div className="h-[3px]" />

      {/* Main value slot */}
      {children}

      <div className="h-[2px]" />

      {/* Subline */}
      <p className="text-[12px] text-trail-muted leading-tight truncate">{subline}</p>

      <div className="h-[4px]" />

      {/* BarStrip */}
      <BarStrip values={barValues} labels={barLabels} color={barColor} />
    </div>
  )
}
```

Changement : `py-[5px]` → `py-[8px]` uniquement. Le `leading-none` est appliqué dans les composants parents (ActivitiesBlock).

- [ ] **Step 2: Modifier `BarStrip.tsx` — fontSize 10 → 11**

Trouver la ligne :
```typescript
fontSize={10}
```

La remplacer par :
```typescript
fontSize={11}
```

- [ ] **Step 3: Vérifier TypeScript + build**

```bash
cd c:/Users/Franc/app-run-mobile/web && npx tsc --noEmit && npm run build
```

Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add web/components/ui/CockpitKpiTile.tsx web/components/ui/BarStrip.tsx
git commit -m "fix(ui): increase KPI tile padding and bar label font size"
```

---

## Checklist de validation finale

- [ ] Swipe gauche/droite fonctionne sur mobile (touch events)
- [ ] Clic sur dots navigue vers le bon sport
- [ ] ⋮ ouvre la modal — sélection persiste au rechargement de page
- [ ] Si tous les sports décochés → bloc absent du DOM
- [ ] Le sport par défaut s'affiche en premier au chargement
- [ ] ATL/CTL/TSB diffèrent entre Run et Global (EWMA sport-spécifique)
- [ ] `charge/page.tsx` fonctionne toujours (`dailyMetrics` conservé)
- [ ] `GoalsBlock` reçoit les bonnes valeurs Running
- [ ] `HistoryPillsBlock` reçoit `sportOverviews.run.monthlyKm`
- [ ] Tous les tests Jest passent
- [ ] Build Next.js sans erreur
