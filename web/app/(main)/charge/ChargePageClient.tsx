// web/app/(main)/charge/ChargePageClient.tsx
'use client'

import { useState, useEffect } from 'react'
import { BlockGrid, type BlockDef } from '@/components/blocks/BlockGrid'
import { SportSegmentedTabs } from '@/components/charge/SportSegmentedTabs'
import type { SportKey } from '@/lib/design/sports'
import type { ChargePageData, ChargeSportFilterKey } from '@/lib/data/charge'
import { charge as chargeLabels } from '@/lib/design/labels'
import { LoadStatusCard } from '@/components/charge/blocks/LoadStatusCard'
import { AcuteChronicCard } from '@/components/charge/blocks/AcuteChronicCard'
import { FreshnessCard } from '@/components/charge/blocks/FreshnessCard'
import { WeeklyLoadChart } from '@/components/charge/blocks/WeeklyLoadChart'
import { FitnessFatigueChart } from '@/components/charge/blocks/FitnessFatigueChart'
import { SportDistributionChart } from '@/components/charge/blocks/SportDistributionChart'

const SPORT_STORAGE = 'charge_sport_filter'

const DEFAULT_ORDER = [
  'status', 'acute-chronic', 'freshness', 'weekly-load',
  'fitness-fatigue', 'sport-distribution', 'intensity-distribution', 'monotony-strain',
  'top-activities', 'heatmap-28d', 'ramp-rate', 'insights',
]

type Props = { data: ChargePageData }

function isSportKey(v: string): v is SportKey {
  return v === 'all' || v === 'run' || v === 'ride' || v === 'swim'
}

// Map block kebab-case ID to camelCase key in chargeLabels.blocks
function blockLabel(id: string): string {
  const camel = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
  // Special: 'ramp-rate' → 'rampRate' but the label key is 'rampRateBlock' to avoid collision with the flat 'rampRate' vocabulary key
  const key = camel === 'rampRate' ? 'rampRateBlock' : camel === 'heatmap28d' ? 'heatmap' : camel
  return (chargeLabels.blocks as Record<string, string>)[key] ?? id
}

export function ChargePageClient({ data }: Props) {
  const [sport, setSport] = useState<SportKey>('all')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SPORT_STORAGE)
      if (stored && isSportKey(stored)) setSport(stored)
    } catch {}
  }, [])

  function handleSportChange(k: SportKey) {
    setSport(k)
    try { localStorage.setItem(SPORT_STORAGE, k) } catch {}
  }

  const payload = data.perSport[sport as ChargeSportFilterKey]

  // Placeholder blocks — implementations come in Phase 5/6/7
  const blocks: BlockDef[] = DEFAULT_ORDER.map((id) => {
    if (id === 'status') return {
      id,
      label:  blockLabel(id),
      emoji:  '⚡',
      render: () => <LoadStatusCard payload={payload} />,
    }
    if (id === 'acute-chronic') return {
      id,
      label:  blockLabel(id),
      emoji:  '⚖️',
      render: () => <AcuteChronicCard payload={payload} />,
    }
    if (id === 'freshness') return {
      id,
      label:  blockLabel(id),
      emoji:  '🌬️',
      render: () => <FreshnessCard payload={payload} />,
    }
    if (id === 'weekly-load') return {
      id,
      label:  blockLabel(id),
      emoji:  '📊',
      render: () => <WeeklyLoadChart payload={payload} />,
    }
    if (id === 'fitness-fatigue') return {
      id,
      label:  blockLabel(id),
      emoji:  '📈',
      render: () => <FitnessFatigueChart payload={payload} />,
    }
    if (id === 'sport-distribution') return {
      id,
      label:  blockLabel(id),
      emoji:  '🥧',
      render: () => <SportDistributionChart payload={payload} />,
    }
    return {
      id,
      label:  blockLabel(id),
      emoji:  '⚡',
      render: () => (
        <div className="rounded-[12px] bg-trail-card border border-trail-border p-3 text-[12px] text-trail-muted">
          [{id}] placeholder
        </div>
      ),
    }
  })

  if (payload.historyDays === 0) {
    return (
      <div className="px-3 py-3 max-w-lg mx-auto">
        <SportSegmentedTabs sport={sport} onChange={handleSportChange} />
        <div className="rounded-[12px] bg-trail-card border border-trail-border p-4 text-center text-trail-muted text-[13px]">
          {chargeLabels.noActivitiesForSport(sport === 'all' ? 'toute activité' : sport)}
        </div>
      </div>
    )
  }

  return (
    <div className="px-3 py-3 max-w-lg mx-auto">
      <SportSegmentedTabs sport={sport} onChange={handleSportChange} />
      <BlockGrid storageKey="charge" defaultOrder={DEFAULT_ORDER} blocks={blocks} />
    </div>
  )
}
