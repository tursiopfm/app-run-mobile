'use client'

import { useState, useEffect } from 'react'
import { calculateHrZones, type HrZoneMethod, type HrZone } from '@/lib/health/hr-zones'
import { fmtDurationSec } from '@/lib/activities/detail'

type AthleteHrProfile = {
  max_hr?:               number | null
  resting_hr?:           number | null
  aerobic_threshold_hr?: number | null
  threshold_hr?:         number | null
  birth_year?:           number | null
}

// ── Loi normale tronquée ──────────────────────────────────────────────────────

// Approximation Abramowitz & Stegun (erreur < 1.5e-7)
function erf(x: number): number {
  const a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741
  const a4 = -1.453152027, a5 =  1.061405429, p  =  0.3275911
  const t = 1 / (1 + p * Math.abs(x))
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return x >= 0 ? y : -y
}

function normCdf(x: number, mu: number, sigma: number): number {
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)))
}

/**
 * Distribue le temps d'activité dans les zones FC via une loi normale tronquée.
 *
 * Modèle : FC ~ N(avgHr, σ) tronquée sur [restingHr, activityMaxHr]
 *   - avgHr    = moyenne (connue)
 *   - maxHr    = borne supérieure dure (l'athlète ne peut pas dépasser)
 *   - σ        = (maxHr - avgHr) / 2  → le max observé est ~2σ au-dessus de la moyenne
 *
 * Toute zone dont le seuil min ≥ activityMaxHr reçoit 0 seconde.
 */
function distributeTimeInZones(
  zones:        HrZone[],
  avgHr:        number,
  activityMaxHr: number,
  movingTimeSec: number,
  restingHr:    number,
): number[] {
  const sigma = Math.max((activityMaxHr - avgHr) / 2, 3)

  const weights = zones.map(z => {
    const zMin = z.min ?? restingHr
    if (zMin >= activityMaxHr) return 0
    const zMax = Math.min(z.max, activityMaxHr)
    return normCdf(zMax, avgHr, sigma) - normCdf(zMin, avgHr, sigma)
  })

  const total = weights.reduce((s, w) => s + w, 0)
  if (total === 0) return zones.map(() => 0)

  let remaining = movingTimeSec
  return weights.map((w, i) => {
    if (i === weights.length - 1) return remaining
    const d = Math.round((w / total) * movingTimeSec)
    remaining -= d
    return d
  })
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function ActivityHeartRateZones({
  avgHr,
  maxHr,
  movingTimeSec,
  athleteProfile,
}: {
  avgHr:           number
  maxHr:           number
  movingTimeSec:   number
  athleteProfile?: AthleteHrProfile | null
}) {
  const [method, setMethod] = useState<HrZoneMethod>('pct_max')

  useEffect(() => {
    const m = localStorage.getItem('tc_hr_zone_method')
    if (m) setMethod(m as HrZoneMethod)
  }, [])

  let result = calculateHrZones({
    method,
    maxHr:              athleteProfile?.max_hr               ?? maxHr,
    restingHr:          athleteProfile?.resting_hr            ?? null,
    aerobicThresholdHr: athleteProfile?.aerobic_threshold_hr  ?? null,
    thresholdHr:        athleteProfile?.threshold_hr          ?? null,
    birthYear:          athleteProfile?.birth_year            ?? null,
  })

  if (result.zones.length === 0) {
    result = calculateHrZones({ method: 'pct_max', maxHr })
  }

  if (result.zones.length === 0) return null

  const restingHr = athleteProfile?.resting_hr ?? Math.max(avgHr - 3 * Math.max((maxHr - avgHr) / 2, 3), 40)
  const durations = distributeTimeInZones(result.zones, avgHr, maxHr, movingTimeSec, restingHr)
  const maxDuration = Math.max(...durations, 1)

  return (
    <div>
      <div className="flex gap-4 mb-4">
        <span className="text-xs text-gray-400">
          FC moy: <span className="text-white">{avgHr}</span> bpm
        </span>
        <span className="text-xs text-gray-400">
          FC max: <span className="text-white">{maxHr}</span> bpm
        </span>
      </div>

      {result.zones.map((zone, i) => {
        const pct = Math.round((durations[i] / maxDuration) * 100)
        return (
          <div key={zone.zone} className="flex items-center gap-2 py-1.5">
            <span className="w-28 text-xs shrink-0" style={{ color: zone.color }}>
              Z{zone.zone} {zone.name}
            </span>
            <div className="flex-1 bg-gray-800 rounded-full h-2">
              <div
                className="h-2 rounded-full"
                style={{ width: `${pct}%`, backgroundColor: zone.color }}
              />
            </div>
            <span className="w-14 text-right text-xs text-gray-400 shrink-0">
              {fmtDurationSec(durations[i])}
            </span>
          </div>
        )
      })}
    </div>
  )
}
