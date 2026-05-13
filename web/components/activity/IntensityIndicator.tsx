import React from 'react'
import {
  INTENSITY_LEVEL_COLORS,
  INTENSITY_LEVEL_LABELS,
  type IntensityLevel,
} from '@/lib/activities/indicators'

interface IntensityIndicatorProps {
  level: IntensityLevel | null
  showGauge?: boolean
  onClick?: (e: React.MouseEvent) => void
  className?: string
}

const BAR_HEIGHTS: Record<IntensityLevel, number> = {
  1: 2,
  2: 2.5,
  3: 3,
  4: 4,
  5: 5,
}

export default function IntensityIndicator({
  level,
  showGauge = true,
  onClick,
  className,
}: IntensityIndicatorProps) {
  const uid = React.useId()
  const gradId = `gauge-grad-${uid}`
  const isEmpty = level === null
  const color = isEmpty ? '#6B7280' : INTENSITY_LEVEL_COLORS[level]
  const label = isEmpty ? 'Non mesurée' : INTENSITY_LEVEL_LABELS[level]
  const angle = isEmpty ? 0 : -90 + ((level - 1) / 4) * 180
  const ariaLabel = isEmpty ? 'Intensité non mesurée' : `Intensité ${label}`
  const interactive = !isEmpty && !!onClick

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: 26,
    padding: '3px 5px',
    borderRadius: 8,
    border: '1px solid var(--ind-border)',
    background: 'var(--ind-bg)',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    boxShadow: 'var(--ind-shadow)',
    cursor: interactive ? 'pointer' : 'default',
    opacity: isEmpty ? 0.55 : 1,
    boxSizing: 'border-box',
  }

  const gauge = showGauge ? (
    <svg
      viewBox="0 0 100 70"
      width="16"
      height="12"
      aria-hidden="true"
      style={{ flexShrink: 0, opacity: isEmpty ? 0.5 : 1 }}
    >
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
  ) : null

  const body = (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          lineHeight: 1,
          color,
          textShadow: isEmpty ? undefined : `0 0 4px ${color}66`,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontStyle: isEmpty ? 'italic' : 'normal',
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 2,
          height: 5,
        }}
      >
        {([1, 2, 3, 4, 5] as IntensityLevel[]).map((i) => {
          const barColor = INTENSITY_LEVEL_COLORS[i]
          const isActive = !isEmpty && i === level
          const isDim = isEmpty || i > level
          const barStyle: React.CSSProperties = {
            flex: 1,
            height: BAR_HEIGHTS[i],
            background: barColor,
            borderRadius: 1,
            opacity: isDim ? 0.25 : 1,
            boxShadow: isActive ? `0 0 2px ${color}` : undefined,
          }
          return <div key={i} style={barStyle} />
        })}
      </div>
    </div>
  )

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={className}
        style={containerStyle}
      >
        {gauge}
        {body}
      </button>
    )
  }

  return (
    <div
      aria-label={ariaLabel}
      className={className}
      style={containerStyle}
    >
      {gauge}
      {body}
    </div>
  )
}
