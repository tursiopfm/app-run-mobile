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
import { FreshnessCard }         from '@/components/charge/blocks/FreshnessCard'
import type { SportOverview, DaySession } from '@/lib/data/dashboard'
import type { SportKey } from '@/lib/design/sports'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import type { AppMode } from '@/lib/preferences/app-mode'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { useT } from '@/lib/i18n/I18nProvider'
import { defaultSportForDiscipline } from '@/lib/design/sport-settings'

type Props = {
  sportOverviews: Record<SportKey, SportOverview>
  weekSessions:   DaySession[]
  latestPerSport: Record<SportKey, ActivityRow | null>
  weekActivities: ActivityRow[]
  athleteProfile: AthleteHrProfile
  mode?: AppMode
  freshnessPayload?: ChargeSportPayload | null
  discipline?: string | null
  mission?: string | null
}

const DEFAULT_ORDER = ['morningReport', 'activities', 'charge', 'lastActivity', 'goals', 'weekly', 'history', 'cumul', 'intensity', 'week', 'weekActivities']
const DEFAULT_HIDDEN: string[] = []

// Sous-ensemble « essentiel novice » affiché en Mode Mission (ordre fixe,
// lecture seule). Inclut le bloc Fraîcheur importé de l'onglet Charge.
const MISSION_VISIBLE = ['morningReport', 'activities', 'lastActivity', 'goals', 'weekly', 'week', 'cumul', 'freshness']

function BlockWithHide({ children }: { children: (onHide: () => void) => React.ReactNode }) {
  const { hideSelf } = useBlockContext()
  return <>{children(hideSelf)}</>
}

export function DashboardGrid({ sportOverviews, weekSessions, latestPerSport, weekActivities, athleteProfile, mode = 'expert', freshnessPayload, discipline, mission }: Props) {
  const L = useT().cockpit.blockLabel
  const defaultSport = defaultSportForDiscipline(discipline)
  const blocks: BlockDef[] = [
    { id: 'morningReport', label: L.morningReport, emoji: '📋', desktopCols: 2, render: () => <MorningReportTile /> },
    { id: 'activities',     label: L.activities,     emoji: '🏅', render: () => <BlockWithHide>{(onHide) => <ActivitiesBlock      sportOverviews={sportOverviews} onHide={onHide} defaultSport={defaultSport} />}</BlockWithHide> },
    { id: 'lastActivity',   label: L.lastActivity,   emoji: '🥇', render: () => <BlockWithHide>{(onHide) => <LastActivityBlock    latestPerSport={latestPerSport} athleteProfile={athleteProfile} onHide={onHide} defaultSport={defaultSport} />}</BlockWithHide> },
    { id: 'goals',          label: L.goals,          emoji: '🎯', render: () => <BlockWithHide>{(onHide) => <GoalsBlock           sportOverviews={sportOverviews} onHide={onHide} defaultSport={defaultSport} />}</BlockWithHide> },
    { id: 'weekly',         label: L.weekly,         emoji: '📊', render: () => <BlockWithHide>{(onHide) => <WeeklyStatsBlock     sportOverviews={sportOverviews} onHide={onHide} defaultSport={defaultSport} />}</BlockWithHide> },
    { id: 'charge',         label: L.charge,         emoji: '⚡', render: () => <BlockWithHide>{(onHide) => <ChargeBlock          sportOverviews={sportOverviews} onHide={onHide} defaultSport={defaultSport} />}</BlockWithHide> },
    { id: 'history',        label: L.history,        emoji: '📅', desktopCols: 2, render: () => <BlockWithHide>{(onHide) => <HistoryBlock         sportOverviews={sportOverviews} onHide={onHide} defaultSport={defaultSport} />}</BlockWithHide> },
    { id: 'cumul',          label: L.cumul,          emoji: '📈', desktopCols: 2, render: () => <BlockWithHide>{(onHide) => <CumulBlock           sportOverviews={sportOverviews} onHide={onHide} defaultSport={defaultSport} />}</BlockWithHide> },
    { id: 'intensity',      label: L.intensity,      emoji: '🔥', render: () => <BlockWithHide>{(onHide) => <IntensityBlock       sportOverviews={sportOverviews} onHide={onHide} defaultSport={defaultSport} />}</BlockWithHide> },
    { id: 'week',           label: L.week,           emoji: '🗓️', desktopCols: 2, render: () => <WeekBlock sportOverviews={sportOverviews} allSessions={weekSessions} /> },
    { id: 'weekActivities', label: L.weekActivities, emoji: '📋', desktopCols: 2, render: () => <BlockWithHide>{(onHide) => <WeekActivitiesBlock  activities={weekActivities} onHide={onHide} />}</BlockWithHide> },
  ]

  // Bloc Fraîcheur : uniquement en Mode Mission (payload fetché côté page).
  // Réutilise le composant de prod → hérite du correctif fraîcheur.
  // Const capturée : préserve le narrowing dans la closure render().
  const fp = freshnessPayload
  if (fp) {
    blocks.push({ id: 'freshness', label: 'Fraîcheur', emoji: '🌬️', render: () => <FreshnessCard payload={fp} /> })
  }

  let missionVisible = mode === 'mission'
    ? MISSION_VISIBLE.filter(id => id !== 'freshness' || freshnessPayload != null)
    : undefined
  // Emphase Charge : si l'objectif d'onboarding est « Suivre ma charge », on met
  // le bloc Charge en avant (juste après le rapport matinal) en Mode Mission.
  if (missionVisible && mission === 'charge' && !missionVisible.includes('charge')) {
    missionVisible = ['morningReport', 'charge', ...missionVisible.filter(id => id !== 'morningReport')]
  }

  return (
    <BlockGrid
      storageKey="cockpit"
      defaultOrder={DEFAULT_ORDER}
      defaultHidden={DEFAULT_HIDDEN}
      blocks={blocks}
      missionVisible={missionVisible}
    />
  )
}
