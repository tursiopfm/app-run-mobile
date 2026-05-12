'use client'

import { colors } from '@/lib/design/colors'
import { INTENSITY_OPTIONS } from '@/lib/activities/intensity'
import { Dumbbell } from 'lucide-react'

const INTENSITY_EMOJI: Record<string, string> = {
  recuperation:     '😴',
  footing:          '🦶',
  endurance_active: '🔄',
  seuil:            '🎯',
  vma:              '🔥',
}

const INTENSITY_DESC: Record<string, string> = {
  recuperation:     'très facile, récupération active',
  footing:          'endurance fondamentale',
  endurance_active: 'tempo, effort soutenu mais aérobie',
  seuil:            'proche du seuil anaérobie',
  vma:              'VO₂max, effort maximal',
}

export const CES_RANGES = [
  { min: 0,   max: 40,  label: '0–40',    desc: 'Séance légère (récup, mobilité)',             color: '#38bdf8' },
  { min: 41,  max: 80,  label: '41–80',   desc: 'Charge modérée (footing, sortie courte)',     color: '#4ade80' },
  { min: 81,  max: 130, label: '81–130',  desc: 'Charge significative (sortie longue, tempo)', color: '#fbbf24' },
  { min: 131, max: 200, label: '131–200', desc: 'Charge élevée (trail avec D+, compétition)',  color: '#f97316' },
  { min: 201, max: Infinity, label: '200+', desc: 'Charge très élevée (ultra, effort prolongé)', color: '#ef4444' },
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
        <p className="text-[18px] font-bold text-white mb-2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Dumbbell size={20} strokeWidth={2.2} />
          Charge d&apos;entraînement (CES)
        </p>
        <p className="text-[14px] mb-4" style={{ color: colors.subtleText }}>
          La CES mesure la charge d&apos;entraînement globale — durée × intensité × dénivelé. Une longue sortie en endurance peut avoir une CES élevée. L&apos;emoji d&apos;intensité (🦶🐢🎯🔥) reflète l&apos;effort physiologique réel via les zones FC.
        </p>
        <div className="space-y-[6px]">
          {CES_RANGES.map(r => {
            const active = ces != null && cesVal >= r.min && cesVal <= r.max
            return (
              <div
                key={r.label}
                className="flex items-center justify-between rounded-[10px] px-3 py-[8px]"
                style={{
                  backgroundColor: active ? `${r.color}22` : 'transparent',
                  border: active ? `1px solid ${r.color}55` : '1px solid transparent',
                }}
              >
                <span
                  className="text-[13px] font-bold"
                  style={{ color: r.color, opacity: active ? 1 : 0.55 }}
                >
                  {r.label}
                </span>
                <span
                  className="text-[13px]"
                  style={{ color: r.color, opacity: active ? 1 : 0.55 }}
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

const INTENSITY_RULE: Record<string, string> = {
  recuperation:     'aucun seuil supérieur atteint, Z1 dominant',
  footing:          'aucun seuil supérieur atteint, Z2 dominant',
  endurance_active: 'Z3+Z4+Z5 ≥ 40 % du temps actif',
  seuil:            'Z4+Z5 ≥ 20 % du temps actif (séance "qualité" au sens Seiler)',
  vma:              'Z5 ≥ 15 % du temps actif (vraie séance VO₂max, intervals longs)',
}

export function IntensityPopup({ intensityKey, onClose }: { intensityKey: string | null; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="rounded-t-[20px] w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: colors.cardBg }}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[18px] font-bold text-white mb-2">Intensité physiologique</p>
        <p className="text-[12px] mb-4" style={{ color: colors.subtleText }}>
          Déterminée par la distribution du temps dans les 5 zones FC de ton profil.
          La règle parcourt les seuils du plus intense au plus facile (premier match gagne).
        </p>

        <div className="space-y-[6px] mb-4">
          {INTENSITY_OPTIONS.map(opt => {
            const active = opt.key === intensityKey
            return (
              <div
                key={opt.key}
                className="rounded-[10px] px-3 py-[8px]"
                style={{
                  backgroundColor: active ? `${colors.chargeOrange}26` : 'transparent',
                  border: active ? `1px solid ${colors.chargeOrange}60` : '1px solid transparent',
                }}
              >
                <p
                  className="text-[13px] font-semibold"
                  style={{ color: active ? colors.chargeOrange : colors.text }}
                >
                  {opt.label}
                </p>
                <p className="text-[12px] mt-[2px]" style={{ color: colors.subtleText }}>
                  {INTENSITY_DESC[opt.key] ?? ''}
                </p>
                <p className="text-[11px] mt-[3px] font-mono" style={{ color: colors.subtleText, opacity: 0.85 }}>
                  Règle : {INTENSITY_RULE[opt.key] ?? ''}
                </p>
              </div>
            )
          })}
        </div>

        <div
          className="rounded-[10px] px-3 py-[8px] mb-3"
          style={{ backgroundColor: `${colors.chargeOrange}10`, border: `1px solid ${colors.chargeOrange}30` }}
        >
          <p className="text-[12px] font-semibold mb-1" style={{ color: colors.text }}>
            Note sur les fractionnés courts
          </p>
          <p className="text-[11px]" style={{ color: colors.subtleText }}>
            Sur des fractions courtes (300-400 m, ~1 min d&apos;effort), la FC n&apos;a pas le temps d&apos;atteindre Z5 stable
            malgré l&apos;allure VMA. L&apos;empreinte FC est dominée par Z3-Z4 → ces séances ressortent en <strong>seuil</strong>.
            Le caractère « VMA » est capturé séparément par le bloc <strong>Type</strong> de séance (chip ⌚ Fractionné).
          </p>
        </div>

        <p className="text-[11px]" style={{ color: colors.subtleText, opacity: 0.7 }}>
          Références : Daniels (intervals VO₂max ≥ 3-5 min), Seiler & Kjerland (TID polarized, HIT 15-20 %),
          Coggan / Foster (classification par zone supérieure significative).
        </p>

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
