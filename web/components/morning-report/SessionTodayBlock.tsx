'use client'

import { useEffect, useState } from 'react'
import { getPlannedSessions } from '@/lib/plan/storage'
import type { PlannedSession } from '@/types/plan'
import { SESSION_TYPE_LABELS } from '@/lib/activities/indicators'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

export function SessionTodayBlock() {
  const [session, setSession] = useState<PlannedSession | null | undefined>(undefined)

  useEffect(() => {
    const today = todayISO()
    let cancelled = false
    getPlannedSessions(today, today)
      .then(list => { if (!cancelled) setSession(list[0] ?? null) })
      .catch(() => { if (!cancelled) setSession(null) })
    return () => { cancelled = true }
  }, [])

  return (
    <div
      className="rounded-[12px] border p-[10px]"
      style={{
        borderColor: 'rgba(255,107,53,0.35)',
        background:  'radial-gradient(100% 100% at 100% 0%, rgba(255,107,53,0.10) 0%, transparent 60%), var(--trail-card)',
      }}
    >
      <div className="flex items-center justify-between mb-[6px]">
        <h3 className="text-[15px] font-semibold text-trail-muted">Séance du jour</h3>
      </div>
      {session === undefined && <p className="text-[12px] text-trail-muted">Chargement…</p>}
      {session === null && <p className="text-[12px] text-trail-muted">Pas de séance prévue aujourd'hui.</p>}
      {session && (
        <>
          <h2
            className="text-[26px] leading-none text-trail-text"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.02em' }}
          >
            {session.title}
          </h2>
          <p className="text-[12px] text-trail-muted mt-1">{labelForType(session.type)}</p>
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-trail-border">
            <Kpi label="Durée"    value={`${session.duration}'`} />
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
        style={{ fontFamily: "'Bebas Neue', sans-serif" }}
      >
        {value}
      </p>
    </div>
  )
}
