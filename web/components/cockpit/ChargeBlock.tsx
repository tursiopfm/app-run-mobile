// web/components/cockpit/ChargeBlock.tsx
'use client'

import { useState } from 'react'
import type { SportOverview } from '@/lib/data/dashboard'
import { SPORT_CONFIG, ALL_SPORT_KEYS, type SportKey } from '@/lib/design/sports'
import { sportLabel } from '@/lib/design/sports-i18n'
import { readSportSettings, withDefaultSport } from '@/lib/design/sport-settings'
import { CockpitKpiTile } from '@/components/ui/CockpitKpiTile'
import { TsbBadge } from '@/components/ui/TsbBadge'
import { FreshnessHelpSheet } from '@/components/ui/FreshnessHelpSheet'
import { SportSettingsModal } from './SportSettingsModal'
import { SportsCarousel } from './SportsCarousel'
import { BlockHelpSheet } from '@/components/blocks/BlockHelpSheet'
import { colors } from '@/lib/design/colors'
import { useT } from '@/lib/i18n/I18nProvider'
import { kpiStatusFreshness } from '@/lib/analytics/charge-kpi-status'

type Settings = { visible: SportKey[]; default: SportKey }
const DEFAULT_SETTINGS: Settings = { visible: ['all', 'run', 'ride', 'swim'], default: 'all' }
const STORAGE_KEY = 'cockpit_charge_settings'

function normalizeTsb(arr: number[]): number[] {
  const min = Math.min(...arr)
  const max = Math.max(...arr)
  const range = (max - min) || 0.001
  return arr.map((v) => (v - min) / range)
}

type Props = { sportOverviews: Record<SportKey, SportOverview>; onHide?: () => void; defaultSport?: SportKey }

export function ChargeBlock({ sportOverviews, onHide, defaultSport }: Props) {
  const t = useT()
  const L = t.charge
  const C = t.cockpit
  const [settings,   setSettings]   = useState<Settings>(() => readSportSettings(STORAGE_KEY, withDefaultSport(DEFAULT_SETTINGS, defaultSport)))
  const [currentIdx, setCurrentIdx] = useState(() => {
    const s = readSportSettings(STORAGE_KEY, withDefaultSport(DEFAULT_SETTINGS, defaultSport))
    return Math.max(0, s.visible.indexOf(s.default))
  })
  const [showModal,  setShowModal]  = useState(false)
  const [showChargeHelp, setShowChargeHelp] = useState(false)
  const [showFreshnessHelp, setShowFreshnessHelp] = useState(false)

  const visibleSports = settings.visible.filter((k) => k in sportOverviews)
  if (visibleSports.length === 0) return null
  const safeIdx = Math.min(currentIdx, visibleSports.length - 1)
  const activeSport = visibleSports[safeIdx]
  const cfg = SPORT_CONFIG[activeSport]
  const activeSov = sportOverviews[activeSport]

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
          <span className="text-[15px] font-semibold text-trail-muted font-display">{C.headerCharge}</span>
          <span className="text-[15px] font-semibold" style={{ color: cfg.color }}>{sportLabel(activeSport, t)}</span>
        </div>
        <div className="flex items-center gap-2">
          <TsbBadge tsb={activeSov.tsb} onClick={() => setShowFreshnessHelp(true)} />
          <button
            onClick={() => setShowModal(true)}
            className="text-trail-muted hover:text-trail-text px-1 text-h2 leading-none"
            aria-label={C.aria.chargeSettings}
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
          const tsbNorm = normalizeTsb(sov.last7Tsb)
          const tsbLabs = sov.last7Tsb.map((v) => `${Math.round(v)}`)

          return {
            key: sportKey,
            node: (
              <CockpitKpiTile
                title={C.chargeTitle}
                subline={
                  <>
                    <span>{C.tsbFreshness} </span>
                    <span className="font-semibold text-trail-text">{Math.round(sov.tsb)}</span>
                    <span> • {C.lastSevenDays}</span>
                  </>
                }
                barValues={tsbNorm} barLabels={tsbLabs} barColor={colors.seriesYellow}
                headerRight={
                  <button
                    type="button"
                    onClick={() => setShowChargeHelp(true)}
                    aria-label={C.aria.chargeHelp}
                    className="text-trail-muted hover:text-trail-text w-5 h-5 flex items-center justify-center text-caption leading-none"
                  >ⓘ</button>
                }
              >
                <div className="flex items-baseline gap-[2px] flex-nowrap">
                  <span className="text-body-sm text-trail-muted">{C.atl7d} </span>
                  <span className="text-[21px] font-bold font-data tabular-nums leading-none text-trail-text">{Math.round(sov.atl)}</span>
                  <span className="text-body-sm text-trail-muted mx-[3px]">·</span>
                  <span className="text-body-sm text-trail-muted">{C.ctl42d} </span>
                  <span className="text-[21px] font-bold font-data tabular-nums leading-none text-trail-text">{Math.round(sov.ctl)}</span>
                </div>
              </CockpitKpiTile>
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
              aria-label={C.aria.sportN(i + 1)}
              className={`w-[6px] h-[6px] rounded-full transition-colors ${
                i === safeIdx ? 'bg-trail-text' : 'bg-trail-border'
              }`}
            />
          ))}
        </div>
      )}

      {showModal && (
        <SportSettingsModal
          title={C.modalTitle.charge}
          allKeys={ALL_SPORT_KEYS}
          visible={settings.visible}
          defaultKey={settings.default}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          onHide={onHide}
        />
      )}
      {showChargeHelp && (
        <BlockHelpSheet
          title={L.blocks.status}
          body={L.help.status}
          onClose={() => setShowChargeHelp(false)}
        />
      )}
      {showFreshnessHelp && (
        <FreshnessHelpSheet
          currentId={kpiStatusFreshness(Math.round(activeSov.tsb)).id}
          onClose={() => setShowFreshnessHelp(false)}
        />
      )}
    </div>
  )
}
