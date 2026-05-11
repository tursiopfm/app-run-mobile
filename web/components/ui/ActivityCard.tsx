'use client'

import { useState } from 'react'
import { colors } from '@/lib/design/colors'
import { sportLabel } from '@/lib/design/labels'
import { guessIntensity, type IntensityKey } from '@/lib/activities/intensity'
import type { HrZone } from '@/lib/health/hr-zones'
import { EffortPopup, IntensityPopup } from '@/components/ui/ActivityPopups'
import { Dumbbell } from 'lucide-react'

const INTENSITY_EMOJI: Record<string, string> = {
  recuperation:     '😴',
  footing:          '🦶',
  endurance_active: '🔄',
  seuil:            '🎯',
  vma:              '🔥',
}

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

function toHex(color: string, opacity: number): string {
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0')
  return `${color}${alpha}`
}

function TypeBadge({ type }: { type: string }) {
  const color = SPORT_COLORS[type] ?? colors.subtleText
  const label = sportLabel[type] ?? type
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-[3px] text-[14px] font-semibold leading-none border"
      style={{
        backgroundColor: toHex(color, 0.16),
        borderColor:     toHex(color, 0.35),
        color,
      }}
    >
      {label}
    </span>
  )
}

function MetricTile({ label, value, unit, color }: {
  label: string; value: string; unit: string; color: string
}) {
  return (
    <div className="rounded-[10px] bg-trail-surface px-[10px] py-[8px] flex-shrink-0">
      <p className="text-[11px] text-trail-muted">{label}</p>
      <div className="flex items-baseline gap-[3px] mt-[2px]">
        <span className="text-[17px] font-bold" style={{ color }}>{value}</span>
        {unit && <span className="text-[11px] text-trail-muted">{unit}</span>}
      </div>
    </div>
  )
}

function fmt1(v: number): string {
  return (Math.round(v * 10) / 10).toFixed(1)
}

function fmtDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const h = Math.floor(m / 60)
  const rem = m % 60
  return h > 0 ? `${h}h${String(rem).padStart(2, '0')}` : `${m}min`
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const dd   = String(d.getDate()).padStart(2, '0')
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh   = String(d.getHours()).padStart(2, '0')
  const mn   = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} · ${hh}:${mn}`
}

function fmtPace(distM: number | null, timeSec: number | null): string {
  if (!distM || !timeSec || distM < 1) return '—'
  const paceMin = (timeSec / 60) / (distM / 1000)
  const mins = Math.floor(paceMin)
  const secs = Math.round((paceMin - mins) * 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function fmtSpeed(distM: number | null, timeSec: number | null): string {
  if (!distM || !timeSec) return '—'
  return ((distM / 1000) / (timeSec / 3600)).toFixed(1)
}

function fourthMetric(sport: string, distM: number | null, timeSec: number | null, ces: number | null) {
  if (sport === 'Run' || sport === 'TrailRun') {
    return { label: 'Allure', value: fmtPace(distM, timeSec), unit: '/km', color: colors.text }
  }
  if (sport === 'Ride' || sport === 'GravelRide' || sport === 'VirtualRide') {
    return { label: 'Vitesse', value: fmtSpeed(distM, timeSec), unit: 'km/h', color: colors.text }
  }
  return { label: 'CES', value: ces != null ? Math.round(ces).toString() : '—', unit: '', color: colors.text }
}

export type ActivityRow = {
  id:                      string
  sport_type:              string
  name:                    string
  start_time:              string
  ces:                     number | null
  avg_hr:                  number | null
  distance_m:              number | null
  elevation_gain_m:        number | null
  moving_time_sec:         number | null
  manual_sport_type:       string | null
  manual_intensity:        string | null
  manual_workout_type:     string | null
  manual_distance_m:       number | null
  manual_moving_time_sec:  number | null
  manual_elevation_gain_m: number | null
}

export function ActivityCard({
  activity: a,
  onEdit,
  onClick,
  hrZones = [],
}: {
  activity: ActivityRow
  onEdit?: (a: ActivityRow) => void
  onClick?: () => void
  hrZones?: HrZone[]
}) {
  const [popup, setPopup] = useState<null | 'effort' | 'intensity'>(null)

  const effectiveSport     = a.manual_sport_type     ?? a.sport_type
  const effectiveDistance  = a.manual_distance_m     ?? a.distance_m
  const effectiveDuration  = a.manual_moving_time_sec ?? a.moving_time_sec
  const effectiveElevation = a.manual_elevation_gain_m ?? a.elevation_gain_m

  const km    = effectiveDistance  != null ? fmt1(effectiveDistance / 1000)           : '—'
  const dPlus = effectiveElevation != null ? Math.round(effectiveElevation).toString() : '—'
  const dur   = fmtDuration(effectiveDuration)
  const ces   = a.ces != null ? Math.round(a.ces).toString() : '—'
  const fourth = fourthMetric(effectiveSport, effectiveDistance, effectiveDuration, a.ces)

  const intensityKey = (a.manual_intensity as IntensityKey | null) ?? guessIntensity(a.avg_hr, hrZones)
  const cesVal = a.ces ?? 0
  const effortColor =
    cesVal <= 40  ? '#38bdf8' :
    cesVal <= 80  ? '#4ade80' :
    cesVal <= 130 ? '#fbbf24' :
    cesVal <= 200 ? '#f97316' : '#ef4444'

  return (
    <>
      {popup === 'effort' && (
        <EffortPopup ces={a.ces} onClose={() => setPopup(null)} />
      )}
      {popup === 'intensity' && intensityKey && (
        <IntensityPopup intensityKey={intensityKey} onClose={() => setPopup(null)} />
      )}
      <div
        className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]"
        style={onClick ? { cursor: 'pointer' } : undefined}
        onClick={onClick}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-[6px]">
              <TypeBadge type={effectiveSport} />
              <span className="text-[14px] text-trail-muted">{fmtDate(a.start_time)}</span>
            </div>
            <p className="text-[18px] font-medium truncate mt-[6px] text-trail-text">
              {a.name}
            </p>
            <div className="flex gap-[6px] mt-[4px] overflow-x-auto pb-0.5">
              <MetricTile label="Distance"    value={km}           unit="km"         color={colors.chargeOrange} />
              <MetricTile label="Durée"       value={dur}          unit=""           color={colors.seriesGreen}  />
              <MetricTile label="D+"          value={dPlus}        unit="m"          color={colors.seriesBlue}   />
              <MetricTile label={fourth.label} value={fourth.value} unit={fourth.unit} color={fourth.color}      />
            </div>
          </div>

          <div className="flex flex-col items-end flex-shrink-0 self-stretch relative">
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); if (onEdit) onEdit(a) }}
                aria-label="Modifier l'activité"
                className="absolute top-0 right-0"
                style={{
                  color:      colors.subtleText,
                  cursor:     'pointer',
                  background: 'none',
                  border:     'none',
                  padding:    '2px 4px',
                  fontSize:   '20px',
                  lineHeight: 1,
                }}
              >
                ⋮
              </button>
            )}
            <div className="flex-1 flex flex-col items-end justify-center gap-[14px]">
              <button
                onClick={(e) => { e.stopPropagation(); setPopup('effort') }}
                className="flex items-center justify-center text-[18px] font-bold leading-none"
                style={{ color: effortColor, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Dumbbell size={14} strokeWidth={2.2} />
                {ces}
              </button>
              {intensityKey && (
                <button
                  onClick={(e) => { e.stopPropagation(); setPopup('intensity') }}
                  className="flex items-center justify-center text-[18px] leading-none"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {INTENSITY_EMOJI[intensityKey] ?? '❓'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
