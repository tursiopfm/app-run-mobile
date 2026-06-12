'use client'

// Écran Activités du Mode Mission v2 — « mon journal de bord » :
// Dernière sortie (héros) → Cumul du mois → Sorties récentes → lien historique.
// Le lien historique pointe vers /activities?full=1 qui rend la liste Expert.

import Link from 'next/link'
import { MissionCard, MissionCardLabel } from './cards'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import { useT } from '@/lib/i18n/I18nProvider'

function dist(a: ActivityRow): number { return (a.manual_distance_m ?? a.distance_m ?? 0) / 1000 }
function elev(a: ActivityRow): number { return a.manual_elevation_gain_m ?? a.elevation_gain_m ?? 0 }
function durSec(a: ActivityRow): number { return a.manual_moving_time_sec ?? a.moving_time_sec ?? 0 }

function formatDur(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}

// start_time = heure locale étiquetée UTC → toujours lire en getters UTC
// (cf. lib/activities/format-datetime.ts).
function dayLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function MissionActivities({ activities }: { activities: ActivityRow[] }) {
  const M = useT().mission
  const last = activities[0] ?? null

  const now = new Date()
  const monthRows = activities.filter(a => {
    const d = new Date(a.start_time)
    return d.getUTCFullYear() === now.getFullYear() && d.getUTCMonth() === now.getMonth()
  })
  const monthKm = monthRows.reduce((s, a) => s + dist(a), 0)
  const monthDPlus = monthRows.reduce((s, a) => s + elev(a), 0)
  const recent = activities.slice(1, 4)

  return (
    <div className="px-3 py-3 max-w-lg mx-auto space-y-3">
      {last && (
        <Link href={`/activities/${last.id}`} className="block">
          <MissionCard className="p-5">
            <div className="mb-2">
              <MissionCardLabel>{M.lastActivityTitle} · {dayLabel(last.start_time)}</MissionCardLabel>
            </div>
            <p className="font-display text-[24px] font-bold leading-tight text-trail-text">{last.name}</p>
            <div className="flex items-end gap-5 mt-3">
              <p className="font-display text-[22px] font-bold leading-none text-trail-text">
                {dist(last).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}<span className="text-[13px] text-trail-muted"> km</span>
              </p>
              <p className="font-display text-[22px] font-bold leading-none" style={{ color: 'var(--status-info)' }}>
                +{Math.round(elev(last))}<span className="text-[13px]"> m</span>
              </p>
              <p className="font-display text-[22px] font-bold leading-none text-trail-text">{formatDur(durSec(last))}</p>
            </div>
          </MissionCard>
        </Link>
      )}

      <MissionCard>
        <div className="mb-3"><MissionCardLabel>{M.monthTitle}</MissionCardLabel></div>
        <div className="flex justify-between">
          <div>
            <p className="font-display text-[24px] font-bold leading-none text-trail-text">
              {Math.round(monthKm)}<span className="text-[13px] text-trail-muted"> km</span>
            </p>
            <p className="text-[10px] mt-1 uppercase tracking-wider text-trail-muted">{M.volumeLabel}</p>
          </div>
          <div>
            <p className="font-display text-[24px] font-bold leading-none" style={{ color: 'var(--status-info)' }}>
              +{Math.round(monthDPlus).toLocaleString('fr-FR')}<span className="text-[13px]"> m</span>
            </p>
            <p className="text-[10px] mt-1 uppercase tracking-wider text-trail-muted">{M.dplusLabel}</p>
          </div>
          <div>
            <p className="font-display text-[24px] font-bold leading-none text-trail-text">{monthRows.length}</p>
            <p className="text-[10px] mt-1 uppercase tracking-wider text-trail-muted">{M.sessionsLabel}</p>
          </div>
        </div>
      </MissionCard>

      {recent.length > 0 && (
        <MissionCard className="px-4 py-2">
          {recent.map(a => (
            <Link key={a.id} href={`/activities/${a.id}`}
                  className="flex items-center justify-between py-[9px] border-t border-trail-border first:border-t-0">
              <div>
                <p className="text-[13px] font-semibold text-trail-text">{a.name}</p>
                <p className="text-[11px] text-trail-muted">{dayLabel(a.start_time)}</p>
              </div>
              <p className="text-[12px] text-right text-trail-muted">
                {dist(a).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km · <span style={{ color: 'var(--status-info)' }}>+{Math.round(elev(a))} m</span>
                <br />{formatDur(durSec(a))}
              </p>
            </Link>
          ))}
        </MissionCard>
      )}

      <Link href="/activities?full=1" className="block w-full text-center text-[13px] font-semibold py-1"
            style={{ color: 'var(--primary-text)' }}>
        {M.allHistory}
      </Link>
    </div>
  )
}
