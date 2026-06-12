'use client'

// Sessions réalisées de la semaine (liste éditoriale, reprise de la maquette B).

import Link from 'next/link'
import { MissionCard, MissionCardLabel } from './cards'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import { useT } from '@/lib/i18n/I18nProvider'

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

function dist(a: ActivityRow): number { return (a.manual_distance_m ?? a.distance_m ?? 0) / 1000 }
function elev(a: ActivityRow): number { return Math.round(a.manual_elevation_gain_m ?? a.elevation_gain_m ?? 0) }
function durSec(a: ActivityRow): number { return a.manual_moving_time_sec ?? a.moving_time_sec ?? 0 }
function fmtDur(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}

export function SessionsSemaineCard({ activities }: { activities: ActivityRow[] }) {
  const M = useT().mission
  if (activities.length === 0) return null
  // start_time = heure locale étiquetée UTC → getters UTC.
  const rows = [...activities].sort((a, b) => a.start_time.localeCompare(b.start_time))
  const totKm = rows.reduce((s, a) => s + dist(a), 0)
  const totDp = rows.reduce((s, a) => s + elev(a), 0)
  const totSec = rows.reduce((s, a) => s + durSec(a), 0)
  return (
    <MissionCard>
      <div className="mb-1.5"><MissionCardLabel>{M.sessionsTitle}</MissionCardLabel></div>
      <div className="text-[13px]">
        {rows.map((a, i) => (
          <Link key={a.id} href={`/activities/${a.id}`}
                className={`flex items-center justify-between py-[7px] ${i < rows.length - 1 ? 'border-b border-trail-border' : ''}`}>
            <span className="w-9 text-trail-muted">{DAYS[new Date(a.start_time).getUTCDay()]}</span>
            <span className="flex-1 truncate pr-2 text-trail-text">{a.name}</span>
            <span className="font-semibold tabular-nums text-trail-text whitespace-nowrap">
              {dist(a).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km · <span style={{ color: 'var(--status-info)' }}>{elev(a)} m</span> · <span className="text-trail-muted">{fmtDur(durSec(a))}</span>
            </span>
          </Link>
        ))}
      </div>
      <div className="flex justify-around mt-1.5 pt-2 border-t border-trail-border">
        <span className="font-display font-bold text-[13px] tabular-nums" style={{ color: 'var(--primary)' }}>
          {Math.round(totKm)} <span className="text-[9px] font-normal text-trail-muted">km</span></span>
        <span className="font-display font-bold text-[13px] tabular-nums" style={{ color: 'var(--status-info)' }}>
          {totDp.toLocaleString('fr-FR')} <span className="text-[9px] font-normal text-trail-muted">m D+</span></span>
        <span className="font-display font-bold text-[13px] tabular-nums text-trail-text">{fmtDur(totSec)}</span>
      </div>
    </MissionCard>
  )
}
