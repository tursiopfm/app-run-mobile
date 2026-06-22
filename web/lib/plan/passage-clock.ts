import { estimatePassageTimes, type PacingWaypoint } from '@/lib/plan/pacing'

export interface PassageClockOpts {
  startTime?: string | null       // 'HH:MM' heure locale de départ
  totalDurationSec: number | null // objectif total ; null = pas de calcul
  fade: number                    // coef fade pacing
  startDateIso?: string | null    // 'YYYY-MM-DD' pour le jour de semaine
}

const WEEKDAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']

function dayLabel(dayOffset: number, startDateIso: string | null): string {
  if (startDateIso) {
    const d = new Date(`${startDateIso}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + dayOffset)
    return WEEKDAYS[d.getUTCDay()]
  }
  return dayOffset === 0 ? '' : `J+${dayOffset}`
}

function formatClock(totalSec: number, startDateIso: string | null): string {
  const dayOffset = Math.floor(totalSec / 86400)
  const sod = ((totalSec % 86400) + 86400) % 86400
  const hh = String(Math.floor(sod / 3600)).padStart(2, '0')
  const mm = String(Math.floor((sod % 3600) / 60)).padStart(2, '0')
  const hm = `${hh}:${mm}`
  const prefix = dayLabel(dayOffset, startDateIso)
  return prefix ? `${prefix} ${hm}` : hm
}

// Heure absolue de passage à chaque waypoint. Vide si objectif ou heure de
// départ manquants (on n'invente rien).
export function passageClocks(waypoints: PacingWaypoint[], opts: PassageClockOpts): string[] {
  if (opts.totalDurationSec == null || !opts.startTime) return waypoints.map(() => '')
  const m = /^(\d{1,2}):(\d{2})/.exec(opts.startTime)
  if (!m) return waypoints.map(() => '')
  const startSec = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60
  const elapsed = estimatePassageTimes(waypoints, {
    totalDurationSec: opts.totalDurationSec, fade: opts.fade,
  })
  return elapsed.map((e) => formatClock(startSec + e, opts.startDateIso ?? null))
}
