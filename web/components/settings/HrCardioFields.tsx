'use client'

import { useState } from 'react'
import { colors } from '@/lib/design/colors'
import type { HrZoneMethod as Method } from '@/lib/health/hr-zones'
import { TestProtocolModal } from './TestProtocolModal'
import { RestingHrInfoPopover } from './RestingHrInfoPopover'
import { CustomZonesEditor, type CustomZone } from './CustomZonesEditor'
import { useT } from '@/lib/i18n/I18nProvider'

export type CardioState = {
  max_hr:               number | null
  resting_hr:           number | null
  aerobic_threshold_hr: number | null
  threshold_hr:         number | null
  birth_year:           number | null
  hr_zones_custom:      CustomZone[] | null
}

export type DeducedValues = {
  maxHrObserved:      number | null
  restingHrEstimated: number | null
  lthrEstimated:      number | null
  computedAt:         string | null
}

function Field({ label, value, onChange, unit, disabled, info, alert }: {
  label: string
  value: number | null
  onChange?: (v: number | null) => void
  unit?: string
  disabled?: boolean
  info?: React.ReactNode
  alert?: boolean
}) {
  return (
    <div
      className="rounded-[10px] px-[12px] py-[8px]"
      style={{
        backgroundColor: colors.surface,
        border: alert ? '1px dashed #fb923c' : 'none',
      }}
    >
      <p className="text-micro text-trail-muted mb-[4px] flex items-center gap-[4px]">
        {label}{info}
      </p>
      <div className="flex items-center gap-[6px]">
        <input
          type="number"
          inputMode="numeric"
          value={value ?? ''}
          disabled={disabled}
          onChange={e => {
            const v = e.target.value === '' ? null : parseInt(e.target.value, 10)
            onChange?.(Number.isFinite(v) ? v : null)
          }}
          className="flex-1 bg-transparent text-[15px] font-semibold outline-none"
          style={{ color: value ? colors.text : colors.subtleText, minWidth: 0 }}
        />
        {unit && <span className="text-caption text-trail-muted flex-shrink-0">{unit}</span>}
      </div>
    </div>
  )
}

export function HrCardioFields({
  method, state, onChange, deduced, onRecompute,
}: {
  method:      Method
  state:       CardioState
  onChange:    (next: CardioState) => void
  deduced:     DeducedValues
  onRecompute: () => void
}) {
  const L = useT().settings
  const [protocolOpen, setProtocolOpen]   = useState(false)
  const [restingInfoOpen, setRestingInfo] = useState(false)

  const set = <K extends keyof CardioState>(key: K, v: CardioState[K]) => onChange({ ...state, [key]: v })

  const estimatedMaxFromAge = state.birth_year
    ? Math.round(208 - 0.7 * (new Date().getFullYear() - state.birth_year))
    : null

  return (
    <div className="space-y-[8px]">
      {method === 'seuils' && <>
        <Field label={L.hrFieldMax} unit="bpm" value={state.max_hr} onChange={v => set('max_hr', v)} />
        <div className="grid grid-cols-2 gap-[8px]">
          <Field label={L.hrFieldAerobic} unit="bpm" value={state.aerobic_threshold_hr} onChange={v => set('aerobic_threshold_hr', v)} />
          <Field label={L.hrFieldAnaerobic} unit="bpm" value={state.threshold_hr} onChange={v => set('threshold_hr', v)} />
        </div>
      </>}

      {method === 'test30' && <>
        <Field label={L.hrFieldMax} unit="bpm" value={state.max_hr} onChange={v => set('max_hr', v)} />
        <Field label={L.hrFieldThresholdTest30} unit="bpm" value={state.threshold_hr} onChange={v => set('threshold_hr', v)} />
        <button
          onClick={() => setProtocolOpen(true)}
          className="rounded-[8px] px-[10px] py-[6px] text-caption font-semibold border"
          style={{ borderColor: colors.border, color: colors.text }}
        >
          {L.hrSeeProtocol}
        </button>
        <TestProtocolModal open={protocolOpen} onClose={() => setProtocolOpen(false)} />
      </>}

      {method === 'karvonen' && <>
        <Field label={L.hrFieldMax} unit="bpm" value={state.max_hr} onChange={v => set('max_hr', v)} />
        <div className="relative">
          <Field
            label={L.hrFieldResting}
            unit="bpm"
            value={state.resting_hr}
            onChange={v => set('resting_hr', v)}
            info={
              <button
                type="button"
                onClick={() => setRestingInfo(v => !v)}
                className="inline-flex items-center justify-center rounded-full border text-[9px] italic"
                style={{ width: 14, height: 14, borderColor: '#fb923c', color: '#fb923c' }}
                aria-label={L.hrRestingInfoAria}
              >i</button>
            }
          />
          <RestingHrInfoPopover open={restingInfoOpen} onClose={() => setRestingInfo(false)} />
        </div>
      </>}

      {method === 'pct_max' && (
        <Field label={L.hrFieldMax} unit="bpm" value={state.max_hr} onChange={v => set('max_hr', v)} />
      )}

      {method === 'auto' && <>
        <Field label={L.hrFieldMaxEstimated} unit="bpm" value={estimatedMaxFromAge} disabled />
        <Field
          label={L.hrFieldBirthYear}
          value={state.birth_year}
          onChange={v => set('birth_year', v)}
          alert={!state.birth_year}
        />
      </>}

      {method === 'deduced' && (
        <div className="rounded-[10px] p-[12px] text-caption" style={{ backgroundColor: colors.surface }}>
          <p className="text-trail-muted mb-2">{L.hrDeducedTitle}</p>
          <ul className="space-y-1 text-trail-text">
            <li>• {L.hrDeducedMaxObs} : <strong>{deduced.maxHrObserved ?? '—'} bpm</strong></li>
            <li>• {L.hrDeducedRestEst} : <strong>{deduced.restingHrEstimated ?? '—'} bpm</strong></li>
            <li>• {L.hrDeducedLthrEst} : <strong>{deduced.lthrEstimated ?? '—'} bpm</strong></li>
          </ul>
          <button
            onClick={onRecompute}
            className="mt-3 rounded-[8px] px-[10px] py-[6px] text-caption font-semibold border"
            style={{ borderColor: colors.border, color: colors.text }}
          >
            {L.hrRecomputeBtn}
          </button>
          {deduced.maxHrObserved == null && (
            <p className="text-micro text-trail-muted mt-2">{L.hrNoActivityFC}</p>
          )}
        </div>
      )}

      {method === 'custom' && (
        <CustomZonesEditor
          initial={state.hr_zones_custom}
          onChange={(zones) => set('hr_zones_custom', zones)}
        />
      )}
    </div>
  )
}
