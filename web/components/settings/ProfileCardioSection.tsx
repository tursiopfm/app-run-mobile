'use client'

import { useState } from 'react'
import { colors } from '@/lib/design/colors'

export type ProfileCardioData = {
  first_name:           string | null
  last_name:            string | null
  max_hr:               number | null
  aerobic_threshold_hr: number | null
  threshold_hr:         number | null
  resting_hr:           number | null
  ftp_watts:            number | null
  weight_kg:            number | null
  year_goal_km:         number | null
  birth_year:           number | null
}

type Status = 'idle' | 'saving' | 'saved' | 'error'

function Field({
  label, value, unit, placeholder, onChange,
}: {
  label: string; value: string; unit?: string; placeholder?: string; onChange: (v: string) => void
}) {
  return (
    <div className="rounded-[10px] px-[12px] py-[8px]" style={{ backgroundColor: colors.surface }}>
      <p className="text-[11px] text-trail-muted mb-[4px]">{label}</p>
      <div className="flex items-center gap-[6px]">
        <input
          type="number"
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          inputMode="numeric"
          className="flex-1 bg-transparent text-[15px] font-semibold outline-none"
          style={{ color: value ? colors.text : colors.subtleText, minWidth: 0 }}
        />
        {unit && <span className="text-[12px] text-trail-muted flex-shrink-0">{unit}</span>}
      </div>
    </div>
  )
}

export function ProfileCardioSection({ initial }: { initial: ProfileCardioData }) {
  const [maxHr,      setMaxHr]      = useState(initial.max_hr               != null ? String(initial.max_hr)               : '')
  const [aet,        setAet]        = useState(initial.aerobic_threshold_hr  != null ? String(initial.aerobic_threshold_hr)  : '')
  const [lthr,       setLthr]       = useState(initial.threshold_hr          != null ? String(initial.threshold_hr)          : '')
  const [restingHr,  setRestingHr]  = useState(initial.resting_hr            != null ? String(initial.resting_hr)            : '')
  const [weight,     setWeight]     = useState(initial.weight_kg             != null ? String(initial.weight_kg)             : '')
  const [birthYear,  setBirthYear]  = useState(initial.birth_year            != null ? String(initial.birth_year)            : '')
  const [status,     setStatus]     = useState<Status>('idle')

  async function handleSave() {
    setStatus('saving')
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_hr:               maxHr      ? parseInt(maxHr)      : null,
          aerobic_threshold_hr: aet        ? parseInt(aet)        : null,
          threshold_hr:         lthr       ? parseInt(lthr)       : null,
          resting_hr:           restingHr  ? parseInt(restingHr)  : null,
          weight_kg:            weight     ? parseFloat(weight)   : null,
          birth_year:           birthYear  ? parseInt(birthYear)  : null,
        }),
      })
      if (res.ok) {
        try {
          localStorage.setItem('tc_athlete_hr', JSON.stringify({
            maxHr:              maxHr     ? parseInt(maxHr)      : null,
            restingHr:          restingHr ? parseInt(restingHr)  : null,
            aerobicThresholdHr: aet       ? parseInt(aet)        : null,
            thresholdHr:        lthr      ? parseInt(lthr)       : null,
            birthYear:          birthYear ? parseInt(birthYear)  : null,
          }))
        } catch {}
        setStatus('saved')
        setTimeout(() => setStatus('idle'), 2500)
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="space-y-[10px]">
      {/* Données cardio */}
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[12px] space-y-[8px]">
        <p className="text-[14px] font-bold text-trail-text">Données cardio</p>
        <Field label="FC max" value={maxHr} unit="bpm" placeholder="ex. 190" onChange={setMaxHr} />
        <div className="grid grid-cols-2 gap-[8px]">
          <Field label="Seuil aérobie / AeT" value={aet}  unit="bpm" placeholder="ex. 150" onChange={setAet}  />
          <Field label="Seuil anaérobie / LTHR" value={lthr} unit="bpm" placeholder="ex. 174" onChange={setLthr} />
        </div>
        <Field label="FC repos (Karvonen)" value={restingHr} unit="bpm" placeholder="ex. 48" onChange={setRestingHr} />
        <p className="text-[11px] text-trail-muted leading-[16px]">
          C&apos;est la méthode la plus précise si tes seuils ont été mesurés en laboratoire ou via un test terrain fiable.
        </p>
      </div>

      {/* Infos athlète */}
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[12px] space-y-[8px]">
        <p className="text-[14px] font-bold text-trail-text">Infos athlète</p>
        <div className="grid grid-cols-2 gap-[8px]">
          <Field label="Poids (kg)" value={weight} placeholder="ex. 72" onChange={setWeight} />
          <Field label="Année naissance" value={birthYear} placeholder="ex. 1985" onChange={setBirthYear} />
        </div>
        <p className="text-[11px] text-trail-muted leading-[16px]">
          Ces infos améliorent les estimations si tu ne renseignes pas directement tes zones.
        </p>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={status === 'saving'}
        className="w-full rounded-[12px] py-[11px] text-[14px] font-bold text-white"
        style={{
          backgroundColor: status === 'error' ? '#ef4444'
            : status === 'saved' ? '#4caf50'
            : colors.chargeOrange,
          opacity: status === 'saving' ? 0.6 : 1,
          cursor: status === 'saving' ? 'not-allowed' : 'pointer',
        }}
      >
        {status === 'saving' ? 'Enregistrement…'
          : status === 'saved' ? '✓ Enregistré'
          : status === 'error' ? 'Erreur — réessayer'
          : 'Enregistrer le profil'}
      </button>
    </div>
  )
}
