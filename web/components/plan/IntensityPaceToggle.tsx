'use client'

import { useEffect } from 'react'
import type { IntensityMode } from '@/types/plan'

type Props = {
  value: IntensityMode
  onChange: (mode: IntensityMode) => void
  size?: 'sm' | 'md'
  disabled?: boolean
}

export function IntensityPaceToggle({ value, onChange, size = 'sm', disabled = false }: Props) {
  // Coercition automatique : si on devient disabled et value='pace', repasse en 'level'
  useEffect(() => {
    if (disabled && value === 'pace') onChange('level')
  }, [disabled, value, onChange])

  const sizeCls = size === 'sm' ? 'text-[11px] py-1 px-2' : 'text-[13px] py-1.5 px-3'

  return (
    <div
      className="inline-flex rounded-[8px] bg-trail-surface border border-trail-border overflow-hidden"
      role="tablist"
      aria-label="Mode d'intensité du segment"
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
        Intensité
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'pace'}
        onClick={() => !disabled && onChange('pace')}
        disabled={disabled}
        title={disabled ? 'Mode allure disponible uniquement pour les types running' : undefined}
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
