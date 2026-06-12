'use client'

// Écran Plan du Mode Mission v2 — « ma feuille de route, jusqu'à la course » :
// Séance du jour → Semaine → Destination (course) → Ma prépa → Coach IA.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MissionCard, MissionCardLabel } from './cards'
import {
  getAllMacrocycles, getMainRace, getPlannedSessions, isRaceMirrorSession, pickActiveMacrocycle,
} from '@/lib/plan/storage'
import { computePrepaProgress, computePhaseSegments, weekOfPlan } from '@/lib/mission/prepa'
import type { PlannedSession, Race, RaceWaypoint, TrainingPlan } from '@/types/plan'
import { useT } from '@/lib/i18n/I18nProvider'

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

const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function formatTarget(min: number | undefined): string | null {
  if (!min || min <= 0) return null
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

function daysUntil(dateISO: string): number {
  const today = new Date(`${todayISO()}T00:00:00`)
  const race = new Date(`${dateISO}T00:00:00`)
  return Math.max(0, Math.round((race.getTime() - today.getTime()) / 86_400_000))
}

// Teinte du héros « séance du jour » selon la discipline (spec : la séance
// porte sa discipline — vélo vert, natation bleu, défaut orange).
function sessionAccent(type: string | undefined): { color: string; glow: string } {
  if (type === 'velo' || type === 'velotaf') return { color: 'var(--data-bike)', glow: 'rgba(39,169,113,0.14)' }
  if (type === 'natation') return { color: 'var(--data-swim)', glow: 'rgba(75,180,230,0.14)' }
  return { color: 'var(--primary)', glow: 'var(--primary-glow)' }
}

export function MissionPlan() {
  const M = useT().mission
  const [planned, setPlanned] = useState<PlannedSession[]>([])
  const [prepaSessions, setPrepaSessions] = useState<PlannedSession[]>([])
  const [race, setRace] = useState<Race | null>(null)
  const [plan, setPlan] = useState<TrainingPlan | null>(null)
  const [waypoints, setWaypoints] = useState<RaceWaypoint[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const today = todayISO()
        const [macros, week, mainRace] = await Promise.all([
          getAllMacrocycles(),
          getPlannedSessions(isoOfWeekDay(0), isoOfWeekDay(6)),
          getMainRace(),
        ])
        if (cancelled) return
        const active = pickActiveMacrocycle(macros, today)
        setPlan(active)
        setPlanned(week.filter(s => !isRaceMirrorSession(s)))
        setRace(mainRace)
        if (active) {
          const all = await getPlannedSessions(active.startDate, active.endDate)
          if (cancelled) return
          setPrepaSessions(all)
        }
        if (mainRace) {
          try {
            const res = await fetch(`/api/races/${mainRace.id}/waypoints`)
            if (res.ok && !cancelled) {
              const json = (await res.json()) as { waypoints: RaceWaypoint[] }
              setWaypoints(json.waypoints ?? [])
            }
          } catch { /* profil optionnel */ }
        }
      } catch { /* états restent vides : écran dégrade proprement */ }
      if (!cancelled) setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [])

  const today = todayISO()
  const todaySession = planned.find(s => s.date === today) ?? null
  const prepa = computePrepaProgress(prepaSessions)
  const segments = plan ? computePhaseSegments(plan, today) : []
  const week = plan ? weekOfPlan(plan, today) : null

  // Mini profil : altitude nette cumulée (dPlus - dMoins) par waypoint.
  const profile = waypoints.filter(w => w.dPlus != null).map(w => ({
    km: w.km, alt: (w.dPlus ?? 0) - (w.dMoins ?? 0), ravito: w.type === 'ravito',
  }))
  const maxAlt = Math.max(1, ...profile.map(p => p.alt))
  const maxKm = race?.distance ?? Math.max(1, ...profile.map(p => p.km))
  const pathD = profile.length >= 2
    ? `M0,62 ${profile.map(p => `L${(p.km / maxKm) * 340},${62 - (p.alt / maxAlt) * 50}`).join(' ')} L340,62 Z`
    : null

  if (!loaded) return null

  const accent = sessionAccent(todaySession?.type)

  return (
    <div className="px-3 py-3 max-w-lg mx-auto space-y-3">
      {/* 1 · Séance du jour — teintée par la discipline de la séance */}
      <div
        className="rounded-[16px] border p-5"
        style={{
          background: `linear-gradient(150deg, ${accent.glow} 0%, var(--trail-card) 55%)`,
          borderColor: accent.color,
        }}
      >
        <p className="text-[10px] uppercase tracking-[0.15em] font-bold mb-3" style={{ color: accent.color }}>
          {M.todayTitle}
        </p>
        {todaySession ? (
          <>
            <p className="font-display text-[32px] font-bold leading-none text-trail-text">{todaySession.title}</p>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-[12px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'var(--primary)', color: 'var(--ink-900)' }}>
                {formatTarget(todaySession.duration) ?? `${todaySession.duration} min`}
              </span>
              <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-trail-border text-trail-muted">
                {M.intensityLabel} {'●'.repeat(todaySession.intensity)}{'○'.repeat(5 - todaySession.intensity)}
              </span>
            </div>
            {todaySession.notes && (
              <p className="text-[13px] mt-3.5 leading-relaxed text-trail-muted">{todaySession.notes}</p>
            )}
          </>
        ) : (
          <p className="font-display text-[32px] font-bold leading-none text-trail-muted">{M.restDay}</p>
        )}
      </div>

      {/* 2 · Ma semaine d'entraînement */}
      <MissionCard>
        <div className="mb-3"><MissionCardLabel>{M.weekPlanTitle}</MissionCardLabel></div>
        <div className="space-y-1 text-[13px]">
          {DAY_SHORT.map((label, i) => {
            const iso = isoOfWeekDay(i)
            const s = planned.find(x => x.date === iso) ?? null
            const isToday = iso === today
            return (
              <div
                key={label}
                className={`flex items-center justify-between py-1 ${isToday ? 'px-2 -mx-2 rounded-[10px]' : ''}`}
                style={isToday ? { background: 'var(--primary-glow)' } : undefined}
              >
                <span className={`w-9 ${isToday ? 'font-bold' : ''}`} style={{ color: isToday ? 'var(--primary-text)' : 'var(--trail-muted)' }}>
                  {label}
                </span>
                <span className={`flex-1 ${isToday ? 'font-bold text-trail-text' : s ? 'text-trail-muted' : ''}`}
                      style={!s ? { color: 'var(--text-disabled)' } : undefined}>
                  {s ? s.title : M.restDay}
                </span>
                <span className="font-bold" style={{
                  color: s?.status === 'completed' ? 'var(--status-success)'
                    : isToday ? 'var(--primary-text)' : 'var(--trail-muted)',
                }}>
                  {s?.status === 'completed' ? M.statusDone : isToday ? M.statusToday : s ? M.statusUpcoming : M.statusRest}
                </span>
              </div>
            )
          })}
        </div>
      </MissionCard>

      {/* 3 · Destination */}
      {race ? (
        <Link href={`/plan/courses/${race.id}`} className="block">
          <MissionCard>
            <div className="flex items-center justify-between mb-1">
              <MissionCardLabel>{M.destinationTitle}</MissionCardLabel>
              <p className="text-[11px] font-semibold" style={{ color: 'var(--primary-text)' }}>{M.destinationTableLink}</p>
            </div>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-[36px] font-bold leading-none" style={{ color: 'var(--primary)' }}>
                  J-{daysUntil(race.date)}
                </p>
                <p className="text-[14px] font-bold mt-1.5 text-trail-text">{race.name}</p>
                <p className="text-[11px] mt-0.5 text-trail-muted">
                  {new Date(`${race.date}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  {' · '}{race.distance} km · <span style={{ color: 'var(--status-info)' }}>+{race.elevation.toLocaleString('fr-FR')} m</span>
                  {formatTarget(race.targetDurationMin) && <> · {M.destinationTargetPrefix} {formatTarget(race.targetDurationMin)}</>}
                </p>
              </div>
              {pathD && (
                <svg viewBox="0 0 340 70" className="w-[120px] mt-1 shrink-0">
                  <path d={pathD} fill="rgba(56,189,248,0.16)" stroke="var(--status-info)" strokeWidth="2" />
                  {profile.filter(p => p.ravito).map((p, i) => (
                    <circle key={i} cx={(p.km / maxKm) * 340} cy={62 - (p.alt / maxAlt) * 50} r="5" fill="var(--primary)" />
                  ))}
                </svg>
              )}
            </div>
          </MissionCard>
        </Link>
      ) : (
        <MissionCard className="text-center">
          <p className="text-[24px]">🏁</p>
          <p className="text-[14px] font-semibold mt-1.5 text-trail-text">{M.destinationEmptyTitle}</p>
          <p className="text-[12px] mt-1 text-trail-muted">{M.destinationEmptyBody}</p>
          {/* ?full=1 : ouvre la vue Plan complète (gestion des courses) — /plan nu re-rendrait cet écran */}
          <Link
            href="/plan?full=1"
            className="inline-block mt-3.5 px-5 py-2.5 rounded-full text-[13px] font-bold"
            style={{ background: 'var(--primary)', color: 'var(--ink-900)' }}
          >
            {M.destinationEmptyCta}
          </Link>
        </MissionCard>
      )}

      {/* 4 · Ma prépa */}
      {plan && week && (
        <MissionCard>
          <div className="flex items-center justify-between mb-3">
            <MissionCardLabel>{M.prepaTitle}</MissionCardLabel>
            <p className="text-[11px] font-bold" style={{ color: 'var(--primary-text)' }}>{M.prepaWeekOf(week.week, week.total)}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-[72px] h-[72px] shrink-0">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="var(--trail-border)" strokeWidth="11" />
                <circle
                  cx="60" cy="60" r="52" fill="none" stroke="var(--status-success)" strokeWidth="11"
                  strokeLinecap="round" strokeDasharray={`${(prepa.pct / 100) * 326.7} 326.7`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="font-display text-[18px] font-bold text-trail-text">{prepa.pct}<span className="text-[10px]">%</span></p>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold mb-2 text-trail-text">{M.prepaSessions(prepa.done, prepa.total)}</p>
              <div className="flex gap-1 mb-1.5">
                {segments.map((seg, i) => (
                  <div
                    key={i}
                    className={`h-[7px] relative ${i === 0 ? 'rounded-l-full' : ''} ${i === segments.length - 1 ? 'rounded-r-full' : ''}`}
                    style={{ width: `${seg.widthPct}%`, background: seg.active ? 'var(--primary)' : 'var(--ink-500)' }}
                  >
                    {seg.cursorPct != null && (
                      <span className="absolute -top-[3px] w-[3px] h-[13px] rounded bg-white" style={{ left: `${seg.cursorPct}%` }} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex text-[9px] text-trail-muted">
                {segments.map((seg, i) => (
                  <span key={i} style={{ width: `${seg.widthPct}%`, ...(seg.active ? { color: 'var(--primary-text)', fontWeight: 700 } : {}) }}>
                    {seg.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </MissionCard>
      )}

      {/* 5 · Coach IA (placeholder — le module n'existe pas encore) */}
      <button
        type="button"
        disabled
        className="w-full p-3.5 rounded-2xl flex items-center justify-center gap-2 text-[14px] font-bold opacity-80"
        style={{ border: '1.5px solid var(--primary)', color: 'var(--primary-text)', background: 'transparent' }}
      >
        {M.coachButton}
        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-trail-border text-trail-muted">
          {M.coachBadge}
        </span>
      </button>
    </div>
  )
}
