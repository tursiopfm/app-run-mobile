> **Status: Implémenté** · Date: 2026-05-04 · Code: `web/components/cockpit/`
> *Snapshot de design — pour l'état actuel, voir le code.*

# Cockpit Blocks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 missing Cockpit blocks (Run/D+ 10w, Ratio D+/km, Charge cards, Historic Running, Cumul months), make Goals block configurable via localStorage, and reorder all 9 blocks to match the Android Cockpit tab.

**Architecture:** The dashboard page (`app/dashboard/page.tsx`) is a Next.js 14 Server Component. Data additions go in `lib/data/dashboard.ts`. Interactive blocks (Goals, History pills) become `'use client'` child components receiving server data as props. New charts follow the existing Recharts pattern. localStorage is used for goal targets (matches Android SharedPreferences pattern).

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Recharts (ComposedChart), Supabase

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `web/lib/data/dashboard.ts` | Modify | Add `WeeklyPoint`, `MonthSeries` types + `weeklyPoints`, `weekSuffer`, `cumulMonths` to `DashboardData` |
| `web/components/charts/CockpitComboChart.tsx` | Create | Recharts `ComposedChart` — bar = D+ (blue), line = km (orange), dual Y-axes |
| `web/components/ui/CompactMetricCard.tsx` | Create | Small card: unit label / large value / description (used in Charge block) |
| `web/components/cockpit/GoalsBlock.tsx` | Create | `'use client'` — 3 `GoalProgressRow`s with localStorage-persisted targets + edit dialog |
| `web/components/cockpit/HistoryPillsBlock.tsx` | Create | `'use client'` — pill row with Semaine / Mois / Année period toggle |
| `web/components/charts/CockpitCumulChart.tsx` | Create | Recharts `LineChart` — one line per month, x = day of month, y = cumulative km |
| `web/app/dashboard/page.tsx` | Modify | Rewire: 9 blocks in Android-matching order, remove ATL/CTL line chart from Cockpit |

---

## Block order target

| # | Block | Status |
|---|---|---|
| 1 | Activité (4 KPI tiles) | ✅ keep |
| 2 | Objectifs (configurable) | 🔧 replace hardcoded |
| 3 | Run/D+ — 10 semaines | ❌ new |
| 4 | Ratio D+/km — 10 semaines | ❌ new |
| 5 | Charge d'entraînement (ATL/CTL/TSB/Suffer) | ❌ new, replaces ATL/CTL line chart |
| 6 | Historique Running | ❌ new |
| 7 | Cumul km par mois | ❌ new (replaces monthly bar chart) |
| 8 | Répartition intensité 30j | ✅ keep |
| 9 | Semaine en cours | ✅ keep |

---

### Task 1: Extend DashboardData — weekly points, weekly suffer, cumulative months

**Files:**
- Modify: `web/lib/data/dashboard.ts`

- [ ] **Step 1: Add new types after `IntensityShare`**

In `web/lib/data/dashboard.ts`, add these types after the `IntensityShare` type and before `DashboardData`:

```typescript
export type WeeklyPoint = {
  weekLabel: string  // "DD/MM" — ISO Monday of the week
  km:        number
  dPlus:     number
}

export type MonthSeries = {
  label:      string    // e.g. "Jan 2025"
  color:      string    // hex
  dailyCumul: number[]  // cumulative km for days 1..N of that month
}
```

- [ ] **Step 2: Add new fields to `DashboardData`**

Replace the `DashboardData` type with:

```typescript
export type DashboardData = {
  dailyMetrics:       DailyMetrics[]
  recentActivities:   ActivityRow[]
  hasActivities:      boolean
  weekOverview:       WeekOverview
  monthlyRunKm:       number[]
  weekSessions:       DaySession[]
  ytd:                YtdOverview
  intensityBreakdown: IntensityShare[]
  weeklyPoints:       WeeklyPoint[]  // last 10 ISO weeks, oldest first
  weekSuffer:         number         // sum of CES for current week
  cumulMonths:        MonthSeries[]  // last 4 calendar months
}
```

- [ ] **Step 3: Add `getWeekStart` helper after `toMonIndex`**

