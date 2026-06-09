// web/components/cockpit/WeeklyStatsBlock.tsx
'use client'

import { useState } from 'react'
import type { SportOverview } from '@/lib/data/dashboard'
import { SPORT_CONFIG, ALL_SPORT_KEYS, type SportKey } from '@/lib/design/sports'
import { sportLabel } from '@/lib/design/sports-i18n'
import { readSportSettings, withDefaultSport } from '@/lib/design/sport-settings'
import { CockpitComboChart, type ComboPoint } from '@/components/charts/CockpitComboChart'
import { CockpitLineChart } from '@/components/charts/CockpitLineChart'
import { SportSettingsModal } from './SportSettingsModal'
import { SportsCarousel } from './SportsCarousel'
import { SportDots } from './SportDots'
import { colors } from '@/lib/design/colors'
import { useT } from '@/lib/i18n/I18nProvider'

type ChartType = 'volume' | 'ratio'
type Settings = { visible: SportKey[]; default: SportKey }
const DEFAULT_SETTINGS: Settings = { visible: ['run', 'ride', 'swim', 'all'], default: 'run' }
const STORAGE_KEY = 'cockpit_weekly_settings'

type Props = { sportOverviews: Record<SportKey, SportOverview>; onHide?: () => void; defaultSport?: SportKey }

export function WeeklyStatsBlock({ sportOverviews, onHide, defaultSport }: Props) {
  const t = useT()
  const L = t.cockpit
  const [settings,   setSettings]   = useState<Settings>(() => readSportSettings(STORAGE_KEY, withDefaultSport(DEFAULT_SETTINGS, defaultSport)))
  const [currentIdx, setCurrentIdx] = useState(() => {
    const s = readSportSettings(STORAGE_KEY, withDefaultSport(DEFAULT_SETTINGS, defaultSport))
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
    { key: 'volume', label: L.chartTabs.vol },
    { key: 'ratio',  label: L.chartTabs.ratio },
  ]

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-[6px]">
        <div className="flex items-center gap-1">
          <span className="text-[15px] font-semibold text-trail-muted font-display">{L.headerWeeklyStats}</span>
          <span className="text-[15px] font-semibold" style={{ color: cfg.color }}>{sportLabel(activeSport, t)}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Chart type tabs */}
          <div className="flex gap-[4px]">
            {chartTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setChartType(tab.key)}
                className="text-micro font-semibold px-[8px] py-[2px] rounded-[6px] transition-colors"
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
            className="text-trail-muted hover:text-trail-text px-1 text-h2 leading-none"
            aria-label={L.aria.weeklySettings}
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
      <SportDots sports={visibleSports} activeIdx={safeIdx} onSelect={setCurrentIdx} />

      {showModal && (
        <SportSettingsModal
          title={L.modalTitle.weekly}
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
