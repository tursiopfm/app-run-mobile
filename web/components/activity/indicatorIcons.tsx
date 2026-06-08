import React from 'react'
import type { IntensityLevel } from '@/lib/activities/indicators'
import type { WorkoutType } from '@/lib/activities/intensity'

// Dumbbell — same shapes as ChargeIndicator. `color` drives currentColor.
export function DumbbellIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 50 50"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      style={{ color, filter: `drop-shadow(0 0 2px ${color}88)` }}
    >
      <rect x="2" y="20" width="4" height="10" rx="1.5" />
      <rect x="7" y="13" width="9" height="24" rx="2.2" />
      <rect x="17" y="22.5" width="16" height="5" rx="1" />
      <rect x="34" y="13" width="9" height="24" rx="2.2" />
      <rect x="44" y="20" width="4" height="10" rx="1.5" />
    </svg>
  )
}

// Gauge — half-circle gradient + rotating needle for level 1..5.
// `level === null` shows a grey arc with no needle.
export function IntensityGauge({
  level,
  size = 40,
  idSuffix,
}: {
  level: IntensityLevel | null
  size?: number
  idSuffix: string
}) {
  const isEmpty = level === null
  const angle = isEmpty ? 0 : -90 + ((level - 1) / 4) * 180
  const gradId = `gauge-grad-${idSuffix}`
  const w = size
  const h = Math.round(size * 0.7)
  return (
    <svg viewBox="0 0 100 70" width={w} height={h} aria-hidden="true" style={{ flexShrink: 0 }}>
      {!isEmpty && (
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="30%" stopColor="#F59E0B" />
            <stop offset="60%" stopColor="#F97316" />
            <stop offset="85%" stopColor="#EF4444" />
            <stop offset="100%" stopColor="#DC2626" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M 12 55 A 38 38 0 0 1 88 55"
        fill="none"
        stroke={isEmpty ? '#6B7280' : `url(#${gradId})`}
        strokeWidth="10"
        strokeLinecap="round"
      />
      {!isEmpty && (
        <g transform={`rotate(${angle} 50 55)`}>
          <line
            x1="50"
            y1="55"
            x2="50"
            y2="22"
            stroke="#F3F4F6"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="50" cy="55" r="3.5" fill="#F3F4F6" />
        </g>
      )}
    </svg>
  )
}

// Empty "?" icon used for "Non défini" workout type.
export function UnknownTypeIcon({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <circle cx="50" cy="50" r="32" fill="none" stroke="#6B7280" strokeWidth="6" />
      <text
        x="50"
        y="65"
        textAnchor="middle"
        fontSize="44"
        fontWeight="700"
        fill="#6B7280"
        fontFamily="var(--font-data)"
      >
        ?
      </text>
    </svg>
  )
}

// Per-workout-type illustration. `type === null` returns the unknown ? icon.
export function TypeIcon({ type, size = 32 }: { type: WorkoutType | null; size?: number }) {
  if (type === null) return <UnknownTypeIcon size={size} />

  const w = size
  const h = size
  switch (type) {
    case 'sortie_longue':
      return (
        <svg viewBox="0 0 100 100" width={w} height={h} aria-hidden="true">
          <ellipse cx="26" cy="62" rx="7" ry="5" fill="#5DA060" />
          <ellipse cx="74" cy="62" rx="7" ry="5" fill="#5DA060" />
          <ellipse cx="32" cy="74" rx="6" ry="4" fill="#5DA060" />
          <ellipse cx="68" cy="74" rx="6" ry="4" fill="#5DA060" />
          <ellipse cx="80" cy="48" rx="10" ry="8" fill="#5DA060" />
          <circle cx="84" cy="46" r="1.5" fill="#0a1410" />
          <ellipse cx="50" cy="55" rx="28" ry="20" fill="#7BC97F" />
          <ellipse cx="50" cy="55" rx="28" ry="20" fill="none" stroke="#3d6f40" strokeWidth="2" />
          <path d="M30 55 L40 42 L50 38 L60 42 L70 55 L60 68 L50 72 L40 68 Z" fill="none" stroke="#3d6f40" strokeWidth="1.5" />
          <polygon points="50,42 56,50 53,58 47,58 44,50" fill="#5DA060" stroke="#3d6f40" strokeWidth="1" />
          <polygon points="38,52 44,50 47,58 42,62 36,58" fill="#5DA060" stroke="#3d6f40" strokeWidth="1" />
          <polygon points="62,52 56,50 53,58 58,62 64,58" fill="#5DA060" stroke="#3d6f40" strokeWidth="1" />
        </svg>
      )
    case 'fractionne':
      return (
        <svg viewBox="0 0 100 100" width={w} height={h} aria-hidden="true">
          <line x1="8" y1="44" x2="22" y2="44" stroke="#D85A4A" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
          <line x1="4" y1="54" x2="20" y2="54" stroke="#D85A4A" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
          <line x1="10" y1="64" x2="24" y2="64" stroke="#D85A4A" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
          <rect x="45" y="14" width="10" height="6" fill="#D85A4A" rx="1.5" />
          <rect x="47" y="10" width="6" height="4" fill="#D85A4A" rx="1" />
          <circle cx="56" cy="54" r="24" fill="var(--trail-card)" stroke="#D85A4A" strokeWidth="3" />
          <line x1="74" y1="32" x2="80" y2="26" stroke="#D85A4A" strokeWidth="3" strokeLinecap="round" />
          <line x1="56" y1="34" x2="56" y2="38" stroke="#D85A4A" strokeWidth="2" />
          <line x1="56" y1="70" x2="56" y2="74" stroke="#D85A4A" strokeWidth="2" />
          <line x1="38" y1="54" x2="42" y2="54" stroke="#D85A4A" strokeWidth="2" />
          <line x1="74" y1="54" x2="78" y2="54" stroke="#D85A4A" strokeWidth="2" />
          <line x1="56" y1="54" x2="68" y2="42" stroke="#D85A4A" strokeWidth="3" strokeLinecap="round" />
          <circle cx="56" cy="54" r="2.5" fill="#D85A4A" />
        </svg>
      )
    case 'seuil_tempo':
      return (
        <svg viewBox="0 0 100 100" width={w} height={h} aria-hidden="true">
          <rect x="45" y="14" width="10" height="6" fill="#3DB5E6" rx="1.5" />
          <rect x="47" y="10" width="6" height="4" fill="#3DB5E6" rx="1" />
          <circle cx="50" cy="54" r="26" fill="var(--trail-card)" stroke="#3DB5E6" strokeWidth="3" />
          <line x1="50" y1="32" x2="50" y2="36" stroke="#3DB5E6" strokeWidth="2" />
          <line x1="50" y1="72" x2="50" y2="76" stroke="#3DB5E6" strokeWidth="2" />
          <line x1="28" y1="54" x2="32" y2="54" stroke="#3DB5E6" strokeWidth="2" />
          <line x1="68" y1="54" x2="72" y2="54" stroke="#3DB5E6" strokeWidth="2" />
          <line x1="38" y1="36" x2="40" y2="40" stroke="#3DB5E6" strokeWidth="1.5" opacity="0.6" />
          <line x1="62" y1="36" x2="60" y2="40" stroke="#3DB5E6" strokeWidth="1.5" opacity="0.6" />
          <line x1="38" y1="72" x2="40" y2="68" stroke="#3DB5E6" strokeWidth="1.5" opacity="0.6" />
          <line x1="62" y1="72" x2="60" y2="68" stroke="#3DB5E6" strokeWidth="1.5" opacity="0.6" />
          <line x1="50" y1="54" x2="50" y2="40" stroke="#3DB5E6" strokeWidth="3" strokeLinecap="round" />
          <line x1="50" y1="54" x2="62" y2="54" stroke="#3DB5E6" strokeWidth="2" strokeLinecap="round" />
          <circle cx="50" cy="54" r="2.5" fill="#3DB5E6" />
        </svg>
      )
    case 'cotes':
      return (
        <svg viewBox="0 0 100 100" width={w} height={h} aria-hidden="true">
          <path d="M10 80 L34 50 L46 64 L52 58 L70 80 Z" fill="#3a6655" opacity="0.5" />
          <path d="M22 80 L44 44 L56 60 L64 50 L82 80 Z" fill="none" stroke="#5BA88D" strokeWidth="3" strokeLinejoin="round" />
          <path d="M40 50 L44 44 L48 50 L46 52 L42 52 Z" fill="#5BA88D" opacity="0.4" />
          <line x1="44" y1="44" x2="44" y2="22" stroke="#5BA88D" strokeWidth="2.5" />
          <path d="M44 22 L58 26 L44 30 Z" fill="#5BA88D" />
        </svg>
      )
    case 'course':
      return (
        <svg viewBox="0 0 100 100" width={w} height={h} aria-hidden="true">
          <path d="M28 30 Q14 32 14 48 Q14 58 26 58" fill="none" stroke="#E8B968" strokeWidth="3" strokeLinecap="round" />
          <path d="M72 30 Q86 32 86 48 Q86 58 74 58" fill="none" stroke="#E8B968" strokeWidth="3" strokeLinecap="round" />
          <path d="M28 22 L72 22 L70 56 Q70 66 50 68 Q30 66 30 56 Z" fill="#E8B968" />
          <path d="M28 22 L72 22 L70 56 Q70 66 50 68 Q30 66 30 56 Z" fill="none" stroke="#b8893f" strokeWidth="1.5" />
          <rect x="44" y="68" width="12" height="8" fill="#E8B968" />
          <rect x="34" y="76" width="32" height="6" rx="1.5" fill="#E8B968" />
          <path d="M50 38 L52.5 44 L59 44.5 L54 49 L55.5 55.5 L50 52 L44.5 55.5 L46 49 L41 44.5 L47.5 44 Z" fill="#0a1410" opacity="0.4" />
        </svg>
      )
    case 'runtaf':
      return (
        <svg viewBox="0 0 100 100" width={w} height={h} aria-hidden="true">
          <circle cx="30" cy="18" r="5" fill="#3DB5E6" />
          <path d="M30 24 Q33 32 36 42 Q34 46 30 48" fill="#3DB5E6" stroke="#3DB5E6" strokeWidth="4" strokeLinejoin="round" />
          <path d="M34 30 L42 32 L40 40" fill="none" stroke="#3DB5E6" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M30 32 L22 28 L18 36" fill="none" stroke="#3DB5E6" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M32 46 L40 54 L36 64" fill="none" stroke="#3DB5E6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M36 64 L42 64" stroke="#3DB5E6" strokeWidth="3" strokeLinecap="round" />
          <path d="M30 48 L20 56 L14 60" fill="none" stroke="#3DB5E6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 60 L9 60" stroke="#3DB5E6" strokeWidth="3" strokeLinecap="round" />
          <line x1="6" y1="32" x2="14" y2="32" stroke="#3DB5E6" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
          <line x1="4" y1="42" x2="12" y2="42" stroke="#3DB5E6" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
          <rect x="56" y="44" width="38" height="24" rx="2.5" fill="none" stroke="#3DB5E6" strokeWidth="2.5" />
          <rect x="60" y="48" width="30" height="16" rx="1" fill="#3DB5E6" opacity="0.22" />
          <path d="M52 68 L98 68 L94 74 L56 74 Z" fill="#3DB5E6" />
          <line x1="68" y1="71" x2="82" y2="71" stroke="#0a1410" strokeWidth="1" opacity="0.4" />
        </svg>
      )
    case 'footing':
      return (
        <svg viewBox="0 0 100 100" width={w} height={h} aria-hidden="true">
          {/* Chaussure de running stylisée */}
          <path d="M14 64 L20 56 L34 50 L46 46 L60 46 L74 50 Q86 54 88 62 L88 70 L18 70 Z" fill="#4ADE80" stroke="#2c8a4d" strokeWidth="1.5" strokeLinejoin="round" />
          {/* Semelle */}
          <rect x="14" y="68" width="74" height="6" rx="2" fill="#2c8a4d" />
          {/* Lacets */}
          <line x1="38" y1="52" x2="44" y2="58" stroke="#2c8a4d" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="46" y1="50" x2="52" y2="56" stroke="#2c8a4d" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="54" y1="48" x2="60" y2="54" stroke="#2c8a4d" strokeWidth="1.5" strokeLinecap="round" />
          {/* Détail crampons */}
          <circle cx="24" cy="72" r="1.5" fill="#0a1410" opacity="0.4" />
          <circle cx="40" cy="72" r="1.5" fill="#0a1410" opacity="0.4" />
          <circle cx="56" cy="72" r="1.5" fill="#0a1410" opacity="0.4" />
          <circle cx="72" cy="72" r="1.5" fill="#0a1410" opacity="0.4" />
          {/* Indications de mouvement (vitesse) */}
          <line x1="6" y1="48" x2="14" y2="48" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          <line x1="4" y1="56" x2="12" y2="56" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
        </svg>
      )
    case 'velotaf':
      return (
        <svg viewBox="0 0 100 100" width={w} height={h} aria-hidden="true">
          <circle cx="12" cy="60" r="9" fill="none" stroke="#B8C25F" strokeWidth="2.5" />
          <circle cx="12" cy="60" r="1.8" fill="#B8C25F" />
          <line x1="12" y1="51" x2="12" y2="69" stroke="#B8C25F" strokeWidth="0.8" opacity="0.5" />
          <line x1="3" y1="60" x2="21" y2="60" stroke="#B8C25F" strokeWidth="0.8" opacity="0.5" />
          <line x1="6" y1="54" x2="18" y2="66" stroke="#B8C25F" strokeWidth="0.8" opacity="0.5" />
          <line x1="6" y1="66" x2="18" y2="54" stroke="#B8C25F" strokeWidth="0.8" opacity="0.5" />
          <circle cx="44" cy="60" r="9" fill="none" stroke="#B8C25F" strokeWidth="2.5" />
          <circle cx="44" cy="60" r="1.8" fill="#B8C25F" />
          <line x1="44" y1="51" x2="44" y2="69" stroke="#B8C25F" strokeWidth="0.8" opacity="0.5" />
          <line x1="35" y1="60" x2="53" y2="60" stroke="#B8C25F" strokeWidth="0.8" opacity="0.5" />
          <line x1="38" y1="54" x2="50" y2="66" stroke="#B8C25F" strokeWidth="0.8" opacity="0.5" />
          <line x1="38" y1="66" x2="50" y2="54" stroke="#B8C25F" strokeWidth="0.8" opacity="0.5" />
          <line x1="28" y1="60" x2="22" y2="34" stroke="#B8C25F" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="22" y1="36" x2="40" y2="36" stroke="#B8C25F" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="28" y1="60" x2="40" y2="36" stroke="#B8C25F" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="28" y1="60" x2="12" y2="60" stroke="#B8C25F" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="40" y1="38" x2="44" y2="60" stroke="#B8C25F" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M14 32 Q22 28 30 32 L28 33 Q22 30 16 33 Z" fill="#B8C25F" />
          <line x1="22" y1="33" x2="22" y2="36" stroke="#B8C25F" strokeWidth="1.5" />
          <line x1="40" y1="36" x2="40" y2="28" stroke="#B8C25F" strokeWidth="2" strokeLinecap="round" />
          <path d="M36 28 Q40 26 44 28 L44 34" fill="none" stroke="#B8C25F" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M36 28 L36 34" fill="none" stroke="#B8C25F" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="28" cy="60" r="2.5" fill="#B8C25F" />
          <line x1="28" y1="60" x2="34" y2="65" stroke="#B8C25F" strokeWidth="1.8" strokeLinecap="round" />
          <rect x="58" y="44" width="38" height="22" rx="2.5" fill="none" stroke="#B8C25F" strokeWidth="2.5" />
          <rect x="62" y="48" width="30" height="14" rx="1" fill="#B8C25F" opacity="0.22" />
          <path d="M54 66 L98 66 L94 72 L58 72 Z" fill="#B8C25F" />
          <line x1="70" y1="69" x2="82" y2="69" stroke="#0a1410" strokeWidth="1" opacity="0.4" />
        </svg>
      )
  }
}
