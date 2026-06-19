'use client'

import type { MorningLastActivity } from '@/lib/data/morning-report'
import { ReportCard } from './ReportCard'

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
      <ReportCard label="Hier" accent="var(--text-muted)">
        <p className="text-caption text-trail-muted">Aucune activité récente.</p>
      </ReportCard>
    )
  }
  const dur  = formatDuration(act.movingTimeSec)
  const pace = act.distanceMeters && act.movingTimeSec && act.distanceMeters > 0
    ? paceSecToString(act.movingTimeSec / (act.distanceMeters / 1000))
    : '—'

  return (
    <ReportCard
      label="Hier"
      accent="var(--text-muted)"
      right={<span className="text-caption text-trail-muted truncate max-w-[180px]">{act.name}</span>}
    >
      <div className="grid grid-cols-4 gap-2">
        <Cell label="Durée"  value={dur} />
        <Cell label="Allure" value={pace} />
        <Cell label="FC moy" value={act.avgHr ? String(act.avgHr) : '—'} />
        <Cell label="D+"     value={act.elevationGainM != null ? `${act.elevationGainM}` : '—'} />
      </div>
    </ReportCard>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] bg-trail-surface px-2 py-2 text-center">
      <p className="text-[10px] text-trail-muted">{label}</p>
      <p
        className="text-[20px] leading-none mt-1 text-trail-text"
        style={{ fontFamily: "var(--font-data)" }}
      >
        {value}
      </p>
    </div>
  )
}
