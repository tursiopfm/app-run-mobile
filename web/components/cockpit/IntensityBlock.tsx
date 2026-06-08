// web/components/cockpit/IntensityBlock.tsx
'use client'

import { useState } from 'react'
import type { SportOverview } from '@/lib/data/dashboard'
import { SPORT_CONFIG, ALL_SPORT_KEYS, type SportKey } from '@/lib/design/sports'
import { sportLabel } from '@/lib/design/sports-i18n'
import { readSportSettings, withDefaultSport } from '@/lib/design/sport-settings'
import { CockpitPieChart, type PieSlice } from '@/components/charts/CockpitPieChart'
import { SportSettingsModal } from './SportSettingsModal'
import { SportsCarousel } from './SportsCarousel'
import { SESSION_TYPE_COLORS, SESSION_TYPE_LABELS } from '@/lib/activities/indicators'
import { TypeIcon, UnknownTypeIcon } from '@/components/activity/indicatorIcons'
import { useT } from '@/lib/i18n/I18nProvider'

type Settings = { visible: SportKey[]; default: SportKey }
const DEFAULT_SETTINGS: Settings = { visible: ['run', 'ride', 'swim', 'all'], default: 'all' }
const STORAGE_KEY = 'cockpit_intensity_settings'

const UNDEFINED_COLOR = '#6B7280'

type Props = { sportOverviews: Record<SportKey, SportOverview>; onHide?: () => void; defaultSport?: SportKey }

export function IntensityBlock({ sportOverviews, onHide, defaultSport }: Props) {
  const t = useT()
  const L = t.cockpit
  const [settings,   setSettings]   = useState<Settings>(() => readSportSettings(STORAGE_KEY, withDefaultSport(DEFAULT_SETTINGS, defaultSport)))
  const [currentIdx, setCurrentIdx] = useState(() => {
    const s = readSportSettings(STORAGE_KEY, withDefaultSport(DEFAULT_SETTINGS, defaultSport))
    return Math.max(0, s.visible.indexOf(s.default))
  })
  const [showModal,  setShowModal]  = useState(false)

  const visibleSports = settings.visible.filter((k) => k in sportOverviews)
  if (visibleSports.length === 0) return null
  const safeIdx = Math.min(currentIdx, visibleSports.length - 1)
  const activeSport = visibleSports[safeIdx]
  const cfg = SPORT_CONFIG[activeSport]

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
      <div className="flex items-center justify-between mb-[6px]">
        <div className="flex items-center gap-1">
          <span className="text-[15px] font-semibold text-trail-muted font-display">{L.headerIntensityBlock}</span>
          <span className="text-[15px] font-semibold" style={{ color: cfg.color }}>{sportLabel(activeSport, t)}</span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="text-trail-muted hover:text-trail-text px-1 text-h2 leading-none"
          aria-label={L.aria.intensitySettings}
        >
          ⋮
        </button>
      </div>

      {/* Carousel */}
      <SportsCarousel
        idx={safeIdx}
        onIdxChange={setCurrentIdx}
        slides={visibleSports.map((sportKey) => {
          const sov = sportOverviews[sportKey]
          const pieData: PieSlice[] = sov.workoutTypeBreakdown.map((s) => ({
            label: s.type === null ? L.intensityUndefined : SESSION_TYPE_LABELS[s.type],
            value: s.km,
            color: s.type === null ? UNDEFINED_COLOR : SESSION_TYPE_COLORS[s.type],
            icon:  s.type === null ? <UnknownTypeIcon size={18} /> : <TypeIcon type={s.type} size={18} />,
          }))

          return {
            key: sportKey,
            node: <CockpitPieChart data={pieData} />,
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
          title={L.modalTitle.intensity}
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
