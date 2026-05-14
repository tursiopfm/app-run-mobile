'use client'

import { BlockGrid, useBlockContext, type BlockDef } from '@/components/blocks/BlockGrid'
import { ActivitiesBlock }  from './ActivitiesBlock'
import { GoalsBlock }       from './GoalsBlock'
import { WeeklyStatsBlock } from './WeeklyStatsBlock'
import { ChargeBlock }      from './ChargeBlock'
import { HistoryBlock }     from './HistoryBlock'
import { CumulBlock }       from './CumulBlock'
import { IntensityBlock }   from './IntensityBlock'
import { WeekBlock }        from './WeekBlock'
import type { SportOverview, DaySession } from '@/lib/data/dashboard'
import type { SportKey } from '@/lib/design/sports'

type Props = {
  sportOverviews: Record<SportKey, SportOverview>
  weekSessions:   DaySession[]
}

const DEFAULT_ORDER = ['activities', 'goals', 'weekly', 'charge', 'history', 'cumul', 'intensity', 'week']
const DEFAULT_HIDDEN = ['charge']

function BlockWithHide({ children }: { children: (onHide: () => void) => React.ReactNode }) {
  const { hideSelf } = useBlockContext()
  return <>{children(hideSelf)}</>
}

export function DashboardGrid({ sportOverviews, weekSessions }: Props) {
  const blocks: BlockDef[] = [
    { id: 'activities', label: 'Activités',        emoji: '🏅', render: () => <BlockWithHide>{(onHide) => <ActivitiesBlock  sportOverviews={sportOverviews} onHide={onHide} />}</BlockWithHide> },
    { id: 'goals',      label: 'Objectifs',        emoji: '🎯', render: () => <BlockWithHide>{(onHide) => <GoalsBlock       sportOverviews={sportOverviews} onHide={onHide} />}</BlockWithHide> },
    { id: 'weekly',     label: 'Volume & Ratio',   emoji: '📊', render: () => <BlockWithHide>{(onHide) => <WeeklyStatsBlock sportOverviews={sportOverviews} onHide={onHide} />}</BlockWithHide> },
    { id: 'charge',     label: 'Charge',           emoji: '⚡', render: () => <BlockWithHide>{(onHide) => <ChargeBlock      sportOverviews={sportOverviews} onHide={onHide} />}</BlockWithHide> },
    { id: 'history',    label: 'Historique',       emoji: '📅', render: () => <BlockWithHide>{(onHide) => <HistoryBlock     sportOverviews={sportOverviews} onHide={onHide} />}</BlockWithHide> },
    { id: 'cumul',      label: 'Cumul mensuel',    emoji: '📈', render: () => <BlockWithHide>{(onHide) => <CumulBlock       sportOverviews={sportOverviews} onHide={onHide} />}</BlockWithHide> },
    { id: 'intensity',  label: 'Intensité',        emoji: '🔥', render: () => <BlockWithHide>{(onHide) => <IntensityBlock   sportOverviews={sportOverviews} onHide={onHide} />}</BlockWithHide> },
    { id: 'week',       label: 'Semaine en cours', emoji: '🗓️', render: () => <WeekBlock sportOverviews={sportOverviews} allSessions={weekSessions} /> },
  ]
  return <BlockGrid storageKey="cockpit" defaultOrder={DEFAULT_ORDER} defaultHidden={DEFAULT_HIDDEN} blocks={blocks} />
}
