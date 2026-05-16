'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import { colors } from '@/lib/design/colors'
import {
  INTENSITY_OPTIONS,
  WORKOUT_TYPE_OPTIONS,
  type IntensityKey,
  type WorkoutType,
} from '@/lib/activities/intensity'
import {
  INTENSITY_KEY_TO_LEVEL,
  INTENSITY_LEVEL_COLORS,
  INTENSITY_LEVEL_LABELS,
  SESSION_TYPE_COLORS,
  SESSION_TYPE_LABELS,
  type IntensityLevel,
} from '@/lib/activities/indicators'
import {
  DumbbellIcon,
  IntensityGauge,
  TypeIcon,
  UnknownTypeIcon,
} from '@/components/activity/indicatorIcons'

export const CES_RANGES = [
  { min: 0,   max: 40,  label: '0–40',    desc: 'Séance légère (récup, mobilité)',             color: '#10B981' },
  { min: 41,  max: 80,  label: '41–80',   desc: 'Charge modérée (footing, sortie courte)',     color: '#84CC16' },
  { min: 81,  max: 130, label: '81–130',  desc: 'Charge significative (sortie longue, tempo)', color: '#F59E0B' },
  { min: 131, max: 200, label: '131–200', desc: 'Charge élevée (trail avec D+, compétition)',  color: '#F97316' },
  { min: 201, max: Infinity, label: '200+', desc: 'Charge très élevée (ultra, effort prolongé)', color: '#EF4444' },
]

const INTENSITY_DESC: Record<IntensityKey, string> = {
  recuperation:     'très facile, récupération active',
  footing:          'endurance fondamentale',
  endurance_active: 'tempo, effort soutenu mais aérobie',
  seuil:            'proche du seuil anaérobie',
  vma:              'VO₂max, effort maximal',
}

const INTENSITY_RULE: Record<IntensityKey, string> = {
  recuperation:     'aucun seuil supérieur atteint, Z1 dominant',
  footing:          'aucun seuil supérieur atteint, Z2 dominant',
  endurance_active: 'Z3+Z4+Z5 ≥ 40 % du temps actif',
  seuil:            'Z4+Z5 ≥ 20 % du temps actif (séance "qualité" au sens Seiler)',
  vma:              'Z5 ≥ 15 % du temps actif (vraie séance VO₂max, intervals longs)',
}

const WORKOUT_TYPE_DESC: Record<WorkoutType, string> = {
  sortie_longue: 'séance longue à allure facile à modérée (volume)',
  fractionne:    'intervals courts à allure VMA (200–800 m)',
  seuil_tempo:   'intervals longs au seuil ou tempo run continu (1000–5000 m)',
  cotes:         'travail spécifique en côtes / dénivelé positif',
  course:        'compétition ou objectif chrono (10K, semi, marathon, race)',
  runtaf:        'trajet maison ↔ bureau à pied (Run / TrailRun)',
  velotaf:       'trajet maison ↔ bureau en vélo (Ride / EBike)',
  footing:       'sortie facile en endurance fondamentale (Z2)',
}

const WORKOUT_TYPE_RULE: Record<WorkoutType, string> = {
  sortie_longue: 'titre contient "sortie longue", "sl", "long run", "lsl"',
  fractionne:    'titre contient "vma", "fractionné", "interval", "répétition", ou une distance 200–800 m isolée',
  seuil_tempo:   'titre contient "seuil", "tempo", "threshold", ou une distance 1000–5000 m isolée',
  cotes:         'titre contient "côtes", "montée", "hill" (priorité sur fractionné/seuil)',
  course:        'titre contient "race", "compét", "dossard", "chrono", "10k", "semi", "marathon"',
  runtaf:        'titre contient "runtaf", "taf", "Home 🏃‍♂️", à la fois "Home"/🏠 et "Office"/🏢, ou un emoji commute (🚉/👨‍💻/🏢/🏠) avec une flèche — si sport = Run/TrailRun',
  velotaf:       'titre contient "vélotaf", "taf", "Home 🚴🏻", à la fois "Home"/🏠 et "Office"/🏢, ou un emoji commute (🚉/👨‍💻/🏢/🏠) avec une flèche — si sport = Ride/EBike/VirtualRide',
  footing:       'type manuel sélectionné dans l\'éditeur (pas de détection automatique depuis le titre)',
}

// ── Layout primitives ────────────────────────────────────────────────────────

