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

type Props = { sportOverviews: Record<SportKey, SportOverview>; onHide?: () => void }

export function ChargeBlock({ sportOverviews, onHide }: Props) {
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
        <p className="text-[13px] font-semibold text-trail-text">
          Charge d&apos;entraînement —{' '}
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
          title="Charge d'entraînement"
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
