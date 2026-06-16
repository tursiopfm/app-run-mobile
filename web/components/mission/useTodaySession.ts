'use client'

// Logique « séance du jour » partagée entre MissionPlan (fil « Ma semaine »)
// et ProchaineSeanceBlock (mode expert). Tout est calculé EN RENDER (pas de
// useEffect de sync) → le curseur et le fil restent cohérents sans décalage.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Props as PlanHeroCardProps } from './PlanHeroCard'
import {
  deletePlannedSession, getAllMacrocycles, getMainRace, getPlannedSessions,
  isRaceMirrorSession, pickActiveMacrocycle,
} from '@/lib/plan/storage'
import { adviseWeek, applySlider, type SliderBase, type SliderOutcome, type ReasonCode } from '@/lib/mission/session-advisor'
import { buildWeekFeed, sessionCategory, type FeedEntry } from '@/lib/mission/week-feed'
import { activityCategory } from '@/lib/plan/session-matching'
import { habitualWeekly } from '@/lib/mission/rhythm'
import { raceProfile } from '@/lib/mission/race-profile'
import { resolveMissionWeeklyTarget } from '@/lib/mission/weekly-target'
import { computeFreshness } from '@/lib/analytics/charge-insights'
import { estimateCharge } from '@/lib/training/charge'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import type { HrZone } from '@/lib/health/hr-zones'
import type { IntensityLevel, PlannedSession, Race, SessionTemplate, TrainingPlan } from '@/types/plan'
import { useT } from '@/lib/i18n/I18nProvider'

