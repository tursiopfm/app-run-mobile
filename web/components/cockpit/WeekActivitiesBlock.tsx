'use client'

import { useEffect, useRef, useState } from 'react'
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
  const t = useT()
  const L = t.cockpit
  const C = t.common
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showMenu) return
    function handle(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
    }
  }, [showMenu])

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      <div className="flex items-center justify-between mb-[8px]">
        <div className="flex items-center gap-1">
          <span className="text-[15px] font-semibold text-trail-muted font-display">{L.weekActivitiesPrefix}</span>
          <span className="text-[15px] font-semibold text-trail-text font-display">{L.weekActivitiesSuffix}</span>
        </div>
        {onHide && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(s => !s)}
              className="text-trail-muted hover:text-trail-text px-1 text-h2 leading-none"
              aria-label={C.blockMenuAria}
            >
              ⋮
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-1 w-32 rounded-[8px] bg-trail-surface border border-trail-border shadow-lg z-30">
                <button
                  onClick={() => { setShowMenu(false); onHide() }}
                  className="w-full px-3 py-2 text-left text-caption text-trail-text hover:bg-trail-card"
                >{C.blockHide}</button>
              </div>
            )}
          </div>
        )}
      </div>

      {activities.length === 0 ? (
        <p className="text-body-sm py-2" style={{ color: colors.subtleText }}>
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
                  <span suppressHydrationWarning className="text-caption font-semibold text-trail-muted flex-shrink-0">
                    {fmtDayLabel(a.start_time, L.dayAbbr)}
                  </span>
                  <span className="text-body text-trail-text truncate flex-1 text-right" title={a.name}>
                    {a.name}
                  </span>
                </div>
                <div className="flex gap-[10px] mt-[2px] text-caption">
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
