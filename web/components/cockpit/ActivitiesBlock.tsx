// web/components/cockpit/ActivitiesBlock.tsx
'use client'

import { useState } from 'react'
import type { SportOverview } from '@/lib/data/dashboard'
import { SPORT_CONFIG, ALL_SPORT_KEYS, type SportKey } from '@/lib/design/sports'
import { sportLabel } from '@/lib/design/sports-i18n'
import { readSportSettings } from '@/lib/design/sport-settings'
import { CockpitKpiTile } from '@/components/ui/CockpitKpiTile'
import { TsbBadge } from '@/components/ui/TsbBadge'
import { FreshnessHelpSheet } from '@/components/ui/FreshnessHelpSheet'
import { SportSettingsModal } from './SportSettingsModal'
import { SportsCarousel } from './SportsCarousel'
import { colors } from '@/lib/design/colors'
import { kpiStatusFreshness } from '@/lib/analytics/charge-kpi-status'
import { useT } from '@/lib/i18n/I18nProvider'

type Settings = { visible: SportKey[]; default: SportKey }
const DEFAULT_SETTINGS: Settings = { visible: ['run', 'ride', 'swim', 'all'], default: 'run' }
const STORAGE_KEY = 'cockpit_activities_settings'

function normalize(arr: number[]): number[] {
  const max = Math.max(...arr, 0.001)
  return arr.map((v) => v / max)
}

// Format compact pour labels D+ mensuels : 12 barres dans une demi-tuile = colonnes
// très étroites, donc on arrondit au millier sans décimale (>=1000 → "2K", "9K").
// Le total précis reste affiché en gros au-dessus.
function formatDPlusLabel(v: number): string {
  if (v <= 0) return ''
  if (v >= 1000) return `${Math.round(v / 1000)}K`
  return `${Math.round(v)}`
}

type Props = { sportOverviews: Record<SportKey, SportOverview>; onHide?: () => void }

export function ActivitiesBlock({ sportOverviews, onHide }: Props) {
  const t = useT()
  const L = t.cockpit
  // Lazy-init depuis LS — pas de flash entre default et préférences user.
  const [settings,    setSettings]    = useState<Settings>(() => readSportSettings(STORAGE_KEY, DEFAULT_SETTINGS))
  const [currentIdx,  setCurrentIdx]  = useState(() => {
    const s = readSportSettings(STORAGE_KEY, DEFAULT_SETTINGS)
    return Math.max(0, s.visible.indexOf(s.default))
  })
  const [showModal,   setShowModal]   = useState(false)
  const [showFreshnessHelp, setShowFreshnessHelp] = useState(false)

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
          <span className="text-[15px] font-semibold text-trail-muted">{L.headerActivities}</span>
          <span className="text-[15px] font-semibold" style={{ color: cfg.color }}>{sportLabel(activeSport, t)}</span>
        </div>
        <div className="flex items-center gap-2">
          <TsbBadge tsb={sportOverviews.all.tsb} onClick={() => setShowFreshnessHelp(true)} />
          <button
            onClick={() => setShowModal(true)}
            className="text-trail-muted hover:text-trail-text px-1 text-[18px] leading-none"
            aria-label={L.aria.activitiesSettings}
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
          const scfg = SPORT_CONFIG[sportKey]
          const sov  = sportOverviews[sportKey]
          const kmNorm   = normalize(sov.dailyKm)
          const kmLabels = sov.dailyKm.map((v) => v > 0 ? `${Math.round(v * 10) / 10}` : '')
          const dpNorm   = normalize(sov.dailyDPlus)
          const dpLabels = sov.dailyDPlus.map((v) => v > 0 ? `${Math.round(v)}` : '')
          const mNorm    = normalize(sov.monthlyKm)
          const mLabels  = sov.monthlyKm.map((v) => v > 0 ? `${Math.round(v)}` : '')
          const mdpNorm  = normalize(sov.monthlyDPlus)
          const mdpLabels = sov.monthlyDPlus.map(formatDPlusLabel)

          return {
            key: sportKey,
            node: (
              <>
                <div className="grid grid-cols-2 gap-[6px]">
                  <CockpitKpiTile
                    title={L.kmWeek}
                    subline={L.sessionsCount(sov.weekSessions)}
                    barValues={kmNorm} barLabels={kmLabels} barColor={scfg.color}
                  >
                    <div className="flex items-baseline gap-[3px]">
                      <span className="text-[21px] font-black leading-none text-trail-text">{sov.weekKm}</span>
                      <span className="text-[14px] text-trail-muted">km</span>
                    </div>
                  </CockpitKpiTile>

                  <CockpitKpiTile
                    title={L.dPlusWeek}
                    subline={L.elevationPositive}
                    barValues={dpNorm} barLabels={dpLabels} barColor={colors.seriesBlue}
                  >
                    <div className="flex items-baseline gap-[3px]">
                      <span className="text-[21px] font-black leading-none text-trail-text">{sov.weekDPlus}</span>
                      <span className="text-[14px] text-trail-muted">m</span>
                    </div>
                  </CockpitKpiTile>
                </div>

                <div className="h-[6px]" />

                <div className="grid grid-cols-2 gap-[6px]">
                  <CockpitKpiTile
                    title={L.kmYear}
                    subline={L.sessionsCount(sov.ytdSessions)}
                    barValues={mNorm} barLabels={mLabels} barColor={scfg.color}
                  >
                    <div className="flex items-baseline gap-[3px]">
                      <span className="text-[18px] font-black leading-none text-trail-text">{sov.ytdKm}</span>
                      <span className="text-[14px] text-trail-muted">km</span>
                    </div>
                  </CockpitKpiTile>

                  <CockpitKpiTile
                    title={L.dPlusYear}
                    subline={L.elevationPositive}
                    barValues={mdpNorm} barLabels={mdpLabels} barColor={colors.seriesBlue}
                  >
                    <div className="flex items-baseline gap-[3px]">
                      <span className="text-[18px] font-black leading-none text-trail-text">{sov.ytdDPlus.toLocaleString('fr-FR')}</span>
                      <span className="text-[14px] text-trail-muted">m</span>
                    </div>
                  </CockpitKpiTile>
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
          title={L.modalTitle.activities}
          allKeys={ALL_SPORT_KEYS}
          visible={settings.visible}
          defaultKey={settings.default}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          onHide={onHide}
        />
      )}
      {showFreshnessHelp && (
        <FreshnessHelpSheet
          currentId={kpiStatusFreshness(Math.round(sportOverviews.all.tsb)).id}
          onClose={() => setShowFreshnessHelp(false)}
        />
      )}
    </div>
  )
}
