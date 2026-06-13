'use client'

// Écran Plan du Mode Mission v2 — « feuille de route tournée vers l'avant » :
// Héros « Ta prochaine séance » → Ma semaine (réalisé + suggéré + ajout) →
// Destination compacte (ou bloc générique « Ton rythme » sans course) → Coach.
// Spec : docs/superpowers/specs/2026-06-13-onglet-plan-mode-mission-design.md
// Maquette : Prompts/plan-tab-mission-final-mockup.html

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { MissionCard, MissionCardLabel } from './cards'
import { PlanHeroCard } from './PlanHeroCard'
import { RythmeCard } from './RythmeCard'
import { SessionAddSheet } from '@/components/plan/SessionAddSheet'
import { SessionEditorModal } from '@/components/plan/SessionEditorModal'
import { RaceEditorModal } from '@/components/plan/RaceEditorModal'
import {
  getAllMacrocycles, getMainRace, getPlannedSessions, isRaceMirrorSession,
  pickActiveMacrocycle, savePlannedSession,
} from '@/lib/plan/storage'
import { adviseWeek } from '@/lib/mission/session-advisor'
import { buildWeekFeed } from '@/lib/mission/week-feed'
import { weeklyVolumes, habitualWeekly } from '@/lib/mission/rhythm'
import { resolveMissionWeeklyTarget } from '@/lib/mission/weekly-target'
import { computePhaseSegments, weekOfPlan } from '@/lib/mission/prepa'
import { computeFreshness } from '@/lib/analytics/charge-insights'
import { estimateCharge } from '@/lib/training/charge'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import type { PlannedSession, Race, SessionTemplate, TrainingPlan } from '@/types/plan'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = {
  freshnessPayload: ChargeSportPayload | null
  recentActivities: ActivityRow[]   // 28 derniers jours
}

const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const CAT_COLOR: Record<string, string> = {
  run: 'var(--primary)', bike: 'var(--data-bike)', swim: 'var(--data-swim)', other: 'var(--ink-500)',
}
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

function daysUntil(dateISO: string): number {
  const today = new Date(`${todayISO()}T00:00:00`)
  const race = new Date(`${dateISO}T00:00:00`)
  return Math.max(0, Math.round((race.getTime() - today.getTime()) / 86_400_000))
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function actKm(a: ActivityRow): number { return (a.manual_distance_m ?? a.distance_m ?? 0) / 1000 }
function fmtKmDp(km: number, dPlus: number, sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60)
  const dur = h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}'`
  return `${km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km · ${dPlus} · ${dur}`
}

