'use client'

import type { MorningWeekVolume } from '@/lib/data/morning-report'

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export function WeekVolumeBlock({ data }: { data: MorningWeekVolume }) {
  const maxKm = Math.max(...data.byDay, 0.001)

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      <div className="flex items-center justify-between mb-[6px]">
        <h3 className="text-body-sm font-semibold text-trail-muted">Volume semaine</h3>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-[24px] leading-none text-trail-text" style={{ fontFamily: "var(--font-data)", letterSpacing: '0.02em' }}>
          {data.km} km
        </p>
        <p className="text-[10px] text-trail-muted">{data.dPlus} m D+</p>
      </div>
      <div className="grid grid-cols-7 gap-[3px] mt-3">
        {DAY_LABELS.map((label, idx) => {
          const km = data.byDay[idx]
          const hasActivity = km > 0
          const isToday = idx === data.todayIdx
          const isPast = idx < data.todayIdx
          const heightPct = hasActivity ? Math.max(20, (km / maxKm) * 100) : 0

          let bg = 'transparent'
          let border = '1px dashed var(--trail-border)'
          if (hasActivity) {
            bg = isToday ? 'var(--trail-primary)' : 'var(--trail-success)'
            border = 'none'
          }

          return (
            <div key={idx} className="text-center">
              <div className="h-6 rounded-sm relative overflow-hidden" style={{
                background: hasActivity ? 'transparent' : 'var(--trail-surface)',
                border,
              }}>
                {hasActivity && (
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-sm"
                    style={{ background: bg, height: `${heightPct}%` }}
                  />
                )}
              </div>
              <p
                className="text-[9px] mt-1"
                style={{ color: isToday ? 'var(--trail-primary)' : (isPast ? 'var(--trail-text)' : 'var(--trail-muted)') }}
              >
                {label}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
