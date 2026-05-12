// web/components/charge/SportSegmentedTabs.tsx
'use client'

import { SPORT_CONFIG, type SportKey } from '@/lib/design/sports'
import { charge as chargeLabels } from '@/lib/design/labels'

type Props = {
  sport:    SportKey
  onChange: (k: SportKey) => void
}

const TABS: { key: SportKey; label: string }[] = [
  { key: 'all',  label: chargeLabels.sportFilterAll },
  { key: 'run',  label: chargeLabels.sportFilterRun },
  { key: 'ride', label: chargeLabels.sportFilterRide },
  { key: 'swim', label: chargeLabels.sportFilterSwim },
]

export function SportSegmentedTabs({ sport, onChange }: Props) {
  return (
    <div
      className="sticky top-0 z-20 bg-trail-bg/95 backdrop-blur supports-[backdrop-filter]:bg-trail-bg/80 pb-2 pt-2 px-1"
      role="tablist"
      aria-label="Filtre sport"
    >
      <div className="flex gap-1 rounded-[10px] bg-trail-card border border-trail-border p-1">
        {TABS.map(({ key, label }) => {
          const active = sport === key
          const cfg = SPORT_CONFIG[key]
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(key)}
              className={[
                'flex-1 px-2 py-2 rounded-[8px] text-[12px] font-semibold transition-colors',
                active ? 'text-white' : 'text-trail-muted hover:text-trail-text',
              ].join(' ')}
              style={active ? { backgroundColor: cfg.color } : undefined}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
