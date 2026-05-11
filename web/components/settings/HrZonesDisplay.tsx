'use client'

import { useState, useEffect } from 'react'
import { calculateHrZones, type HrZoneMethod } from '@/lib/health/hr-zones'
import { colors } from '@/lib/design/colors'

type Props = {
  method?:             HrZoneMethod
  maxHr?:              number | null
  restingHr?:          number | null
  aerobicThresholdHr?: number | null
  thresholdHr?:        number | null
  birthYear?:          number | null
}

const METHOD_LABELS: Record<HrZoneMethod, string> = {
  seuils:   'Seuils',
  test30:   'Test 30min',
  karvonen: 'Karvonen',
  pct_max:  '% FC max',
  auto:     'Estimation',
  deduced:  'Déduites',
  custom:   'Personnalisé',
}

export function HrZonesDisplay({ method: methodProp, maxHr, restingHr, aerobicThresholdHr, thresholdHr, birthYear: birthYearProp }: Props) {
  const [methodLocal,    setMethodLocal]    = useState<HrZoneMethod>('seuils')
  const [birthYearLocal, setBirthYearLocal] = useState<number | null>(null)

  useEffect(() => {
    const m = localStorage.getItem('tc_hr_zone_method')
    if (m) setMethodLocal(m as HrZoneMethod)
    const by = localStorage.getItem('tc_birth_year')
    if (by) setBirthYearLocal(parseInt(by))
  }, [])

  const method    = methodProp    ?? methodLocal
  const birthYear = birthYearProp ?? birthYearLocal
  const result = calculateHrZones({ method, maxHr, restingHr, aerobicThresholdHr, thresholdHr, birthYear })

  if (result.zones.length === 0) {
    return (
      <div className="rounded-[10px] px-[12px] py-[10px]" style={{ backgroundColor: colors.surface }}>
        <p className="text-[12px] text-trail-muted">
          Données manquantes :{' '}
          <span className="font-semibold text-trail-text">{result.missing.join(', ')}</span>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-[10px]">
      {/* Summary badges */}
      <div className="flex gap-[6px]">
        <div className="flex-1 rounded-[8px] px-[8px] py-[6px] text-center" style={{ backgroundColor: colors.surface }}>
          <p className="text-[9px] text-trail-muted mb-[2px]">Méthode</p>
          <p className="text-[11px] font-bold" style={{ color: colors.chargeOrange }}>{METHOD_LABELS[method]}</p>
        </div>
        {result.confidence && (
          <div className="flex-1 rounded-[8px] px-[8px] py-[6px] text-center" style={{ backgroundColor: colors.surface }}>
            <p className="text-[9px] text-trail-muted mb-[2px]">Fiabilité</p>
            <p className="text-[11px] font-bold" style={{ color: '#4caf50' }}>{result.confidence}</p>
          </div>
        )}
        {result.maxHrUsed && (
          <div className="flex-1 rounded-[8px] px-[8px] py-[6px] text-center" style={{ backgroundColor: colors.surface }}>
            <p className="text-[9px] text-trail-muted mb-[2px]">FC max</p>
            <p className="text-[11px] font-bold text-trail-text">{result.maxHrUsed}</p>
          </div>
        )}
      </div>

      {/* Zone rows */}
      <div className="space-y-0">
        {result.zones.map((z, i) => (
          <div
            key={z.zone}
            className="flex items-center gap-[8px] py-[7px]"
            style={{ borderBottom: i < result.zones.length - 1 ? `1px solid ${colors.border}` : 'none' }}
          >
            <div className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, backgroundColor: z.color }} />
            <span className="text-[12px] flex-1" style={{ color: colors.subtleText }}>
              Z{z.zone} — {z.name}
            </span>
            <span className="text-[12px] font-bold" style={{ color: z.color }}>
              {z.min == null ? `≤ ${z.max}` : `${z.min} – ${z.max}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
