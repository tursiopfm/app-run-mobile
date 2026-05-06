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
import { colors } from '@/lib/design/colors'

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

// ── Dynamic import ─────────────────────────────────────────────────────────────

const DynamicActivityMap = dynamic(
  () => import('@/components/ui/ActivityMap').then(m => ({ default: m.ActivityMap })),
  { ssr: false }
)

// ── Constants ──────────────────────────────────────────────────────────────────

const SPORT_COLORS: Record<string, string> = {
  Run:              colors.chargeOrange,
  TrailRun:         colors.chargeOrange,
  Ride:             colors.seriesGreen,
  GravelRide:       colors.seriesGreen,
  VirtualRide:      colors.seriesGreen,
  EBikeRide:        colors.seriesGreen,
  MountainBikeRide: colors.seriesGreen,
  Swim:             colors.pieVma,
  Walk:             colors.seriesGreen,
  Hike:             colors.seriesGreen,
  WeightTraining:   colors.subtleText,
}

const INTENSITY_EMOJI: Record<string, string> = {
  footing:       '🦶',
  sortie_longue: '🐢',
  cotes:         '⛰️',
  vma:           '🔥',
  seuil:         '🎯',
  runtaf:        '🏃‍♂️🏢',
  velotaf:       '🚴🏻🏢',
  course:        '🏁',
  autre:         '❓',
}

const RIDE_TYPES = new Set(['Ride', 'GravelRide', 'VirtualRide', 'EBikeRide', 'MountainBikeRide'])
const RUN_TYPES  = new Set(['Run', 'TrailRun'])

// ── Sub-components ─────────────────────────────────────────────────────────────

function SportBadge({ type }: { type: string }) {
  const color = SPORT_COLORS[type] ?? colors.subtleText
  const label = sportLabel[type] ?? type
  return (
    <span
      className="text-xs font-semibold px-2 py-1 rounded-full border"
      style={{
        color,
        borderColor: color + '59',
        backgroundColor: color + '28',
      }}
    >
      {label}
    </span>
  )
}

function IntensityBadge({ intensity, ces }: { intensity: string | null; ces: number | null }) {
  const emoji = intensity ? (INTENSITY_EMOJI[intensity] ?? '') : ''
  const score = ces != null ? Math.round(ces) : null
  if (!emoji && score === null) return null
  return (
    <span className="text-xs text-gray-400">
      {emoji && <span className="mr-1">{emoji}</span>}
      {score !== null && <span>⚡ Effort {score}</span>}
    </span>
  )
}

function StatTile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl bg-trail-surface px-3 py-2">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-base font-bold text-trail-text mt-0.5">
        {value}
        {unit && <span className="text-[11px] text-gray-400 ml-0.5">{unit}</span>}
      </p>
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
  const dist      = a.manual_distance_m     ?? a.distance_m
  const elev      = a.manual_elevation_gain_m ?? a.elevation_gain_m
  const movingTime = a.manual_moving_time_sec ?? a.moving_time_sec

  const polyline = a.raw_payload?.map?.summary_polyline ?? null

  const avgPaceSec =
    dist && movingTime && dist > 0
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
    paceValue =
      dist && movingTime && movingTime > 0
        ? ((dist / 1000) / (movingTime / 3600)).toFixed(1)
        : '—'
    paceUnit = 'km/h'
  } else {
    paceLabel = 'Effort'
    paceValue = a.ces != null ? Math.round(a.ces).toString() : '—'
    paceUnit  = ''
  }

  // EditActivityModal expects ActivityRow — ActivityDetail is a superset
  const activityAsActivityRow = activity as unknown as ActivityRow

  return (
    <div className="relative flex flex-col min-h-screen bg-trail-bg text-trail-text">
      {/* Map section */}
      <div className="relative" style={{ height: 230 }}>
        <div className="absolute top-4 left-4 z-50">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-black/60 text-white text-lg backdrop-blur-sm"
          >
            ←
          </button>
        </div>
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-black/60 text-white text-lg backdrop-blur-sm"
          >
            ✏️
          </button>
        </div>
        {polyline
          ? <DynamicActivityMap encodedPolyline={polyline} />
          : <ActivityMapPlaceholder />
        }
      </div>

      {/* Content below map */}
      <div className="flex flex-col px-4 py-3 gap-4">
        {/* Sport + Effort header */}
        <div className="flex items-center gap-2 flex-wrap">
          <SportBadge type={effectiveSport} />
          <IntensityBadge intensity={a.manual_intensity} ces={a.ces} />
        </div>

        {/* Name + date */}
        <div>
          <p className="text-lg font-bold text-trail-text">{a.name}</p>
          <p className="text-sm text-gray-400">{fmtDetailDate(a.start_time)}</p>
        </div>

        {/* Stats grid 3×2 */}
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Distance"   value={fmtDist(dist)}                                              unit="km"   />
          <StatTile label="D+"         value={fmtElev(elev)}                                              unit="m"    />
          <StatTile label="Durée"      value={fmtDurationSec(movingTime)}                                 unit=""     />
          <StatTile label={paceLabel}  value={paceValue}                                                  unit={paceUnit} />
          <StatTile label="Cal."       value={a.calories != null ? String(a.calories) : '—'}              unit="kcal" />
          <StatTile label="Tps écoulé" value={fmtDurationSec(a.duration_sec)}                             unit=""     />
        </div>

        {/* Tabs */}
        {(showSplits || showZones) && (
          <>
            <div className="flex border-b border-gray-800">
              {showSplits && (
                <button
                  className={`px-4 py-2 text-sm font-medium ${activeTab === 'splits' ? 'text-trail-text border-b-2 border-orange-500' : 'text-gray-500'}`}
                  onClick={() => setActiveTab('splits')}
                >
                  Splits
                </button>
              )}
              {showZones && (
                <button
                  className={`px-4 py-2 text-sm font-medium ${activeTab === 'zones' ? 'text-trail-text border-b-2 border-orange-500' : 'text-gray-500'}`}
                  onClick={() => setActiveTab('zones')}
                >
                  Zones FC
                </button>
              )}
            </div>

            <div className="pt-2">
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
