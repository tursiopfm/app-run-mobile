'use client'

import { useState, useEffect } from 'react'
import { calculateHrZones, type HrZoneMethod } from '@/lib/health/hr-zones'
import { fmtDurationSec } from '@/lib/activities/detail'

type AthleteHrProfile = {
  max_hr?:               number | null
  resting_hr?:           number | null
  aerobic_threshold_hr?: number | null
  threshold_hr?:         number | null
  birth_year?:           number | null
}

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

  const maxHrForCalc = result.maxHrUsed ?? maxHr
  const sigma = maxHrForCalc * 0.10

  const centers = result.zones.map(z =>
    z.min == null ? Math.round(z.max * 0.70) : Math.round((z.min + z.max) / 2)
  )

  const rawWeights = centers.map(c =>
    Math.exp(-0.5 * ((avgHr - c) / sigma) ** 2)
  )
  const total = rawWeights.reduce((s, w) => s + w, 0)

  let remaining = movingTimeSec
  const durations = rawWeights.map((w, i) => {
    if (i === rawWeights.length - 1) return remaining
    const d = Math.round((w / total) * movingTimeSec)
    remaining -= d
    return d
  })

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