In the helpers section (after `toMonIndex`), add:

```typescript
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const jsDay = d.getDay()                    // 0=Sun..6=Sat
  const diff = jsDay === 0 ? -6 : 1 - jsDay  // shift back to Monday
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}
```

- [ ] **Step 4: Compute `weeklyPoints` and `weekSuffer`**

Inside `getDashboardData`, after the `weekOverview` block (after the `runSessions++` loop and before `// --- YTD ---`), add:

```typescript
  // --- Weekly points (last 10 ISO weeks) ---
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

  const weekSuffer = Math.round(weekActivities.reduce((s, a) => s + (a.ces ?? 0), 0))
```

- [ ] **Step 5: Compute `cumulMonths`**

Directly after the `weeklyPoints` block, add:

```typescript
  // --- Cumulative km per month (last 4 calendar months) ---
  const MONTH_CUMUL_COLORS = ['#4ADE80', '#FF6B35', '#F87171', '#38BDF8']
  const MONTH_SHORT_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  const nowDate = new Date()

  const cumulMonths: MonthSeries[] = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - 3 + i, 1)
    const year  = d.getFullYear()
    const month = d.getMonth()
    const isCurrentMonth = year === nowDate.getFullYear() && month === nowDate.getMonth()
    const lastDay = isCurrentMonth ? nowDate.getDate() : new Date(year, month + 1, 0).getDate()

    const dailyKm = Array(31).fill(0) as number[]
    for (const a of activities) {
      const ad = new Date(a.start_time)
      if (ad.getFullYear() === year && ad.getMonth() === month) {
        dailyKm[ad.getDate() - 1] += (a.distance_m ?? 0) / 1000
      }
    }

    const dailyCumul: number[] = []
    let cumul = 0
    for (let day = 0; day < lastDay; day++) {
      cumul += dailyKm[day]
      dailyCumul.push(Math.round(cumul * 10) / 10)
    }

    return { label: `${MONTH_SHORT_FR[month]} ${year}`, color: MONTH_CUMUL_COLORS[i], dailyCumul }
  })
```

- [ ] **Step 6: Add new fields to the return object**

Update the `return` statement at the end of `getDashboardData`:

```typescript
  return {
    dailyMetrics,
    recentActivities,
    hasActivities: activities.length > 0,
    weekOverview,
    monthlyRunKm,
    weekSessions,
    ytd,
    intensityBreakdown,
    weeklyPoints,
    weekSuffer,
    cumulMonths,
  }
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing unrelated warnings).

- [ ] **Step 8: Commit**

```bash
git add web/lib/data/dashboard.ts
git commit -m "feat(data): add weeklyPoints, weekSuffer, cumulMonths to DashboardData"
```

---

### Task 2: CompactMetricCard — small card for Charge block

**Files:**
- Create: `web/components/ui/CompactMetricCard.tsx`

The Charge block shows 4 of these in a 2×2 grid: ATL (orange), CTL (blue), TSB (green/red), Suffer (yellow).

- [ ] **Step 1: Create the file**

Create `web/components/ui/CompactMetricCard.tsx`:

```tsx
// Mirror of CompactMetricCard composable from DashboardScreen.kt (BlockType.Load).
// unit label (top-muted) | large rounded value | description (bottom-muted)

type Props = {
  unit:        string  // "ATL" | "CTL" | "TSB" | "Suffer"
  value:       number
  description: string
  color:       string  // hex — value color
}

