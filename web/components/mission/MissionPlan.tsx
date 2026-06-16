'use client'

// Écran Plan du Mode Mission v2 — « feuille de route tournée vers l'avant » :
// Héros « Ta prochaine séance » → Ma semaine (réalisé + suggéré + ajout) →
// Destination compacte (ou bloc générique « Ton rythme » sans course) → Coach.
// Spec : docs/superpowers/specs/2026-06-13-onglet-plan-mode-mission-design.md
// Maquette : Prompts/plan-tab-mission-final-mockup.html

import Link from 'next/link'
import { MissionCard, MissionCardLabel } from './cards'
import { PlanHeroCard } from './PlanHeroCard'
import { RythmeCard } from './RythmeCard'
import { weeklyVolumes, habitualWeekly } from '@/lib/mission/rhythm'
import { computePhaseSegments, weekOfPlan } from '@/lib/mission/prepa'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import type { HrZone } from '@/lib/health/hr-zones'
import { useT } from '@/lib/i18n/I18nProvider'
import { useTodaySession } from './useTodaySession'
import { NextSessionModals } from './NextSessionModals'

type Props = {
  freshnessPayload: ChargeSportPayload | null
  recentActivities: ActivityRow[]   // 28 derniers jours
  hrZones: HrZone[]                  // zones FC de l'athlète (cible des séances)
}

const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const CAT_COLOR: Record<string, string> = {
  run: 'var(--primary)', bike: 'var(--data-bike)', swim: 'var(--data-swim)', other: 'var(--ink-500)',
}

function daysUntil(dateISO: string): number {
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const todayDate = new Date(`${today}T00:00:00`)
  const race = new Date(`${dateISO}T00:00:00`)
  return Math.max(0, Math.round((race.getTime() - todayDate.getTime()) / 86_400_000))
}

function fmtKmDp(km: number, dPlus: number, sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60)
  const dur = h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}'`
  return `${km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km · ${dPlus} · ${dur}`
}
// Métrique compacte d'une séance planifiée/suggérée (durée · distance · D+).
function fmtMeta(min: number, km?: number, elev?: number): string {
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  const dur = h > 0 ? (m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`) : `${m}'`
  return [dur, km ? `${km} km` : null, elev ? `+${elev} m` : null].filter(Boolean).join(' · ')
}

export function MissionPlan({ freshnessPayload, recentActivities, hrZones }: Props) {
  const M = useT().mission
  const { loaded, heroProps, modalsState, feed, today, plan, race, openAdd, openEditSession, openCreateRace } =
    useTodaySession({ freshnessPayload, recentActivities, hrZones })

  if (!loaded) return null

  const week = plan ? weekOfPlan(plan, today) : null
  const segments = plan ? computePhaseSegments(plan, today) : []

  return (
    <div className="px-3 py-3 max-w-lg mx-auto space-y-3">
      {/* ① Héros : ta prochaine séance */}
      <PlanHeroCard {...heroProps} />

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
              // Jour passé + séance non réalisée → « non réalisé » (croix rouge).
              const missed = !entry.completed && !entry.isToday && entry.date < today
              const status = entry.completed ? M.statusDone
                : entry.isToday ? M.statusToday
                  : missed ? M.weekStatusMissed
                    : M.statusUpcoming
              const statusColor = entry.completed ? 'var(--status-success)'
                : entry.isToday ? 'var(--primary-text)'
                  : missed ? 'var(--status-danger)'
                    : 'var(--trail-muted)'
              return (
                <button key={entry.date} type="button" onClick={() => openEditSession(s)} className={`flex w-full items-center gap-2.5 py-[9px] text-left ${sep}`} style={rowStyle}>
                  {dayLabel}{tick}
                  <span className={`flex-1 text-[13px] truncate ${entry.isToday ? 'font-bold text-trail-text' : missed ? 'text-trail-muted' : 'text-trail-text'}`}>{s.title}</span>
                  {!missed && <span className="text-[11px] tabular-nums whitespace-nowrap text-trail-muted">{fmtMeta(s.duration, s.distance, s.elevation)}</span>}
                  <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: statusColor }}>
                    {missed ? '✗ ' : ''}{status}
                  </span>
                </button>
              )
            }

            if (entry.kind === 'suggested') {
              const s = entry.session
              const chip = M.reasonChips[s.reasonCode]
              return (
                <div key={entry.date} className={`flex items-center gap-2.5 py-[9px] ${sep}`} style={rowStyle}>
                  {dayLabel}{tick}
                  <span className="flex-1 text-[13px] truncate text-trail-text">{M.sessionTitles[s.titleKey] ?? s.titleKey}</span>
                  <span className="text-[11px] tabular-nums whitespace-nowrap text-trail-muted">{fmtMeta(s.durationMin, s.distanceKm, s.elevationM)}</span>
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
          onAddRace={openCreateRace}
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
      <NextSessionModals state={modalsState} />
    </div>
  )
}
