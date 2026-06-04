'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ActivityMapPlaceholder } from '@/components/ui/ActivityMap'
import { ActivitySplits } from '@/components/ui/ActivitySplits'
import { ActivityFractionneSplits } from '@/components/ui/ActivityFractionneSplits'
import { ActivityHeartRateZones } from '@/components/ui/ActivityHeartRateZones'
import { EditActivityModal } from '@/components/ui/EditActivityModal'
import { EffortPopup, IntensityPopup, WorkoutTypePopup } from '@/components/ui/ActivityPopups'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import ChargeIndicator from '@/components/activity/ChargeIndicator'
import IntensityIndicator from '@/components/activity/IntensityIndicator'
import TypeIndicator from '@/components/activity/TypeIndicator'
import { fmtPaceSec, fmtDurationSec } from '@/lib/activities/detail'
import { formatActivityDateTimeLong } from '@/lib/activities/format-datetime'
import type { StravaSplit, StravaLap } from '@/lib/activities/detail'
import { vapPaceSec } from '@/lib/activities/vap'
import { useT } from '@/lib/i18n/I18nProvider'
import {
  asIntensityKey,
  effectiveWorkoutType,
  guessIntensity,
  type IntensityKey,
  type WorkoutType,
} from '@/lib/activities/intensity'
import { INTENSITY_KEY_TO_LEVEL } from '@/lib/activities/indicators'
import { calculateHrZones, type HrZoneMethod } from '@/lib/health/hr-zones'

// ── Types ──────────────────────────────────────────────────────────────────────

export type ActivityDetail = {
  id: string
  sport_type: string
  manual_sport_type: string | null
  name: string
  start_time: string
  ces: number | null
  manual_intensity: string | null
  manual_workout_type: string | null
  distance_m: number | null
  manual_distance_m: number | null
  elevation_gain_m: number | null
  manual_elevation_gain_m: number | null
  moving_time_sec: number | null
  manual_moving_time_sec: number | null
  duration_sec: number | null
  avg_hr: number | null
  max_hr: number | null
  calories: number | null
  raw_payload: {
    map?: { summary_polyline?: string }
    [key: string]: unknown
  } | null
}

// ── Dynamic map import ─────────────────────────────────────────────────────────

const DynamicActivityMap = dynamic(
  () => import('@/components/ui/ActivityMap').then(m => ({ default: m.ActivityMap })),
  { ssr: false }
)

// ── Constants ──────────────────────────────────────────────────────────────────

const SPORT_COLORS: Record<string, string> = {
  Run: '#e8651a', TrailRun: '#e8651a',
  Ride: '#4caf50', GravelRide: '#4caf50', VirtualRide: '#4caf50',
  EBikeRide: '#4caf50', MountainBikeRide: '#4caf50',
  Swim: '#42a5f5',
  Walk: '#4caf50', Hike: '#4caf50',
  WeightTraining: '#8892a4',
}

const RIDE_TYPES = new Set(['Ride', 'GravelRide', 'VirtualRide', 'EBikeRide', 'MountainBikeRide'])
const RUN_TYPES  = new Set(['Run', 'TrailRun'])

// ── Sub-components ─────────────────────────────────────────────────────────────

function SportBadge({ type }: { type: string }) {
  const sportLabel = useT().sportLabel
  const color = SPORT_COLORS[type] ?? '#8892a4'
  const label = sportLabel[type] ?? type
  return (
    <span style={{
      background: `${color}2e`, border: `1px solid ${color}66`,
      color, fontSize: 12, fontWeight: 700,
      padding: '4px 12px', borderRadius: 20,
    }}>
      {label}
    </span>
  )
}

