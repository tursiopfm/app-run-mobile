'use client'

import type { ZoneMode } from '@/types/plan'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = {
  value: ZoneMode
  onChange: (mode: ZoneMode) => void
  size?: 'sm' | 'md'
}

export function DurationDistanceToggle({ value, onChange, size = 'sm' }: Props) {
  const L = useT().plan
  const sizeCls = size === 'sm' ? 'text-[11px] py-1 px-2' : 'text-[13px] py-1.5 px-3'
  return (
    <div
      className="inline-flex rounded-[8px] bg-trail-surface border border-trail-border overflow-hidden"
      role="tablist"
      aria-label={L.toggleAriaMeasure}
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === 'duration'}
        onClick={() => onChange('duration')}
        className={`${sizeCls} font-semibold transition-colors ${
          value === 'duration'
            ? 'bg-trail-primary text-black'
            : 'text-trail-muted hover:text-trail-text'
        }`}
      >
        {L.toggleDuration}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'distance'}
        onClick={() => onChange('distance')}
        className={`${sizeCls} font-semibold transition-colors ${
          value === 'distance'
            ? 'bg-trail-primary text-black'
            : 'text-trail-muted hover:text-trail-text'
        }`}
      >
        {L.toggleDistance}
      </button>
    </div>
  )
}
