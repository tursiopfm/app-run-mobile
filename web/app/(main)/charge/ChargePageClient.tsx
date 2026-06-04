// web/app/(main)/charge/ChargePageClient.tsx
'use client'

import { useState, useEffect } from 'react'
import { BlockGrid, type BlockDef } from '@/components/blocks/BlockGrid'
import { SportSegmentedTabs } from '@/components/charge/SportSegmentedTabs'
import type { SportKey } from '@/lib/design/sports'
import type { ChargePageData, ChargeSportFilterKey } from '@/lib/data/charge'
import { useT } from '@/lib/i18n/I18nProvider'
import { LoadStatusCard } from '@/components/charge/blocks/LoadStatusCard'
import { AcuteChronicCard } from '@/components/charge/blocks/AcuteChronicCard'
import { FreshnessCard } from '@/components/charge/blocks/FreshnessCard'
import { WeeklyLoadChart } from '@/components/charge/blocks/WeeklyLoadChart'
import { FitnessFatigueChart } from '@/components/charge/blocks/FitnessFatigueChart'
import { SportDistributionChart } from '@/components/charge/blocks/SportDistributionChart'
import { IntensityDistributionChart } from '@/components/charge/blocks/IntensityDistributionChart'
import { MonotonyStrainCard } from '@/components/charge/blocks/MonotonyStrainCard'
import { TopLoadActivitiesCard } from '@/components/charge/blocks/TopLoadActivitiesCard'
import { LoadHeatmap28d } from '@/components/charge/blocks/LoadHeatmap28d'
import { RampRateCard } from '@/components/charge/blocks/RampRateCard'
import { LoadInsightsCard } from '@/components/charge/blocks/LoadInsightsCard'

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

export function ChargePageClient({ data }: Props) {
  const chargeLabels = useT().charge

  // Map block kebab-case ID to camelCase key in chargeLabels.blocks
  function blockLabel(id: string): string {
    const camel = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    const key = camel === 'rampRate' ? 'rampRateBlock' : camel === 'heatmap28d' ? 'heatmap' : camel
    return (chargeLabels.blocks as Record<string, string>)[key] ?? id
  }

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
      desktopCols: 2 as const,
      render: () => <WeeklyLoadChart payload={payload} />,
    }
    if (id === 'fitness-fatigue') return {
      id,
      label:  blockLabel(id),
      emoji:  '📈',
      desktopCols: 2 as const,
      render: () => <FitnessFatigueChart payload={payload} />,
    }
    if (id === 'sport-distribution') return {
      id,
      label:  blockLabel(id),
      emoji:  '🥧',
      render: () => <SportDistributionChart payload={payload} />,
    }
    if (id === 'intensity-distribution') return {
      id,
      label:  blockLabel(id),
      emoji:  '🔥',
      render: () => <IntensityDistributionChart payload={payload} />,
    }
    if (id === 'monotony-strain') return {
      id,
      label:  blockLabel(id),
      emoji:  '🌡️',
      render: () => <MonotonyStrainCard payload={payload} />,
    }
    if (id === 'top-activities') return {
      id,
      label:  blockLabel(id),
      emoji:  '🏅',
      desktopCols: 2 as const,
      render: () => <TopLoadActivitiesCard payload={payload} />,
    }
    if (id === 'heatmap-28d') return {
      id,
      label:  blockLabel(id),
      emoji:  '🗓️',
      desktopCols: 2 as const,
      render: () => <LoadHeatmap28d payload={payload} />,
    }
    if (id === 'ramp-rate') return {
      id,
      label:  blockLabel(id),
      emoji:  '↗️',
      render: () => <RampRateCard payload={payload} />,
    }
    if (id === 'insights') return {
      id,
      label:  blockLabel(id),
      emoji:  '💡',
      render: () => <LoadInsightsCard payload={payload} />,
    }
    // Fallback — should never be reached with 12 known IDs
    return {
      id,
      label:  blockLabel(id),
      emoji:  '⚡',
      render: () => <div className="text-[12px] text-trail-muted p-3">{id}</div>,
    }
  })

  if (payload.historyDays === 0) {
    return (
      <div className="px-3 py-3 max-w-lg mx-auto md:max-w-none md:px-6">
        <SportSegmentedTabs sport={sport} onChange={handleSportChange} />
        <div className="rounded-[12px] bg-trail-card border border-trail-border p-4 text-center text-trail-muted text-[13px]">
          {chargeLabels.noActivitiesForSport(sport === 'all' ? chargeLabels.allSport : sport)}
        </div>
      </div>
    )
  }

  return (
    <div className="px-3 py-3 max-w-lg mx-auto md:max-w-none md:px-6">
      <SportSegmentedTabs sport={sport} onChange={handleSportChange} />
      <BlockGrid storageKey="charge" defaultOrder={DEFAULT_ORDER} blocks={blocks} />
    </div>
  )
}
