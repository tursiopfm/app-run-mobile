import React from 'react'
import {
  INTENSITY_LEVEL_COLORS,
  INTENSITY_LEVEL_LABELS,
  type IntensityLevel,
} from '@/lib/activities/indicators'

interface IntensityIndicatorProps {
  level: IntensityLevel
  showGauge?: boolean
  onClick?: (e: React.MouseEvent) => void
  className?: string
}

const BAR_HEIGHTS: Record<IntensityLevel, number> = {
  1: 4,
  2: 6,
  3: 8,
  4: 10,
  5: 12,
}

export default function IntensityIndicator({
  level,
  showGauge = true,
  onClick,
  className,
}: IntensityIndicatorProps) {
  const uid = React.useId()
  const gradId = `gauge-grad-${uid}`
  const color = INTENSITY_LEVEL_COLORS[level]
  const label = INTENSITY_LEVEL_LABELS[level]
  const angle = -90 + ((level - 1) / 4) * 180
  const ariaLabel = `Intensité ${label}`

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: 64,
    padding: '8px 10px',
    borderRadius: 14,
    border: '1px solid #232826',
    background: 'linear-gradient(180deg, #1a1f1a 0%, #141816 100%)',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
    cursor: onClick ? 'pointer' : undefined,
  }

  const gauge = showGauge ? (
    <svg
      viewBox="0 0 100 70"
      width="32"
      height="24"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="30%" stopColor="#F59E0B" />
          <stop offset="60%" stopColor="#F97316" />
          <stop offset="85%" stopColor="#EF4444" />
          <stop offset="100%" stopColor="#DC2626" />
        </linearGradient>
      </defs>
      <path
        d="M 12 55 A 38 38 0 0 1 88 55"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="10"
        strokeLinecap="round"
      />
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
    </svg>
  ) : null

  const body = (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: 9,
            letterSpacing: '0.12em',
            color: '#D1D5DB',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            textTransform: 'uppercase',
          }}
        >
          INTENSITÉ :
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1,
            color,
            textShadow: `0 0 6px ${color}66`,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 3,
          height: 12,
        }}
      >
        {([1, 2, 3, 4, 5] as IntensityLevel[]).map((i) => {
          const barColor = INTENSITY_LEVEL_COLORS[i]
          const isActive = i === level
          const isDim = i > level
          const barStyle: React.CSSProperties = {
            flex: 1,
            height: BAR_HEIGHTS[i],
            background: barColor,
            borderRadius: 2,
            opacity: isDim ? 0.25 : 1,
            boxShadow: isActive ? `0 0 4px ${color}` : undefined,
          }
          return <div key={i} style={barStyle} />
        })}
      </div>
    </div>
  )

  if (onClick) {
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
