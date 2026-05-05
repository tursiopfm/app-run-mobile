'use client'

import { useState } from 'react'
import { colors } from '@/lib/design/colors'

export type ProfileData = {
  first_name:    string | null
  last_name:     string | null
  max_hr:        number | null
  threshold_hr:  number | null
  resting_hr:    number | null
  ftp_watts:     number | null
  weight_kg:     number | null
  year_goal_km:  number | null
}

type Props = {
  initial: ProfileData
}

const FIELDS: Array<{ key: keyof ProfileData; label: string; unit?: string; type: 'text' | 'number' }> = [
  { key: 'first_name',    label: 'Prénom',                  type: 'text' },
  { key: 'last_name',     label: 'Nom',                     type: 'text' },
  { key: 'max_hr',        label: 'FC max',         unit: 'bpm', type: 'number' },
  { key: 'threshold_hr',  label: 'FC seuil',       unit: 'bpm', type: 'number' },
  { key: 'resting_hr',    label: 'FC repos',       unit: 'bpm', type: 'number' },
  { key: 'ftp_watts',     label: 'FTP vélo',       unit: 'W',   type: 'number' },
  { key: 'weight_kg',     label: 'Poids',          unit: 'kg',  type: 'number' },
  { key: 'year_goal_km',  label: 'Objectif annuel', unit: 'km', type: 'number' },
]

export function ProfileSection({ initial }: Props) {
  const [data,    setData]    = useState<ProfileData>(initial)
  const [saving,  setSaving]  = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/profile', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      })
      setMessage(res.ok ? 'Enregistré' : 'Erreur')
    } catch {
      setMessage('Erreur')
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 2000)
    }
  }

  function update<K extends keyof ProfileData>(key: K, raw: string) {
    setData((d) => ({
      ...d,
      [key]: raw === '' ? null : (typeof d[key] === 'number' || FIELDS.find((f) => f.key === key)?.type === 'number' ? Number(raw) : raw),
    }))
  }

  return (
    <div className="space-y-2">
      {FIELDS.map((f) => (
        <div
          key={f.key}
          className="flex items-center justify-between rounded-[12px] bg-trail-surface"
          style={{ padding: '8px 12px' }}
        >
          <span className="text-[14px] text-trail-muted flex-1">{f.label}</span>
          <input
            type={f.type}
            value={data[f.key] ?? ''}
            onChange={(e) => update(f.key, e.target.value)}
            className="bg-transparent text-[14px] font-semibold text-right w-24 focus:outline-none"
            style={{ color: colors.seriesBlue }}
          />
          {f.unit && <span className="text-[12px] text-trail-muted ml-1 w-8">{f.unit}</span>}
        </div>
      ))}

      <div className="flex items-center justify-end gap-3 pt-1">
        {message && <span className="text-[12px] text-trail-muted">{message}</span>}
        <button
          onClick={save}
          disabled={saving}
          className="text-[13px] font-semibold px-4 py-2 rounded-[8px] disabled:opacity-50"
          style={{ backgroundColor: colors.chargeOrange, color: '#fff' }}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}
