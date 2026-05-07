'use client'

import { colors } from '@/lib/design/colors'
import { INTENSITY_OPTIONS } from '@/lib/activities/intensity'

const INTENSITY_EMOJI: Record<string, string> = {
  footing:       '🦶',
  sortie_longue: '🐢',
  cotes:         '⛰️',
  vma:           '🔥',
  seuil:         '🎯',
  runtaf:        '🏃‍♂️🏢',
  velotaf:       '🚴🏻🏢',
  course:        '🏁',
  autre:         '❓',
}

const INTENSITY_DESC: Record<string, string> = {
  footing:       'Endurance fondamentale, allure confortable',
  sortie_longue: 'Longue durée, rythme lent et régulier',
  cotes:         'Montées répétées, développe la force',
  vma:           'Effort maximal court, fractionné',
  seuil:         'Allure soutenue proche du seuil anaérobie',
  runtaf:        'Course domicile-travail',
  velotaf:       'Vélo domicile-travail',
  course:        'Compétition officielle',
  autre:         'Autre type de séance',
}

export const CES_RANGES = [
  { min: 0,   max: 30,  label: '0–30',   desc: 'Très facile (récup)' },
  { min: 31,  max: 60,  label: '31–60',  desc: 'Modéré (footing)' },
  { min: 61,  max: 90,  label: '61–90',  desc: 'Intense (seuil)' },
  { min: 91,  max: 120, label: '91–120', desc: 'Très intense (VMA)' },
  { min: 121, max: Infinity, label: '120+', desc: 'Effort extrême (course)' },
]

export function EffortPopup({ ces, onClose }: { ces: number | null; onClose: () => void }) {
  const cesVal = ces ?? 0
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="rounded-t-[20px] w-full max-w-lg p-5"
        style={{ backgroundColor: colors.cardBg }}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[18px] font-bold text-white mb-2">⚡ Score d&apos;effort (CES)</p>
        <p className="text-[14px] mb-4" style={{ color: colors.subtleText }}>
          Ce chiffre mesure à quel point ton corps a travaillé pendant cette séance. Plus c&apos;est grand, plus c&apos;était dur !
        </p>
        <div className="space-y-[6px]">
          {CES_RANGES.map(r => {
            const active = ces != null && cesVal >= r.min && cesVal <= r.max
            return (
              <div
                key={r.label}
                className="flex items-center justify-between rounded-[10px] px-3 py-[8px]"
                style={{
                  backgroundColor: active ? `${colors.chargeOrange}26` : 'transparent',
                  border: active ? `1px solid ${colors.chargeOrange}60` : '1px solid transparent',
                }}
              >
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: active ? colors.chargeOrange : colors.subtleText }}
                >
                  {r.label}
                </span>
                <span
                  className="text-[13px]"
                  style={{ color: active ? colors.chargeOrange : colors.subtleText }}
                >
                  {r.desc}
                </span>
              </div>
            )
          })}
        </div>
        <button
          onClick={onClose}
          className="mt-5 w-full py-3 rounded-[12px] text-[14px] font-bold"
          style={{ backgroundColor: colors.chargeOrange, color: '#fff', cursor: 'pointer' }}
        >
          Fermer
        </button>
      </div>
    </div>
  )
}

export function IntensityPopup({ intensityKey, onClose }: { intensityKey: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="rounded-t-[20px] w-full max-w-lg p-5"
        style={{ backgroundColor: colors.cardBg }}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[18px] font-bold text-white mb-4">Types d&apos;intensité</p>
        <div className="space-y-[6px]">
          {INTENSITY_OPTIONS.map(opt => {
            const active = opt.key === intensityKey
            return (
              <div
                key={opt.key}
                className="flex items-center gap-3 rounded-[10px] px-3 py-[8px]"
                style={{
                  backgroundColor: active ? `${colors.chargeOrange}26` : 'transparent',
                  border: active ? `1px solid ${colors.chargeOrange}60` : '1px solid transparent',
                }}
              >
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[13px] font-semibold"
                    style={{ color: active ? colors.chargeOrange : colors.text }}
                  >
                    {opt.label}
                  </p>
                  <p className="text-[12px]" style={{ color: colors.subtleText }}>
                    {INTENSITY_DESC[opt.key] ?? ''}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
        <button
          onClick={onClose}
          className="mt-5 w-full py-3 rounded-[12px] text-[14px] font-bold"
          style={{ backgroundColor: colors.chargeOrange, color: '#fff', cursor: 'pointer' }}
        >
          Fermer
        </button>
      </div>
    </div>
  )
}