export function MissionPlan({ freshnessPayload, recentActivities }: Props) {
  const M = useT().mission

  const [macros, setMacros] = useState<TrainingPlan[]>([])
  const [plan, setPlan] = useState<TrainingPlan | null>(null)
  const [planned, setPlanned] = useState<PlannedSession[]>([])
  const [race, setRace] = useState<Race | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const bumpReload = useCallback(() => setReloadKey(k => k + 1), [])

  // Modales (mêmes composants que le mode expert).
  const [addOpen, setAddOpen] = useState(false)
  const [addDate, setAddDate] = useState(todayISO())
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorSession, setEditorSession] = useState<PlannedSession | null>(null)
  const [editorPrefill, setEditorPrefill] = useState<SessionTemplate | null>(null)
  const [editorDate, setEditorDate] = useState(todayISO())
  const [createRaceOpen, setCreateRaceOpen] = useState(false)

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
      } catch { /* états vides : l'écran dégrade proprement */ }
      if (!cancelled) setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [reloadKey])

  const today = todayISO()
  // Dates de la semaine : dérivées de la date du jour (pas réactives) → calcul au mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => isoOfWeekDay(i)), [])

  // Activités réalisées de la semaine courante (filtre des 28 jours reçus).
  const weekActivities = useMemo(
    () => recentActivities.filter(a => {
      const d = a.start_time.slice(0, 10)
      return d >= weekDates[0] && d <= weekDates[6]
    }),
    [recentActivities, weekDates],
  )

  const advice = useMemo(() => {
    const weekDoneKm = weekActivities.reduce((s, a) => s + actKm(a), 0)
    const recentHardCount = planned.filter(s => s.status === 'completed' && s.intensity >= 4).length
    const freshnessZone = freshnessPayload ? computeFreshness(freshnessPayload.dailyMetrics).zone : null
    const planTarget = resolveMissionWeeklyTarget(macros, today)
    const targetKm = planTarget?.km ?? (habitualWeekly(recentActivities, today).km || null)
    // Type stable de la phase active (enum), pas le libellé d'affichage.
    const phaseType = plan?.phases.find(p => p.startDate <= today && today <= p.endDate)?.type ?? null
    return adviseWeek({
      todayISO: today, weekDates, freshnessZone, weekDoneKm, recentHardCount,
      targetKm, phaseType, daysToRace: race ? daysUntil(race.date) : null,
      plannedDates: planned.map(s => s.date),
    })
  }, [weekActivities, planned, freshnessPayload, macros, plan, race, today, weekDates, recentActivities])

  const feed = useMemo(
    () => buildWeekFeed({ weekDates, todayISO: today, activities: weekActivities, planned, advice }),
    [weekDates, today, weekActivities, planned, advice],
  )

  // ─── Handlers héros ──────────────────────────────────────────────────────
  const handleHeroDone = useCallback(async () => {
    const todays = planned.find(s => s.date === today)
    if (todays) {
      await savePlannedSession({ ...todays, status: 'completed' })
    } else {
      const s = advice.today.kind === 'suggested' ? advice.today.session : null
      const duration = s?.durationMin ?? 45
      const intensity = s?.intensity ?? 2
      await savePlannedSession({
        id: makeId(), planId: '', date: today,
        type: s?.type ?? 'footing',
        title: s ? (M.sessionTitles[s.titleKey] ?? s.titleKey) : M.heroRestName,
        duration, distance: s?.distanceKm, intensity,
        estimatedCharge: estimateCharge(duration, intensity, undefined),
        status: 'completed',
      })
    }
    bumpReload()
  }, [planned, today, advice, M, bumpReload])

  function openAdd(date: string) { setAddDate(date); setAddOpen(true) }

  function openEditSession(s: PlannedSession) {
    setEditorSession(s); setEditorPrefill(null); setEditorDate(s.date); setEditorOpen(true)
  }

  // « Décaler » : ouvre l'éditeur sur la séance (planifiée, ou créée à la volée
  // depuis la suggestion) pour que l'athlète change le jour avant d'enregistrer.
  function handleHeroMove() {
    const todays = planned.find(s => s.date === today)
    if (todays) { openEditSession(todays); return }
    const s = advice.today.kind === 'suggested' ? advice.today.session : null
    if (!s) { openAdd(today); return }
    setEditorSession({
      id: makeId(), planId: '', date: today, type: s.type,
      title: M.sessionTitles[s.titleKey] ?? s.titleKey,
      duration: s.durationMin, distance: s.distanceKm, intensity: s.intensity,
      estimatedCharge: estimateCharge(s.durationMin, s.intensity, undefined),
      status: 'planned',
    })
    setEditorPrefill(null); setEditorDate(today); setEditorOpen(true)
  }

  function handlePickTemplate(t: SessionTemplate) {
    setAddOpen(false); setEditorSession(null); setEditorPrefill(t); setEditorDate(addDate); setEditorOpen(true)
  }
  function handleCreateBlank() {
    setAddOpen(false); setEditorSession(null); setEditorPrefill(null); setEditorDate(addDate); setEditorOpen(true)
  }

  // Création de course IN-PLACE (le fond reste le Plan Mission) ; au save on
  // rafraîchit → la course apparaît en Destination, sans bascule vers l'expert.
  const goToCreateRace = () => setCreateRaceOpen(true)

  if (!loaded) return null

  // ─── Héros ─────────────────────────────────────────────────────────────────
  const todayEntry = feed.find(f => f.date === today)
  let hero: ReactNode = null
  if (todayEntry?.kind === 'done') {
    const heroTitle = todayEntry.multiple ? M.weekMultiSessions(todayEntry.count) : todayEntry.title
    hero = <PlanHeroCard state="done" title={heroTitle} km={todayEntry.km} dPlus={todayEntry.dPlus} durationSec={todayEntry.durationSec} />
  } else if (todayEntry?.kind === 'planned') {
    const s = todayEntry.session
    hero = (
      <PlanHeroCard
        state="active" title={s.title} durationMin={s.duration} distanceKm={s.distance}
        intensity={s.intensity} whyText={null} accentColor={accentForType(s.type)}
        onDone={handleHeroDone} onMove={handleHeroMove} onOther={() => openAdd(today)}
      />
    )
  } else if (todayEntry?.kind === 'suggested') {
    const s = todayEntry.session
    hero = (
      <PlanHeroCard
        state="active" title={M.sessionTitles[s.titleKey] ?? s.titleKey} durationMin={s.durationMin}
        distanceKm={s.distanceKm} intensity={s.intensity} whyText={M.reasonWhy[s.reasonCode]}
        accentColor={accentForType(s.type)}
        onDone={handleHeroDone} onMove={handleHeroMove} onOther={() => openAdd(today)}
      />
    )
  } else {
    const code = todayEntry?.kind === 'rest' ? todayEntry.reasonCode : 'rest-recovery'
    hero = <PlanHeroCard state="rest" text={M.reasonWhy[code]} />
  }

  const week = plan ? weekOfPlan(plan, today) : null
  const segments = plan ? computePhaseSegments(plan, today) : []

  return (
    <div className="px-3 py-3 max-w-lg mx-auto space-y-3">
      {/* ① Héros : ta prochaine séance */}
      {hero}

      {/* ② Ma semaine : fil réalisé + suggéré + ajout */}
      <MissionCard>
        <div className="flex items-center justify-between mb-2">
          <MissionCardLabel>{M.weekFeedTitle}</MissionCardLabel>
          <span className="text-[10px] font-semibold text-trail-muted">{M.weekFeedSubtitle}</span>
        </div>
        <div>
          {feed.map((entry, i) => {
            const tick = <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.kind === 'rest' ? 'var(--ink-500)' : CAT_COLOR[entry.category] }} />
            const rowStyle = entry.isToday
              ? { background: 'var(--primary-glow)', borderRadius: 10, paddingLeft: 8, paddingRight: 8, marginLeft: -8, marginRight: -8 }
              : undefined
            const dayLabel = (
              <span className="w-[30px] text-[11px] font-bold uppercase tracking-[0.04em]"
                    style={{ color: entry.isToday ? 'var(--primary-text)' : 'var(--trail-muted)' }}>
                {DAY_SHORT[i]}
              </span>
            )
            const sep = i < feed.length - 1 && !entry.isToday ? 'border-b border-trail-border' : ''

            if (entry.kind === 'done') {
              const inner = (
                <>
                  {dayLabel}{tick}
                  <span className="flex-1 text-[13px] truncate text-trail-text">{entry.multiple ? M.weekMultiSessions(entry.count) : entry.title}</span>
                  <span className="text-[11.5px] tabular-nums whitespace-nowrap text-trail-muted">{fmtKmDp(entry.km, entry.dPlus, entry.durationSec)}</span>
                  <span className="text-[12px] font-bold" style={{ color: 'var(--status-success)' }}>✓</span>
                </>
              )
              const href = entry.multiple ? `/activities?full=1&date=${entry.date}` : `/activities/${entry.activityId}`
              return (
                <Link key={entry.date} href={href} className={`flex items-center gap-2.5 py-[9px] ${sep}`} style={rowStyle}>{inner}</Link>
              )
            }

            if (entry.kind === 'planned') {
              const s = entry.session
              const status = s.status === 'completed' ? M.statusDone : entry.isToday ? M.statusToday : M.statusUpcoming
              return (
                <button key={entry.date} type="button" onClick={() => openEditSession(s)} className={`flex w-full items-center gap-2.5 py-[9px] text-left ${sep}`} style={rowStyle}>
                  {dayLabel}{tick}
                  <span className={`flex-1 text-[13px] truncate ${entry.isToday ? 'font-bold text-trail-text' : 'text-trail-text'}`}>{s.title}</span>
                  <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: s.status === 'completed' ? 'var(--status-success)' : entry.isToday ? 'var(--primary-text)' : 'var(--trail-muted)' }}>{status}</span>
                </button>
              )
            }

            if (entry.kind === 'suggested') {
              const s = entry.session
              const chip = s.reasonCode === 'fill-volume-long' && s.reasonParam
                ? `+${s.reasonParam} km`
                : M.reasonChips[s.reasonCode]
              return (
                <div key={entry.date} className={`flex items-center gap-2.5 py-[9px] ${sep}`} style={rowStyle}>
                  {dayLabel}{tick}
                  <span className="flex-1 text-[13px] truncate text-trail-text">{M.sessionTitles[s.titleKey] ?? s.titleKey}</span>
                  <span className="text-[9.5px] font-semibold px-2 py-[2px] rounded-full" style={{ background: 'var(--primary-glow)', color: 'var(--primary-text)', border: '1px solid rgba(255,121,0,0.30)' }}>{chip}</span>
                </div>
              )
            }

            // rest
            return (
              <div key={entry.date} className={`flex items-center gap-2.5 py-[9px] ${sep}`} style={rowStyle}>
                {dayLabel}{tick}
                <span className="flex-1 text-[13px] text-trail-muted">{M.restDay}</span>
                <span className="text-[9.5px] font-semibold px-2 py-[2px] rounded-full" style={{ background: 'rgba(74,222,128,0.12)', color: 'var(--status-success)', border: '1px solid rgba(74,222,128,0.30)' }}>{M.reasonChips[entry.reasonCode]}</span>
              </div>
            )
          })}
          <button type="button" onClick={() => openAdd(today)}
                  className="flex w-full items-center gap-2 mt-2 px-2.5 py-[9px] rounded-[10px] border border-dashed border-trail-border text-trail-muted text-[12px] font-semibold">
            {M.weekAddSession}
          </button>
        </div>
      </MissionCard>

      {/* ③ Destination compacte + frise (ou bloc générique « Ton rythme ») */}
      {race ? (
        <Link href={`/plan/courses/${race.id}`} className="block">
          <MissionCard>
            <div className="flex items-center justify-between mb-2">
              <MissionCardLabel>{week ? `${M.destinationTitle} · ${M.prepaWeekOf(week.week, week.total)}` : M.destinationTitle}</MissionCardLabel>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--primary-text)' }}>{M.destinationTableLink}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-display text-[30px] font-bold leading-none" style={{ color: 'var(--primary)' }}>J-{daysUntil(race.date)}</p>
                <p className="text-[13px] font-bold mt-1 text-trail-text">{race.name}</p>
              </div>
              {segments.length > 0 && (
                <div className="flex-1">
                  <div className="flex gap-1 mb-1.5">
                    {segments.map((seg, i) => (
                      <div key={i} className={`h-[7px] relative ${i === 0 ? 'rounded-l-full' : ''} ${i === segments.length - 1 ? 'rounded-r-full' : ''}`}
                           style={{ width: `${seg.widthPct}%`, background: seg.active ? 'var(--primary)' : 'var(--ink-500)' }}>
                        {seg.cursorPct != null && <span className="absolute -top-[3px] w-[3px] h-[13px] rounded bg-white" style={{ left: `${seg.cursorPct}%` }} />}
                      </div>
                    ))}
                  </div>
                  <div className="flex text-[9px] text-trail-muted">
                    {segments.map((seg, i) => (
                      <span key={i} style={{ width: `${seg.widthPct}%`, ...(seg.active ? { color: 'var(--primary-text)', fontWeight: 700 } : {}) }}>{seg.label}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </MissionCard>
        </Link>
      ) : (
        <RythmeCard
          weeks={weeklyVolumes(recentActivities, today, 4)}
          avgKm={habitualWeekly(recentActivities, today).km}
          onAddRace={goToCreateRace}
        />
      )}

      {/* ④ Affiner avec le coach (placeholder — module IA à venir) */}
      <button type="button" disabled
              className="w-full p-3 rounded-2xl flex items-center justify-center gap-2 text-[13px] font-bold opacity-80"
              style={{ border: '1.5px solid var(--primary)', color: 'var(--primary-text)', background: 'transparent' }}>
        {M.coachRefine}
        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-trail-border text-trail-muted">{M.coachSoon}</span>
      </button>

      {/* Modales (mêmes que le mode expert) */}
      <SessionAddSheet open={addOpen} dateISO={addDate} onClose={() => setAddOpen(false)} onPickTemplate={handlePickTemplate} onCreateBlank={handleCreateBlank} />
      <SessionEditorModal session={editorSession} initialDate={editorDate} open={editorOpen} prefillTemplate={editorPrefill} onClose={() => setEditorOpen(false)} onSaved={() => { setEditorOpen(false); bumpReload() }} />
      {/* onSaved NE FERME PAS la modale : comme en expert, RaceEditorModal
          enchaîne sur son écran « Course créée » (→ recherche du tableau de
          course). La fermeture se fait via son propre onClose. */}
      <RaceEditorModal race={null} open={createRaceOpen} onClose={() => setCreateRaceOpen(false)} onSaved={bumpReload} />
    </div>
  )
}
