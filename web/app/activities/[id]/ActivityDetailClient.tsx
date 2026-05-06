'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ActivityMapPlaceholder } from '@/components/ui/ActivityMap'
import { ActivitySplits } from '@/components/ui/ActivitySplits'
import { ActivityHeartRateZones } from '@/components/ui/ActivityHeartRateZones'
import { EditActivityModal } from '@/components/ui/EditActivityModal'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import { fmtPaceSec, fmtDurationSec } from '@/lib/activities/detail'
import type { StravaSplit } from '@/lib/activities/detail'
import { sportLabel } from '@/lib/design/labels'

// ── Types ──────────────────────────────────────────────────────────────────────

export type ActivityDetail = {
  id: string
  sport_type: string
  manual_sport_type: string | null
  name: string
  start_time: string
  ces: number | null
  manual_intensity: string | null
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

const INTENSITY_EMOJI: Record<string, string> = {
  footing: '🦶', sortie_longue: '🐢', cotes: '⛰️', vma: '🔥',
  seuil: '🎯', runtaf: '🏃‍♂️🏢', velotaf: '🚴🏻🏢', course: '🏁', autre: '❓',
}

const RIDE_TYPES = new Set(['Ride', 'GravelRide', 'VirtualRide', 'EBikeRide', 'MountainBikeRide'])
const RUN_TYPES  = new Set(['Run', 'TrailRun'])

// ── Sub-components ─────────────────────────────────────────────────────────────

function SportBadge({ type }: { type: string }) {
  const color = SPORT_COLORS[type] ?? '#8892a4'
  const label = sportLabel[type] ?? type
  return (
    <span style={{
      background: `${color}2e`, border: `1px solid ${color}66`,
      color, fontSize: 9, fontWeight: 700,
      padding: '2px 8px', borderRadius: 20,
    }}>
      {label}
    </span>
  )
}

function IntensityEmoji({ intensity }: { intensity: string | null }) {
  const emoji = intensity ? (INTENSITY_EMOJI[intensity] ?? '') : ''
  if (!emoji) return null
  return <span style={{ fontSize: 13, lineHeight: 1 }}>{emoji}</span>
}

function EffortBadge({ ces }: { ces: number | null }) {
  if (ces === null) return null
  return (
    <span style={{
      display: 'flex', alignItems: 'center', gap: 3,
      background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.28)',
      padding: '3px 9px', borderRadius: 20,
      fontSize: 10, fontWeight: 800, color: '#ffc107',
    }}>
      ⚡ Effort {Math.round(ces)}
    </span>
  )
}

