'use client'

import { BlockGrid, useBlockContext, type BlockDef } from '@/components/blocks/BlockGrid'
import { ActivitiesBlock }       from './ActivitiesBlock'
import { LastActivityBlock, type AthleteHrProfile }     from './LastActivityBlock'
import { WeekActivitiesBlock }   from './WeekActivitiesBlock'
import { GoalsBlock }            from './GoalsBlock'
import { WeeklyStatsBlock }      from './WeeklyStatsBlock'
import { ChargeBlock }           from './ChargeBlock'
import { HistoryBlock }          from './HistoryBlock'
import { CumulBlock }            from './CumulBlock'
import { IntensityBlock }        from './IntensityBlock'
import { WeekBlock }             from './WeekBlock'
import { MorningReportTile }     from './MorningReportTile'
import type { SportOverview, DaySession } from '@/lib/data/dashboard'
import type { SportKey } from '@/lib/design/sports'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = {
  sportOverviews: Record<SportKey, SportOverview>
  weekSessions:   DaySession[]
  latestPerSport: Record<SportKey, ActivityRow | null>
  weekActivities: ActivityRow[]
  athleteProfile: AthleteHrProfile
}

const DEFAULT_ORDER = ['morningReport', 'activities', 'charge', 'lastActivity', 'goals', 'weekly', 'history', 'cumul', 'intensity', 'week', 'weekActivities']
const DEFAULT_HIDDEN: string[] = []

function BlockWithHide({ children }: { children: (onHide: () => void) => React.ReactNode }) {
  const { hideSelf } = useBlockContext()
  return <>{children(hideSelf)}</>
}

export function DashboardGrid({ sportOverviews, weekSessions, latestPerSport, weekActivities, athleteProfile }: Props) {
  const L = useT().cockpit.blockLabel
  const blocks: BlockDef[] = [
    { id: 'morningReport', label: L.morningReport, emoji: '📋', render: () => <MorningReportTile /> },
    { id: 'activities',     label: L.activities,     emoji: '🏅', render: () => <BlockWithHide>{(onHide) => <ActivitiesBlock      sportOverviews={sportOverviews} onHide={onHide} />}</BlockWithHide> },
    { id: 'lastActivity',   label: L.lastActivity,   emoji: '🥇', render: () => <BlockWithHide>{(onHide) => <LastActivityBlock    latestPerSport={latestPerSport} athleteProfile={athleteProfile} onHide={onHide} />}</BlockWithHide> },
    { id: 'goals',          label: L.goals,          emoji: '🎯', render: () => <BlockWithHide>{(onHide) => <GoalsBlock           sportOverviews={sportOverviews} onHide={onHide} />}</BlockWithHide> },
    { id: 'weekly',         label: L.weekly,         emoji: '📊', render: () => <BlockWithHide>{(onHide) => <WeeklyStatsBlock     sportOverviews={sportOverviews} onHide={onHide} />}</BlockWithHide> },
    { id: 'charge',         label: L.charge,         emoji: '⚡', render: () => <BlockWithHide>{(onHide) => <ChargeBlock          sportOverviews={sportOverviews} onHide={onHide} />}</BlockWithHide> },
    { id: 'history',        label: L.history,        emoji: '📅', render: () => <BlockWithHide>{(onHide) => <HistoryBlock         sportOverviews={sportOverviews} onHide={onHide} />}</BlockWithHide> },
    { id: 'cumul',          label: L.cumul,          emoji: '📈', render: () => <BlockWithHide>{(onHide) => <CumulBlock           sportOverviews={sportOverviews} onHide={onHide} />}</BlockWithHide> },
    { id: 'intensity',      label: L.intensity,      emoji: '🔥', render: () => <BlockWithHide>{(onHide) => <IntensityBlock       sportOverviews={sportOverviews} onHide={onHide} />}</BlockWithHide> },
    { id: 'week',           label: L.week,           emoji: '🗓️', render: () => <WeekBlock sportOverviews={sportOverviews} allSessions={weekSessions} /> },
    { id: 'weekActivities', label: L.weekActivities, emoji: '📋', render: () => <BlockWithHide>{(onHide) => <WeekActivitiesBlock  activities={weekActivities} onHide={onHide} />}</BlockWithHide> },
  ]
  return <BlockGrid storageKey="cockpit" defaultOrder={DEFAULT_ORDER} defaultHidden={DEFAULT_HIDDEN} blocks={blocks} />
}
