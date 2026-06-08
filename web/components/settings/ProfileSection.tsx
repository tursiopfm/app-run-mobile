'use client'

import { useState } from 'react'
import { colors } from '@/lib/design/colors'
import { useT } from '@/lib/i18n/I18nProvider'

export type ProfileData = {
  first_name:   string | null
  last_name:    string | null
  max_hr:       number | null
  threshold_hr: number | null
  resting_hr:   number | null
  ftp_watts:    number | null
  weight_kg:    number | null
  year_goal_km: number | null
}

type Status = 'idle' | 'saving' | 'saved' | 'error'

function FieldInput({
  label, value, unit, type = 'number', onChange,
}: {
  label: string; value: string; unit?: string; type?: string; onChange: (v: string) => void
}) {
  return (
    <div className="rounded-[10px] px-[12px] py-[8px]" style={{ backgroundColor: colors.surface }}>
      <p className="text-micro text-trail-muted mb-[4px]">{label}</p>
      <div className="flex items-center gap-[6px]">
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          inputMode={type === 'number' ? 'numeric' : undefined}
          className="flex-1 bg-transparent text-[15px] font-semibold outline-none"
          style={{ color: colors.text, minWidth: 0 }}
        />
        {unit && <span className="text-caption text-trail-muted flex-shrink-0">{unit}</span>}
      </div>
    </div>
  )
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-[8px]">{children}</div>
}

export function ProfileSection({ initial }: { initial: ProfileData }) {
  const L = useT().settings
  const [firstName,   setFirstName]   = useState(initial.first_name   ?? '')
  const [lastName,    setLastName]    = useState(initial.last_name     ?? '')
  const [maxHr,       setMaxHr]       = useState(initial.max_hr        != null ? String(initial.max_hr)       : '')
  const [thresholdHr, setThresholdHr] = useState(initial.threshold_hr != null ? String(initial.threshold_hr) : '')
  const [restingHr,   setRestingHr]   = useState(initial.resting_hr   != null ? String(initial.resting_hr)   : '')
  const [ftp,         setFtp]         = useState(initial.ftp_watts     != null ? String(initial.ftp_watts)    : '')
  const [weight,      setWeight]      = useState(initial.weight_kg     != null ? String(initial.weight_kg)    : '')
  const [yearGoal,    setYearGoal]    = useState(initial.year_goal_km  != null ? String(initial.year_goal_km) : '')
  const [status,      setStatus]      = useState<Status>('idle')

  async function handleSave() {
    setStatus('saving')
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name:   firstName   || null,
          last_name:    lastName    || null,
          max_hr:       maxHr       ? parseInt(maxHr)         : null,
          threshold_hr: thresholdHr ? parseInt(thresholdHr)   : null,
          resting_hr:   restingHr   ? parseInt(restingHr)     : null,
          ftp_watts:    ftp         ? parseInt(ftp)           : null,
          weight_kg:    weight      ? parseFloat(weight)      : null,
          year_goal_km: yearGoal    ? parseInt(yearGoal)      : null,
        }),
      })
      setStatus(res.ok ? 'saved' : 'error')
      if (res.ok) setTimeout(() => setStatus('idle'), 2500)
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="space-y-[8px]">
      <FieldRow>
        <FieldInput label={L.profileFirstName} type="text" value={firstName} onChange={setFirstName} />
        <FieldInput label={L.profileLastName}  type="text" value={lastName}  onChange={setLastName}  />
      </FieldRow>

      <FieldRow>
        <FieldInput label={L.profileFcMax}    value={maxHr}       unit="bpm" onChange={setMaxHr}       />
        <FieldInput label={L.profileFcSeuil}  value={thresholdHr} unit="bpm" onChange={setThresholdHr} />
      </FieldRow>
      <FieldRow>
        <FieldInput label={L.profileFcRepos}  value={restingHr} unit="bpm" onChange={setRestingHr} />
        <FieldInput label={L.profileFtp}      value={ftp}       unit="W"   onChange={setFtp}       />
      </FieldRow>

      <FieldRow>
        <FieldInput label={L.profileWeight}    value={weight}   unit="kg" onChange={setWeight}   />
        <FieldInput label={L.profileYearGoal}  value={yearGoal} unit="km" onChange={setYearGoal} />
      </FieldRow>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={status === 'saving'}
        className="w-full rounded-[12px] py-[10px] text-body font-bold text-white mt-[4px]"
        style={{
          backgroundColor: status === 'error' ? '#ef4444'
            : status === 'saved' ? colors.greenOk
            : colors.chargeOrange,
          opacity: status === 'saving' ? 0.6 : 1,
        }}
      >
        {status === 'saving' ? L.hrSaveSaving
          : status === 'saved' ? L.hrSaveSaved
          : status === 'error' ? L.identitySaveError
          : L.hrSaveCta}
      </button>
    </div>
  )
}
