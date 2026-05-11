'use client'

import { useState } from 'react'
import { colors } from '@/lib/design/colors'

export type CustomZone = { zone: number; min: number | null; max: number | null }

export function validateCustomZones(zones: CustomZone[]): string[] {
  const errors: string[] = []
  if (zones.length !== 5) errors.push('Il faut exactement 5 zones.')

  for (const z of zones) {
    if (z.zone === 1) {
      if (z.max == null) errors.push(`Z${z.zone} : valeur max manquante`)
    } else {
      if (z.min == null || z.max == null) errors.push(`Z${z.zone} : valeur manquante`)
      else if (z.min > z.max) errors.push(`Z${z.zone} : min > max`)
    }
  }

  for (let i = 1; i < zones.length; i++) {
    const prev = zones[i - 1]
    const cur  = zones[i]
    if (prev.max == null || cur.min == null) continue
    if (cur.min !== prev.max + 1) {
      errors.push(`Z${cur.zone} doit commencer à ${prev.max + 1} (continuité avec Z${prev.zone})`)
    }
  }

  return errors
}

const DEFAULT_ZONES: CustomZone[] = [
  { zone: 1, min: null, max: 120 },
  { zone: 2, min: 121,  max: 130 },
  { zone: 3, min: 131,  max: 142 },
  { zone: 4, min: 143,  max: 154 },
  { zone: 5, min: 155,  max: 167 },
]

export function CustomZonesEditor({
  initial, onChange,
}: {
  initial: CustomZone[] | null
  onChange: (zones: CustomZone[], errors: string[]) => void
}) {
  const [zones, setZones] = useState<CustomZone[]>(initial && initial.length === 5 ? initial : DEFAULT_ZONES)

  function update(idx: number, field: 'min' | 'max', value: string) {
    const v = value === '' ? null : parseInt(value, 10)
    const cleaned = Number.isFinite(v) ? v : null
    const next = zones.map((z, i) => i === idx ? { ...z, [field]: cleaned } : z)
    if (field === 'max' && cleaned != null && idx < 4) {
      next[idx + 1] = { ...next[idx + 1], min: cleaned + 1 }
    }
    setZones(next)
    onChange(next, validateCustomZones(next))
  }

  const errors = validateCustomZones(zones)

  return (
    <div className="space-y-[6px]">
      {zones.map((z, i) => (
        <div key={z.zone} className="flex items-center gap-[8px]">
          <span className="text-[12px] font-bold text-trail-text w-[24px]">Z{z.zone}</span>
          <div className="flex-1 rounded-[8px] px-[10px] py-[6px]" style={{ backgroundColor: colors.surface }}>
            <p className="text-[10px] text-trail-muted">Min</p>
            <input
              type="number" inputMode="numeric"
              value={z.min ?? ''}
              disabled={z.zone === 1}
              placeholder={z.zone === 1 ? '—' : ''}
              onChange={e => update(i, 'min', e.target.value)}
              className="bg-transparent text-[14px] font-semibold outline-none w-full text-trail-text"
            />
          </div>
          <div className="flex-1 rounded-[8px] px-[10px] py-[6px]" style={{ backgroundColor: colors.surface }}>
            <p className="text-[10px] text-trail-muted">Max</p>
            <input
              type="number" inputMode="numeric"
              value={z.max ?? ''}
              onChange={e => update(i, 'max', e.target.value)}
              className="bg-transparent text-[14px] font-semibold outline-none w-full text-trail-text"
            />
          </div>
        </div>
      ))}
      {errors.length > 0 && (
        <ul className="text-[11px] mt-2" style={{ color: '#f87171' }}>
          {errors.map((e, i) => <li key={i}>• {e}</li>)}
        </ul>
      )}
      <p className="text-[11px] text-trail-muted leading-[16px]">
        Vérifie que les zones personnalisées sont continues, croissantes et sans chevauchement.
      </p>
    </div>
  )
}
