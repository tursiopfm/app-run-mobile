'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ActivityCard, type ActivityRow } from '@/components/ui/ActivityCard'
import { EditActivityModal } from '@/components/ui/EditActivityModal'
import { calculateHrZones, type HrZone, type HrZoneMethod } from '@/lib/health/hr-zones'
import { colors } from '@/lib/design/colors'
import type { AthleteHrProfile } from './LastActivityBlock'

type Props = {
  activities:     ActivityRow[]
  athleteProfile: AthleteHrProfile
  onHide?:        () => void
}

export function WeekActivitiesBlock({ activities, athleteProfile, onHide }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<ActivityRow | null>(null)
  const [hrZones, setHrZones] = useState<HrZone[]>([])

  useEffect(() => {
    if (!athleteProfile) return
    try {
      const method = (localStorage.getItem('tc_hr_zone_method') ?? 'pct_max') as HrZoneMethod
      setHrZones(calculateHrZones({
        method,
        maxHr:              athleteProfile.max_hr,
        restingHr:          athleteProfile.resting_hr,
        aerobicThresholdHr: athleteProfile.aerobic_threshold_hr,
        thresholdHr:        athleteProfile.threshold_hr,
        birthYear:          athleteProfile.birth_year,
      }).zones)
    } catch {}
  }, [athleteProfile])

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      <div className="flex items-center justify-between mb-[8px]">
        <div className="flex items-center gap-1">
          <span className="text-[15px] font-semibold text-trail-muted">Activités —</span>
          <span className="text-[15px] font-semibold text-trail-text">Semaine en cours</span>
        </div>
        {onHide && (
          <button
            onClick={onHide}
            className="text-trail-muted hover:text-trail-text px-1 text-[18px] leading-none"
            aria-label="Masquer le bloc"
          >
            ⋮
          </button>
        )}
      </div>

      {activities.length === 0 ? (
        <p className="text-[13px]" style={{ color: colors.subtleText }}>
          Aucune activité cette semaine.
        </p>
      ) : (
        <div className="space-y-[10px]">
          {activities.map((a) => (
            <ActivityCard
              key={a.id}
              activity={a}
              hrZones={hrZones}
              onEdit={setEditing}
              onClick={() => router.push(`/activities/${a.id}`)}
            />
          ))}
        </div>
      )}

      {editing && (
        <EditActivityModal
          activity={editing}
          hrZones={hrZones}
          onSaved={() => { setEditing(null); router.refresh() }}
          onDeleted={() => { setEditing(null); router.refresh() }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
