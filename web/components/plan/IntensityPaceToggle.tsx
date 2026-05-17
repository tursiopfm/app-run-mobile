'use client'

import type { IntensityMode } from '@/types/plan'

type Props = {
  value: IntensityMode
  onChange: (mode: IntensityMode) => void
  size?: 'sm' | 'md'
}

export function IntensityPaceToggle({ value, onChange, size = 'sm' }: Props) {
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
        onClick={() => onChange('pace')}
        className={`${sizeCls} font-semibold transition-colors ${
          value === 'pace'
            ? 'bg-trail-primary text-black'
            : 'text-trail-muted hover:text-trail-text'
        }`}
      >
        Allure
      </button>
    </div>
  )
}