function FullScreenSheet({ title, onClose, children }: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ backgroundColor: colors.background }}
    >
      {/* Sticky header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ backgroundColor: colors.headerBg, borderColor: colors.border }}
      >
        <span className="text-[16px] font-bold" style={{ color: colors.text }}>{title}</span>
        <button
          onClick={onClose}
          aria-label="Fermer"
          style={{
            background: 'none',
            border: 'none',
            color: colors.subtleText,
            cursor: 'pointer',
            fontSize: 22,
            lineHeight: 1,
            padding: '4px 8px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full">
        {children}

        <button
          onClick={onClose}
          className="mt-5 w-full py-3 rounded-[12px] text-[14px] font-bold"
          style={{ backgroundColor: colors.chargeOrange, color: '#fff', cursor: 'pointer' }}
        >
          Fermer
        </button>
      </div>
    </div>,
    document.body,
  )
}

// ── Effort / Charge popup ────────────────────────────────────────────────────

export function EffortPopup({ ces, onClose }: { ces: number | null; onClose: () => void }) {
  const cesVal = ces ?? 0
  return (
    <FullScreenSheet title="Charge d'entraînement (CES)" onClose={onClose}>
      <div className="flex items-center gap-3 mb-3">
        <DumbbellIcon color="#F59E0B" size={36} />
        <p className="text-[14px]" style={{ color: colors.subtleText }}>
          La CES mesure la charge d&apos;entraînement globale — durée × intensité × dénivelé.
          Une longue sortie en endurance peut avoir une CES élevée.
        </p>
      </div>

      <div className="space-y-[6px]">
        {CES_RANGES.map(r => {
          const active = ces != null && cesVal >= r.min && cesVal <= r.max
          return (
            <div
              key={r.label}
              className="flex items-center gap-3 rounded-[10px] px-3 py-[10px]"
              style={{
                backgroundColor: active ? `${r.color}22` : 'transparent',
                border: active ? `1px solid ${r.color}55` : `1px solid ${colors.border}`,
              }}
            >
              <DumbbellIcon color={r.color} size={28} />
              <div className="flex-1 min-w-0">
                <p
                  className="text-[13px] font-bold"
                  style={{ color: r.color, opacity: active ? 1 : 0.85 }}
                >
                  {r.label}
                </p>
                <p
                  className="text-[12px]"
                  style={{ color: colors.subtleText, opacity: active ? 1 : 0.75 }}
                >
                  {r.desc}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </FullScreenSheet>
  )
}

// ── Intensity popup ──────────────────────────────────────────────────────────

export function IntensityPopup({
  intensityKey,
  onClose,
}: {
  intensityKey: IntensityKey | null
  onClose: () => void
}) {
  return (
    <FullScreenSheet title="Intensité physiologique" onClose={onClose}>
      <p className="text-[12px] mb-4" style={{ color: colors.subtleText }}>
        Déterminée par la distribution du temps dans les 5 zones FC de ton profil.
        La règle parcourt les seuils du plus intense au plus facile (premier match gagne).
      </p>

      <div className="space-y-[6px] mb-4">
        {INTENSITY_OPTIONS.map(opt => {
          const active = opt.key === intensityKey
          const level: IntensityLevel = INTENSITY_KEY_TO_LEVEL[opt.key]
          const color = INTENSITY_LEVEL_COLORS[level]
          const label = INTENSITY_LEVEL_LABELS[level]
          return (
            <div
              key={opt.key}
              className="flex items-start gap-3 rounded-[10px] px-3 py-[10px]"
              style={{
                backgroundColor: active ? `${color}22` : 'transparent',
                border: active ? `1px solid ${color}55` : `1px solid ${colors.border}`,
              }}
            >
              <div style={{ flexShrink: 0 }}>
                <IntensityGauge level={level} size={40} idSuffix={`pop-${opt.key}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-[13px] font-bold"
                  style={{ color: active ? color : colors.text }}
                >
                  {label}
                </p>
                <p className="text-[12px] mt-[2px]" style={{ color: colors.subtleText }}>
                  {INTENSITY_DESC[opt.key]}
                </p>
                <p
                  className="text-[11px] mt-[3px] font-mono"
                  style={{ color: colors.subtleText, opacity: 0.85 }}
                >
                  Règle : {INTENSITY_RULE[opt.key]}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <div
        className="rounded-[10px] px-3 py-[10px] mb-3"
        style={{ backgroundColor: `${colors.chargeOrange}10`, border: `1px solid ${colors.chargeOrange}30` }}
      >
        <p className="text-[12px] font-semibold mb-1" style={{ color: colors.text }}>
          Note sur les fractionnés courts
        </p>
        <p className="text-[11px]" style={{ color: colors.subtleText }}>
          Sur des fractions courtes (300-400 m, ~1 min d&apos;effort), la FC n&apos;a pas le temps d&apos;atteindre Z5 stable
          malgré l&apos;allure VMA. L&apos;empreinte FC est dominée par Z3-Z4 → ces séances ressortent en <strong>seuil</strong>.
          Le caractère « VMA » est capturé séparément par le bloc <strong>Type</strong> de séance (chip Fractionné).
        </p>
      </div>

      <p className="text-[11px]" style={{ color: colors.subtleText, opacity: 0.7 }}>
        Références : Daniels (intervals VO₂max ≥ 3-5 min), Seiler &amp; Kjerland (TID polarized, HIT 15-20 %),
        Coggan / Foster (classification par zone supérieure significative).
      </p>
    </FullScreenSheet>
  )
}

// ── Workout type popup ───────────────────────────────────────────────────────

export function WorkoutTypePopup({
  workoutTypeKey,
  onClose,
}: {
  workoutTypeKey: WorkoutType | null
  onClose: () => void
}) {
  return (
    <FullScreenSheet title="Type de séance" onClose={onClose}>
      <p className="text-[12px] mb-4" style={{ color: colors.subtleText }}>
        Notion contextuelle indépendante de l&apos;intensité physiologique. Déterminée par mots-clés du
        titre de l&apos;activité (et compatibilité du sport pour runtaf / velotaf). Une «&nbsp;Sortie longue&nbsp;» peut
        être en footing ou endurance active — les deux dimensions sont orthogonales.
      </p>

      <div className="space-y-[6px]">
        {WORKOUT_TYPE_OPTIONS.map(opt => {
          const active = opt.value === workoutTypeKey
          const color = SESSION_TYPE_COLORS[opt.value]
          const label = SESSION_TYPE_LABELS[opt.value]
          return (
            <div
              key={opt.value}
              className="flex items-start gap-3 rounded-[10px] px-3 py-[10px]"
              style={{
                backgroundColor: active ? `${color}22` : 'transparent',
                border: active ? `1px solid ${color}55` : `1px solid ${colors.border}`,
              }}
            >
              <div style={{ flexShrink: 0, width: 40, height: 40 }}>
                <TypeIcon type={opt.value} size={40} />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-[13px] font-bold"
                  style={{ color: active ? color : colors.text }}
                >
                  {label}
                </p>
                <p className="text-[12px] mt-[2px]" style={{ color: colors.subtleText }}>
                  {WORKOUT_TYPE_DESC[opt.value]}
                </p>
                <p
                  className="text-[11px] mt-[3px] font-mono"
                  style={{ color: colors.subtleText, opacity: 0.85 }}
                >
                  Règle : {WORKOUT_TYPE_RULE[opt.value]}
                </p>
              </div>
            </div>
          )
        })}

        {/* Non défini */}
        {(() => {
          const active = workoutTypeKey === null
          return (
            <div
              className="flex items-start gap-3 rounded-[10px] px-3 py-[10px]"
              style={{
                backgroundColor: active ? 'rgba(107,114,128,0.18)' : 'transparent',
                border: active ? `1px solid rgba(107,114,128,0.5)` : `1px solid ${colors.border}`,
              }}
            >
              <div style={{ flexShrink: 0, width: 40, height: 40 }}>
                <UnknownTypeIcon size={40} />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-[13px] font-bold italic"
                  style={{ color: active ? '#9CA3AF' : colors.text }}
                >
                  Non défini
                </p>
                <p className="text-[12px] mt-[2px]" style={{ color: colors.subtleText }}>
                  Aucun type identifié — le titre ne contient pas de mot-clé reconnu et aucun
                  type n&apos;a été choisi manuellement.
                </p>
                <p
                  className="text-[11px] mt-[3px] font-mono"
                  style={{ color: colors.subtleText, opacity: 0.85 }}
                >
                  Règle : aucune correspondance avec les 7 types ci-dessus
                </p>
              </div>
            </div>
          )
        })()}
      </div>
    </FullScreenSheet>
  )
}