function StatTile({ label, value, unit, valueStyle }: {
  label: string; value: string; unit: string
  valueStyle?: React.CSSProperties
}) {
  return (
    <div style={{ background: '#181c29', border: '1px solid #232738', borderRadius: 10, padding: '9px 10px 8px' }}>
      <div style={{ fontSize: 8, color: '#8892a4', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1, color: '#e8eaf0', ...valueStyle }}>{value}</div>
      {unit && <div style={{ fontSize: 8, color: '#8892a4' }}>{unit}</div>}
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
  const d = new Date(iso)
  const datePart = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(d)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${datePart} · ${hh}:${mm}`
}

// ── Main component ─────────────────────────────────────────────────────────────

type Tab = 'splits' | 'zones'

export function ActivityDetailClient({
  activity,
  splits,
}: {
  activity: ActivityDetail
  splits: StravaSplit[] | null
}) {
  const router = useRouter()
  const [showEdit, setShowEdit] = useState(false)

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

  const [activeTab, setActiveTab] = useState<Tab>(showSplits ? 'splits' : 'zones')

  // Pace / speed tile
  let paceLabel: string
  let paceValue: string
  let paceUnit: string
  if (RUN_TYPES.has(effectiveSport)) {
    paceLabel = 'Allure'
    paceValue = avgPaceSec > 0 ? fmtPaceSec(avgPaceSec) : '—'
    paceUnit  = '/km'
  } else if (RIDE_TYPES.has(effectiveSport)) {
    paceLabel = 'Vitesse'
    paceValue = dist && movingTime && movingTime > 0
      ? ((dist / 1000) / (movingTime / 3600)).toFixed(1)
      : '—'
    paceUnit = 'km/h'
  } else {
    paceLabel = 'Effort'
    paceValue = a.ces != null ? Math.round(a.ces).toString() : '—'
    paceUnit  = ''
  }

  const activityAsActivityRow = activity as unknown as ActivityRow

  return (
    <div style={{ background: '#0f1219', minHeight: '100vh', color: '#e8eaf0', fontFamily: "-apple-system, 'Inter', sans-serif" }}>

      {/* Map section */}
      <div style={{ position: 'relative', height: 230, overflow: 'hidden' }}>
        {/* Map */}
        <div style={{ width: '100%', height: '100%' }}>
          {polyline ? <DynamicActivityMap encodedPolyline={polyline} /> : <ActivityMapPlaceholder />}
        </div>

        {/* Fade into content */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 70,
          background: 'linear-gradient(to bottom, transparent 0%, #0f1219 100%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Floating buttons — outside map div so z-index is independent */}
      <div style={{ position: 'relative', height: 0, zIndex: 60 }}>
        <button
          onClick={() => router.back()}
          style={{
            position: 'absolute', top: -214, left: 16,
            width: 34, height: 34, borderRadius: '50%',
            background: 'rgba(15,18,25,0.72)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, color: '#ffffff', cursor: 'pointer',
          }}
        >
          ←
        </button>
        <button
          onClick={() => setShowEdit(true)}
          style={{
            position: 'absolute', top: -214, right: 16,
            width: 34, height: 34, borderRadius: '50%',
            background: 'rgba(232,101,26,0.72)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(232,101,26,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, cursor: 'pointer',
          }}
        >
          ✏️
        </button>
      </div>

      {/* Content body — overlaps map slightly, solid bg covers gradient */}
      <div style={{ padding: '0 16px', marginTop: -10, position: 'relative', zIndex: 10, background: '#0f1219' }}>

        {/* Activity header */}
        <div style={{ paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <SportBadge type={effectiveSport} />
              <IntensityEmoji intensity={a.manual_intensity} />
            </div>
            <EffortBadge ces={a.ces} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#f0f2f8', lineHeight: 1.15, marginBottom: 3 }}>
            {a.name}
          </div>
          <div style={{ fontSize: 10, color: '#8892a4' }}>{fmtDetailDate(a.start_time)}</div>
        </div>

        {/* Stats grid 3×2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 16 }}>
          <StatTile label="Distance"   value={fmtDist(dist)}                                 unit="km"   valueStyle={{ color: '#e8651a', fontSize: 20 }} />
          <StatTile label="D+"         value={fmtElev(elev)}                                 unit="m"    valueStyle={{ color: '#4db6f0', fontSize: 20 }} />
          <StatTile label="Durée"      value={fmtDurationSec(movingTime)}                    unit=""     valueStyle={{ color: '#4caf50', fontSize: 17 }} />
          <StatTile label={paceLabel}  value={paceValue}                                     unit={paceUnit} valueStyle={{ color: '#e8eaf0', fontSize: 17 }} />
          <StatTile label="Calories"   value={a.calories != null ? String(a.calories) : '—'} unit="kcal" valueStyle={{ color: '#ff7043', fontSize: 18 }} />
          <StatTile label="Tps écoulé" value={fmtDurationSec(a.duration_sec)}                unit=""     valueStyle={{ color: '#4caf50', fontSize: 16 }} />
        </div>

        {/* Tabs — full width, breaking out of padding */}
        {(showSplits || showZones) && (
          <>
            <div style={{
              display: 'flex',
              borderBottom: '1px solid #1e2230',
              margin: '0 -16px',
              background: '#0f1219',
              position: 'sticky', top: 0, zIndex: 30,
            }}>
              {showSplits && (
                <button
                  onClick={() => setActiveTab('splits')}
                  style={{
                    flex: 1, padding: '9px 0',
                    fontSize: 10, fontWeight: 700, textAlign: 'center',
                    textTransform: 'uppercase', letterSpacing: '0.9px',
                    color: activeTab === 'splits' ? '#e8651a' : '#6b7a96',
                    background: 'none', border: 'none',
                    borderBottom: activeTab === 'splits' ? '2px solid #e8651a' : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  Splits
                </button>
              )}
              {showZones && (
                <button
                  onClick={() => setActiveTab('zones')}
                  style={{
                    flex: 1, padding: '9px 0',
                    fontSize: 10, fontWeight: 700, textAlign: 'center',
                    textTransform: 'uppercase', letterSpacing: '0.9px',
                    color: activeTab === 'zones' ? '#e8651a' : '#6b7a96',
                    background: 'none', border: 'none',
                    borderBottom: activeTab === 'zones' ? '2px solid #e8651a' : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  Zones FC
                </button>
              )}
            </div>

            <div style={{ paddingTop: 12, paddingBottom: 20 }}>
              {activeTab === 'splits' && showSplits && (
                <ActivitySplits splits={splits!} avgPaceSec={avgPaceSec} />
              )}
              {activeTab === 'zones' && showZones && (
                <ActivityHeartRateZones
                  avgHr={a.avg_hr!}
                  maxHr={a.max_hr!}
                  movingTimeSec={a.manual_moving_time_sec ?? a.moving_time_sec ?? 0}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Edit modal */}
      {showEdit && (
        <EditActivityModal
          activity={activityAsActivityRow}
          onSaved={() => { router.refresh(); setShowEdit(false) }}
          onDeleted={() => { router.push('/activities'); setShowEdit(false) }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  )
}
