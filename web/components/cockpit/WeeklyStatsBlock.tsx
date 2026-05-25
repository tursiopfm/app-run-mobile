// web/components/cockpit/WeeklyStatsBlock.tsx
'use client'

import { useState } from 'react'
import type { SportOverview } from '@/lib/data/dashboard'
import { SPORT_CONFIG, ALL_SPORT_KEYS, type SportKey } from '@/lib/design/sports'
import { readSportSettings } from '@/lib/design/sport-settings'
import { CockpitComboChart, type ComboPoint } from '@/components/charts/CockpitComboChart'
import { CockpitLineChart } from '@/components/charts/CockpitLineChart'
import { SportSettingsModal } from './SportSettingsModal'
import { SportsCarousel } from './SportsCarousel'
import { colors } from '@/lib/design/colors'

type ChartType = 'volume' | 'ratio'
type Settings = { visible: SportKey[]; default: SportKey }
const DEFAULT_SETTINGS: Settings = { visible: ['run', 'ride', 'swim', 'all'], default: 'run' }
const STORAGE_KEY = 'cockpit_weekly_settings'

type Props = { sportOverviews: Record<SportKey, SportOverview>; onHide?: () => void }

export function WeeklyStatsBlock({ sportOverviews, onHide }: Props) {
  const [settings,   setSettings]   = useState<Settings>(() => readSportSettings(STORAGE_KEY, DEFAULT_SETTINGS))
  const [currentIdx, setCurrentIdx] = useState(() => {
    const s = readSportSettings(STORAGE_KEY, DEFAULT_SETTINGS)
    return Math.max(0, s.visible.indexOf(s.default))
  })
  const [showModal,  setShowModal]  = useState(false)
  const [chartType,  setChartType]  = useState<ChartType>('volume')

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

  const chartTabs: { key: ChartType; label: string }[] = [
    { key: 'volume', label: 'Vol.' },
    { key: 'ratio',  label: 'Ratio' },
  ]

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-[6px]">
        <div className="flex items-center gap-1">
          <span className="text-[15px] font-semibold text-trail-muted">Semaines —</span>
          <span className="text-[15px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Chart type tabs */}
          <div className="flex gap-[4px]">
            {chartTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setChartType(tab.key)}
                className="text-[11px] font-semibold px-[8px] py-[2px] rounded-[6px] transition-colors"
                style={
                  chartType === tab.key
                    ? { backgroundColor: cfg.color, color: '#fff', border: `1px solid ${cfg.color}` }
                    : { backgroundColor: 'transparent', color: colors.subtleText, border: `1px solid ${colors.border}` }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="text-trail-muted hover:text-trail-text px-1 text-[18px] leading-none"
            aria-label="Paramètres volume hebdomadaire"
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

          const comboData: ComboPoint[] = sov.weeklyPoints.map((w) => ({
            label: w.weekLabel,
            dPlus: w.dPlus,
            km:    w.km,
          }))

          const ratioData = sov.weeklyPoints.map((w) => ({
            date:  w.weekLabel,
            ratio: w.km > 0 ? Math.round((w.dPlus / w.km) * 10) / 10 : 0,
          }))

          return {
            key: sportKey,
            node: chartType === 'volume'
              ? <CockpitComboChart data={comboData} height={220} />
              : <CockpitLineChart
                  data={ratioData}
                  series={[{ key: 'ratio', label: 'D+/km', color: colors.seriesGreen }]}
                  xInterval={0}
                  height={220}
                  showLabels
                  labelFormatter={(v) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
                />,
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
          title="Volume hebdomadaire"
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
