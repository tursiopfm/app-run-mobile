> **Status: Implémenté** · Date: 2026-05-11 · Code: `web/components/cockpit/CumulBlock.tsx`, `web/components/cockpit/YearRangeSelector.tsx`
> *Snapshot de design — pour l'état actuel, voir le code.*

# Cumul Year-Range Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a slider + preset chip strip below the cumul-km-per-year chart so the user can choose how many recent years are visible, with the value persisted in localStorage.

**Architecture:** A new isolated component `YearRangeSelector` exposes a controlled `value/onChange` API. `CumulBlock` owns the state (extended `Settings` type with `yearWindow`), persists it under the existing `cockpit_cumul_settings` key, and applies `slice(-yearWindow)` to the year series before passing them to the chart and the legend. No changes to `dashboard.ts` or the chart component.

**Tech Stack:** React 18 + Next.js 14 App Router, TypeScript, Tailwind CSS, Jest + React Testing Library.

**Spec:** [`docs/superpowers/specs/2026-05-11-cumul-year-range-selector-design.md`](../specs/2026-05-11-cumul-year-range-selector-design.md)

---

## File Structure

- **Create:** `web/components/cockpit/YearRangeSelector.tsx` — presentational, controlled, no localStorage logic
- **Create:** `web/__tests__/cockpit/YearRangeSelector.test.tsx` — RTL unit tests
- **Modify:** `web/components/cockpit/CumulBlock.tsx` — extend `Settings`, persist `yearWindow`, slice series, render selector conditionally

No changes needed to `dashboard.ts`, `CockpitCumulChart.tsx`, or storage migrations (object spread handles missing key).

---

## Task 1: `YearRangeSelector` component + unit tests

**Files:**
- Create: `web/components/cockpit/YearRangeSelector.tsx`
- Test: `web/__tests__/cockpit/YearRangeSelector.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `web/__tests__/cockpit/YearRangeSelector.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { YearRangeSelector } from '@/components/cockpit/YearRangeSelector'

function setup(partial?: Partial<React.ComponentProps<typeof YearRangeSelector>>) {
  const onChange = jest.fn()
  const utils = render(
    <YearRangeSelector value={5} max={14} onChange={onChange} {...partial} />,
  )
  return { onChange, ...utils }
}

