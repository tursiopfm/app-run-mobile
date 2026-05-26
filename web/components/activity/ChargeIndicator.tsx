'use client'

import {
  CHARGE_COLORS,
  getChargeLevel,
  type ChargeLevel,
} from '@/lib/activities/indicators'
import { useT } from '@/lib/i18n/I18nProvider'

interface ChargeIndicatorProps {
  value: number
  level?: ChargeLevel
  onClick?: (e: React.MouseEvent) => void
  className?: string
}

const BAR_HEIGHTS: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 2,
  2: 2.5,
  3: 3,
  4: 4,
  5: 5,
}

export default function ChargeIndicator({
  value,
  level: levelProp,
  onClick,
  className,
}: ChargeIndicatorProps) {
  const L = useT().activities
  const level: ChargeLevel = levelProp ?? getChargeLevel(value)
  const color = CHARGE_COLORS[level]
  const isValid = Number.isFinite(value) && value >= 0
  const displayValue = isValid ? String(Math.round(value)) : '—'
  const ariaLabel = L.chargeAria(isValid ? Math.round(value) : 0, L.chargeLevelLabels[level])

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
    cursor: onClick ? 'pointer' : 'default',
    boxSizing: 'border-box',
  }

  const iconWrapperStyle: React.CSSProperties = {
    flexShrink: 0,
    width: 16,
    height: 16,
    color,
    filter: `drop-shadow(0 0 2px ${color}88)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const bodyStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  }

  const titleRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    gap: 4,
    minWidth: 0,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 7,
    letterSpacing: '0.08em',
    color: 'var(--ind-label)',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
  }

  const valueStyle: React.CSSProperties = {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 11,
    lineHeight: 1,
    color,
    textShadow: `0 0 4px ${color}66`,
  }

  const barsRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 2,
    height: 5,
  }

  const dumbbell = (
    <svg
      viewBox="0 0 50 50"
      fill="currentColor"
      width="100%"
      height="100%"
      aria-hidden="true"
    >
      <rect x="2" y="20" width="4" height="10" rx="1.5" />
      <rect x="7" y="13" width="9" height="24" rx="2.2" />
      <rect x="17" y="22.5" width="16" height="5" rx="1" />
      <rect x="34" y="13" width="9" height="24" rx="2.2" />
      <rect x="44" y="20" width="4" height="10" rx="1.5" />
    </svg>
  )

  const bars = ([1, 2, 3, 4, 5] as const).map((i) => {
    const barColor = CHARGE_COLORS[i]
    const isActive = i === level
    const isDimmed = i > level
    const barStyle: React.CSSProperties = {
      flex: 1,
      height: BAR_HEIGHTS[i],
      background: barColor,
      borderRadius: 1,
      clipPath: 'polygon(8% 100%, 100% 100%, 92% 0%, 0% 0%)',
      opacity: isDimmed ? 0.22 : 1,
      filter: isActive ? `drop-shadow(0 0 1.5px ${color})` : undefined,
    }
    return <div key={i} style={barStyle} />
  })

  const content = (
    <>
      <div style={iconWrapperStyle}>{dumbbell}</div>
      <div style={bodyStyle}>
        <div style={titleRowStyle}>
          <span style={labelStyle}>{L.chargeLabel}</span>
          <span style={valueStyle}>{displayValue}</span>
        </div>
        <div style={barsRowStyle}>{bars}</div>
      </div>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={className}
        style={{ ...containerStyle, appearance: 'none', font: 'inherit', textAlign: 'left' }}
      >
        {content}
      </button>
    )
  }

  return (
    <div aria-label={ariaLabel} className={className} style={containerStyle}>
      {content}
    </div>
  )
}