const DISCIPLINES = new Set(['run', 'bike', 'swim'])
const TYPE_ACCENT: Record<string, string> = {
  velo: 'var(--data-bike)', velotaf: 'var(--data-bike)', natation: 'var(--data-swim)',
}
const accentForType = (type: string): string => TYPE_ACCENT[type] ?? 'var(--primary)'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function isoOfWeekDay(idx: number): string {
  const now = new Date()
  const dow = now.getDay() || 7
  const d = new Date(now)
  d.setDate(now.getDate() - (dow - 1) + idx)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
function actKm(a: ActivityRow): number { return (a.manual_distance_m ?? a.distance_m ?? 0) / 1000 }

function daysUntil(dateISO: string): number {
  const today = new Date(`${todayISO()}T00:00:00`)
  const race = new Date(`${dateISO}T00:00:00`)
  return Math.max(0, Math.round((race.getTime() - today.getTime()) / 86_400_000))
}

export type NextSessionModalsState = {
  add: { open: boolean; dateISO: string; onClose: () => void; onPickTemplate: (t: SessionTemplate) => void; onCreateBlank: () => void }
  editor: { session: PlannedSession | null; initialDate: string; open: boolean; prefillTemplate: SessionTemplate | null; onClose: () => void; onSaved: () => void | Promise<void> }
  race: { open: boolean; onClose: () => void; onSaved: () => void }
}

export type TodaySession = {
  loaded: boolean
  heroProps: PlanHeroCardProps
  modalsState: NextSessionModalsState
  // extras consommés uniquement par MissionPlan :
  feed: FeedEntry[]
  today: string
  plan: TrainingPlan | null
  race: Race | null
  openAdd: (date: string) => void
  openEditSession: (s: PlannedSession) => void
  openCreateRace: () => void
}

type Params = {
  freshnessPayload: ChargeSportPayload | null
  recentActivities: ActivityRow[]
  hrZones: HrZone[]
  reloadKey?: number
  onSaved?: () => void
}

export function useTodaySession({ freshnessPayload, recentActivities, hrZones, reloadKey = 0, onSaved }: Params): TodaySession {
  const M = useT().mission

  const hrTargetLabel = (intensity: IntensityLevel): string | null => {
    const z = hrZones[intensity - 1]
    if (!z) return null
    const range = z.min != null ? `${z.min}–${z.max}` : `< ${z.max}`
    return `${z.name} · ${range} bpm`
  }

  const [plan, setPlan] = useState<TrainingPlan | null>(null)
  const [macros, setMacros] = useState<TrainingPlan[]>([])
  const [planned, setPlanned] = useState<PlannedSession[]>([])
  const [race, setRace] = useState<Race | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [internalReload, setInternalReload] = useState(0)
  const bumpReload = useCallback(() => setInternalReload(k => k + 1), [])

  const [addOpen, setAddOpen] = useState(false)
  const [addDate, setAddDate] = useState(todayISO())
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorSession, setEditorSession] = useState<PlannedSession | null>(null)
  const [editorPrefill, setEditorPrefill] = useState<SessionTemplate | null>(null)
  const [editorDate, setEditorDate] = useState(todayISO())
  const [createRaceOpen, setCreateRaceOpen] = useState(false)
  const [replaceIds, setReplaceIds] = useState<string[]>([])

  const [sliderPos, setSliderPosState] = useState(2)
  useEffect(() => {
    try {
      const v = localStorage.getItem(`tc_form_slider_${todayISO()}`)
      if (v != null) setSliderPosState(Number(v))
    } catch { /* ignore */ }
  }, [])
  const setSliderPos = useCallback((p: number) => {
    setSliderPosState(p)
    try { localStorage.setItem(`tc_form_slider_${todayISO()}`, String(p)) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const today = todayISO()
        const [allMacros, week, mainRace] = await Promise.all([
          getAllMacrocycles(),
          getPlannedSessions(isoOfWeekDay(0), isoOfWeekDay(6)),
          getMainRace(),
        ])
        if (cancelled) return
        setMacros(allMacros)
        setPlan(pickActiveMacrocycle(allMacros, today))
        setPlanned(week.filter(s => !isRaceMirrorSession(s)))
        setRace(mainRace)
      } catch { /* états vides : dégrade proprement */ }
      if (!cancelled) setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [internalReload, reloadKey])

  const today = todayISO()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => isoOfWeekDay(i)), [])

  const weekActivities = useMemo(
    () => recentActivities.filter(a => {
      const d = a.start_time.slice(0, 10)
      return d >= weekDates[0] && d <= weekDates[6]
        && DISCIPLINES.has(activityCategory(a.manual_sport_type ?? a.sport_type))
    }),
    [recentActivities, weekDates],
  )
  const weekPlanned = useMemo(
    () => planned.filter(s => DISCIPLINES.has(sessionCategory(s.type))),
    [planned],
  )

  const ctx = useMemo(() => {
    const weekDoneKm = weekActivities.reduce((s, a) => s + actKm(a), 0)
    const recentHardCount = weekPlanned.filter(s => s.status === 'completed' && s.intensity >= 4).length
    const freshnessZone = freshnessPayload ? computeFreshness(freshnessPayload.dailyMetrics).zone : null
    const planTarget = resolveMissionWeeklyTarget(macros, today)
    const targetKm = planTarget?.km ?? (habitualWeekly(recentActivities, today).km || null)
    const phaseType = plan?.phases.find(p => p.startDate <= today && today <= p.endDate)?.type ?? null
    return { todayISO: today, weekDates, freshnessZone, weekDoneKm, recentHardCount, targetKm, phaseType, daysToRace: race ? daysUntil(race.date) : null, raceProfile: raceProfile(race) }
  }, [weekActivities, weekPlanned, freshnessPayload, macros, plan, race, today, weekDates, recentActivities])

  const plannedInputs = (list: PlannedSession[]) => {
    const future = list.filter(s => s.date >= today && s.status !== 'completed')
    return {
      plannedDates: list.map(s => s.date),
      plannedRemainingKm: future.reduce((sum, s) => sum + (s.distance ?? 0), 0),
      hasPlannedLongRun: future.some(s => s.type === 'sortie_longue' || s.type === 'course'),
    }
  }

  const rec = adviseWeek({ ...ctx, ...plannedInputs(weekPlanned) }).today
  const todayPlanned = weekPlanned.find(s => s.date === today && s.status !== 'completed') ?? null
  const centerIsRest = !todayPlanned && rec.kind === 'rest'
  const sliderBase: SliderBase = todayPlanned
    ? { type: todayPlanned.type, title: todayPlanned.title, durationMin: todayPlanned.duration, distanceKm: todayPlanned.distance, elevationM: todayPlanned.elevation, intensity: todayPlanned.intensity }
    : rec.kind === 'suggested'
      ? { type: rec.session.type, title: M.sessionTitles[rec.session.titleKey] ?? rec.session.titleKey, durationMin: rec.session.durationMin, distanceKm: rec.session.distanceKm, elevationM: rec.session.elevationM, intensity: rec.session.intensity }
      : { type: 'footing', title: M.sessionTitles.sessionFooting, durationMin: 45, distanceKm: 8, intensity: 2 }
  const outcome = applySlider(sliderBase, sliderPos, centerIsRest)

  const outcomeToPlanned = (o: SliderOutcome): PlannedSession | null => {
    if (o.kind !== 'session') return null
    return { id: 'slider-today', planId: '', date: today, type: o.type, title: o.title, duration: o.durationMin, distance: o.distanceKm, elevation: o.elevationM, intensity: o.intensity, estimatedCharge: estimateCharge(o.durationMin, o.intensity, o.elevationM), status: 'planned' }
  }

  const todayDone = weekActivities.some(a => a.start_time.slice(0, 10) === today)
  const virtualToday = (!todayDone && outcome.kind === 'session') ? outcomeToPlanned(outcome) : null
  const effectivePlanned = todayDone
    ? weekPlanned
    : [...weekPlanned.filter(s => s.date !== today), ...(virtualToday ? [virtualToday] : [])]
  const finalAdvice = adviseWeek({ ...ctx, ...plannedInputs(effectivePlanned) })
  const feedRaw = buildWeekFeed({ weekDates, todayISO: today, activities: weekActivities, planned: effectivePlanned, advice: finalAdvice })
  const feed: FeedEntry[] = (!todayDone && outcome.kind === 'rest')
    ? feedRaw.map(e => e.date === today ? { date: today, isToday: true, kind: 'rest', reasonCode: 'rest-recovery' as ReasonCode } : e)
    : feedRaw

  // ─── Handlers ───────────────────────────────────────────────────────────
  const todaySessionIds = () => planned.filter(s => s.date === today).map(s => s.id)
  function openAdd(date: string) { setReplaceIds(date === today ? todaySessionIds() : []); setAddDate(date); setAddOpen(true) }
  function openEditSession(s: PlannedSession) { setReplaceIds([]); setEditorSession(s); setEditorPrefill(null); setEditorDate(s.date); setEditorOpen(true) }
  function openTodayEditor() {
    if (todayPlanned) {
      setReplaceIds(todaySessionIds().filter(id => id !== todayPlanned.id))
      setEditorSession(todayPlanned); setEditorPrefill(null); setEditorDate(today); setEditorOpen(true)
      return
    }
    if (outcome.kind !== 'session') { openAdd(today); return }
    setReplaceIds(todaySessionIds())
    setEditorSession({
      id: makeId(), planId: '', date: today, type: outcome.type, title: outcome.title,
      duration: outcome.durationMin, distance: outcome.distanceKm, elevation: outcome.elevationM, intensity: outcome.intensity,
      estimatedCharge: estimateCharge(outcome.durationMin, outcome.intensity, outcome.elevationM), status: 'planned',
    })
    setEditorPrefill(null); setEditorDate(today); setEditorOpen(true)
  }
  function handlePickTemplate(t: SessionTemplate) { setAddOpen(false); setEditorSession(null); setEditorPrefill(t); setEditorDate(addDate); setEditorOpen(true) }
  function handleCreateBlank() { setAddOpen(false); setEditorSession(null); setEditorPrefill(null); setEditorDate(addDate); setEditorOpen(true) }
  function goToCreateRace() { setCreateRaceOpen(true) }

  async function handleSessionSaved() {
    setEditorOpen(false)
    if (replaceIds.length > 0) {
      await Promise.all(replaceIds.map(id => deletePlannedSession(id)))
      setReplaceIds([])
    }
    if (editorDate === today) setSliderPos(2)
    bumpReload()
    onSaved?.()
  }

  // ─── heroProps (active | done | rest) ─────────────────────────────────────
  const atDefault = sliderPos === 2
  const doneEntry = feed.find(f => f.date === today)
  let heroProps: PlanHeroCardProps
  if (todayDone && doneEntry?.kind === 'done') {
    const t = doneEntry.multiple ? M.weekMultiSessions(doneEntry.count) : doneEntry.title
    heroProps = { state: 'done', title: t, km: doneEntry.km, dPlus: doneEntry.dPlus, durationSec: doneEntry.durationSec }
  } else if (outcome.kind === 'session') {
    const whyText = atDefault
      ? (todayPlanned ? null : (rec.kind === 'suggested' ? M.reasonWhy[rec.session.reasonCode] : null))
      : M.heroSliderAdjusted
    heroProps = {
      state: 'active', title: outcome.title, sessionType: outcome.type,
      durationMin: outcome.durationMin, distanceKm: outcome.distanceKm, elevationM: outcome.elevationM, intensity: outcome.intensity,
      whyText, targetLabel: hrTargetLabel(outcome.intensity), accentColor: accentForType(outcome.type),
      onOpen: openTodayEditor, sliderPos, onSliderChange: setSliderPos, onOpenLibrary: () => { setSliderPos(2); openAdd(today) },
    }
  } else {
    const text = !atDefault ? M.heroSliderAdjusted : (rec.kind === 'rest' ? M.reasonWhy[rec.reasonCode] : M.reasonWhy['rest-recovery'])
    heroProps = { state: 'rest', text, sliderPos, onSliderChange: setSliderPos, onOpenLibrary: () => { setSliderPos(2); openAdd(today) } }
  }

  const modalsState: NextSessionModalsState = {
    add: { open: addOpen, dateISO: addDate, onClose: () => setAddOpen(false), onPickTemplate: handlePickTemplate, onCreateBlank: handleCreateBlank },
    editor: { session: editorSession, initialDate: editorDate, open: editorOpen, prefillTemplate: editorPrefill, onClose: () => setEditorOpen(false), onSaved: handleSessionSaved },
    race: { open: createRaceOpen, onClose: () => setCreateRaceOpen(false), onSaved: bumpReload },
  }

  return { loaded, heroProps, modalsState, feed, today, plan, race, openAdd, openEditSession, openCreateRace: goToCreateRace }
}
