'use client'

// Écran Cockpit du Mode Mission v2 — « je pilote » :
// Briefing → État de forme → Ma semaine → Objectif → Sessions → Cumul.
// Spec : docs/superpowers/specs/2026-06-12-mode-mission-v2-3-piliers-design.md

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MorningReportTile } from '@/components/cockpit/MorningReportTile'
import { MissionCard, MissionCardLabel, DayDot, type DayDotState } from './cards'
import { FormeCard } from './FormeCard'
import { GoalsModal } from './GoalsModal'
import { ObjectifCard } from './ObjectifCard'
import { SessionsSemaineCard } from './SessionsSemaineCard'
import { CumulCard } from './CumulCard'
import { MissionDetailSheet } from './MissionDetailSheet'
import { ActivitiesBlock } from '@/components/cockpit/ActivitiesBlock'
import { WeeklyStatsBlock } from '@/components/cockpit/WeeklyStatsBlock'
import { getAllMacrocycles, getPlannedSessions, isRaceMirrorSession } from '@/lib/plan/storage'
import { resolveMissionWeeklyTarget, type MissionWeeklyTarget } from '@/lib/mission/weekly-target'
import { readMissionGoals } from '@/lib/mission/goals'
import { computeTriWeek, formatHoursMin } from '@/lib/mission/tri-week'
import { defaultSportForDiscipline } from '@/lib/design/sport-settings'
import type { SportOverview } from '@/lib/data/dashboard'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import type { SportKey } from '@/lib/design/sports'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import type { PlannedSession } from '@/types/plan'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = {
  sportOverviews: Record<SportKey, SportOverview>
  freshnessPayload: ChargeSportPayload | null
  discipline: string | null
  weekActivities: ActivityRow[]
}

const SPORT_DOT_COLOR: Record<string, string> = {
  run: 'var(--data-run)', ride: 'var(--data-bike)', swim: 'var(--data-swim)',
}

