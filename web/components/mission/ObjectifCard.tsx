'use client'

// Bloc « Objectif » (design A) : 3 barres avec repère « attendu aujourd'hui ».
// Semaine = override user sinon cible du plan ; année = objectif saisi sinon projection.

import { MissionCard, MissionCardLabel, CapGauge } from './cards'
import { yearElapsedFraction, projectYearKm, type MissionGoals } from '@/lib/mission/goals'
import { expectedWeekFraction, type MissionWeeklyTarget } from '@/lib/mission/weekly-target'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = {
  goals: MissionGoals
  planTarget: MissionWeeklyTarget | null
  weekKm: number
  weekDPlus: number
  ytdKm: number
  todayISO: string
  onEditGoals?: () => void
}

function Row({ label, value, target, color, pct, markerPct }: {
  label: string; value: string; target: string; color: string; pct: number; markerPct?: number
}) {
  return (
    <div>
      <div className="flex justify-between text-[12px] mb-1.5">
        <span className="text-trail-muted">{label}</span>
        <span className="font-display font-bold tabular-nums text-trail-text">
          <span style={{ color }}>{value}</span>{' '}
          <span className="text-trail-muted">{target}</span>
        </span>
      </div>
      <CapGauge pct={pct} markerPct={markerPct} color={color} />
    </div>
  )
}

export function ObjectifCard({ goals, planTarget, weekKm, weekDPlus, ytdKm, todayISO, onEditGoals }: Props) {
  const M = useT().mission

  const weekTarget = goals.weekKm ?? planTarget?.km
  const dpTarget = goals.weekDPlus ?? planTarget?.dPlus
  // Objectif annuel absent ou à 0 = pas d'objectif → on affiche la projection
  // (barre verte seule), pas une barre « … / 0 km ».
  const yearTarget = goals.yearKm && goals.yearKm > 0 ? goals.yearKm : undefined

  const frac = expectedWeekFraction(todayISO)
  const yearFrac = yearElapsedFraction(todayISO)

  const volPct = weekTarget && weekTarget > 0 ? (weekKm / weekTarget) * 100 : 0
  const dpPct = dpTarget && dpTarget > 0 ? (weekDPlus / dpTarget) * 100 : 0
  const yearPct = yearTarget && yearTarget > 0 ? (ytdKm / yearTarget) * 100 : 0

  const projection = !yearTarget ? projectYearKm(ytdKm, todayISO) : null

  const hasBars = (weekTarget != null) || (dpTarget != null) || (yearTarget != null) || (projection != null)
  if (!hasBars) return null

  const onTrack = weekTarget != null && volPct >= frac * 100 - 15

  return (
    <MissionCard>
      <div className="mb-3">
        <MissionCardLabel>{M.objectifTitle}</MissionCardLabel>
      </div>
      <div className="space-y-3.5">
        {weekTarget != null && (
          <Row
            label={M.goalsWeekKm}
            value={String(Math.round(weekKm))}
            target={`/ ${weekTarget} km`}
            color="var(--primary)"
            pct={volPct}
            markerPct={frac * 100}
          />
        )}
        {dpTarget != null && (
          <Row
            label={M.goalsWeekDPlus}
            value={Math.round(weekDPlus).toLocaleString('fr-FR')}
            target={`/ ${Math.round(dpTarget).toLocaleString('fr-FR')} m`}
            color="var(--status-info)"
            pct={dpPct}
            markerPct={frac * 100}
          />
        )}
        {yearTarget != null && (
          <Row
            label={M.goalsYearLabel}
            value={ytdKm.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
            target={`/ ${yearTarget.toLocaleString('fr-FR')} km`}
            color="var(--status-success)"
            pct={yearPct}
            markerPct={yearFrac * 100}
          />
        )}
        {projection != null && (
          <div>
            <div className="flex justify-between text-[12px] mb-1.5">
              <span className="text-trail-muted">{M.goalsProjLabel}</span>
              <span className="font-display font-bold tabular-nums" style={{ color: 'var(--status-success)' }}>
                {M.projArrow(
                  ytdKm.toLocaleString('fr-FR', { maximumFractionDigits: 0 }),
                  projection.toLocaleString('fr-FR'),
                )}
              </span>
            </div>
            <CapGauge pct={yearFrac * 100} color="var(--status-success)" />
            <p className="text-[10px] mt-1.5 text-trail-muted">
              {M.goalsProjectionNote}{' '}
              {onEditGoals && (
                <button onClick={onEditGoals} className="underline font-bold">{M.goalsDefine}</button>
              )}
            </p>
          </div>
        )}
      </div>
      {weekTarget != null && (
        <p className="text-[11px] mt-3 text-trail-muted">
          {M.capMarkerHint} {onTrack ? M.capOnTrack : M.capBehind}
        </p>
      )}
    </MissionCard>
  )
}
