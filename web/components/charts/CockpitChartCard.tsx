// Mirror of ChartCard composable from ui/components/Charts.kt
// Generic container for all chart components (rounded-md, trail-card bg, 1px border).

import type { ReactNode } from 'react'

type CockpitChartCardProps = {
  title?:     string    // used when titleSlot is absent
  titleSlot?: ReactNode // overrides title (custom header row with icons, etc.)
  minHeight?: number    // px — default 180 (matches Android ChartCard minHeight)
  children:   ReactNode
  className?: string
}

export function CockpitChartCard({
  title,
  titleSlot,
  minHeight = 180,
  children,
  className = '',
}: CockpitChartCardProps) {
  return (
    <div className={`rounded-md bg-trail-card border border-trail-border px-2.5 py-2 ${className}`}>
      {/* Title / title slot */}
      {titleSlot ? (
        titleSlot
      ) : title ? (
        <p className="text-body-sm font-semibold text-trail-text leading-tight">{title}</p>
      ) : null}

      {/* Chart content area */}
      <div style={{ minHeight }} className="mt-1.5 w-full">
        {children}
      </div>
    </div>
  )
}
