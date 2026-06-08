'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ActivityCard, type ActivityRow } from '@/components/ui/ActivityCard'
import { EditActivityModal } from '@/components/ui/EditActivityModal'
import { SportSettingsModal } from './SportSettingsModal'
import { SportsCarousel } from './SportsCarousel'
import { SPORT_CONFIG, ALL_SPORT_KEYS, type SportKey } from '@/lib/design/sports'
import { sportLabel } from '@/lib/design/sports-i18n'
import { readSportSettings, withDefaultSport } from '@/lib/design/sport-settings'
import { calculateHrZones, type HrZone, type HrZoneMethod } from '@/lib/health/hr-zones'
import { colors } from '@/lib/design/colors'
import { useT } from '@/lib/i18n/I18nProvider'

export type AthleteHrProfile = {
  max_hr:               number | null
  resting_hr:           number | null
  aerobic_threshold_hr: number | null
  threshold_hr:         number | null
  birth_year:           number | null
  hr_zone_method?:      string | null
  hr_zones_custom?:     { zone: number; min: number | null; max: number | null }[] | null
} | null

type Settings = { visible: SportKey[]; default: SportKey }
const DEFAULT_SETTINGS: Settings = { visible: ['run', 'ride', 'swim', 'all'], default: 'run' }
const STORAGE_KEY = 'cockpit_last_activity_settings'

type Props = {
  latestPerSport: Record<SportKey, ActivityRow | null>
  athleteProfile: AthleteHrProfile
  onHide?:        () => void
  defaultSport?:  SportKey
}

// Calcule les zones FC sync depuis localStorage — réutilisé pour le lazy init.
function computeHrZones(profile: AthleteHrProfile): HrZone[] {
  if (!profile) return []
  try {
    const method = (profile.hr_zone_method
      ?? (typeof window !== 'undefined' ? localStorage.getItem('tc_hr_zone_method') : null)
      ?? 'pct_max') as HrZoneMethod
    return calculateHrZones({
      method,
      maxHr:              profile.max_hr,
      restingHr:          profile.resting_hr,
      aerobicThresholdHr: profile.aerobic_threshold_hr,
      thresholdHr:        profile.threshold_hr,
      birthYear:          profile.birth_year,
      customZones:        profile.hr_zones_custom,
    }).zones
  } catch { return [] }
}

export function LastActivityBlock({ latestPerSport, athleteProfile, onHide, defaultSport }: Props) {
  const router = useRouter()
  const t = useT()
  const L = t.cockpit
  const [settings,   setSettings]   = useState<Settings>(() => readSportSettings(STORAGE_KEY, withDefaultSport(DEFAULT_SETTINGS, defaultSport)))
  const [currentIdx, setCurrentIdx] = useState(() => {
    const s = readSportSettings(STORAGE_KEY, withDefaultSport(DEFAULT_SETTINGS, defaultSport))
    return Math.max(0, s.visible.indexOf(s.default))
  })
  const [showModal,  setShowModal]  = useState(false)
  const [editing,    setEditing]    = useState<ActivityRow | null>(null)
  const [hrZones,    setHrZones]    = useState<HrZone[]>(() => computeHrZones(athleteProfile))

  // Recalcule les zones si le profil change (rare — la page Cockpit reçoit le
  // profile en props server-side, donc stable durant la session).
  useEffect(() => {
    setHrZones(computeHrZones(athleteProfile))
  }, [athleteProfile])

  const visibleSports = settings.visible.filter((k) => k in latestPerSport)
  if (visibleSports.length === 0) return null
  const safeIdx = Math.min(currentIdx, visibleSports.length - 1)
  const activeSport = visibleSports[safeIdx]
  const cfg = SPORT_CONFIG[activeSport]
  const activeActivity = latestPerSport[activeSport]

  function handleSave(visible: SportKey[], defaultKey: SportKey) {
    const next: Settings = { visible, default: defaultKey }
    setSettings(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setShowModal(false)
    setCurrentIdx(Math.max(0, visible.indexOf(defaultKey)))
  }

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      <div className="flex items-center justify-between mb-[8px]">
        <div className="flex items-center gap-1">
          <span className="text-[15px] font-semibold text-trail-muted font-display">{L.headerLastActivity}</span>
          <span className="text-[15px] font-semibold" style={{ color: cfg.color }}>{sportLabel(activeSport, t)}</span>
        </div>
        <div className="flex items-center gap-2">
          {activeActivity && (
            <button
              onClick={() => setEditing(activeActivity)}
              className="text-trail-muted hover:text-trail-text transition-colors p-0.5"
              aria-label={L.aria.lastActivityEdit}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="text-trail-muted hover:text-trail-text px-1 text-h2 leading-none"
            aria-label={L.aria.lastActivitySettings}
          >
            ⋮
          </button>
        </div>
      </div>

      <SportsCarousel
        idx={safeIdx}
        onIdxChange={setCurrentIdx}
        slides={visibleSports.map((sportKey) => {
          const act = latestPerSport[sportKey]
          return {
            key: sportKey,
            node: act ? (
              <ActivityCard
                activity={act}
                hrZones={hrZones}
                embedded
                onClick={() => router.push(`/activities/${act.id}`)}
              />
            ) : (
              <p className="text-body-sm py-2" style={{ color: colors.subtleText }}>
                {L.noActivityFor(sportLabel(sportKey, t))}
              </p>
            ),
          }
        })}
      />

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
          title={L.modalTitle.lastActivity}
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
