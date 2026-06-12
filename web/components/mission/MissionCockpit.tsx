'use client'

// Écran Cockpit du Mode Mission v2 — « je pilote » :
// Briefing → État de forme → Ma semaine → Cap de la semaine → Altitude.
// Spec : docs/superpowers/specs/2026-06-12-mode-mission-v2-3-piliers-design.md

import { useEffect, useState } from 'react'
import { MorningReportTile } from '@/components/cockpit/MorningReportTile'
import { MissionCard, MissionCardLabel, DayDot, CapGauge, type DayDotState } from './cards'
import { FormeCard } from './FormeCard'
import { getAllMacrocycles, getPlannedSessions, isRaceMirrorSession } from '@/lib/plan/storage'
import { resolveMissionWeeklyTarget, expectedWeekFraction, type MissionWeeklyTarget } from '@/lib/mission/weekly-target'
import { computeTriWeek, formatHoursMin } from '@/lib/mission/tri-week'
import { defaultSportForDiscipline } from '@/lib/design/sport-settings'
import type { SportOverview } from '@/lib/data/dashboard'
import type { SportKey } from '@/lib/design/sports'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import type { PlannedSession } from '@/types/plan'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = {
  sportOverviews: Record<SportKey, SportOverview>
  freshnessPayload: ChargeSportPayload | null
  discipline: string | null
}

const SPORT_DOT_COLOR: Record<string, string> = {
  run: 'var(--data-run)', ride: 'var(--data-bike)', swim: 'var(--data-swim)',
}

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

