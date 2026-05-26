'use client'

import { useRouter } from 'next/navigation'
import type { ActivityRow } from '@/components/ui/ActivityCard'
import { colors } from '@/lib/design/colors'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = {
  activities: ActivityRow[]
  onHide?:    () => void
}

function fmtDayLabel(iso: string, days: readonly string[]): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${days[d.getDay()]} ${dd}/${mm}`
}

function fmtDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const h = Math.floor(m / 60)
  const rem = m % 60
  return h > 0 ? `${h}h${String(rem).padStart(2, '0')}` : `${m}min`
}

function fmtKm(m: number | null): string {
  if (m == null) return '—'
  const km = m / 1000
  return `${(Math.round(km * 10) / 10).toFixed(1)} km`
}

function fmtDPlus(m: number | null): string {
  if (m == null) return '—'
  return `${Math.round(m)} m`
}

export function WeekActivitiesBlock({ activities, onHide }: Props) {
  const router = useRouter()
  const L = useT().cockpit

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      <div className="flex items-center justify-between mb-[8px]">
        <div className="flex items-center gap-1">
          <span className="text-[15px] font-semibold text-trail-muted">{L.weekActivitiesPrefix}</span>
          <span className="text-[15px] font-semibold text-trail-text">{L.weekActivitiesSuffix}</span>
        </div>
        {onHide && (
          <button
            onClick={onHide}
            className="text-trail-muted hover:text-trail-text px-1 text-[18px] leading-none"
            aria-label={L.aria.weekActivitiesHide}
          >
            ⋮
          </button>
        )}
      </div>

      {activities.length === 0 ? (
        <p className="text-[13px] py-2" style={{ color: colors.subtleText }}>
          {L.noActivityThisWeek}
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: colors.border }}>
          {activities.map((a) => {
            const dist  = a.manual_distance_m       ?? a.distance_m
            const dur   = a.manual_moving_time_sec  ?? a.moving_time_sec
            const dPlus = a.manual_elevation_gain_m ?? a.elevation_gain_m
            return (
              <li
                key={a.id}
                onClick={() => router.push(`/activities/${a.id}`)}
                className="py-[8px] cursor-pointer"
                style={{ borderColor: colors.border }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span suppressHydrationWarning className="text-[12px] font-semibold text-trail-muted flex-shrink-0">
                    {fmtDayLabel(a.start_time, L.dayAbbr)}
                  </span>
                  <span className="text-[14px] text-trail-text truncate flex-1 text-right" title={a.name}>
                    {a.name}
                  </span>
                </div>
                <div className="flex gap-[10px] mt-[2px] text-[12px]">
                  <span style={{ color: colors.chargeOrange }}>{fmtKm(dist)}</span>
                  <span style={{ color: colors.seriesGreen }}>{fmtDuration(dur)}</span>
                  <span style={{ color: colors.seriesBlue }}>D+ {fmtDPlus(dPlus)}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
