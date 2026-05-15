'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ActivityCard, type ActivityRow } from '@/components/ui/ActivityCard'
import { EditActivityModal } from '@/components/ui/EditActivityModal'
import { SportSettingsModal } from './SportSettingsModal'
import { SPORT_CONFIG, ALL_SPORT_KEYS, type SportKey } from '@/lib/design/sports'
import { calculateHrZones, type HrZone, type HrZoneMethod } from '@/lib/health/hr-zones'
import { colors } from '@/lib/design/colors'

export type AthleteHrProfile = {
  max_hr:               number | null
  resting_hr:           number | null
  aerobic_threshold_hr: number | null
  threshold_hr:         number | null
  birth_year:           number | null
} | null

type Settings = { visible: SportKey[]; default: SportKey }
const DEFAULT_SETTINGS: Settings = { visible: ['run', 'ride', 'swim', 'all'], default: 'run' }
const STORAGE_KEY = 'cockpit_last_activity_settings'

type Props = {
  latestPerSport: Record<SportKey, ActivityRow | null>
  athleteProfile: AthleteHrProfile
  onHide?:        () => void
}

export function LastActivityBlock({ latestPerSport, athleteProfile, onHide }: Props) {
  const router = useRouter()
  const [settings,   setSettings]   = useState<Settings>(DEFAULT_SETTINGS)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [showModal,  setShowModal]  = useState(false)
  const [editing,    setEditing]    = useState<ActivityRow | null>(null)
  const [hrZones,    setHrZones]    = useState<HrZone[]>([])
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

  useEffect(() => {
    if (!athleteProfile) return
    try {
      const method = (localStorage.getItem('tc_hr_zone_method') ?? 'pct_max') as HrZoneMethod
      setHrZones(calculateHrZones({
        method,
        maxHr:              athleteProfile.max_hr,
        restingHr:          athleteProfile.resting_hr,
        aerobicThresholdHr: athleteProfile.aerobic_threshold_hr,
        thresholdHr:        athleteProfile.threshold_hr,
        birthYear:          athleteProfile.birth_year,
      }).zones)
    } catch {}
  }, [athleteProfile])

  const visibleSports = settings.visible.filter((k) => k in latestPerSport)
  if (visibleSports.length === 0) return null
  const safeIdx = Math.min(currentIdx, visibleSports.length - 1)
  const activeSport = visibleSports[safeIdx]
  const cfg = SPORT_CONFIG[activeSport]
  const activeActivity = latestPerSport[activeSport]

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
      <div className="flex items-center justify-between mb-[8px]">
        <div className="flex items-center gap-1">
          <span className="text-[15px] font-semibold text-trail-muted">Dernière activité —</span>
          <span className="text-[15px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {activeActivity && (
            <button
              onClick={() => setEditing(activeActivity)}
              className="text-trail-muted hover:text-trail-text transition-colors p-0.5"
              aria-label="Modifier l'activité"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="text-trail-muted hover:text-trail-text px-1 text-[18px] leading-none"
            aria-label="Paramètres dernière activité"
          >
            ⋮
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
      >
        {visibleSports.map((sportKey) => {
          const act = latestPerSport[sportKey]
          return (
            <div
              key={sportKey}
              style={{ flexShrink: 0, width: '100%', scrollSnapAlign: 'start' }}
            >
              {act ? (
                <ActivityCard
                  activity={act}
                  hrZones={hrZones}
                  embedded
                  onClick={() => router.push(`/activities/${act.id}`)}
                />
              ) : (
                <p className="text-[13px] py-2" style={{ color: colors.subtleText }}>
                  Aucune activité {SPORT_CONFIG[sportKey].label.toLowerCase()}.
                </p>
              )}
            </div>
          )
        })}
      </div>

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
          title="Dernière activité"
          allKeys={ALL_SPORT_KEYS}
          visible={settings.visible}
          defaultKey={settings.default}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          onHide={onHide}
        />
      )}

      {editing && (
        <EditActivityModal
          activity={editing}
          hrZones={hrZones}
          onSaved={() => { setEditing(null); router.refresh() }}
          onDeleted={() => { setEditing(null); router.refresh() }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