export function MissionCockpit({ sportOverviews, freshnessPayload, discipline }: Props) {
  const M = useT().mission
  const sport: SportKey = defaultSportForDiscipline(discipline) ?? 'run'
  const isTri = sport === 'all'
  const o = sportOverviews[sport]

  // Cible hebdo + sessions planifiées de la semaine (client, comme les blocs Plan).
  const [target, setTarget] = useState<MissionWeeklyTarget | null>(null)
  const [planned, setPlanned] = useState<PlannedSession[]>([])
  useEffect(() => {
    void (async () => {
      const [macros, sessions] = await Promise.all([
        getAllMacrocycles(),
        getPlannedSessions(isoOfWeekDay(0), isoOfWeekDay(6)),
      ])
      setTarget(resolveMissionWeeklyTarget(macros, todayISO()))
      setPlanned(sessions.filter(s => !isRaceMirrorSession(s)))
    })()
  }, [])

  // États des 7 pastilles : fait (volume ce jour) > aujourd'hui > à venir (séance planifiée) > repos.
  const today = todayISO()
  const dots: { state: DayDotState; color?: string }[] = (o?.dailyLabels ?? ['L','M','M','J','V','S','D']).map((_, i) => {
    const iso = isoOfWeekDay(i)
    const km = o?.dailyKm?.[i] ?? 0
    const dur = o?.dailyDurationSec?.[i] ?? 0
    if (km > 0 || dur > 0) return { state: 'done', color: isTri ? undefined : SPORT_DOT_COLOR[sport] }
    if (iso === today) return { state: 'today' }
    if (iso > today && planned.some(s => s.date === iso)) return { state: 'upcoming' }
    return iso > today ? { state: 'upcoming' } : { state: 'rest' }
  })

  const tri = isTri ? computeTriWeek(sportOverviews) : null
  const frac = expectedWeekFraction(today)
  const volPct = target && target.km > 0 ? ((o?.weekKm ?? 0) / target.km) * 100 : 0
  const dplusPct = target && target.dPlus > 0 ? ((o?.weekDPlus ?? 0) / target.dPlus) * 100 : 0
  const onTrack = target != null && volPct >= frac * 100 - 15

  // Tendance 6 semaines (weeklyPoints contient la série hebdo, on prend les 6 dernières).
  const weekly = (o?.weeklyPoints ?? []).slice(-6)
  const maxKm = Math.max(1, ...weekly.map(w => w.km))
  const trend = weekly.length >= 2
    ? (weekly[weekly.length - 1].km >= weekly[weekly.length - 2].km ? 'up' : 'down')
    : 'stable'

  return (
    <div className="space-y-3">
      <MorningReportTile />

      {freshnessPayload && <FormeCard payload={freshnessPayload} />}

      {/* Ma semaine */}
      <MissionCard>
        <div className="mb-3"><MissionCardLabel>{M.weekTitle}</MissionCardLabel></div>
        <div className="flex justify-between mb-4">
          {dots.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-semibold text-trail-muted">{o?.dailyLabels?.[i] ?? ''}</span>
              <DayDot state={d.state} color={d.color} />
            </div>
          ))}
        </div>
        {isTri && tri ? (
          <div className="flex items-end gap-4">
            <p className="font-display text-[40px] font-bold leading-none text-trail-text">{formatHoursMin(tri.totalSec)}</p>
            <p className="text-[11px] pb-1 font-semibold text-trail-muted">
              <span style={{ color: 'var(--data-swim)' }}>{formatHoursMin(tri.swimSec)} nat</span>
              {' · '}
              <span style={{ color: 'var(--data-bike)' }}>{formatHoursMin(tri.rideSec)} vélo</span>
              {' · '}
              <span style={{ color: 'var(--data-run)' }}>{formatHoursMin(tri.runSec)} cap</span>
            </p>
          </div>
        ) : (
          <div className="flex items-end gap-4">
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
          </div>
        )}
      </MissionCard>

      {/* Cap de la semaine — seulement si un plan actif fournit une cible */}
      {target && (
        <MissionCard>
          <div className="flex items-center justify-between mb-3">
            <MissionCardLabel>{M.capTitle}</MissionCardLabel>
            <p className="text-[10px] font-semibold text-trail-muted">{M.capPhasePrefix} {target.phaseLabel}</p>
          </div>
          <div className="space-y-3.5">
            <div>
              <div className="flex justify-between text-[12px] mb-1.5">
                <span className="text-trail-muted">{M.capVolume}</span>
                <span className="font-bold text-trail-text">
                  {Math.round(o?.weekKm ?? 0)} <span className="text-trail-muted">/ {target.km} km</span>
                </span>
              </div>
              <CapGauge pct={volPct} markerPct={frac * 100} color="var(--primary)" />
            </div>
            <div>
              <div className="flex justify-between text-[12px] mb-1.5">
                <span className="text-trail-muted">{M.capDplus}</span>
                <span className="font-bold" style={{ color: 'var(--status-info)' }}>
                  {Math.round(o?.weekDPlus ?? 0).toLocaleString('fr-FR')} <span className="text-trail-muted">/ {target.dPlus.toLocaleString('fr-FR')} m</span>
                </span>
              </div>
              <CapGauge pct={dplusPct} markerPct={frac * 100} color="var(--status-info)" />
            </div>
          </div>
          <p className="text-[11px] mt-3 text-trail-muted">
            {M.capMarkerHint} {onTrack ? M.capOnTrack : M.capBehind}
          </p>
        </MissionCard>
      )}

      {/* Altitude · 6 semaines */}
      {weekly.length >= 2 && (
        <MissionCard>
          <div className="flex items-center justify-between mb-3">
            <MissionCardLabel>{M.altitudeTitle}</MissionCardLabel>
            <p className="text-[11px] font-bold" style={{ color: trend === 'up' ? 'var(--status-success)' : trend === 'down' ? 'var(--status-warning)' : 'var(--trail-muted)' }}>
              {trend === 'up' ? M.altitudeUp : trend === 'down' ? M.altitudeDown : M.altitudeStable}
            </p>
          </div>
          <div className="flex items-end gap-2 h-[64px]">
            {weekly.map((w, i) => (
              <div
                key={w.weekLabel}
                className="flex-1 rounded-t"
                style={{
                  height: `${Math.max(6, (w.km / maxKm) * 100)}%`,
                  background: i === weekly.length - 1 ? 'var(--primary)' : 'var(--ink-500)',
                }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[9px] mt-1.5 text-trail-muted">
            {weekly.map((w, i) => (
              <span key={w.weekLabel} style={i === weekly.length - 1 ? { color: 'var(--primary-text)', fontWeight: 700 } : undefined}>
                {w.weekLabel}
              </span>
            ))}
          </div>
        </MissionCard>
      )}
    </div>
  )
}
