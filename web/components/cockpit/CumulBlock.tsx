// web/components/cockpit/CumulBlock.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import type { SportOverview } from '@/lib/data/dashboard'
import { SPORT_CONFIG, ALL_SPORT_KEYS, type SportKey } from '@/lib/design/sports'
import { colors } from '@/lib/design/colors'
import { CockpitCumulChart } from '@/components/charts/CockpitCumulChart'
import { SportSettingsModal } from './SportSettingsModal'

type Settings = { visible: SportKey[]; default: SportKey }
const DEFAULT_SETTINGS: Settings = { visible: ['run', 'ride', 'swim', 'all'], default: 'run' }
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
          const series = period === 'month' ? sov.cumulMonths : sov.cumulYears

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