const DAY_ABBR = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoOfWeekDay(idx: number): string {
  // idx 0..6 = lundi..dimanche de la semaine courante (heure locale).
  const now = new Date()
  const dow = now.getDay() || 7
  const d = new Date(now)
  d.setDate(now.getDate() - (dow - 1) + idx)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function MissionCockpit({ sportOverviews, freshnessPayload, discipline, weekActivities }: Props) {
  const M = useT().mission
  const router = useRouter()
  const sport: SportKey = defaultSportForDiscipline(discipline) ?? 'run'
  const isTri = sport === 'all'
  const o = sportOverviews[sport]

  // Cible hebdo + sessions planifiées de la semaine (client, comme les blocs Plan).
  const [target, setTarget] = useState<MissionWeeklyTarget | null>(null)
  const [planned, setPlanned] = useState<PlannedSession[]>([])
  const [showGoals, setShowGoals] = useState(false)
  const [showVolume, setShowVolume] = useState(false)
  const [goalsVersion, setGoalsVersion] = useState(0)

  // Activités réalisées de la semaine indexées par date (clé = YYYY-MM-DD local
  // étiqueté UTC, cf. start_time). Sert au clic sur une pastille de jour.
  const activitiesByDay = useMemo(() => {
    const m = new Map<string, ActivityRow[]>()
    for (const a of weekActivities) {
      const key = a.start_time.slice(0, 10)
      const arr = m.get(key)
      if (arr) arr.push(a)
      else m.set(key, [a])
    }
    return m
  }, [weekActivities])

  // Clic sur un jour : 1 activité → son détail ; plusieurs → onglet Activités
  // filtré sur la date.
  function goToDay(iso: string) {
    const acts = activitiesByDay.get(iso) ?? []
    if (acts.length === 0) return
    if (acts.length === 1) router.push(`/activities/${acts[0].id}`)
    else router.push(`/activities?full=1&date=${iso}`)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [macros, sessions] = await Promise.all([
          getAllMacrocycles(),
          getPlannedSessions(isoOfWeekDay(0), isoOfWeekDay(6)),
        ])
        if (cancelled) return
        setTarget(resolveMissionWeeklyTarget(macros, todayISO()))
        setPlanned(sessions.filter(s => !isRaceMirrorSession(s)))
      } catch { /* cible et séances restent vides : cartes Cap/pastilles dégradent proprement */ }
    })()
    return () => { cancelled = true }
  }, [])

  // Objectifs utilisateur. `goalsVersion` force la relecture après sauvegarde
  // dans la modal (volontairement dans les deps même s'il n'est pas lu).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const goals = useMemo(() => readMissionGoals(sport), [sport, goalsVersion])

  // États des 7 pastilles : fait (volume ce jour) > aujourd'hui > à venir (séance planifiée) > repos.
  const today = todayISO()
  const dots: { state: DayDotState; color?: string }[] = DAY_ABBR.map((_, i) => {
    const iso = isoOfWeekDay(i)
    const km = o?.dailyKm?.[i] ?? 0
    const dur = o?.dailyDurationSec?.[i] ?? 0
    if (km > 0 || dur > 0) return { state: 'done', color: isTri ? undefined : SPORT_DOT_COLOR[sport] }
    if (iso === today) return { state: 'today' }
    if (iso > today && planned.some(s => s.date === iso)) return { state: 'upcoming' }
    return { state: 'rest' }
  })

  const tri = isTri ? computeTriWeek(sportOverviews) : null

  return (
    <div className="space-y-3">
      <MorningReportTile />

      {freshnessPayload && <FormeCard payload={freshnessPayload} />}

      {/* Ma semaine */}
      <MissionCard>
        <div className="flex items-center justify-between mb-3">
          <MissionCardLabel>{M.weekTitle}</MissionCardLabel>
          <button
            type="button"
            onClick={() => setShowGoals(true)}
            className="text-[11px] font-bold rounded-full px-2.5 py-[3px] border"
            style={{ borderColor: 'var(--primary)', color: 'var(--primary-text)' }}
          >
            {M.goalsButton}
          </button>
        </div>
        <div className="flex justify-between mb-4">
          {dots.map((d, i) => {
            const iso = isoOfWeekDay(i)
            const clickable = (activitiesByDay.get(iso)?.length ?? 0) > 0
            const inner = (
              <>
                <span className="text-[10px] font-semibold text-trail-muted">{DAY_ABBR[i]}</span>
                <DayDot state={d.state} color={d.color} />
              </>
            )
            return clickable ? (
              <button key={i} type="button" onClick={() => goToDay(iso)} className="flex flex-col items-center gap-1">
                {inner}
              </button>
            ) : (
              <div key={i} className="flex flex-col items-center gap-1">{inner}</div>
            )
          })}
        </div>
        {/* km/D+ (ou heures tri) → ouvre la page « Mon volume » (blocs Activités + Semaines Vol/Ratio Expert) */}
        <button type="button" onClick={() => setShowVolume(true)} className="flex w-full items-end gap-4 text-left">
          {isTri && tri ? (
            <>
              <p className="font-display text-[40px] font-bold leading-none text-trail-text">{formatHoursMin(tri.totalSec)}</p>
              <p className="text-[11px] pb-1 font-semibold text-trail-muted">
                <span style={{ color: 'var(--data-swim)' }}>{formatHoursMin(tri.swimSec)} nat</span>
                {' · '}
                <span style={{ color: 'var(--data-bike)' }}>{formatHoursMin(tri.rideSec)} vélo</span>
                {' · '}
                <span style={{ color: 'var(--data-run)' }}>{formatHoursMin(tri.runSec)} cap</span>
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-[40px] font-bold leading-none text-trail-text">
                {Math.round(o?.weekKm ?? 0)}<span className="text-[20px] text-trail-muted"> km</span>
              </p>
              <div className="pb-0.5">
                <p className="font-display text-[20px] font-semibold leading-none" style={{ color: 'var(--status-info)' }}>
                  +{Math.round(o?.weekDPlus ?? 0).toLocaleString('fr-FR')} m
                </p>
                <p className="text-[10px] mt-0.5 uppercase tracking-wider text-trail-muted">
                  D+ · {M.weekSessionsCount(o?.weekSessions ?? 0)}
                </p>
              </div>
            </>
          )}
        </button>
      </MissionCard>

      <ObjectifCard
        goals={goals}
        planTarget={target}
        weekKm={o?.weekKm ?? 0}
        weekDPlus={o?.weekDPlus ?? 0}
        ytdKm={o?.ytdKm ?? 0}
        todayISO={today}
        onEditGoals={() => setShowGoals(true)}
      />

      {showGoals && (
        <GoalsModal
          sport={sport}
          defaults={{ weekKm: target?.km, weekDPlus: target?.dPlus }}
          onClose={() => setShowGoals(false)}
          onSaved={() => setGoalsVersion(v => v + 1)}
        />
      )}

      <SessionsSemaineCard activities={weekActivities} />

      {o && <CumulCard overview={o} sport={sport} />}

      {showVolume && (
        <MissionDetailSheet title={M.volumeDetailTitle} onClose={() => setShowVolume(false)}>
          <ActivitiesBlock sportOverviews={sportOverviews} defaultSport={sport} showFreshness={false} />
          <WeeklyStatsBlock sportOverviews={sportOverviews} defaultSport={sport} />
        </MissionDetailSheet>
      )}
    </div>
  )
}
