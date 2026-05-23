// web/components/cockpit/ActivitiesBlock.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import type { SportOverview } from '@/lib/data/dashboard'
import { SPORT_CONFIG, ALL_SPORT_KEYS, type SportKey } from '@/lib/design/sports'
import { CockpitKpiTile } from '@/components/ui/CockpitKpiTile'
import { TsbBadge } from '@/components/ui/TsbBadge'
import { FreshnessHelpSheet } from '@/components/ui/FreshnessHelpSheet'
import { SportSettingsModal } from './SportSettingsModal'
import { BlockHelpSheet } from '@/components/blocks/BlockHelpSheet'
import { colors } from '@/lib/design/colors'
import { charge as L } from '@/lib/design/labels'
import { kpiStatusFreshness } from '@/lib/analytics/charge-kpi-status'

type Settings = { visible: SportKey[]; default: SportKey }
const DEFAULT_SETTINGS: Settings = { visible: ['run', 'ride', 'swim', 'all'], default: 'run' }
const STORAGE_KEY = 'cockpit_activities_settings'

function normalize(arr: number[]): number[] {
  const max = Math.max(...arr, 0.001)
  return arr.map((v) => v / max)
}

function normalizeTsb(arr: number[]): number[] {
  const min = Math.min(...arr)
  const max = Math.max(...arr)
  const range = (max - min) || 0.001
  return arr.map((v) => (v - min) / range)
}

type Props = { sportOverviews: Record<SportKey, SportOverview>; onHide?: () => void }

export function ActivitiesBlock({ sportOverviews, onHide }: Props) {
  const [settings,    setSettings]    = useState<Settings>(DEFAULT_SETTINGS)
  const [currentIdx,  setCurrentIdx]  = useState(0)
  const [showModal,   setShowModal]   = useState(false)
  const [showChargeHelp, setShowChargeHelp] = useState(false)
  const [showFreshnessHelp, setShowFreshnessHelp] = useState(false)
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
          <span className="text-[15px] font-semibold text-trail-muted">Activités —</span>
          <span className="text-[15px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <TsbBadge tsb={sportOverviews.all.tsb} onClick={() => setShowFreshnessHelp(true)} />
          <button
            onClick={() => setShowModal(true)}
            className="text-trail-muted hover:text-trail-text px-1 text-[18px] leading-none"
            aria-label="Paramètres activités"
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
          const all  = sportOverviews.all
          const kmNorm   = normalize(sov.dailyKm)
          const kmLabels = sov.dailyKm.map((v) => v > 0 ? `${Math.round(v * 10) / 10}` : '')
          const dpNorm   = normalize(sov.dailyDPlus)
          const dpLabels = sov.dailyDPlus.map((v) => v > 0 ? `${Math.round(v)}` : '')
          const mNorm    = normalize(sov.monthlyKm)
          const mLabels  = sov.monthlyKm.map((v) => v > 0 ? `${Math.round(v)}` : '')
          const tsbNorm  = normalizeTsb(all.last7Tsb)
          const tsbLabs  = all.last7Tsb.map((v) => `${Math.round(v)}`)

          return (
            <div
              key={sportKey}
              style={{ flexShrink: 0, width: '100%', scrollSnapAlign: 'start' }}
            >
              <div className="grid grid-cols-2 gap-[6px]">
                <CockpitKpiTile
                  title="Km semaine"
                  subline={`${sov.weekSessions} séance${sov.weekSessions !== 1 ? 's' : ''}`}
                  barValues={kmNorm} barLabels={kmLabels} barColor={scfg.color}
                >
                  <div className="flex items-baseline gap-[3px]">
                    <span className="text-[21px] font-black leading-none text-trail-text">{sov.weekKm}</span>
                    <span className="text-[14px] text-trail-muted">km</span>
                  </div>
                </CockpitKpiTile>

                <CockpitKpiTile
                  title="D+ semaine"
                  subline="Dénivelé positif"
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
                  title="Km année"
                  subline={`D+ ${sov.ytdDPlus.toLocaleString('fr-FR')} m`}
                  barValues={mNorm} barLabels={mLabels} barColor={scfg.color}
                >
                  <div className="flex items-baseline gap-[3px]">
                    <span className="text-[18px] font-black leading-none text-trail-text">{sov.ytdKm}</span>
                    <span className="text-[14px] text-trail-muted">km</span>
                  </div>
                </CockpitKpiTile>

                <CockpitKpiTile
                  title="CHARGE"
                  subline={
                    <>
                      <span>TSB (Fraîcheur) </span>
                      <span className="font-semibold text-trail-text">{Math.round(all.tsb)}</span>
                      <span> • 7 derniers jours</span>
                    </>
                  }
                  barValues={tsbNorm} barLabels={tsbLabs} barColor={colors.seriesYellow}
                  headerRight={
                    <button
                      type="button"
                      onClick={() => setShowChargeHelp(true)}
                      aria-label="Aide sur la charge"
                      className="text-trail-muted hover:text-trail-text w-5 h-5 flex items-center justify-center text-[12px] leading-none"
                    >ⓘ</button>
                  }
                >
                  <div className="flex items-baseline gap-[2px] flex-nowrap">
                    <span className="text-[13px] text-trail-muted">ATL (7j) </span>
                    <span className="text-[21px] font-black leading-none text-trail-text">{Math.round(all.atl)}</span>
                    <span className="text-[13px] text-trail-muted mx-[3px]">·</span>
                    <span className="text-[13px] text-trail-muted">CTL (42j) </span>
                    <span className="text-[21px] font-black leading-none text-trail-text">{Math.round(all.ctl)}</span>
                  </div>
                </CockpitKpiTile>
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
          title="Volume d'activités"
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
          currentId={kpiStatusFreshness(Math.round(sportOverviews.all.tsb)).id}
          onClose={() => setShowFreshnessHelp(false)}
        />
      )}
    </div>
  )
}
