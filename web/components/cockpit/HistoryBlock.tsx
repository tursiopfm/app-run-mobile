// web/components/cockpit/HistoryBlock.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import type { SportOverview } from '@/lib/data/dashboard'
import { SPORT_CONFIG, ALL_SPORT_KEYS, type SportKey } from '@/lib/design/sports'
import { SportSettingsModal } from './SportSettingsModal'
import { colors } from '@/lib/design/colors'

type Settings = { visible: SportKey[]; default: SportKey }
const DEFAULT_SETTINGS: Settings = { visible: ['run', 'ride', 'swim', 'all'], default: 'run' }
const STORAGE_KEY = 'cockpit_history_settings'

type Period = 'week' | 'month' | 'year'
const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const DAY_ABBR = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

type Props = {
  sportOverviews: Record<SportKey, SportOverview>
  weeklyPoints: { label: string; km: number; dPlus: number }[]
  onHide?: () => void
}

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

export function HistoryBlock({ sportOverviews, weeklyPoints, onHide }: Props) {
  const [settings,   setSettings]   = useState<Settings>(DEFAULT_SETTINGS)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [showModal,  setShowModal]  = useState(false)
  const [period,     setPeriod]     = useState<Period>('week')
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
      <div className="flex items-center justify-between mb-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-semibold text-trail-muted">Historique —</span>
          <span className="text-[15px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
          <span className="text-[15px] ml-0.5">{cfg.emoji}</span>
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
                {p === 'week' ? 'Sem.' : p === 'month' ? 'Mois' : 'An'}
              </button>
            ))}
          </div>
          {/* ⋮ button */}
          <button
            onClick={() => setShowModal(true)}
            className="text-trail-muted hover:text-trail-text px-1 text-[18px] leading-none"
            aria-label="Paramètres historique"
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

          const pills: { label: string; km: number; dPlus: number }[] = (() => {
            switch (period) {
              case 'week':
                return DAY_ABBR.map((day, i) => ({
                  label: day,
                  km:    sov.dailyKm[i]    ?? 0,
                  dPlus: sov.dailyDPlus[i] ?? 0,
                }))
              case 'month':
                return weeklyPoints.slice(-5).map((w) => ({
                  label: w.label,
                  km:    w.km,
                  dPlus: w.dPlus,
                }))
              case 'year':
                return MONTH_LETTERS.map((letter, i) => ({
                  label: letter,
                  km:    sov.monthlyKm[i]   ?? 0,
                  dPlus: sov.monthlyDPlus[i] ?? 0,
                }))
            }
          })()

          return (
            <div
              key={sportKey}
              style={{ flexShrink: 0, width: '100%', scrollSnapAlign: 'start' }}
            >
              <div
                className="flex gap-[5px]"
                style={{ overflowX: period === 'year' ? 'auto' : 'visible' }}
              >
                {pills.map((pill, i) => (
                  <HistoryPill
                    key={i}
                    label={pill.label}
                    km={pill.km}
                    dPlus={pill.dPlus}
                    flex={period !== 'year'}
                    color={scfg.color}
                  />
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
          title="Historique"
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
