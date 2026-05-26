'use client'

import type { MorningLastActivity } from '@/lib/data/morning-report'

function paceSecToString(secPerKm: number | null | undefined): string {
  if (!secPerKm || secPerKm <= 0 || !Number.isFinite(secPerKm)) return '—'
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}'${String(s).padStart(2, '0')}`
}

function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return '—'
  const mins = Math.round(sec / 60)
  return mins >= 60 ? `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}` : `${mins}'`
}

export function YesterdayBlock({ act }: { act: MorningLastActivity | null }) {
  if (!act) {
    return (
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
        <h3 className="text-[15px] font-semibold text-trail-muted">Hier</h3>
        <p className="text-[12px] text-trail-muted mt-2">Aucune activité récente.</p>
      </div>
    )
  }
  const dur  = formatDuration(act.movingTimeSec)
  const pace = act.distanceMeters && act.movingTimeSec && act.distanceMeters > 0
    ? paceSecToString(act.movingTimeSec / (act.distanceMeters / 1000))
    : '—'

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      <div className="flex items-center justify-between mb-[6px]">
        <h3 className="text-[15px] font-semibold text-trail-muted truncate">Hier · {act.name}</h3>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Cell label="Durée"  value={dur} />
        <Cell label="Allure" value={pace} />
        <Cell label="FC moy" value={act.avgHr ? String(act.avgHr) : '—'} />
        <Cell label="D+"     value={act.elevationGainM != null ? `${act.elevationGainM}` : '—'} />
      </div>
    </div>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] bg-trail-surface px-2 py-2 text-center">
      <p className="text-[10px] text-trail-muted">{label}</p>
      <p
        className="text-[20px] leading-none mt-1 text-trail-text"
        style={{ fontFamily: "'Bebas Neue', sans-serif" }}
      >
        {value}
      </p>
    </div>
  )
}
