'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { colors } from '@/lib/design/colors'
import {
  asIntensityKey,
  asWorkoutType,
  guessIntensity,
  guessWorkoutType,
  intensityWithWorkoutFloor,
  secondsToHMS,
  hmsToSeconds,
  INTENSITY_OPTIONS,
  WORKOUT_TYPE_OPTIONS,
  SPORT_OPTIONS,
  type IntensityKey,
} from '@/lib/activities/intensity'
import {
  INTENSITY_KEY_TO_LEVEL,
  INTENSITY_LEVEL_COLORS,
  SESSION_TYPE_COLORS,
} from '@/lib/activities/indicators'
import { IntensityGauge, TypeIcon, UnknownTypeIcon } from '@/components/activity/indicatorIcons'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import type { HrZone } from '@/lib/health/hr-zones'
import { useT } from '@/lib/i18n/I18nProvider'
import { formatActivityDateTime } from '@/lib/activities/format-datetime'

function fmtModalDate(iso: string): string {
  return formatActivityDateTime(iso)
}

function si(): React.CSSProperties {
  return { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, outline: 'none' }
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-[12px] border p-4 space-y-3"
      style={{ backgroundColor: colors.cardBg, borderColor: colors.border }}
    >
      <p className="text-[15px] font-bold text-trail-text">{title}</p>
      {children}
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-caption text-trail-muted">{label}</p>
      {children}
    </div>
  )
}

type ChipOption = {
  value: string
  label: string
  icon?: React.ReactNode
  color?: string
}

