// Mirror of CockpitKpiTile composable in DashboardScreen.kt (line 8425).
// Compound tile: period label + content slot + subline + BarStrip.
// Note: bg = trail-surface (NOT trail-card), radius = rounded-[10px].

import type { ReactNode } from 'react'
import { BarStrip } from './BarStrip'

type CockpitKpiTileProps = {
  icon?:        string             // optional emoji prefix
  title:        string             // period label: 'SEMAINE', 'ANNÉE', 'CHARGE'
  subline:      ReactNode          // e.g. '3 séances', 'D+ 1234 m', 'TSB -5 • 7 derniers jours'
  barValues:    number[]           // 0..1 normalized values for BarStrip
  barLabels:    string[]           // label per bar (shown inside/above)
  barColor:     string             // hex color
  children:     ReactNode          // main value display
  headerRight?: ReactNode          // optional slot in the top-right of the period label row
  className?:   string
}

export function CockpitKpiTile({
  icon,
  title,
  subline,
  barValues,
  barLabels,
  barColor,
  children,
  headerRight,
  className = '',
}: CockpitKpiTileProps) {
  return (
    <div className={`rounded-[10px] bg-trail-surface border border-trail-border px-2 py-[8px] flex flex-col ${className}`}>
      {/* Period label row */}
      <div className="flex items-center justify-between gap-[3px]">
        <div className="flex items-center gap-[3px] min-w-0">
          {icon && <span className="text-[14px] leading-none">{icon}</span>}
          <span
            className="text-[11px] font-semibold text-trail-muted leading-tight truncate"
            style={{ maxWidth: '100%' }}
          >
            {title}
          </span>
        </div>
        {headerRight}
      </div>

      {/* 3px gap */}
      <div className="h-[3px]" />

      {/* Main value slot (21px Black in usage) */}
      {children}

      {/* 2px gap */}
      <div className="h-[2px]" />

      {/* Subline */}
      <div className="text-[12px] text-trail-muted leading-tight truncate">{subline}</div>

      {/* 4px gap (mt-auto pour plaquer la BarStrip en bas quand la tuile est étirée par la grid) */}
      <div className="mt-auto h-[4px]" />

      {/* BarStrip */}
      <BarStrip values={barValues} labels={barLabels} color={barColor} />
    </div>
  )
}
