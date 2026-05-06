'use client'

import { useState } from 'react'
import { colors } from '@/lib/design/colors'
import {
  guessIntensity,
  secondsToHMS,
  hmsToSeconds,
  INTENSITY_OPTIONS,
  SPORT_OPTIONS,
  type IntensityKey,
} from '@/lib/activities/intensity'
import type { ActivityRow } from '@/components/ui/ActivityCard'

function fmtModalDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mn = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()} · ${hh}:${mn}`
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
      <p className="text-[12px] text-trail-muted">{label}</p>
      {children}
    </div>
  )
}

function ChipRow({
  options,
  selected,
  onSelect,
}: {
  options:  { value: string; label: string }[]
  selected: string
  onSelect: (v: string) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {options.map(({ value, label }) => {
        const active = selected === value
        return (
          <button
            key={value}
            onClick={() => onSelect(value)}
            className="rounded-full px-4 py-[6px] border text-[13px] font-semibold flex-shrink-0"
            style={{
              backgroundColor: active ? `${colors.chargeOrange}26` : 'transparent',
              borderColor:     active ? colors.chargeOrange : colors.border,
              color:           active ? colors.chargeOrange : colors.subtleText,
              cursor:          'pointer',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

type Props = {
  activity:  ActivityRow
  onSaved:   (updated: ActivityRow) => void
  onDeleted: () => void
  onClose:   () => void
}

export function EditActivityModal({ activity: a, onSaved, onDeleted, onClose }: Props) {
  const effectiveSport     = a.manual_sport_type     ?? a.sport_type
  const effectiveDistance  = a.manual_distance_m     ?? a.distance_m
  const effectiveDuration  = a.manual_moving_time_sec ?? a.moving_time_sec
  const effectiveElevation = a.manual_elevation_gain_m ?? a.elevation_gain_m

  const [name,      setName]      = useState(a.name)
  const [distKm,    setDistKm]    = useState(
    effectiveDistance  != null ? (effectiveDistance / 1000).toFixed(1)  : ''
  )
  const [duration,  setDuration]  = useState(
    effectiveDuration  != null ? secondsToHMS(effectiveDuration) : '0:00:00'
  )
  const [elevM,     setElevM]     = useState(
    effectiveElevation != null ? String(Math.round(effectiveElevation)) : ''
  )
  const [sport,     setSport]     = useState(effectiveSport)
  const [intensity, setIntensity] = useState<IntensityKey>(
    (a.manual_intensity as IntensityKey | null) ?? guessIntensity(a.name, a.ces, effectiveSport)
  )

  function availableIntensities(s: string) {
    return INTENSITY_OPTIONS.filter(({ key }) => {
      if (key === 'runtaf')  return s === 'Run'
      if (key === 'velotaf') return s === 'Ride' || s === 'EBikeRide'
      return true
    })
  }

  function handleSportChange(s: string) {
    setSport(s)
    const available = availableIntensities(s).map(i => i.key)
    if (!available.includes(intensity)) setIntensity('autre')
  }
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

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
          manual_distance_m:       distM,
          manual_moving_time_sec:  timeSec,
          manual_elevation_gain_m: elev,
        }),
      })
      if (!res.ok) throw new Error('Erreur lors de la sauvegarde')
      onSaved({
        ...a,
        name,
        manual_sport_type:       sport,
        manual_intensity:        intensity,
        manual_distance_m:       distM,
        manual_moving_time_sec:  timeSec,
        manual_elevation_gain_m: elev,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/activities/${a.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erreur lors de la suppression')
      onDeleted()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'rounded-[8px] border px-3 py-[8px] text-[14px] w-full'
  const btnBase  = 'flex-1 py-3 rounded-[12px] text-[14px] font-bold'

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: colors.background }}>

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
          <span className="text-[16px] font-semibold text-trail-text">Modifier l&apos;activité</span>
        </button>
        <span className="text-[13px] text-trail-muted">{fmtModalDate(a.start_time)}</span>
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-3">

        {/* Activité */}
        <SectionCard title="Activité">
          <FieldRow label="Titre">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className={inputCls}
              style={si()}
            />
          </FieldRow>
        </SectionCard>

        {/* Métriques */}
        <SectionCard title="Métriques">
          <FieldRow label="Distance (km)">
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
          <FieldRow label="Durée (hh:mm:ss)">
            <input
              type="text"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              className={inputCls}
              style={si()}
              placeholder="0:00:00"
            />
          </FieldRow>
          <FieldRow label="Dénivelé positif (m)">
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

        {/* Sport */}
        <SectionCard title="Sport">
          <ChipRow
            options={SPORT_OPTIONS}
            selected={sport}
            onSelect={handleSportChange}
          />
        </SectionCard>

        {/* Intensité */}
        <SectionCard title="Intensité">
          <ChipRow
            options={availableIntensities(sport).map(i => ({ value: i.key, label: i.label }))}
            selected={intensity}
            onSelect={v => setIntensity(v as IntensityKey)}
          />
        </SectionCard>

        {/* Erreur */}
        {error && (
          <p className="text-[13px] px-1" style={{ color: '#ef4444' }}>{error}</p>
        )}

      </div>

      {/* Footer — fixed outside scroll area */}
      <div
        className="flex-shrink-0 flex gap-2 px-4 py-3 border-t"
        style={{ backgroundColor: colors.headerBg, borderColor: colors.border }}
      >
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
            Supprimer
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
            Annuler
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
            {saving ? '…' : 'Enregistrer'}
          </button>
        </div>
    </div>
  )
}