function StatTile({ label, value, unit, valueStyle }: {
  label: string; value: string; unit: string
  valueStyle?: React.CSSProperties
}) {
  return (
    <div style={{ background: 'var(--trail-card)', border: '1px solid var(--trail-border)', borderRadius: 10, padding: '9px 10px 8px' }}>
      <div style={{ fontSize: 11, color: 'var(--trail-muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1, color: 'var(--trail-text)', ...valueStyle }}>{value}</div>
      {unit && <div style={{ fontSize: 11, color: 'var(--trail-muted)' }}>{unit}</div>}
    </div>
  )
}

// ── ActivityStats ──────────────────────────────────────────────────────────────

function StatsSection({ title, tiles }: { title: string; tiles: { label: string; value: string; unit: string }[] }) {
  if (tiles.length === 0) return null
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--trail-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
        {title}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {tiles.map(t => (
          <StatTile key={t.label} label={t.label} value={t.value} unit={t.unit} />
        ))}
      </div>
    </div>
  )
}

function ActivityStats({ activity: a }: { activity: ActivityDetail }) {
  const L = useT().activities
  const raw = (a.raw_payload ?? {}) as Record<string, unknown>

  function rawNum(key: string): number | null {
    const v = raw[key]
    return typeof v === 'number' ? v : null
  }

  const effectiveSport = a.manual_sport_type ?? a.sport_type
  const dist = a.manual_distance_m ?? a.distance_m
  const movingTime = a.manual_moving_time_sec ?? a.moving_time_sec
  const elev = a.manual_elevation_gain_m ?? a.elevation_gain_m

  const isRun  = ['Run', 'TrailRun'].includes(effectiveSport)
  const isRide = ['Ride', 'GravelRide', 'VirtualRide', 'EBikeRide', 'MountainBikeRide'].includes(effectiveSport)
  const avgSpeedKph = dist && movingTime ? (dist / 1000) / (movingTime / 3600) : null
  const maxSpeedRaw = rawNum('max_speed')
  const maxSpeedKph = maxSpeedRaw != null ? maxSpeedRaw * 3.6 : null
  const avgPaceSec  = dist && movingTime && dist > 0 ? Math.round(movingTime / (dist / 1000)) : null
  const maxSpeedPace = maxSpeedRaw && maxSpeedRaw > 0 ? Math.round(1000 / maxSpeedRaw) : null
  const vapSec = isRun ? vapPaceSec(avgPaceSec, dist, elev) : null

  const avgCadence = rawNum('average_cadence')
  const suffer     = rawNum('suffer_score')

  const avgWatts   = rawNum('average_watts')
  const maxWatts   = rawNum('max_watts') ?? rawNum('weighted_average_watts')
  const kilojoules = rawNum('kilojoules')

  const elapsed = rawNum('elapsed_time')

  const perfTiles: { label: string; value: string; unit: string }[] = [
    isRun
      ? { label: L.detailAvgPace, value: avgPaceSec ? fmtPaceSec(avgPaceSec) : '—', unit: '/km' }
      : { label: L.detailAvgSpeed, value: avgSpeedKph ? avgSpeedKph.toFixed(1) : '—', unit: 'km/h' },
    isRun
      ? { label: L.detailMaxPace, value: maxSpeedPace ? fmtPaceSec(maxSpeedPace) : '—', unit: '/km' }
      : { label: L.detailMaxSpeed, value: maxSpeedKph ? maxSpeedKph.toFixed(1) : '—', unit: 'km/h' },
    ...(isRun && vapSec != null ? [{ label: L.detailVap, value: fmtPaceSec(vapSec), unit: '/km' }] : []),
    { label: L.detailAvgCadence, value: avgCadence != null ? Math.round(avgCadence * (isRun ? 2 : 1)).toString() : '—', unit: isRun ? 'pas/min' : 'rpm' },
    ...(isRide && avgWatts != null ? [{ label: L.detailAvgPower, value: Math.round(avgWatts).toString(), unit: 'W' }] : []),
    ...(isRide && maxWatts != null ? [{ label: L.detailMaxPower, value: Math.round(maxWatts).toString(), unit: 'W' }] : []),
    ...(isRide && kilojoules != null ? [{ label: L.detailEnergy, value: Math.round(kilojoules).toString(), unit: 'kJ' }] : []),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <StatsSection title={L.detailCardio} tiles={[
        { label: L.detailHrAvg, value: a.avg_hr != null ? String(a.avg_hr) : '—', unit: 'bpm' },
        { label: L.detailHrMax, value: a.max_hr != null ? String(a.max_hr) : '—', unit: 'bpm' },
        { label: L.detailCalories,   value: a.calories != null ? String(a.calories) : '—', unit: 'kcal' },
        { label: L.detailSufferStrava, value: suffer != null ? Math.round(suffer).toString() : '—', unit: '' },
      ]} />
      <StatsSection title={L.detailPerformance} tiles={perfTiles} />
      <StatsSection title={L.detailTime} tiles={[
        { label: L.detailActiveTime, value: fmtDurationSec(movingTime), unit: '' },
        { label: L.detailTotalTime, value: fmtDurationSec(elapsed ?? a.duration_sec), unit: '' },
      ]} />
    </div>
  )
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtDist(m: number | null): string {
  if (!m) return '—'
  return (m / 1000).toFixed(1)
}

function fmtElev(m: number | null): string {
  if (m == null) return '—'
  return Math.round(m).toString()
}

function fmtDetailDate(iso: string): string {
  return formatActivityDateTimeLong(iso)
}

// ── Main component ─────────────────────────────────────────────────────────────

type Tab = 'splits' | 'fractionne' | 'zones' | 'stats'

type AthleteHrProfile = {
  max_hr?:               number | null
  resting_hr?:           number | null
  aerobic_threshold_hr?: number | null
  threshold_hr?:         number | null
  birth_year?:           number | null
} | null

export function ActivityDetailClient({
  activity,
  splits,
  laps,
  athleteProfile,
}: {
  activity:       ActivityDetail
  splits:         StravaSplit[] | null
  laps:           StravaLap[] | null
  athleteProfile: AthleteHrProfile
}) {
  const router = useRouter()
  const A = useT().activities
  const [showEdit, setShowEdit] = useState(false)
  const [mapExpanded, setMapExpanded] = useState(false)
  const [popup, setPopup] = useState<null | 'effort' | 'intensity' | 'workoutType'>(null)

  const a = activity
  const effectiveSport = a.manual_sport_type ?? a.sport_type
  const dist       = a.manual_distance_m       ?? a.distance_m
  const elev       = a.manual_elevation_gain_m  ?? a.elevation_gain_m
  const movingTime = a.manual_moving_time_sec   ?? a.moving_time_sec

  const polyline = a.raw_payload?.map?.summary_polyline ?? null

  const avgPaceSec = dist && movingTime && dist > 0
    ? Math.round(movingTime / (dist / 1000))
    : 0

  const showSplits = splits !== null && splits.length > 0
  const showZones  = a.avg_hr !== null && a.max_hr !== null
  const showFractionne = laps !== null && laps.length >= 2

  const [activeTab, setActiveTab] = useState<Tab>(
    showSplits ? 'splits' : showFractionne ? 'fractionne' : showZones ? 'zones' : 'stats'
  )

  const hrZones = (() => {
    if (!athleteProfile) return []
    try {
      const method = (typeof window !== 'undefined'
        ? (localStorage.getItem('tc_hr_zone_method') ?? 'pct_max')
        : 'pct_max') as HrZoneMethod
      return calculateHrZones({
        method,
        maxHr:              athleteProfile.max_hr,
        restingHr:          athleteProfile.resting_hr,
        aerobicThresholdHr: athleteProfile.aerobic_threshold_hr,
        thresholdHr:        athleteProfile.threshold_hr,
        birthYear:          athleteProfile.birth_year,
      }).zones
    } catch { return [] }
  })()

  const intensityKey: IntensityKey | null =
    asIntensityKey(a.manual_intensity) ??
    guessIntensity(a.avg_hr, hrZones, {
      activityMaxHr: a.max_hr,
      movingTimeSec: a.manual_moving_time_sec ?? a.moving_time_sec,
      restingHr:     athleteProfile?.resting_hr ?? null,
    })

  const workoutTypeKey: WorkoutType | null =
    effectiveWorkoutType(a.manual_workout_type, a.name, effectiveSport)

  // Pace / speed tile
  let paceLabel: string
  let paceValue: string
  let paceUnit: string
  if (RUN_TYPES.has(effectiveSport)) {
    paceLabel = A.paceLabel
    paceValue = avgPaceSec > 0 ? fmtPaceSec(avgPaceSec) : '—'
    paceUnit  = '/km'
  } else if (RIDE_TYPES.has(effectiveSport)) {
    paceLabel = A.speedLabel
    paceValue = dist && movingTime && movingTime > 0
      ? ((dist / 1000) / (movingTime / 3600)).toFixed(1)
      : '—'
    paceUnit = 'km/h'
  } else {
    paceLabel = A.tileEffort
    paceValue = a.ces != null ? Math.round(a.ces).toString() : '—'
    paceUnit  = ''
  }

  const activityAsActivityRow = activity as unknown as ActivityRow

  return (
    <div style={{ background: 'var(--trail-bg)', minHeight: '100vh', color: 'var(--trail-text)', fontFamily: "-apple-system, 'Inter', sans-serif" }}>

      {/* Map section */}
      <div style={{
        position: 'relative',
        height: mapExpanded ? 'calc(100svh - 80px - env(safe-area-inset-bottom))' : 307,
        transition: 'height 0.3s ease',
        overflow: 'hidden',
        isolation: 'isolate',
      }}>
        <div style={{ width: '100%', height: '100%' }}>
          {polyline ? <DynamicActivityMap encodedPolyline={polyline} expanded={mapExpanded} /> : <ActivityMapPlaceholder />}
        </div>

        {/* Back button */}
        <button
          onClick={() => router.back()}
          style={{
            position: 'absolute', top: 16, left: 16, zIndex: 9999,
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(10,12,20,0.82)', backdropFilter: 'blur(14px)',
            border: '2px solid rgba(255,255,255,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Edit button */}
        <button
          onClick={() => setShowEdit(true)}
          style={{
            position: 'absolute', top: 16, right: 16, zIndex: 9999,
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(232,101,26,0.28)', backdropFilter: 'blur(14px)',
            border: '2px solid rgba(232,101,26,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="rgba(232,101,26,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="rgba(232,101,26,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Map expand handle */}
        <div
          onClick={() => setMapExpanded(!mapExpanded)}
          style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
            zIndex: 9999, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '8px 22px',
            background: 'rgba(10,12,22,0.72)',
            backdropFilter: 'blur(12px)',
            borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.8)' }} />
          <svg width="12" height="7" viewBox="0 0 12 7" fill="none">
            <path
              d={mapExpanded ? "M1 6L6 1L11 6" : "M1 1L6 6L11 1"}
              stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Fade into content */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 50,
          background: 'linear-gradient(to bottom, transparent 0%, var(--trail-bg) 100%)',
          pointerEvents: 'none', zIndex: 1,
        }} />
      </div>

      {/* Content body */}
      <div style={{ padding: '0 16px', marginTop: 0, position: 'relative', zIndex: 20, background: 'var(--trail-bg)' }}>

        {/* Activity header */}
        <div style={{ paddingTop: 14, paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <SportBadge type={effectiveSport} />
            <span style={{ fontSize: 11, color: 'var(--trail-muted)' }}>{fmtDetailDate(a.start_time)}</span>
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--trail-text)', lineHeight: 1.15, marginBottom: 10 }}>
            {a.name}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <ChargeIndicator
              value={a.ces ?? 0}
              onClick={() => setPopup('effort')}
            />
            <IntensityIndicator
              level={intensityKey ? INTENSITY_KEY_TO_LEVEL[intensityKey] : null}
              onClick={intensityKey ? () => setPopup('intensity') : undefined}
            />
            <TypeIndicator
              type={workoutTypeKey}
              onClick={() => setPopup('workoutType')}
            />
          </div>
        </div>

        {/* Stats grid 3×2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 16 }}>
          <StatTile label={A.distanceLabel}        value={fmtDist(dist)}                                 unit="km"   valueStyle={{ color: '#e8651a', fontSize: 20 }} />
          <StatTile label={A.dPlusLabel}           value={fmtElev(elev)}                                 unit="m"    valueStyle={{ color: '#4db6f0', fontSize: 20 }} />
          <StatTile label={A.detailDurationLabel}  value={fmtDurationSec(movingTime)}                    unit=""     valueStyle={{ color: '#4caf50', fontSize: 17 }} />
          <StatTile label={paceLabel}              value={paceValue}                                     unit={paceUnit} valueStyle={{ color: 'var(--trail-text)', fontSize: 17 }} />
          <StatTile label={A.detailCalories}       value={a.calories != null ? String(a.calories) : '—'} unit="kcal" valueStyle={{ color: '#ff7043', fontSize: 18 }} />
          <StatTile label={A.detailElapsedTime}    value={fmtDurationSec(a.duration_sec)}                unit=""     valueStyle={{ color: '#4caf50', fontSize: 16 }} />
        </div>

        {/* Tabs — always shown (STATS tab is always available) */}
        <>
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--trail-border)',
            margin: '0 -16px',
            background: 'var(--trail-bg)',
            position: 'sticky', top: 0, zIndex: 30,
          }}>
            {showSplits && (
              <button
                onClick={() => setActiveTab('splits')}
                style={{
                  flex: 1, padding: '9px 0',
                  fontSize: 14, fontWeight: 700, textAlign: 'center',
                  textTransform: 'uppercase', letterSpacing: '0.9px',
                  color: activeTab === 'splits' ? '#e8651a' : 'var(--trail-muted)',
                  background: 'none', border: 'none',
                  borderBottom: activeTab === 'splits' ? '2px solid #e8651a' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {A.splitsTitle}
              </button>
            )}
            {showFractionne && (
              <button
                onClick={() => setActiveTab('fractionne')}
                style={{
                  flex: 1, padding: '9px 0',
                  fontSize: 14, fontWeight: 700, textAlign: 'center',
                  textTransform: 'uppercase', letterSpacing: '0.9px',
                  color: activeTab === 'fractionne' ? '#e8651a' : 'var(--trail-muted)',
                  background: 'none', border: 'none',
                  borderBottom: activeTab === 'fractionne' ? '2px solid #e8651a' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {A.splitsInterval}
              </button>
            )}
            {showZones && (
              <button
                onClick={() => setActiveTab('zones')}
                style={{
                  flex: 1, padding: '9px 0',
                  fontSize: 14, fontWeight: 700, textAlign: 'center',
                  textTransform: 'uppercase', letterSpacing: '0.9px',
                  color: activeTab === 'zones' ? '#e8651a' : 'var(--trail-muted)',
                  background: 'none', border: 'none',
                  borderBottom: activeTab === 'zones' ? '2px solid #e8651a' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {A.detailHeartRateZones}
              </button>
            )}
            <button
              onClick={() => setActiveTab('stats')}
              style={{
                flex: 1, padding: '9px 0',
                fontSize: 14, fontWeight: 700, textAlign: 'center',
                textTransform: 'uppercase', letterSpacing: '0.9px',
                color: activeTab === 'stats' ? '#e8651a' : 'var(--trail-muted)',
                background: 'none', border: 'none',
                borderBottom: activeTab === 'stats' ? '2px solid #e8651a' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              Stats
            </button>
          </div>

          <div style={{ paddingTop: 12, paddingBottom: 20 }}>
            {activeTab === 'splits' && showSplits && (
              <ActivitySplits splits={splits!} avgPaceSec={avgPaceSec} />
            )}
            {activeTab === 'fractionne' && showFractionne && (
              <ActivityFractionneSplits laps={laps!} />
            )}
            {activeTab === 'zones' && showZones && (
              <ActivityHeartRateZones
                avgHr={a.avg_hr!}
                maxHr={a.max_hr!}
                movingTimeSec={a.manual_moving_time_sec ?? a.moving_time_sec ?? 0}
                athleteProfile={athleteProfile}
              />
            )}
            {activeTab === 'stats' && (
              <ActivityStats activity={a} />
            )}
          </div>
        </>
      </div>

      {/* Edit modal */}
      {showEdit && (
        <EditActivityModal
          activity={activityAsActivityRow}
          hrZones={hrZones}
          onSaved={() => { router.refresh(); setShowEdit(false) }}
          onDeleted={() => { router.push('/activities'); setShowEdit(false) }}
          onClose={() => setShowEdit(false)}
        />
      )}

      {popup === 'effort' && <EffortPopup ces={a.ces} onClose={() => setPopup(null)} />}
      {popup === 'intensity' && <IntensityPopup intensityKey={intensityKey} onClose={() => setPopup(null)} />}
      {popup === 'workoutType' && <WorkoutTypePopup workoutTypeKey={workoutTypeKey} onClose={() => setPopup(null)} />}
    </div>
  )
}
