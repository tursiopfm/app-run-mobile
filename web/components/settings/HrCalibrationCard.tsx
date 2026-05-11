'use client'

import { useEffect, useState } from 'react'
import { colors } from '@/lib/design/colors'
import type { HrZoneMethod as Method } from '@/lib/health/hr-zones'
import { requiredFieldsFor } from '@/lib/health/hr-method-meta'
import { HrZoneMethod } from './HrZoneMethod'
import { HrCardioFields, type CardioState, type DeducedValues } from './HrCardioFields'
import { deduceFromActivities, type ActivityForDeduce, type StravaAthleteData } from '@/lib/health/hr-deduce'

type Status = 'idle' | 'saving' | 'saved' | 'error'

const DEDUCED_KEY = 'tc_hr_deduced'

export function HrCalibrationCard({
  initial, initialMethod, athleteData,
}: {
  initial:       CardioState
  initialMethod: Method
  athleteData:   StravaAthleteData
}) {
  const [method, setMethod] = useState<Method>(initialMethod)
  const [state,  setState]  = useState<CardioState>(initial)
  const [status, setStatus] = useState<Status>('idle')
  const [deduced, setDeduced] = useState<DeducedValues>({
    maxHrObserved: null, restingHrEstimated: null, lthrEstimated: null, computedAt: null,
  })

  useEffect(() => {
    try {
      const cached = localStorage.getItem(DEDUCED_KEY)
      if (cached) setDeduced(JSON.parse(cached))
    } catch {}
  }, [])

  async function recomputeDeduced() {
    const res = await fetch('/api/activities/list-for-deduce')
    if (!res.ok) return
    const acts: ActivityForDeduce[] = await res.json()
    const next = deduceFromActivities(acts, athleteData)
    setDeduced(next)
    try { localStorage.setItem(DEDUCED_KEY, JSON.stringify(next)) } catch {}
  }

  useEffect(() => {
    if (method === 'deduced' && deduced.computedAt == null) {
      recomputeDeduced()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method])

  async function save() {
    const required = requiredFieldsFor(method)
    const missing = required.filter(f => {
      if (f === 'hr_zones_custom') return !state.hr_zones_custom || state.hr_zones_custom.length !== 5
      return state[f] == null
    })
    if (missing.length > 0) {
      setStatus('error')
      return
    }

    setStatus('saving')
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_hr:               state.max_hr,
          aerobic_threshold_hr: state.aerobic_threshold_hr,
          threshold_hr:         state.threshold_hr,
          resting_hr:           state.resting_hr,
          birth_year:           state.birth_year,
          hr_zone_method:       method,
          hr_zones_custom:      method === 'custom' ? state.hr_zones_custom : null,
          hr_method_updated_at: new Date().toISOString(),
        }),
      })
      if (res.ok) {
        try {
          localStorage.setItem('tc_athlete_hr', JSON.stringify({
            maxHr:              state.max_hr,
            restingHr:          state.resting_hr,
            aerobicThresholdHr: state.aerobic_threshold_hr,
            thresholdHr:        state.threshold_hr,
            birthYear:          state.birth_year,
          }))
          if (state.hr_zones_custom) {
            localStorage.setItem('tc_hr_zones_custom', JSON.stringify(state.hr_zones_custom))
          }
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
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[12px] space-y-[10px]">
        <p className="text-[14px] font-bold text-trail-text">Méthode de calcul des zones</p>
        <HrZoneMethod value={method} onChange={setMethod} />
      </div>

      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[12px] space-y-[8px]">
        <p className="text-[14px] font-bold text-trail-text">Données cardio</p>
        <HrCardioFields
          method={method}
          state={state}
          onChange={setState}
          deduced={deduced}
          onRecompute={recomputeDeduced}
        />
      </div>

      <button
        onClick={save}
        disabled={status === 'saving'}
        className="w-full rounded-[12px] py-[11px] text-[14px] font-bold text-white"
        style={{
          backgroundColor: status === 'error' ? '#ef4444'
            : status === 'saved' ? '#4caf50'
            : colors.chargeOrange,
          opacity: status === 'saving' ? 0.6 : 1,
          cursor:  status === 'saving' ? 'not-allowed' : 'pointer',
        }}
      >
        {status === 'saving' ? 'Enregistrement…'
          : status === 'saved' ? '✓ Enregistré'
          : status === 'error' ? 'Erreur — champs requis manquants ou échec'
          : 'Enregistrer le profil'}
      </button>
    </div>
  )
}
