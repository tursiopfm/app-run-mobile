'use client'

import React from 'react'
import { SESSION_TYPE_COLORS } from '@/lib/activities/indicators'
import type { WorkoutType } from '@/lib/activities/intensity'
import { TypeIcon } from '@/components/activity/indicatorIcons'
import { useT } from '@/lib/i18n/I18nProvider'

interface TypeIndicatorProps {
  type: WorkoutType | null
  onClick?: (e: React.MouseEvent) => void
  className?: string
}

export default function TypeIndicator({ type, onClick, className }: TypeIndicatorProps) {
  const L = useT().activities
  const isEmpty = type === null
  const color = isEmpty ? '#6B7280' : SESSION_TYPE_COLORS[type]
  const label = isEmpty ? L.sessionTypeUndefined : L.sessionTypeLabels[type]
  const ariaLabel = isEmpty ? L.sessionTypeUndefinedAria : L.sessionTypeAria(label)
  const interactive = !!onClick

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '26px',
    padding: '3px 5px',
    borderRadius: '8px',
    border: '1px solid var(--ind-border)',
    background: 'var(--ind-bg)',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '5px',
    boxShadow: 'var(--ind-shadow)',
    position: 'relative',
    overflow: 'hidden',
    cursor: interactive ? 'pointer' : 'default',
    opacity: isEmpty ? 0.55 : 1,
    boxSizing: 'border-box',
  }

  const iconWrapStyle: React.CSSProperties = {
    width: '16px',
    height: '16px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    filter: isEmpty ? undefined : `drop-shadow(0 0 2px ${color}88)`,
  }

  const textWrapStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
  }

  const valueStyle: React.CSSProperties = {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '11px',
    lineHeight: 1,
    letterSpacing: '0.3px',
    color,
    textShadow: isEmpty ? undefined : `0 0 4px ${color}66`,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'block',
    fontStyle: isEmpty ? 'italic' : 'normal',
  }

  const content = (
    <>
      <div style={iconWrapStyle}><TypeIcon type={type} size={16} /></div>
      <div style={textWrapStyle}>
        <span style={valueStyle}>{label}</span>
      </div>
    </>
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
