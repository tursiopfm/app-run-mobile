'use client'

import type { WeatherResponse } from '@/lib/weather/open-meteo'
import { computeBestWindow, scoreHour } from '@/lib/weather/best-window'
import { ReportCard } from './ReportCard'

type Props =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: WeatherResponse }

const START_HOUR = 6
const END_HOUR = 22

function hourFromISO(iso: string): number {
  return parseInt(iso.slice(11, 13), 10)
}

function colorForScore(score: number): string {
  if (score >= 85) return 'var(--trail-success)'
  if (score >= 70) return 'rgba(74,222,128,0.6)'
  if (score >= 55) return 'var(--trail-warning)'
  if (score >= 40) return 'rgba(251,191,36,0.6)'
  if (score >= 25) return 'var(--trail-primary)'
  return 'rgba(56,189,248,0.5)'
}

export function BestWindowBlock(props: Props) {
  if (props.status !== 'ready') {
    return (
      <ReportCard label="Meilleur créneau aujourd'hui" accent="var(--trail-primary)">
        <p className="text-micro text-trail-muted">
          {props.status === 'loading' ? 'Calcul du meilleur créneau…' : 'Indisponible.'}
        </p>
      </ReportCard>
    )
  }

  const { hourly } = props.data
  const hourScores = new Map<number, number>()
  for (const h of hourly) {
    const hour = hourFromISO(h.time)
    hourScores.set(hour, scoreHour(h))
  }

  const best = computeBestWindow(hourly)

  const bars: { hour: number; score: number; height: number }[] = []
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    const score = hourScores.get(h) ?? 0
    const height = Math.max(20, score)
    bars.push({ hour: h, score, height })
  }

  return (
    <ReportCard label="Meilleur créneau aujourd'hui" accent="var(--trail-primary)">
      <div className="flex gap-[3px] h-6 items-end">
        {bars.map(b => {
          const isBest = best != null && b.hour >= best.startHour && b.hour <= best.endHour
          return (
            <div
              key={b.hour}
              className="flex-1 rounded-sm"
              style={{
                background: colorForScore(b.score),
                height:     `${b.height}%`,
                outline:    isBest ? '1.5px solid var(--trail-primary)' : undefined,
                outlineOffset: '-1px',
              }}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-[9px] mt-1.5 text-trail-muted">
        <span>{START_HOUR}h</span><span>10h</span><span>14h</span><span>18h</span><span>{END_HOUR}h</span>
      </div>
      <p className="text-micro mt-2.5 text-trail-text">
        {best ? (
          <>
            <span className="font-bold text-trail-primary">
              {best.startHour}h-{best.endHour}h
            </span>{' '}
            optimal · score moyen {best.avgScore}/100
          </>
        ) : (
          <span className="text-trail-muted">Pas de créneau optimal aujourd&apos;hui — conditions difficiles.</span>
        )}
      </p>
    </ReportCard>
  )
}
