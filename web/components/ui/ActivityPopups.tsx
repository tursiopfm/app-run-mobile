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
  SESSION_TYPE_COLORS,
  type IntensityLevel,
} from '@/lib/activities/indicators'
import {
  DumbbellIcon,
  IntensityGauge,
  TypeIcon,
  UnknownTypeIcon,
} from '@/components/activity/indicatorIcons'
import { useT } from '@/lib/i18n/I18nProvider'

// Numeric ranges only — text and color decoration handled at render time via i18n.
export const CES_RANGES = [
  { min: 0,   max: 40,         label: '0–40',    color: '#10B981', key: 'r1' as const },
  { min: 41,  max: 80,         label: '41–80',   color: '#84CC16', key: 'r2' as const },
  { min: 81,  max: 130,        label: '81–130',  color: '#F59E0B', key: 'r3' as const },
  { min: 131, max: 200,        label: '131–200', color: '#F97316', key: 'r4' as const },
  { min: 201, max: Infinity,   label: '200+',    color: '#EF4444', key: 'r5' as const },
]

// ── Layout primitives ────────────────────────────────────────────────────────

function FullScreenSheet({ title, onClose, children }: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  const L = useT().activities
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
        <span className="font-display text-[16px] font-bold" style={{ color: colors.text }}>{title}</span>
        <button
          onClick={onClose}
          aria-label={L.popupCloseAria}
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
          className="mt-5 w-full py-3 rounded-[12px] text-body font-bold"
          style={{ backgroundColor: colors.chargeOrange, color: '#fff', cursor: 'pointer' }}
        >
          {L.popupClose}
        </button>
      </div>
    </div>,
    document.body,
  )
}

// ── Effort / Charge popup ────────────────────────────────────────────────────

export function EffortPopup({ ces, onClose }: { ces: number | null; onClose: () => void }) {
  const L = useT().activities
  const cesVal = ces ?? 0
  return (
    <FullScreenSheet title={L.popupChargeTitle} onClose={onClose}>
      <div className="flex items-center gap-3 mb-3">
        <DumbbellIcon color="#F59E0B" size={36} />
        <p className="text-body" style={{ color: colors.subtleText }}>
          {L.popupChargeIntro}
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
                  className="text-body-sm font-bold"
                  style={{ color: r.color, opacity: active ? 1 : 0.85 }}
                >
                  {r.label}
                </p>
                <p
                  className="text-caption"
                  style={{ color: colors.subtleText, opacity: active ? 1 : 0.75 }}
                >
                  {L.cesRanges[r.key]}
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
  const L = useT().activities
  return (
    <FullScreenSheet title={L.popupIntensityTitle} onClose={onClose}>
      <p className="text-caption mb-4" style={{ color: colors.subtleText }}>
        {L.popupIntensityIntro}
      </p>

      <div className="space-y-[6px] mb-4">
        {INTENSITY_OPTIONS.map(opt => {
          const active = opt.key === intensityKey
          const level: IntensityLevel = INTENSITY_KEY_TO_LEVEL[opt.key]
          const color = INTENSITY_LEVEL_COLORS[level]
          const label = L.intensityLevelLabels[level]
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
                  className="text-body-sm font-bold"
                  style={{ color: active ? color : colors.text }}
                >
                  {label}
                </p>
                <p className="text-caption mt-[2px]" style={{ color: colors.subtleText }}>
                  {L.intensityDesc[opt.key]}
                </p>
                <p
                  className="text-micro mt-[3px] font-mono"
                  style={{ color: colors.subtleText, opacity: 0.85 }}
                >
                  {L.rulePrefix}{L.intensityRule[opt.key]}
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
        <p className="text-caption font-semibold mb-1" style={{ color: colors.text }}>
          {L.popupShortNote}
        </p>
        <p className="text-micro" style={{ color: colors.subtleText }}
          dangerouslySetInnerHTML={{ __html: L.popupShortIntervalsHtml }}
        />
      </div>

      <p className="text-micro" style={{ color: colors.subtleText, opacity: 0.7 }}>
        {L.popupRefs}
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
  const L = useT().activities
  return (
    <FullScreenSheet title={L.popupWorkoutTypeTitle} onClose={onClose}>
      <p className="text-caption mb-4" style={{ color: colors.subtleText }}>
        {L.popupWorkoutTypeIntro}
      </p>

      <div className="space-y-[6px]">
        {WORKOUT_TYPE_OPTIONS.map(opt => {
          const active = opt.value === workoutTypeKey
          const color = SESSION_TYPE_COLORS[opt.value]
          const label = L.sessionTypeLabels[opt.value]
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
                  className="text-body-sm font-bold"
                  style={{ color: active ? color : colors.text }}
                >
                  {label}
                </p>
                <p className="text-caption mt-[2px]" style={{ color: colors.subtleText }}>
                  {L.workoutTypeDesc[opt.value]}
                </p>
                <p
                  className="text-micro mt-[3px] font-mono"
                  style={{ color: colors.subtleText, opacity: 0.85 }}
                >
                  {L.rulePrefix}{L.workoutTypeRule[opt.value]}
                </p>
              </div>
            </div>
          )
        })}

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
                  className="text-body-sm font-bold italic"
                  style={{ color: active ? '#9CA3AF' : colors.text }}
                >
                  {L.sessionTypeUndefined}
                </p>
                <p className="text-caption mt-[2px]" style={{ color: colors.subtleText }}>
                  {L.workoutTypeUndefinedDesc}
                </p>
                <p
                  className="text-micro mt-[3px] font-mono"
                  style={{ color: colors.subtleText, opacity: 0.85 }}
                >
                  {L.rulePrefix}{L.workoutTypeUndefinedRule}
                </p>
              </div>
            </div>
          )
        })()}
      </div>
    </FullScreenSheet>
  )
}
