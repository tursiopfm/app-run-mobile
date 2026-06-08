'use client'

import type { MorningTodaySession } from '@/lib/data/morning-report'
import { SESSION_TYPE_LABELS } from '@/lib/activities/indicators'

const EXTRA_PLAN_LABELS: Record<string, string> = {
  recuperation: 'Récupération',
  repos:        'Repos',
  competition:  'Compétition',
  autre:        'Autre',
}

function labelForType(type: string): string {
  return (SESSION_TYPE_LABELS as Record<string, string>)[type]
      ?? EXTRA_PLAN_LABELS[type]
      ?? type
}

function formatDuration(min: number): string {
  if (min <= 0) return '—'
  return min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min} min`
}

export function SessionTodayBlock({ session }: { session: MorningTodaySession }) {
  if (session && session.type === 'repos') {
    return (
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
        <div className="flex items-center justify-between mb-[6px]">
          <h3 className="text-[15px] font-semibold text-trail-muted font-display">Séance du jour</h3>
          <span className="text-[11px] text-trail-success">Repos</span>
        </div>
        <h2
          className="text-[26px] leading-none text-trail-text"
          style={{ fontFamily: "var(--font-data)", letterSpacing: '0.02em' }}
        >
          Repos planifié
        </h2>
        <p className="text-[12px] text-trail-muted mt-1">
          Coupure prévue. Récup active OK si tu veux bouger un peu.
        </p>
      </div>
    )
  }

  return (
    <div
      className="rounded-[12px] border p-[10px]"
      style={{
        borderColor: 'rgba(255,107,53,0.35)',
        background:  'radial-gradient(100% 100% at 100% 0%, rgba(255,107,53,0.10) 0%, transparent 60%), var(--trail-card)',
      }}
    >
      <div className="flex items-center justify-between mb-[6px]">
        <h3 className="text-[15px] font-semibold text-trail-muted font-display">Séance du jour</h3>
      </div>
      {!session && <p className="text-[12px] text-trail-muted">Pas de séance prévue aujourd&apos;hui.</p>}
      {session && (
        <>
          <h2
            className="text-[26px] leading-none text-trail-text"
            style={{ fontFamily: "var(--font-data)", letterSpacing: '0.02em' }}
          >
            {session.title}
          </h2>
          <p className="text-[12px] text-trail-muted mt-1">{labelForType(session.type)}</p>
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-trail-border">
            <Kpi label="Durée"    value={formatDuration(session.duration)} />
            <Kpi label="Distance" value={session.distance ? `${session.distance} km` : '—'} />
            <Kpi label="D+"       value={session.elevation ? `${session.elevation} m` : '—'} />
          </div>
        </>
      )}
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] bg-trail-surface px-2 py-2 text-center">
      <p className="text-[12px] font-semibold text-trail-muted">{label}</p>
      <p
        className="text-[20px] leading-none mt-0.5 text-trail-text"
        style={{ fontFamily: "var(--font-data)" }}
      >
        {value}
      </p>
    </div>
  )
}