describe('YearRangeSelector', () => {
  it('renders the three numeric presets, the "Tout" preset, and the counter', () => {
    setup()
    expect(screen.getByRole('button', { name: '3A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '10A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tout' })).toBeInTheDocument()
    expect(screen.getByText('5 années')).toBeInTheDocument()
  })

  it('calls onChange with the preset value when a preset is clicked', () => {
    const { onChange } = setup()
    fireEvent.click(screen.getByRole('button', { name: '3A' }))
    expect(onChange).toHaveBeenCalledWith(3)
    fireEvent.click(screen.getByRole('button', { name: '10A' }))
    expect(onChange).toHaveBeenCalledWith(10)
  })

  it('"Tout" sends max', () => {
    const { onChange } = setup({ max: 14 })
    fireEvent.click(screen.getByRole('button', { name: 'Tout' }))
    expect(onChange).toHaveBeenCalledWith(14)
  })

  it('disables presets that exceed max', () => {
    setup({ value: 2, max: 4 })
    expect(screen.getByRole('button', { name: '5A' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '10A' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '3A' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Tout' })).not.toBeDisabled()
  })

  it('emits new value when the slider changes', () => {
    const { onChange } = setup()
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '7' } })
    expect(onChange).toHaveBeenCalledWith(7)
  })

  it('uses singular "année" when value === 1', () => {
    setup({ value: 1, max: 14 })
    expect(screen.getByText('1 année')).toBeInTheDocument()
  })

  it('clamps display when value > max (does not crash)', () => {
    setup({ value: 99, max: 4 })
    expect(screen.getByText('4 années')).toBeInTheDocument()
    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(Number(slider.value)).toBe(4)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx jest __tests__/cockpit/YearRangeSelector.test.tsx`
Expected: FAIL with "Cannot find module '@/components/cockpit/YearRangeSelector'"

- [ ] **Step 3: Write the component**

Create `web/components/cockpit/YearRangeSelector.tsx`:

```tsx
'use client'

import { colors } from '@/lib/design/colors'

const ACCENT = '#38BDF8'
const NUMERIC_PRESETS = [3, 5, 10] as const

type Props = {
  value:    number
  max:      number
  onChange: (n: number) => void
  accent?:  string
}

export function YearRangeSelector({ value, max, onChange, accent = ACCENT }: Props) {
  const safeMax  = Math.max(1, max)
  const clamped  = Math.min(Math.max(1, value), safeMax)
  const filled   = safeMax === 1 ? 100 : ((clamped - 1) / (safeMax - 1)) * 100
  const trackBg  = `linear-gradient(to right, ${accent} 0%, ${accent} ${filled}%, ${colors.border} ${filled}%, ${colors.border} 100%)`

  function pillStyle(active: boolean) {
    return {
      backgroundColor: active ? accent : 'transparent',
      color:           active ? '#fff' : colors.subtleText,
      border:          `1px solid ${active ? accent : colors.border}`,
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-[10px]">
      <div className="flex gap-1">
        {NUMERIC_PRESETS.map((n) => {
          const disabled = n > safeMax
          const active   = !disabled && clamped === n
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onChange(n)}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors disabled:cursor-not-allowed"
              style={{ ...pillStyle(active), opacity: disabled ? 0.4 : 1 }}
            >
              {n}A
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => onChange(safeMax)}
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors"
          style={pillStyle(clamped === safeMax)}
        >
          Tout
        </button>
      </div>

      <div className="flex-1 flex items-center gap-2 min-w-[140px]">
        <input
          type="range"
          min={1}
          max={safeMax}
          step={1}
          value={clamped}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Nombre d'années affichées"
          className="
            flex-1 h-[14px] cursor-pointer appearance-none bg-transparent
            [&::-webkit-slider-runnable-track]:h-[2px]
            [&::-webkit-slider-runnable-track]:rounded-full
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-[14px]
            [&::-webkit-slider-thumb]:h-[14px]
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-white/30
            [&::-webkit-slider-thumb]:-mt-[6px]
            [&::-webkit-slider-thumb]:bg-[var(--thumb-color)]
            [&::-moz-range-track]:h-[2px]
            [&::-moz-range-track]:rounded-full
            [&::-moz-range-thumb]:w-[14px]
            [&::-moz-range-thumb]:h-[14px]
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-white/30
            [&::-moz-range-thumb]:bg-[var(--thumb-color)]
          "
          style={{
            background: trackBg,
            ['--thumb-color' as string]: accent,
          }}
        />
        <span className="text-[11px] text-trail-muted whitespace-nowrap">
          {clamped} {clamped === 1 ? 'année' : 'années'}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx jest __tests__/cockpit/YearRangeSelector.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 5: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: no output (success)

- [ ] **Step 6: Commit**

```bash
git add web/components/cockpit/YearRangeSelector.tsx web/__tests__/cockpit/YearRangeSelector.test.tsx
git commit -m "feat(cockpit): add YearRangeSelector component with presets + slider"
```

---

## Task 2: Wire selector into `CumulBlock`

**Files:**
- Modify: `web/components/cockpit/CumulBlock.tsx`

- [ ] **Step 1: Replace the file with the wired version**

Overwrite `web/components/cockpit/CumulBlock.tsx`:

```tsx
// web/components/cockpit/CumulBlock.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import type { SportOverview } from '@/lib/data/dashboard'
import { SPORT_CONFIG, ALL_SPORT_KEYS, type SportKey } from '@/lib/design/sports'
import { colors } from '@/lib/design/colors'
import { CockpitCumulChart } from '@/components/charts/CockpitCumulChart'
import { SportSettingsModal } from './SportSettingsModal'
import { YearRangeSelector } from './YearRangeSelector'

type Settings = { visible: SportKey[]; default: SportKey; yearWindow: number }
const DEFAULT_SETTINGS: Settings = {
  visible:    ['run', 'ride', 'swim', 'all'],
  default:    'run',
  yearWindow: 5,
}
const STORAGE_KEY = 'cockpit_cumul_settings'

type Period = 'month' | 'year'

type Props = { sportOverviews: Record<SportKey, SportOverview>; onHide?: () => void }

export function CumulBlock({ sportOverviews, onHide }: Props) {
  const [settings,   setSettings]   = useState<Settings>(DEFAULT_SETTINGS)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [showModal,  setShowModal]  = useState(false)
  const [period,     setPeriod]     = useState<Period>('month')
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
    const el = scrollRef.current
    if (el) el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' })
    setCurrentIdx(idx)
  }

  function persist(next: Settings) {
    setSettings(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function handleSave(visible: SportKey[], defaultKey: SportKey) {
    persist({ ...settings, visible, default: defaultKey })
    setShowModal(false)
    const newIdx = Math.max(0, visible.indexOf(defaultKey))
    setCurrentIdx(newIdx)
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) el.scrollLeft = newIdx * el.clientWidth
    })
  }

  function handleYearWindow(n: number) {
    persist({ ...settings, yearWindow: n })
  }

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-[6px]">
        <div className="flex items-center gap-1">
          <span className="text-[16px] font-semibold text-trail-muted">
            Cumul km/{period === 'month' ? 'mois' : 'année'} —
          </span>
          <span className="text-[16px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
          <span className="text-[16px] ml-0.5">{cfg.emoji}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Period tabs */}
          <div className="flex gap-1">
            {(['month', 'year'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors"
                style={{
                  backgroundColor: period === p ? cfg.color : 'transparent',
                  color:           period === p ? '#fff' : colors.subtleText,
                  border:          `1px solid ${period === p ? cfg.color : colors.border}`,
                }}
              >
                {p === 'month' ? 'Mois' : 'Année'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="text-trail-muted hover:text-trail-text px-1 text-[18px] leading-none"
            aria-label="Paramètres cumul km"
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
          const sov = sportOverviews[sportKey]
          const fullSeries = period === 'month' ? sov.cumulMonths : sov.cumulYears
          const series =
            period === 'year'
              ? fullSeries.slice(-Math.max(1, settings.yearWindow))
              : fullSeries

          return (
            <div
              key={sportKey}
              style={{ flexShrink: 0, width: '100%', scrollSnapAlign: 'start' }}
            >
              <CockpitCumulChart months={series} height={220} mode={period} />
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {series.map((m) => (
                  <span key={m.label} className="flex items-center gap-1 text-[11px] text-trail-muted">
                    <span className="inline-block w-3 h-[3px] rounded-full" style={{ backgroundColor: m.color }} />
                    {m.label}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Year-range selector (active sport only, year mode only) */}
      {period === 'year' && sportOverviews[activeSport].cumulYears.length > 1 && (
        <YearRangeSelector
          value={settings.yearWindow}
          max={sportOverviews[activeSport].cumulYears.length}
          onChange={handleYearWindow}
        />
      )}

      {/* Dots */}
      {visibleSports.length > 1 && (
        <div className="flex justify-center gap-[6px] mt-[8px]">
          {visibleSports.map((sportKey, i) => (
            <button
              key={sportKey}
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
          title="Cumul km par mois"
          allKeys={ALL_SPORT_KEYS}
          visible={settings.visible}
          defaultKey={settings.default}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          onHide={onHide}
        />
      )}
    </div>
  )
}
```

Key changes vs. the previous version:
- `Settings` gains `yearWindow: number` (default 5)
- `persist()` helper centralizes the `setState + localStorage.setItem` pair
- `handleSave` uses spread so `yearWindow` is preserved when sports change
- In the carousel render: when `period === 'year'`, the series is sliced to `slice(-yearWindow)` (oldest dropped)
- `<YearRangeSelector>` is rendered **once below the carousel**, sourcing `max` from the currently active sport's `cumulYears.length`. Hidden when `period !== 'year'` or `max <= 1`

- [ ] **Step 2: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: no output (success)

- [ ] **Step 3: Run all existing tests to ensure nothing regressed**

Run: `cd web && npx jest`
Expected: all tests PASS (including the new selector tests)

- [ ] **Step 4: Commit**

```bash
git add web/components/cockpit/CumulBlock.tsx
git commit -m "feat(cockpit): wire YearRangeSelector into Cumul km/année block"
```

---

## Task 3: Browser verification

Per CLAUDE.md: UI changes must be exercised in a real browser before claiming completion.

- [ ] **Step 1: Start the dev server**

Run in background: `cd web && npm run dev`
Wait for `Ready` log line, default URL: `http://localhost:3000`.

- [ ] **Step 2: Open the cockpit page in Chrome**

Navigate to `http://localhost:3000/dashboard` (or whatever the cockpit route is — check `web/app/(main)/dashboard/page.tsx` if unclear). Authenticate if needed.

- [ ] **Step 3: Visual + interaction checklist**

Switch the Cumul block to **Année** mode and verify each:

- Strip is visible below the legend (presets + slider + counter "5 années")
- Chart shows exactly 5 lines (2022 → 2026)
- Click `3A` → chart drops to 3 lines (2024 → 2026), `3A` pill highlighted blue
- Click `10A` → chart shows 10 lines if `maxYears >= 10`, `10A` pill highlighted
- Click `Tout` → chart shows all available years, `Tout` pill highlighted
- Drag slider mid-range → chart updates **live** during drag, counter follows
- Hard reload the page → the last chosen `yearWindow` value is restored
- Switch to **Mois** mode → strip disappears, chart unaffected
- Switch back to **Année** → strip reappears with persisted value
- Swipe carousel to a different sport (e.g., Course → Vélo) → strip moves to the new active slide, value preserved

- [ ] **Step 4: Stop the dev server**

Stop the background dev server.

- [ ] **Step 5: If any issue found, fix in the relevant file and re-run typecheck + tests + browser check**

No commit at this step unless a fix was applied. If a fix was applied:

```bash
git add web/components/cockpit/YearRangeSelector.tsx web/components/cockpit/CumulBlock.tsx
git commit -m "fix(cockpit): <describe the issue>"
```

---

## Task 4: Push to GitHub for Vercel auto-deploy

Per `feedback_deployment.md`: deploys happen via `git push GitHub`, never via `vercel --prod`.

- [ ] **Step 1: Confirm the branch is clean except for our commits**

Run: `git status`
Expected: `nothing to commit, working tree clean` (assuming Task 1 and Task 2 commits are present).

- [ ] **Step 2: Push to master**

Run: `git push origin master`
Expected: Vercel deploys the new commits within ~1 minute.

---

## Self-Review

**1. Spec coverage check:**
- Slider + 4 presets (3A/5A/10A/Tout) → Task 1, component
- Default 5 years → Task 2, `DEFAULT_SETTINGS.yearWindow: 5`
- Persistence via `cockpit_cumul_settings` → Task 2, `persist()` helper
- Hidden in Mois mode → Task 2, conditional render with `period === 'year'`
- Hidden if `maxYears <= 1` → Task 2, `yearMax > 1` guard
- Clamp on out-of-range value → component clamps via `Math.min(Math.max(1, value), safeMax)`
- Live update during drag → native `<input type=range>` fires `onChange` per pixel
- Counter "N années" → component renders, singular handled
- Disabled presets > max → Task 1, `disabled={n > safeMax}`
- Sky-blue accent → `ACCENT = '#38BDF8'` constant
- Colors stay anchored on current year → `dashboard.ts` already does this (offset-based palette), slicing the tail keeps recent colors stable

**2. Placeholder scan:** none — all code shown inline, no TBD/TODO.

**3. Type consistency:** `YearRangeSelector` props (`value/max/onChange`) match the call site in `CumulBlock`. `Settings` type extended consistently, `persist()` and `handleSave`/`handleYearWindow` all use the same shape.

**4. Tested cases:** clamping, singular/plural, disabled, slider event, preset clicks, "Tout" semantics, max-1 edge case — covered by 7 unit tests + manual browser checklist.

---

## Execution Handoff

After all four tasks pass, the deliverable is:
- Two committed code files (`YearRangeSelector.tsx`, `CumulBlock.tsx`) + one test file
- Pushed to `origin/master`
- Vercel auto-deploy triggered

No follow-up work required.
