// web/components/cockpit/CumulBlock.tsx
'use client'

import { useState } from 'react'
import type { SportOverview } from '@/lib/data/dashboard'
import { SPORT_CONFIG, ALL_SPORT_KEYS, type SportKey } from '@/lib/design/sports'
import { sportLabel } from '@/lib/design/sports-i18n'
import { readSportSettings } from '@/lib/design/sport-settings'
import { colors } from '@/lib/design/colors'
import { CockpitCumulChart } from '@/components/charts/CockpitCumulChart'
import { SportSettingsModal } from './SportSettingsModal'
import { SportsCarousel } from './SportsCarousel'
import { YearRangeSelector } from './YearRangeSelector'
import { useT } from '@/lib/i18n/I18nProvider'

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
  const t = useT()
  const L = t.cockpit
  const [settings,   setSettings]   = useState<Settings>(() => readSportSettings(STORAGE_KEY, DEFAULT_SETTINGS))
  const [currentIdx, setCurrentIdx] = useState(() => {
    const s = readSportSettings(STORAGE_KEY, DEFAULT_SETTINGS)
    return Math.max(0, s.visible.indexOf(s.default))
  })
  const [showModal,  setShowModal]  = useState(false)
  const [period,     setPeriod]     = useState<Period>('month')

  const visibleSports = settings.visible.filter((k) => k in sportOverviews)
  if (visibleSports.length === 0) return null
  const safeIdx = Math.min(currentIdx, visibleSports.length - 1)
  const activeSport = visibleSports[safeIdx]
  const cfg = SPORT_CONFIG[activeSport]

  function persist(next: Settings) {
    setSettings(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function handleSave(visible: SportKey[], defaultKey: SportKey) {
    persist({ ...settings, visible, default: defaultKey })
    setShowModal(false)
    setCurrentIdx(Math.max(0, visible.indexOf(defaultKey)))
  }

  function handleYearWindow(n: number) {
    persist({ ...settings, yearWindow: n })
  }

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-[6px]">
        <div className="flex items-center gap-1">
          <span className="text-[15px] font-semibold text-trail-muted">
            {L.cumulHeader(period)}
          </span>
          <span className="text-[15px] font-semibold" style={{ color: cfg.color }}>{sportLabel(activeSport, t)}</span>
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
                {L.periodLong[p]}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="text-trail-muted hover:text-trail-text px-1 text-[18px] leading-none"
            aria-label={L.aria.cumulSettings}
          >
            ⋮
          </button>
        </div>
      </div>

      {/* Carousel */}
      <SportsCarousel
        idx={safeIdx}
        onIdxChange={setCurrentIdx}
        slides={visibleSports.map((sportKey) => {
          const sov = sportOverviews[sportKey]
          const fullSeries = period === 'month' ? sov.cumulMonths : sov.cumulYears
          const series =
            period === 'year'
              ? fullSeries.slice(-Math.max(1, settings.yearWindow))
              : fullSeries

          return {
            key: sportKey,
            node: (
              <>
                <CockpitCumulChart months={series} height={220} mode={period} />
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                  {series.map((m) => (
                    <span key={m.label} className="flex items-center gap-1 text-[11px] text-trail-muted">
                      <span className="inline-block w-3 h-[3px] rounded-full" style={{ backgroundColor: m.color }} />
                      {m.label}
                    </span>
                  ))}
                </div>
              </>
            ),
          }
        })}
      />

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
          title={L.modalTitle.cumul}
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
