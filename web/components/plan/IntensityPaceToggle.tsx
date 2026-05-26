'use client'

import { useEffect } from 'react'
import type { IntensityMode } from '@/types/plan'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = {
  value: IntensityMode
  onChange: (mode: IntensityMode) => void
  size?: 'sm' | 'md'
  disabled?: boolean
}

export function IntensityPaceToggle({ value, onChange, size = 'sm', disabled = false }: Props) {
  const L = useT().plan
  useEffect(() => {
    if (disabled && value === 'pace') onChange('level')
  }, [disabled, value, onChange])

  const sizeCls = size === 'sm' ? 'text-[11px] py-1 px-2' : 'text-[13px] py-1.5 px-3'

  return (
    <div
      className="inline-flex rounded-[8px] bg-trail-surface border border-trail-border overflow-hidden"
      role="tablist"
      aria-label={L.toggleAriaIntensity}
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === 'level'}
        onClick={() => onChange('level')}
        className={`${sizeCls} font-semibold transition-colors ${
          value === 'level'
            ? 'bg-trail-primary text-black'
            : 'text-trail-muted hover:text-trail-text'
        }`}
      >
        {L.toggleIntensity}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'pace'}
        onClick={() => !disabled && onChange('pace')}
        disabled={disabled}
        title={disabled ? L.togglePaceDisabledTitle : undefined}
        className={`${sizeCls} font-semibold transition-colors ${
          disabled
            ? 'text-trail-muted/40 cursor-not-allowed'
            : value === 'pace'
              ? 'bg-trail-primary text-black'
              : 'text-trail-muted hover:text-trail-text'
        }`}
      >
        Allure
      </button>
    </div>
  )
}