function ChipRow({
  options,
  selected,
  onSelect,
}: {
  options:  ChipOption[]
  selected: string
  onSelect: (v: string) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {options.map(({ value, label, icon, color }) => {
        const active = selected === value
        const accent = color ?? colors.chargeOrange
        return (
          <button
            key={value}
            onClick={() => onSelect(value)}
            className="rounded-full border text-body-sm font-semibold flex-shrink-0 flex items-center gap-[6px]"
            style={{
              backgroundColor: active ? `${accent}26` : 'transparent',
              borderColor:     active ? accent : colors.border,
              color:           active ? accent : colors.subtleText,
              cursor:          'pointer',
              padding:         icon ? '4px 14px 4px 10px' : '6px 16px',
            }}
          >
            {icon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

type Props = {
  activity:  ActivityRow
  hrZones?:  HrZone[]
  onSaved:   (updated: ActivityRow) => void
  onDeleted: () => void
  onClose:   () => void
}

export function EditActivityModal({ activity: a, hrZones = [], onSaved, onDeleted, onClose }: Props) {
  const t = useT()
  const L = t.activities
  const effectiveSport     = a.manual_sport_type     ?? a.sport_type
  const effectiveDistance  = a.manual_distance_m     ?? a.distance_m
  const effectiveDuration  = a.manual_moving_time_sec ?? a.moving_time_sec
  const effectiveElevation = a.manual_elevation_gain_m ?? a.elevation_gain_m

  const [name,        setName]        = useState(a.name)
  const [distKm,      setDistKm]      = useState(
    effectiveDistance  != null ? (effectiveDistance / 1000).toFixed(1)  : ''
  )
  const [duration,    setDuration]    = useState(
    effectiveDuration  != null ? secondsToHMS(effectiveDuration) : '0:00:00'
  )
  const [elevM,       setElevM]       = useState(
    effectiveElevation != null ? String(Math.round(effectiveElevation)) : ''
  )
  const [sport,       setSport]       = useState(effectiveSport)
  const [intensity,   setIntensity]   = useState<IntensityKey | null>(
    asIntensityKey(a.manual_intensity)
  )
  const [workoutType, setWorkoutType] = useState<string | null>(a.manual_workout_type)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const computedWorkoutType = guessWorkoutType(name, sport)
  const rawComputedIntensity = guessIntensity(a.avg_hr, hrZones, {
    activityMaxHr: a.max_hr,
    movingTimeSec: a.manual_moving_time_sec ?? a.moving_time_sec,
  })
  const computedIntensity = intensityWithWorkoutFloor(
    rawComputedIntensity,
    asWorkoutType(workoutType) ?? computedWorkoutType,
  )
  const displayedIntensity  = intensity ?? computedIntensity
  // 'none' is the explicit "no type" override that disables auto-detection.
  const displayedWorkoutType = workoutType === 'none'
    ? null
    : (workoutType ?? computedWorkoutType)

  function availableWorkoutTypes(s: string) {
    return WORKOUT_TYPE_OPTIONS.filter(o => !o.sports || o.sports.includes(s))
  }

  function handleSportChange(s: string) {
    setSport(s)
    if (workoutType) {
      const opt = WORKOUT_TYPE_OPTIONS.find(o => o.value === workoutType)
      if (opt?.sports && !opt.sports.includes(s)) setWorkoutType(null)
    }
  }

  async function handleSave() {
    const distM   = distKm ? parseFloat(distKm) * 1000 : null
    const timeSec = hmsToSeconds(duration)
    const elev    = elevM  ? parseFloat(elevM)         : null

    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/activities/${a.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name,
          manual_sport_type:       sport,
          manual_intensity:        intensity,
          manual_workout_type:     workoutType,
          manual_distance_m:       distM,
          manual_moving_time_sec:  timeSec,
          manual_elevation_gain_m: elev,
        }),
      })
      if (!res.ok) throw new Error(L.editError)
      onSaved({
        ...a,
        name,
        manual_sport_type:       sport,
        manual_intensity:        intensity,
        manual_workout_type:     workoutType,
        manual_distance_m:       distM,
        manual_moving_time_sec:  timeSec,
        manual_elevation_gain_m: elev,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : L.editErrorUnknown)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/activities/${a.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(json.error ?? L.editErrorDelete)
      }
      const json = await res.json() as { warning?: string }
      if (json.warning) {
        // Affiche le warning puis supprime de l'UI
        setError(json.warning)
        await new Promise(r => setTimeout(r, 3000))
      }
      onDeleted()
    } catch (e) {
      setError(e instanceof Error ? e.message : L.editErrorUnknown)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'rounded-[8px] border px-3 py-[8px] text-body w-full'
  const btnBase  = 'flex-1 py-3 rounded-[12px] text-body font-bold'

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ backgroundColor: colors.background }}>

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ backgroundColor: colors.headerBg, borderColor: colors.border }}
      >
        <button onClick={onClose} className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M5 12L12 19M5 12L12 5"
              stroke={colors.subtleText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-display text-[16px] font-semibold text-trail-text">{L.editTitle}</span>
        </button>
        <span className="text-body-sm text-trail-muted">{fmtModalDate(a.start_time)}</span>
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-3">

        <SectionCard title={L.editSectionActivity}>
          <FieldRow label={L.editFieldTitle}>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className={inputCls}
              style={si()}
            />
          </FieldRow>
        </SectionCard>

        <SectionCard title={L.editSectionMetrics}>
          <FieldRow label={L.editFieldDistance}>
            <input
              type="text"
              inputMode="decimal"
              value={distKm}
              onChange={e => setDistKm(e.target.value)}
              className={inputCls}
              style={si()}
              placeholder="0.0"
            />
          </FieldRow>
          <FieldRow label={L.editFieldDuration}>
            <input
              type="text"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              className={inputCls}
              style={si()}
              placeholder="0:00:00"
            />
          </FieldRow>
          <FieldRow label={L.editFieldElevation}>
            <input
              type="text"
              inputMode="decimal"
              value={elevM}
              onChange={e => setElevM(e.target.value)}
              className={inputCls}
              style={si()}
              placeholder="0"
            />
          </FieldRow>
        </SectionCard>

        <SectionCard title={L.editSectionSport}>
          <ChipRow
            options={SPORT_OPTIONS.map(o => ({
              ...o,
              label: L.sportOptionsLabels[o.value] ?? o.label,
            }))}
            selected={sport}
            onSelect={handleSportChange}
          />
        </SectionCard>

        <SectionCard title={L.editSectionIntensity}>
          <ChipRow
            options={INTENSITY_OPTIONS.map(i => {
              const level = INTENSITY_KEY_TO_LEVEL[i.key]
              return {
                value: i.key,
                label: L.intensityLevelLabels[level],
                icon:  <IntensityGauge level={level} size={20} idSuffix={`mod-int-${i.key}`} />,
                color: INTENSITY_LEVEL_COLORS[level],
              }
            })}
            selected={displayedIntensity ?? ''}
            onSelect={v => setIntensity(v === displayedIntensity ? null : (v as IntensityKey))}
          />
        </SectionCard>

        <SectionCard title={L.editSectionType}>
          <ChipRow
            options={[
              ...availableWorkoutTypes(sport).map(o => ({
                value: o.value,
                label: L.sessionTypeLabels[o.value],
                icon:  <TypeIcon type={o.value} size={20} />,
                color: SESSION_TYPE_COLORS[o.value],
              })),
              {
                value: '__none__',
                label: L.sessionTypeUndefined,
                icon:  <UnknownTypeIcon size={20} />,
                color: '#6B7280',
              },
            ]}
            selected={workoutType === 'none' ? '__none__' : (displayedWorkoutType ?? '__none__')}
            onSelect={v => {
              if (v === '__none__') {
                // Toggle: if already explicitly 'none', go back to auto-detect.
                setWorkoutType(workoutType === 'none' ? null : 'none')
              } else {
                setWorkoutType(v === displayedWorkoutType ? null : v)
              }
            }}
          />
        </SectionCard>

        {/* Erreur */}
        {error && (
          <p className="text-body-sm px-1" style={{ color: '#ef4444' }}>{error}</p>
        )}

        {/* Boutons */}
        <div className="flex gap-2 pb-8 pt-2">
          <button
            onClick={handleDelete}
            disabled={saving}
            className={btnBase}
            style={{
              border:          '1px solid #ef4444',
              color:           '#ef4444',
              backgroundColor: 'transparent',
              cursor:          saving ? 'not-allowed' : 'pointer',
              opacity:         saving ? 0.7 : 1,
            }}
          >
            {L.editButtonDelete}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className={btnBase}
            style={{
              border:          `1px solid ${colors.border}`,
              color:           colors.subtleText,
              backgroundColor: 'transparent',
              cursor:          saving ? 'not-allowed' : 'pointer',
              opacity:         saving ? 0.7 : 1,
            }}
          >
            {L.editButtonCancel}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={btnBase}
            style={{
              border:          `1px solid ${colors.chargeOrange}`,
              color:           colors.chargeOrange,
              backgroundColor: 'transparent',
              cursor:          saving ? 'not-allowed' : 'pointer',
              opacity:         saving ? 0.7 : 1,
            }}
          >
            {saving ? '…' : L.editButtonSave}
          </button>
        </div>

      </div>
    </div>,
    document.body,
  )
}
