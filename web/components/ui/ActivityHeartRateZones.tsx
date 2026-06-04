'use client'

import { useState, useEffect } from 'react'
import { calculateHrZones, distributeTimeInZones, type HrZoneMethod } from '@/lib/health/hr-zones'
import { fmtDurationSec } from '@/lib/activities/detail'
import { useT } from '@/lib/i18n/I18nProvider'

type AthleteHrProfile = {
  max_hr?:               number | null
  resting_hr?:           number | null
  aerobic_threshold_hr?: number | null
  threshold_hr?:         number | null
  birth_year?:           number | null
  hr_zone_method?:       string | null
  hr_zones_custom?:      { zone: number; min: number | null; max: number | null }[] | null
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
  const t = useT()
  const L = t.activities
  const ZONE_NAMES_DICT = [t.hrZones.z1Name, t.hrZones.z2Name, t.hrZones.z3Name, t.hrZones.z4Name, t.hrZones.z5Name]
  const [method, setMethod] = useState<HrZoneMethod>(
    (athleteProfile?.hr_zone_method as HrZoneMethod) ?? 'pct_max'
  )

  useEffect(() => {
    if (athleteProfile?.hr_zone_method) {
      setMethod(athleteProfile.hr_zone_method as HrZoneMethod)
    } else {
      const m = localStorage.getItem('tc_hr_zone_method')
      if (m) setMethod(m as HrZoneMethod)
    }
  }, [athleteProfile?.hr_zone_method])

  let result = calculateHrZones({
    method,
    maxHr:              athleteProfile?.max_hr               ?? maxHr,
    restingHr:          athleteProfile?.resting_hr            ?? null,
    aerobicThresholdHr: athleteProfile?.aerobic_threshold_hr  ?? null,
    thresholdHr:        athleteProfile?.threshold_hr          ?? null,
    birthYear:          athleteProfile?.birth_year            ?? null,
    customZones:        athleteProfile?.hr_zones_custom       ?? null,
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
          {L.hrAvgLabel}: <span className="text-gray-700 dark:text-white">{avgHr}</span> bpm
        </span>
        <span className="text-xs text-gray-400">
          {L.hrMaxLabel}: <span className="text-gray-700 dark:text-white">{maxHr}</span> bpm
        </span>
      </div>

      {result.zones.map((zone, i) => {
        const pct = Math.round((durations[i] / maxDuration) * 100)
        return (
          <div key={zone.zone} className="flex items-center gap-2 py-1.5">
            <span className="w-28 text-xs shrink-0" style={{ color: zone.color }}>
              Z{zone.zone} {ZONE_NAMES_DICT[zone.zone - 1] ?? zone.name}
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
