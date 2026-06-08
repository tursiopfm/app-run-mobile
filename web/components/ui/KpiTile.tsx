// Mirror of KpiTile composable from ui/components/KpiTiles.kt
// Key difference from old KpiCard: colored header band (bg-trail-header) with sport-colored title.

import type { ReactNode } from 'react'

type KpiTileProps = {
  title: string
  titleColor?: string        // hex — sport color: primary=run, accent=bike, success=swim
  mainValue: string | number
  mainValueColor?: string    // hex — defaults to trail-text
  unit?: string
  subline1?: string
  subline2?: string
  trailing?: ReactNode       // right slot in header (icon, badge…)
  className?: string
}

export function KpiTile({
  title,
  titleColor = '#FF7900',    // chargeOrange / run default
  mainValue,
  mainValueColor,
  unit,
  subline1,
  subline2,
  trailing,
  className = '',
}: KpiTileProps) {
  return (
    <div className={`rounded bg-trail-card border border-trail-border overflow-hidden ${className}`}>
      {/* Header band — bg-trail-header, title in sport color */}
      <div className="bg-trail-header px-2 py-1 flex items-center justify-between">
        <span
          className="text-[12px] font-bold leading-tight flex-1 min-w-0 truncate"
          style={{ color: titleColor }}
        >
          {title}
        </span>
        {trailing && <span className="flex-shrink-0 ml-1">{trailing}</span>}
      </div>

      {/* Body */}
      <div className="px-2.5 py-2">
        <p
          className="text-[20px] font-bold font-data tabular-nums leading-tight"
          style={{ color: mainValueColor ?? '#E2ECE9' }}
        >
          {mainValue}
          {unit && (
            <span className="text-[11px] font-normal ml-1 text-trail-muted">{unit}</span>
          )}
        </p>
        {subline1 && (
          <p className="text-[11px] text-trail-muted mt-0.5 leading-tight">{subline1}</p>
        )}
        {subline2 && (
          <p className="text-[11px] text-trail-muted mt-1 leading-tight">{subline2}</p>
        )}
      </div>
    </div>
  )
}
