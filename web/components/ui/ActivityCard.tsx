'use client'

import { useState, useEffect } from 'react'
import { colors } from '@/lib/design/colors'
import { useT } from '@/lib/i18n/I18nProvider'
import { formatActivityDateTime } from '@/lib/activities/format-datetime'
import { asIntensityKey, effectiveWorkoutType, guessIntensity } from '@/lib/activities/intensity'
import { INTENSITY_KEY_TO_LEVEL } from '@/lib/activities/indicators'
import type { HrZone } from '@/lib/health/hr-zones'
import { EffortPopup, IntensityPopup, WorkoutTypePopup } from '@/components/ui/ActivityPopups'
import ChargeIndicator from '@/components/activity/ChargeIndicator'
import IntensityIndicator from '@/components/activity/IntensityIndicator'
import TypeIndicator from '@/components/activity/TypeIndicator'

const SPORT_COLORS: Record<string, string> = {
  Run:              colors.chargeOrange,
  TrailRun:         colors.chargeOrange,
  Ride:             colors.seriesGreen,
  GravelRide:       colors.seriesGreen,
  VirtualRide:      colors.seriesGreen,
  EBikeRide:        colors.seriesGreen,
  MountainBikeRide: colors.seriesGreen,
  Swim:             colors.seriesBlue,
  Walk:             colors.seriesGreen,
  Hike:             colors.seriesGreen,
  WeightTraining:   colors.subtleText,
}

function toHex(color: string, opacity: number): string {
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0')
  return `${color}${alpha}`
}

function TypeBadge({ type }: { type: string }) {
  const sportLabel = useT().sportLabel
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
    <div className="rounded-[8px] bg-trail-surface px-[7px] py-[6px] flex-shrink-0">
      <p className="text-[10px] text-trail-muted">{label}</p>
      <div className="flex items-baseline gap-[2px] mt-[1px]">
        <span className="text-[14px] font-bold" style={{ color }}>{value}</span>
        {unit && <span className="text-[10px] text-trail-muted">{unit}</span>}
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
  return formatActivityDateTime(iso)
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

function fourthMetric(
  sport: string,
  distM: number | null,
  timeSec: number | null,
  ces: number | null,
  labels: { pace: string; speed: string; ces: string },
) {
  if (sport === 'Run' || sport === 'TrailRun') {
    return { label: labels.pace, value: fmtPace(distM, timeSec), unit: '/km', color: colors.text }
  }
  if (sport === 'Ride' || sport === 'GravelRide' || sport === 'VirtualRide') {
    return { label: labels.speed, value: fmtSpeed(distM, timeSec), unit: 'km/h', color: colors.text }
  }
  return { label: labels.ces, value: ces != null ? Math.round(ces).toString() : '—', unit: '', color: colors.text }
}

export type ActivityRow = {
  id:                      string
  sport_type:              string
  name:                    string
  start_time:              string
  ces:                     number | null
  avg_hr:                  number | null
  max_hr:                  number | null
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
  embedded = false,
}: {
  activity: ActivityRow
  onEdit?: (a: ActivityRow) => void
  onClick?: () => void
  hrZones?: HrZone[]
  embedded?: boolean
}) {
  const t = useT()
  const A = t.activities
  const [popup, setPopup]     = useState<null | 'effort' | 'intensity' | 'workoutType'>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const effectiveSport     = a.manual_sport_type     ?? a.sport_type
  const effectiveDistance  = a.manual_distance_m     ?? a.distance_m
  const effectiveDuration  = a.manual_moving_time_sec ?? a.moving_time_sec
  const effectiveElevation = a.manual_elevation_gain_m ?? a.elevation_gain_m

  const km    = effectiveDistance  != null ? fmt1(effectiveDistance / 1000)           : '—'
  const dPlus = effectiveElevation != null ? Math.round(effectiveElevation).toString() : '—'
  const dur   = fmtDuration(effectiveDuration)
  const ces   = a.ces != null ? Math.round(a.ces).toString() : '—'
  const fourth = fourthMetric(effectiveSport, effectiveDistance, effectiveDuration, a.ces, {
    pace:  A.paceLabel,
    speed: A.speedLabel,
    ces:   A.cesShortLabel,
  })

  const computedIntensity = mounted
    ? guessIntensity(a.avg_hr, hrZones, {
        activityMaxHr: a.max_hr,
        movingTimeSec: a.manual_moving_time_sec ?? a.moving_time_sec,
      })
    : null
  const intensityKey = asIntensityKey(a.manual_intensity) ?? computedIntensity
  const workoutTypeKey = effectiveWorkoutType(a.manual_workout_type, a.name, effectiveSport)

  return (
    <>
      {popup === 'effort' && (
        <EffortPopup ces={a.ces} onClose={() => setPopup(null)} />
      )}
      {popup === 'intensity' && intensityKey && (
        <IntensityPopup intensityKey={intensityKey} onClose={() => setPopup(null)} />
      )}
      {popup === 'workoutType' && (
        <WorkoutTypePopup workoutTypeKey={workoutTypeKey} onClose={() => setPopup(null)} />
      )}
      <div
        className={embedded ? '' : 'rounded-[12px] bg-trail-card border border-trail-border p-[10px]'}
        style={onClick ? { cursor: 'pointer' } : undefined}
        onClick={onClick}
      >
        <div className="flex items-stretch gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-[6px]">
              <TypeBadge type={effectiveSport} />
              <span suppressHydrationWarning className="text-[13px] text-trail-muted">{fmtDate(a.start_time)}</span>
            </div>
            <p className="text-[15px] font-medium mt-[6px] text-trail-text break-words leading-tight">
              {a.name}
            </p>
            <div className="flex gap-[4px] mt-[4px] overflow-x-auto pb-0.5">
              <MetricTile label={A.distanceLabel}    value={km}    unit="km" color={colors.chargeOrange} />
              <MetricTile label={A.durationLabel}    value={dur}   unit=""   color={colors.seriesGreen}  />
              <MetricTile label={A.dPlusLabel}       value={dPlus} unit="m"  color={colors.seriesBlue}   />
              <MetricTile label={fourth.label} value={fourth.value} unit={fourth.unit} color={fourth.color}      />
            </div>
          </div>

          <div className="flex flex-col flex-shrink-0 relative" style={{ width: 110, justifyContent: 'flex-end' }}>
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); if (onEdit) onEdit(a) }}
                aria-label={A.detailEditAria}
                className="absolute top-0 right-0"
                style={{
                  color:      colors.subtleText,
                  cursor:     'pointer',
                  background: 'none',
                  border:     'none',
                  padding:    '0 2px',
                  fontSize:   '14px',
                  lineHeight: 1,
                  zIndex:     1,
                }}
              >
                ⋮
              </button>
            )}
            <div className="flex flex-col gap-[4px]">
              <ChargeIndicator
                value={a.ces ?? 0}
                onClick={(e) => { e.stopPropagation(); setPopup('effort') }}
              />
              <IntensityIndicator
                level={intensityKey ? INTENSITY_KEY_TO_LEVEL[intensityKey] : null}
                onClick={intensityKey ? (e) => { e.stopPropagation(); setPopup('intensity') } : undefined}
              />
              <TypeIndicator
                type={workoutTypeKey}
                onClick={(e) => { e.stopPropagation(); setPopup('workoutType') }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
