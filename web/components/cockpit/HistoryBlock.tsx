// web/components/cockpit/HistoryBlock.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import type { SportOverview, DailyHistoryEntry } from '@/lib/data/dashboard'
import { SPORT_CONFIG, ALL_SPORT_KEYS, type SportKey } from '@/lib/design/sports'
import { readSportSettings } from '@/lib/design/sport-settings'
import { SportSettingsModal } from './SportSettingsModal'
import { SportsCarousel } from './SportsCarousel'
import { colors } from '@/lib/design/colors'
import { useT } from '@/lib/i18n/I18nProvider'
import type { Dict } from '@/lib/i18n/dictionaries/fr'

type Settings = { visible: SportKey[]; default: SportKey }
const DEFAULT_SETTINGS: Settings = { visible: ['run', 'ride', 'swim', 'all'], default: 'run' }
const STORAGE_KEY = 'cockpit_history_settings'

type Period = 'week' | 'month' | 'year'
const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const DAY_ABBR = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

type Pill = { label: string; km: number; dPlus: number }
type PeriodView = {
  pills: Pill[]
  periodLabel: string
  hasPrev: boolean
  totalKm: number
  totalDPlus: number
}

function fmtDuration(totalKm: number, totalDPlus: number): string {
  // Same heuristic as WeekBlock: ~6 min/km + ~1 min per 100 m D+
  const estSec = Math.round(totalKm * 360 + totalDPlus * 0.6)
  if (estSec === 0) return '—'
  const h = Math.floor(estSec / 3600)
  const m = Math.floor((estSec % 3600) / 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`
}

function sumPills(pills: Pill[]): { totalKm: number; totalDPlus: number } {
  let km = 0
  let dPlus = 0
  for (const p of pills) {
    km    += p.km
    dPlus += p.dPlus
  }
  return { totalKm: Math.round(km * 10) / 10, totalDPlus: Math.round(dPlus) }
}

type Props = {
  sportOverviews: Record<SportKey, SportOverview>
  onHide?: () => void
}

// ── Date helpers ──────────────────────────────────────────────────────────

function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function ddmm(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function mondayOf(d: Date): Date {
  const out = new Date(d)
  const jsDay = out.getDay()
  const diff = jsDay === 0 ? -6 : 1 - jsDay
  out.setDate(out.getDate() + diff)
  out.setHours(0, 0, 0, 0)
  return out
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

// ── Period views ──────────────────────────────────────────────────────────

function buildWeekView(
  L: Dict['cockpit'],
  daily: Map<string, { km: number; dPlus: number }>,
  offset: number,
  now: Date,
  oldestDate: string | null,
): PeriodView {
  const monday = mondayOf(now)
  monday.setDate(monday.getDate() + offset * 7)
  const sunday = addDays(monday, 6)
  const pills: Pill[] = DAY_ABBR.map((day, i) => {
    const e = daily.get(localDateKey(addDays(monday, i)))
    return { label: day, km: e?.km ?? 0, dPlus: e?.dPlus ?? 0 }
  })
  return {
    pills,
    periodLabel: L.weekPeriodLabel(ddmm(monday), ddmm(sunday)),
    hasPrev:     !!oldestDate && oldestDate < localDateKey(monday),
    ...sumPills(pills),
  }
}

function buildMonthView(
  L: Dict['cockpit'],
  daily: Map<string, { km: number; dPlus: number }>,
  offset: number,
  now: Date,
  oldestDate: string | null,
): PeriodView {
  const monthStart = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  monthStart.setHours(0, 0, 0, 0)

  // First Monday whose week intersects this month: Monday of the week
  // containing the 1st — clipped to within the month if it falls before.
  let weekStart = mondayOf(monthStart)
  if (weekStart < monthStart) weekStart = addDays(weekStart, 7)

  const pills: Pill[] = []
  while (
    weekStart.getFullYear() === monthStart.getFullYear() &&
    weekStart.getMonth()    === monthStart.getMonth()
  ) {
    let km = 0
    let dPlus = 0
    for (let i = 0; i < 7; i++) {
      const e = daily.get(localDateKey(addDays(weekStart, i)))
      if (e) {
        km    += e.km
        dPlus += e.dPlus
      }
    }
    pills.push({
      label: ddmm(weekStart),
      km:    Math.round(km * 10) / 10,
      dPlus: Math.round(dPlus),
    })
    weekStart = addDays(weekStart, 7)
  }

  return {
    pills,
    periodLabel: `${L.monthNames[monthStart.getMonth()]} ${monthStart.getFullYear()}`,
    hasPrev:     !!oldestDate && oldestDate < localDateKey(monthStart),
    ...sumPills(pills),
  }
}

function buildYearView(
  daily: Map<string, { km: number; dPlus: number }>,
  offset: number,
  now: Date,
  oldestDate: string | null,
): PeriodView {
  const year = now.getFullYear() + offset
  const yearStr = String(year)
  const monthKm    = Array<number>(12).fill(0)
  const monthDPlus = Array<number>(12).fill(0)
  daily.forEach((v, date) => {
    if (date.slice(0, 4) === yearStr) {
      const m = parseInt(date.slice(5, 7), 10) - 1
      monthKm[m]    += v.km
      monthDPlus[m] += v.dPlus
    }
  })
  const pills: Pill[] = MONTH_LETTERS.map((letter, i) => ({
    label: letter,
    km:    Math.round(monthKm[i] * 10) / 10,
    dPlus: Math.round(monthDPlus[i]),
  }))
  return {
    pills,
    periodLabel: yearStr,
    hasPrev:     !!oldestDate && oldestDate < `${year}-01-01`,
    ...sumPills(pills),
  }
}

function computeView(
  L: Dict['cockpit'],
  period: Period,
  offset: number,
  dailyHistory: DailyHistoryEntry[],
): PeriodView {
  const map = new Map<string, { km: number; dPlus: number }>()
  for (const e of dailyHistory) map.set(e.date, { km: e.km, dPlus: e.dPlus })
  const oldest = dailyHistory[0]?.date ?? null
  const now = new Date()
  switch (period) {
    case 'week':  return buildWeekView (L, map, offset, now, oldest)
    case 'month': return buildMonthView(L, map, offset, now, oldest)
    case 'year':  return buildYearView (map, offset, now, oldest)
  }
}

// ── HistoryPill ───────────────────────────────────────────────────────────

function HistoryPill({
  label,
  km,
  dPlus,
  flex,
  color,
}: {
  label: string
  km: number
  dPlus: number
  flex: boolean
  color: string
}) {
  return (
    <div
      className="rounded-[8px] bg-trail-surface border border-trail-border px-1.5 py-2 flex flex-col items-center gap-[2px]"
      style={{ flex: flex ? '1' : 'none', minWidth: flex ? 0 : 44 }}
    >
      <span className="text-[11px] font-semibold text-trail-muted leading-none">{label}</span>
      {km > 0 ? (
        <>
          <span className="text-[13px] font-bold leading-tight" style={{ color }}>
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

// ── HistoryBlock ──────────────────────────────────────────────────────────

export function HistoryBlock({ sportOverviews, onHide }: Props) {
  const L = useT().cockpit
  const [settings,   setSettings]   = useState<Settings>(() => readSportSettings(STORAGE_KEY, DEFAULT_SETTINGS))
  const [currentIdx, setCurrentIdx] = useState(() => {
    const s = readSportSettings(STORAGE_KEY, DEFAULT_SETTINGS)
    return Math.max(0, s.visible.indexOf(s.default))
  })
  const [showModal,  setShowModal]  = useState(false)
  const [period,     setPeriod]     = useState<Period>('week')
  const [offset,     setOffset]     = useState(0)

  const visibleSports = settings.visible.filter((k) => k in sportOverviews)
  const safeIdx = Math.min(currentIdx, Math.max(0, visibleSports.length - 1))

  // Reset to current period when the period type or active sport changes
  useEffect(() => { setOffset(0) }, [period, safeIdx])

  // Per-sport derived view (pills, label, hasPrev) for the current offset
  const sportViews = useMemo<Record<string, PeriodView>>(() => {
    const out: Record<string, PeriodView> = {}
    for (const k of visibleSports) {
      out[k] = computeView(L, period, offset, sportOverviews[k].dailyHistory ?? [])
    }
    return out
    // visibleSports membership is captured via its join key
  }, [visibleSports.join(','), period, offset, sportOverviews, L])

  if (visibleSports.length === 0) return null
  const activeSport = visibleSports[safeIdx]
  const cfg = SPORT_CONFIG[activeSport]
  const activeView = sportViews[activeSport]

  function handleSave(visible: SportKey[], defaultKey: SportKey) {
    const next: Settings = { visible, default: defaultKey }
    setSettings(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setShowModal(false)
    setCurrentIdx(Math.max(0, visible.indexOf(defaultKey)))
  }

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-semibold text-trail-muted">{L.headerHistory}</span>
          <span className="text-[15px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Period tabs */}
          <div className="flex gap-1">
            {(['week', 'month', 'year'] as Period[]).map((p) => (
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
                {L.periodShort[p]}
              </button>
            ))}
          </div>
          {/* ⋮ button */}
          <button
            onClick={() => setShowModal(true)}
            className="text-trail-muted hover:text-trail-text px-1 text-[18px] leading-none"
            aria-label={L.aria.historySettings}
          >
            ⋮
          </button>
        </div>
      </div>

      {/* Period navigation */}
      <div className="flex items-center justify-between mb-[8px] px-0.5">
        <button
          onClick={() => activeView.hasPrev && setOffset((o) => o - 1)}
          disabled={!activeView.hasPrev}
          aria-label={L.aria.historyPrev}
          className="w-8 h-8 flex items-center justify-center rounded-full text-trail-text disabled:opacity-25 disabled:cursor-not-allowed hover:bg-trail-surface transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-[12px] font-semibold text-trail-muted tabular-nums">
          {activeView.periodLabel}
        </span>
        <button
          onClick={() => offset < 0 && setOffset((o) => o + 1)}
          disabled={offset >= 0}
          aria-label={L.aria.historyNext}
          className="w-8 h-8 flex items-center justify-center rounded-full text-trail-text disabled:opacity-25 disabled:cursor-not-allowed hover:bg-trail-surface transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Carousel — one panel per sport, computed via sportViews */}
      <SportsCarousel
        idx={safeIdx}
        onIdxChange={setCurrentIdx}
        slides={visibleSports.map((sportKey) => {
          const scfg = SPORT_CONFIG[sportKey]
          const view = sportViews[sportKey]
          const durLabel = fmtDuration(view.totalKm, view.totalDPlus)
          return {
            key: sportKey,
            node: (
              <>
                <div
                  className="flex gap-[5px]"
                  style={{ overflowX: period === 'year' ? 'auto' : 'visible' }}
                >
                  {view.pills.length > 0 ? (
                    view.pills.map((pill, i) => (
                      <HistoryPill
                        key={i}
                        label={pill.label}
                        km={pill.km}
                        dPlus={pill.dPlus}
                        flex={period !== 'year'}
                        color={scfg.color}
                      />
                    ))
                  ) : (
                    <div className="flex-1 text-center text-[12px] text-trail-muted py-3">
                      {L.noData}
                    </div>
                  )}
                </div>

                {/* Summary row — Total / D+ / Durée */}
                <div
                  className="flex justify-around items-center mt-[8px] pt-[8px]"
                  style={{ borderTop: `1px solid ${colors.border}` }}
                >
                  <div className="flex flex-col items-center gap-[1px]">
                    <span style={{ fontSize: 13, fontWeight: 800, color: scfg.color }}>
                      {view.totalKm > 0
                        ? (view.totalKm < 10 ? view.totalKm.toFixed(1) : Math.round(view.totalKm))
                        : '—'}
                      {view.totalKm > 0 && (
                        <span style={{ fontSize: 9, fontWeight: 400, color: colors.subtleText }}> km</span>
                      )}
                    </span>
                    <span style={{ fontSize: 9, color: colors.subtleText }}>{L.totalLabel}</span>
                  </div>
                  <div className="flex flex-col items-center gap-[1px]">
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#4db6f0' }}>
                      {view.totalDPlus > 0 ? `${view.totalDPlus}` : '—'}
                      {view.totalDPlus > 0 && (
                        <span style={{ fontSize: 9, fontWeight: 400, color: colors.subtleText }}> m</span>
                      )}
                    </span>
                    <span style={{ fontSize: 9, color: colors.subtleText }}>{L.dPlusShort}</span>
                  </div>
                  <div className="flex flex-col items-center gap-[1px]">
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#4caf50' }}>{durLabel}</span>
                    <span style={{ fontSize: 9, color: colors.subtleText }}>{L.durationShort}</span>
                  </div>
                </div>
              </>
            ),
          }
        })}
      />

      {/* Dots */}
      {visibleSports.length > 1 && (
        <div className="flex justify-center gap-[6px] mt-[8px]">
          {visibleSports.map((sportKey, i) => (
            <button
              key={sportKey}
              onClick={() => setCurrentIdx(i)}
              aria-label={L.aria.sportN(i + 1)}
              className={`w-[6px] h-[6px] rounded-full transition-colors ${
                i === safeIdx ? 'bg-trail-text' : 'bg-trail-border'
              }`}
            />
          ))}
        </div>
      )}

      {showModal && (
        <SportSettingsModal
          title={L.modalTitle.history}
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