export function CompactMetricCard({ unit, value, description, color }: Props) {
  return (
    <div className="flex-1 rounded-[8px] bg-trail-surface border border-trail-border px-3 py-2">
      <p className="text-[11px] font-semibold text-trail-muted leading-tight">{unit}</p>
      <p className="text-[22px] font-black leading-tight" style={{ color }}>{Math.round(value)}</p>
      <p className="text-[11px] text-trail-muted leading-tight">{description}</p>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/ui/CompactMetricCard.tsx
git commit -m "feat(ui): add CompactMetricCard for Charge block"
```

---

### Task 3: CockpitComboChart — combo bar (D+) + line (km)

**Files:**
- Create: `web/components/charts/CockpitComboChart.tsx`

Mirror of Android `ComboBarLineChart`. Bars = D+ (SeriesBlue, left Y-axis). Line = km (chargeOrange, right Y-axis). Dual independent Y-axes so each metric keeps its own scale.

- [ ] **Step 1: Create the file**

Create `web/components/charts/CockpitComboChart.tsx`:

```tsx
'use client'

// Mirror of ComboBarLineChart composable from ui/components/Charts.kt.
// bars = D+ elevation (left Y, blue) | line = km (right Y, orange) | dual Y-axes.

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { colors } from '@/lib/design/colors'
import { chart } from '@/lib/design/layout'

export type ComboPoint = {
  label: string
  dPlus: number   // bars, left Y-axis
  km:    number   // line, right Y-axis
}

type Props = {
  data:       ComboPoint[]
  lineColor?: string
  barColor?:  string
  height?:    number
}

export function CockpitComboChart({
  data,
  lineColor = colors.chargeOrange,
  barColor  = colors.seriesBlue,
  height    = 220,
}: Props) {
  const gap = `${Math.round((1 - chart.comboBarRatio) * 100)}%`

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: chart.topPadCombo, right: 44, left: 0, bottom: 0 }}
          barCategoryGap={gap}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: colors.subtleText }}
            angle={chart.comboLabelRotation}
            textAnchor="end"
            interval={0}
            stroke={colors.border}
            tickLine={false}
            height={70}
          />
          <YAxis
            yAxisId="bar"
            orientation="left"
            tick={{ fontSize: 12, fill: barColor, fontWeight: 600 }}
            stroke="none"
            tickLine={false}
            axisLine={false}
            tickCount={chart.comboYTickCount}
            width={38}
          />
          <YAxis
            yAxisId="line"
            orientation="right"
            tick={{ fontSize: 12, fill: lineColor, fontWeight: 600 }}
            stroke="none"
            tickLine={false}
            axisLine={false}
            tickCount={chart.comboYTickCount}
            width={38}
          />
          <Tooltip
            contentStyle={{
              background:   colors.cardBg,
              border:       `1px solid ${colors.border}`,
              borderRadius: 6,
              fontSize:     12,
            }}
            labelStyle={{ color: colors.subtleText }}
            itemStyle={{ color: colors.text }}
          />
          <Bar
            yAxisId="bar"
            dataKey="dPlus"
            name="D+ (m)"
            fill={barColor}
            fillOpacity={0.7}
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          />
          <Line
            yAxisId="line"
            type="monotone"
            dataKey="km"
            name="km"
            stroke={lineColor}
            strokeWidth={chart.strokeWidth}
            dot={{ r: chart.dotRadius, fill: lineColor, strokeWidth: 0 }}
            activeDot={{ r: chart.dotRadius + 1 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/charts/CockpitComboChart.tsx
git commit -m "feat(charts): add CockpitComboChart (bar=D+, line=km, dual Y)"
```

---

### Task 4: GoalsBlock — configurable goals with localStorage

**Files:**
- Create: `web/components/cockpit/GoalsBlock.tsx`

`'use client'` component. Reads/saves to `localStorage['cockpit_goals']`. Defaults: weekKm=50, weekDPlus=2000, yearKm=1000. Settings ⚙ icon opens an inline dialog with three number inputs.

- [ ] **Step 1: Create the cockpit directory**

```bash
mkdir -p "c:/Users/Franc/app-run-mobile/web/components/cockpit"
```

- [ ] **Step 2: Create the file**

Create `web/components/cockpit/GoalsBlock.tsx`:

```tsx
'use client'

// Goals block with localStorage-persisted targets.
// Mirror of BlockType.Goals (GoalsRun) from DashboardScreen.kt.
// Defaults: weekKm=50, weekDPlus=2000, yearKm=1000.

import { useState, useEffect } from 'react'
import { GoalProgressRow } from '@/components/ui/GoalProgressRow'
import { colors } from '@/lib/design/colors'

const STORAGE_KEY = 'cockpit_goals'

type Goals = {
  weekKm:    number
  weekDPlus: number
  yearKm:    number
}

const DEFAULT_GOALS: Goals = { weekKm: 50, weekDPlus: 2000, yearKm: 1000 }

type Props = {
  weekKm:    number
  weekDPlus: number
  yearKm:    number
}

export function GoalsBlock({ weekKm, weekDPlus, yearKm }: Props) {
  const [goals,   setGoals]   = useState<Goals>(DEFAULT_GOALS)
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState<Goals>(DEFAULT_GOALS)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setGoals(JSON.parse(stored) as Goals)
    } catch {}
  }, [])

  function openEdit() {
    setDraft(goals)
    setEditing(true)
  }

  function saveGoals() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    setGoals(draft)
    setEditing(false)
  }

  return (
    <>
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
        <div className="flex items-center justify-between mb-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-semibold text-trail-text">Objectifs —</span>
            <span className="text-[15px] font-semibold" style={{ color: colors.chargeOrange }}>Course 🏃</span>
          </div>
          <button
            onClick={openEdit}
            className="text-trail-muted hover:text-trail-text transition-colors p-0.5"
            aria-label="Modifier les objectifs"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
        <div className="space-y-[10px]">
          <GoalProgressRow label="Distance hebdo"    current={weekKm}    target={goals.weekKm}    unit="km" color={colors.progressRunFg}    />
          <GoalProgressRow label="D+ semaine"        current={weekDPlus} target={goals.weekDPlus} unit="m"  color={colors.progressDPlusFg}  />
          <GoalProgressRow label="Distance annuelle" current={yearKm}    target={goals.yearKm}    unit="km" color={colors.progressVolumeFg} />
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
          <div className="bg-trail-card border border-trail-border rounded-[12px] p-5 w-full max-w-sm">
            <h3 className="text-[16px] font-bold text-trail-text mb-4">Modifier les objectifs</h3>
            <div className="space-y-4">
              <GoalField label="Km semaine" value={draft.weekKm}    onChange={(v) => setDraft((g) => ({ ...g, weekKm: v }))}    unit="km" />
              <GoalField label="D+ semaine" value={draft.weekDPlus} onChange={(v) => setDraft((g) => ({ ...g, weekDPlus: v }))} unit="m"  />
              <GoalField label="Km année"   value={draft.yearKm}    onChange={(v) => setDraft((g) => ({ ...g, yearKm: v }))}    unit="km" />
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setEditing(false)}
                className="text-[14px] text-trail-muted px-4 py-2"
              >
                Annuler
              </button>
              <button
                onClick={saveGoals}
                className="text-[14px] font-semibold px-4 py-2 rounded-[8px]"
                style={{ backgroundColor: colors.chargeOrange, color: '#fff' }}
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function GoalField({
  label, value, onChange, unit,
}: {
  label: string; value: number; onChange: (v: number) => void; unit: string
}) {
  return (
    <div>
      <label className="text-[13px] text-trail-muted block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="flex-1 bg-trail-surface border border-trail-border rounded-[6px] px-3 py-2 text-[15px] text-trail-text focus:outline-none"
        />
        <span className="text-[13px] text-trail-muted w-6">{unit}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/components/cockpit/GoalsBlock.tsx
git commit -m "feat(cockpit): add GoalsBlock with localStorage-persisted targets"
```

---

### Task 5: HistoryPillsBlock — historic running pills with period toggle

**Files:**
- Create: `web/components/cockpit/HistoryPillsBlock.tsx`

Mirror of Android `BlockType.Days` (DaysRun). Three period toggles: **Sem.** (7 daily pills), **Mois** (last 5 weekly pills), **An** (12 monthly pills).

- [ ] **Step 1: Create the file**

Create `web/components/cockpit/HistoryPillsBlock.tsx`:

```tsx
'use client'

// Mirror of BlockType.Days (DaysRun) from DashboardScreen.kt.
// 3 periods: Sem. (7 days), Mois (last 5 weeks), An (12 months).

import { useState } from 'react'
import { colors } from '@/lib/design/colors'

export type DayPill = {
  label:    string   // 'L'|'M'|'M'|'J'|'V'|'S'|'D'
  volumeKm: number
  dPlus:    number
}

export type WeekPill = {
  label: string   // 'DD/MM'
  km:    number
  dPlus: number
}

type Props = {
  daySessions:  DayPill[]   // 7 items Mon..Sun
  weeklyPoints: WeekPill[]  // last 10 weeks (we take last 5 for Mois)
  monthlyRunKm: number[]    // 12 items Jan..Dec
}

const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

type Period = 'week' | 'month' | 'year'

export function HistoryPillsBlock({ daySessions, weeklyPoints, monthlyRunKm }: Props) {
  const [period, setPeriod] = useState<Period>('week')

  type PillData = { label: string; km: number; dPlus: number }

  const pills: PillData[] = (() => {
    switch (period) {
      case 'week':
        return daySessions.map((s) => ({ label: s.label, km: s.volumeKm, dPlus: s.dPlus }))
      case 'month':
        return weeklyPoints.slice(-5).map((w) => ({ label: w.label, km: w.km, dPlus: w.dPlus }))
      case 'year':
        return monthlyRunKm.map((km, i) => ({ label: MONTH_LETTERS[i], km, dPlus: 0 }))
    }
  })()

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      <div className="flex items-center justify-between mb-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-semibold text-trail-muted">Historique</span>
          <span className="text-[15px] font-semibold" style={{ color: colors.chargeOrange }}>Course 🏃</span>
        </div>
        <div className="flex gap-1">
          {(['week', 'month', 'year'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors"
              style={{
                backgroundColor: period === p ? colors.chargeOrange : 'transparent',
                color:           period === p ? '#fff' : colors.subtleText,
                border:          `1px solid ${period === p ? colors.chargeOrange : colors.border}`,
              }}
            >
              {p === 'week' ? 'Sem.' : p === 'month' ? 'Mois' : 'An'}
            </button>
          ))}
        </div>
      </div>

      <div
        className="flex gap-[5px]"
        style={{ overflowX: period === 'year' ? 'auto' : 'visible' }}
      >
        {pills.map((pill, i) => (
          <HistoryPill key={i} label={pill.label} km={pill.km} dPlus={pill.dPlus} flex={period !== 'year'} />
        ))}
      </div>
    </div>
  )
}

function HistoryPill({
  label, km, dPlus, flex,
}: {
  label: string; km: number; dPlus: number; flex: boolean
}) {
  return (
    <div
      className="rounded-[8px] bg-trail-surface border border-trail-border px-1.5 py-2 flex flex-col items-center gap-[2px]"
      style={{ flex: flex ? '1' : 'none', minWidth: flex ? 0 : 44 }}
    >
      <span className="text-[11px] font-semibold text-trail-muted leading-none">{label}</span>
      {km > 0 ? (
        <>
          <span className="text-[13px] font-bold leading-tight" style={{ color: colors.chargeOrange }}>
            {km < 10 ? km.toFixed(1) : Math.round(km)}
          </span>
          <span className="text-[10px] text-trail-muted leading-none">km</span>
        </>
      ) : (
        <span className="text-[13px] font-bold leading-tight text-trail-muted">—</span>
      )}
      {dPlus > 0 && (
        <>
          <span className="text-[11px] font-semibold leading-tight" style={{ color: colors.seriesBlue }}>
            {Math.round(dPlus)}
          </span>
          <span className="text-[10px] text-trail-muted leading-none">m D+</span>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/cockpit/HistoryPillsBlock.tsx
git commit -m "feat(cockpit): add HistoryPillsBlock with Sem./Mois/An toggle"
```

---

### Task 6: CockpitCumulChart — multi-line cumulative km per month

**Files:**
- Create: `web/components/charts/CockpitCumulChart.tsx`

Mirror of Android `BlockType.CumulMonths`. X-axis = day of month (1..N). One `Line` per month, each showing cumulative km from day 1. Lines stop at current day for the current month.

- [ ] **Step 1: Create the file**

Create `web/components/charts/CockpitCumulChart.tsx`:

```tsx
'use client'

// Mirror of BlockType.CumulMonths from DashboardScreen.kt.
// Multi-line chart: each line = one calendar month's cumulative km by day.
// X-axis = day of month (1..31). Lines from cumulMonths MonthSeries[].

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { colors } from '@/lib/design/colors'
import { chart } from '@/lib/design/layout'

export type MonthSeries = {
  label:      string    // "Jan 2025"
  color:      string    // hex
  dailyCumul: number[]  // cumulative km for each day 1..N
}

type Props = {
  months:  MonthSeries[]
  height?: number
}

export function CockpitCumulChart({ months, height = 220 }: Props) {
  const maxDays = Math.max(...months.map((m) => m.dailyCumul.length), 0)

  if (maxDays === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center">
        <span className="text-[12px] text-trail-muted">Aucune donnée</span>
      </div>
    )
  }

  const data = Array.from({ length: maxDays }, (_, i) => {
    const point: Record<string, number | string> = { day: i + 1 }
    for (const m of months) {
      if (i < m.dailyCumul.length) point[m.label] = m.dailyCumul[i]
    }
    return point
  })

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: chart.topPad, right: chart.rightPad, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 12, fill: colors.subtleText }}
            interval={4}
            stroke={colors.border}
            tickLine={false}
            height={20}
          />
          <YAxis
            tick={{ fontSize: 12, fill: colors.subtleText }}
            stroke="none"
            tickLine={false}
            axisLine={false}
            tickCount={chart.yTickCount}
            width={34}
          />
          <Tooltip
            contentStyle={{
              background:   colors.cardBg,
              border:       `1px solid ${colors.border}`,
              borderRadius: 6,
              fontSize:     12,
            }}
            labelStyle={{ color: colors.subtleText }}
            labelFormatter={(v) => `Jour ${v}`}
            itemStyle={{ color: colors.text }}
          />
          {months.map((m) => (
            <Line
              key={m.label}
              type="monotone"
              dataKey={m.label}
              stroke={m.color}
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/charts/CockpitCumulChart.tsx
git commit -m "feat(charts): add CockpitCumulChart (multi-month cumulative km)"
```

---

### Task 7: Wire the dashboard page — 9 blocks in Android order

**Files:**
- Modify: `web/app/dashboard/page.tsx`

Replace the full file. Removes the ATL/CTL `CockpitLineChart` (belongs in Charge tab, not Cockpit). Wires all 9 blocks in order.

- [ ] **Step 1: Replace `web/app/dashboard/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/navigation/AppShell'
import { CockpitChartCard } from '@/components/charts/CockpitChartCard'
import { CockpitLineChart } from '@/components/charts/CockpitLineChart'
import { CockpitComboChart } from '@/components/charts/CockpitComboChart'
import { CockpitCumulChart } from '@/components/charts/CockpitCumulChart'
import { CockpitPieChart, type PieSlice } from '@/components/charts/CockpitPieChart'
import { CockpitKpiTile } from '@/components/ui/CockpitKpiTile'
import { TsbBadge } from '@/components/ui/TsbBadge'
import { CompactMetricCard } from '@/components/ui/CompactMetricCard'
import { WeekTable } from '@/components/ui/WeekTable'
import { GoalsBlock } from '@/components/cockpit/GoalsBlock'
import { HistoryPillsBlock } from '@/components/cockpit/HistoryPillsBlock'
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
    dailyMetrics,
    weekOverview,
    monthlyRunKm,
    weekSessions,
    ytd,
    intensityBreakdown,
    weeklyPoints,
    weekSuffer,
    cumulMonths,
  } = await getDashboardData(user.id)

  const latest = dailyMetrics[dailyMetrics.length - 1] ?? { atl: 0, ctl: 0, tsb: 0, dailyLoad: 0, date: '' }

  // KPI tile bar data
  const weekKmNorm    = normalize(weekOverview.dailyRunKm)
  const weekKmLabels  = weekOverview.dailyRunKm.map((v) => v > 0 ? `${Math.round(v * 10) / 10}` : '')
  const weekDPlusNorm   = normalize(weekOverview.dailyRunDPlus)
  const weekDPlusLabels = weekOverview.dailyRunDPlus.map((v) => v > 0 ? `${Math.round(v)}` : '')
  const monthlyNorm   = normalize(monthlyRunKm)
  const monthlyLabels = monthlyRunKm.map((v) => v > 0 ? `${Math.round(v)}` : '')
  const tsbLast7  = dailyMetrics.slice(-7).map((m) => m.tsb)
  const tsbNorm   = normalizeTsb(tsbLast7)
  const tsbLabels = tsbLast7.map((v) => `${Math.round(v)}`)

  // Run/D+ 10 weeks combo data
  const comboData = weeklyPoints.map((w) => ({ label: w.weekLabel, dPlus: w.dPlus, km: w.km }))

  // Ratio D+/km line data
  const ratioData = weeklyPoints.map((w) => ({
    date:  w.weekLabel,
    ratio: w.km > 0 ? Math.round((w.dPlus / w.km) * 10) / 10 : 0,
  }))

  // HistoryPills — map weeklyPoints to WeekPill shape
  const weekPills = weeklyPoints.map((w) => ({ label: w.weekLabel, km: w.km, dPlus: w.dPlus }))

  // Intensity pie
  const pieData: PieSlice[] = intensityBreakdown.map((s) => ({
    label: s.label,
    value: s.km,
    color: INTENSITY_COLORS[s.label] ?? colors.pieAutre,
  }))

  const tsbColor = latest.tsb >= 0 ? colors.greenOk : colors.runRed

  return (
    <AppShell>
      <div className="px-2 py-2 space-y-2 max-w-lg mx-auto">

        {/* ── 1. Activités ── */}
        <SectionCard>
          <div className="flex items-center justify-between mb-[6px]">
            <div className="flex items-center gap-1">
              <span className="text-[16px] font-semibold text-trail-muted">Activités —</span>
              <span className="text-[16px] font-semibold" style={{ color: colors.chargeOrange }}>Course</span>
              <span className="text-[16px] ml-0.5">🏃</span>
            </div>
            <TsbBadge tsb={latest.tsb} />
          </div>

          <div className="grid grid-cols-2 gap-[6px]">
            <CockpitKpiTile
              title="SEMAINE"
              subline={`${weekOverview.runSessions} séance${weekOverview.runSessions !== 1 ? 's' : ''}`}
              barValues={weekKmNorm} barLabels={weekKmLabels} barColor={colors.chargeOrange}
            >
              <div className="flex items-baseline gap-[3px]">
                <span className="text-[21px] font-black leading-tight text-trail-text">{weekOverview.runKm}</span>
                <span className="text-[14px] text-trail-muted">km</span>
              </div>
            </CockpitKpiTile>

            <CockpitKpiTile
              title="D+ SEMAINE"
              subline="Dénivelé positif"
              barValues={weekDPlusNorm} barLabels={weekDPlusLabels} barColor={colors.seriesBlue}
            >
              <div className="flex items-baseline gap-[3px]">
                <span className="text-[21px] font-black leading-tight text-trail-text">{weekOverview.runDPlus}</span>
                <span className="text-[14px] text-trail-muted">m</span>
              </div>
            </CockpitKpiTile>
          </div>

          <div className="h-[6px]" />

          <div className="grid grid-cols-2 gap-[6px]">
            <CockpitKpiTile
              title="ANNÉE"
              subline={`D+ ${ytd.runDPlus.toLocaleString('fr-FR')} m`}
              barValues={monthlyNorm} barLabels={monthlyLabels} barColor={colors.chargeOrange}
            >
              <div className="flex items-baseline gap-[3px]">
                <span className="text-[18px] font-black leading-tight text-trail-text">{ytd.runKm}</span>
                <span className="text-[14px] text-trail-muted">km</span>
              </div>
            </CockpitKpiTile>

            <CockpitKpiTile
              icon="⚡"
              title="CHARGE (RUN)"
              subline={`TSB ${Math.round(latest.tsb)} • 7 derniers jours`}
              barValues={tsbNorm} barLabels={tsbLabels} barColor={colors.seriesYellow}
            >
              <div className="flex items-center flex-wrap gap-[2px]">
                <span className="text-[13px] font-bold" style={{ color: colors.chargeOrange }}>ATL </span>
                <span className="text-[21px] font-black leading-tight" style={{ color: colors.chargeOrange }}>{Math.round(latest.atl)}</span>
                <span className="text-[13px] text-trail-muted mx-0.5">•</span>
                <span className="text-[13px] font-bold" style={{ color: colors.seriesBlue }}>CTL </span>
                <span className="text-[21px] font-black leading-tight" style={{ color: colors.seriesBlue }}>{Math.round(latest.ctl)}</span>
              </div>
            </CockpitKpiTile>
          </div>
        </SectionCard>

        {/* ── 2. Objectifs (configurable) ── */}
        <GoalsBlock
          weekKm={weekOverview.runKm}
          weekDPlus={weekOverview.runDPlus}
          yearKm={ytd.runKm}
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

        {/* ── 5. Charge d'entraînement ── */}
        <SectionCard title="Charge d'entraînement">
          <div className="grid grid-cols-2 gap-2 mt-1">
            <CompactMetricCard unit="ATL"    value={latest.atl}  description="Fatigue 7j"  color={colors.chargeOrange}  />
            <CompactMetricCard unit="CTL"    value={latest.ctl}  description="Fitness 28j" color={colors.seriesBlue}    />
            <CompactMetricCard unit="TSB"    value={latest.tsb}  description="Forme"        color={tsbColor}             />
            <CompactMetricCard unit="Suffer" value={weekSuffer}  description="Charge sem." color={colors.seriesYellow}  />
          </div>
        </SectionCard>

        {/* ── 6. Historique Running ── */}
        <HistoryPillsBlock
          daySessions={weekSessions.map((s) => ({ label: s.day, volumeKm: s.volumeKm, dPlus: s.dPlus }))}
          weeklyPoints={weekPills}
          monthlyRunKm={monthlyRunKm}
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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Verify build succeeds**

```bash
cd web && node scripts/build.js 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` or routes listed with no errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/dashboard/page.tsx
git commit -m "feat(cockpit): wire 9 blocks in Android-matching order"
```

---

## Self-review

### Spec coverage

| Block requested | Task | ✓ |
|---|---|---|
| Bloc Activité (4 cartes, D+ semaine, année, charge) | Task 7 block 1 | ✅ |
| Bloc Objectif (3 lignes, paramétrable) | Task 4 + Task 7 block 2 | ✅ |
| Bloc Run/D+ sur 10 semaines | Task 1 (weeklyPoints) + Task 3 + Task 7 block 3 | ✅ |
| Bloc Ratio running D+ et km sur 10 semaines | Task 1 (weeklyPoints) + Task 7 block 4 | ✅ |
| Bloc Charge d'entraînement (ATL/CTL/TSB/Suffer) | Task 1 (weekSuffer) + Task 2 + Task 7 block 5 | ✅ |
| Bloc Historic Running | Task 1 (weeklyPoints) + Task 5 + Task 7 block 6 | ✅ |
| Bloc cumul km par mois | Task 1 (cumulMonths) + Task 6 + Task 7 block 7 | ✅ |
| Bloc répartition intensité 30j | Task 7 block 8 (kept) | ✅ |
| Bloc semaine en cours | Task 7 block 9 (kept) | ✅ |

### Type consistency

- `WeeklyPoint.weekLabel` (Task 1) → mapped to `WeekPill.label` in Task 7 via `.map((w) => ({ label: w.weekLabel, ... }))` — ✅ consistent.
- `MonthSeries` defined in Task 1 with `{ label, color, dailyCumul }` → `CockpitCumulChart` uses same field names — ✅ consistent.
- `ComboPoint` defined in Task 3 with `{ label, dPlus, km }` → Task 7 builds `{ label: w.weekLabel, dPlus: w.dPlus, km: w.km }` — ✅ consistent.
- `CompactMetricCard` props in Task 2: `{ unit, value, description, color }` → all 4 present in Task 7 block 5 — ✅ consistent.
- `GoalsBlock` props in Task 4: `{ weekKm, weekDPlus, yearKm }` → passed correctly in Task 7 block 2 — ✅ consistent.
- `HistoryPillsBlock` props: `{ daySessions: DayPill[], weeklyPoints: WeekPill[], monthlyRunKm: number[] }` → all present in Task 7 block 6 — ✅ consistent.
