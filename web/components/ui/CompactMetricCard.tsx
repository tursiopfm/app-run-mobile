// Mirror of CompactMetricCard composable from DashboardScreen.kt (BlockType.Load).
// unit label (top-muted) | large rounded value | description (bottom-muted)

type Props = {
  unit:        string  // "ATL" | "CTL" | "TSB" | "Suffer"
  value:       number
  description: string
  color:       string  // hex — value color
}

export function CompactMetricCard({ unit, value, description, color }: Props) {
  return (
    <div className="flex-1 rounded-[8px] bg-trail-surface border border-trail-border px-3 py-2">
      <p className="text-[11px] font-semibold text-trail-muted leading-tight">{unit}</p>
      <p className="text-[22px] font-black leading-tight" style={{ color }}>{Math.round(value)}</p>
      <p className="text-[11px] text-trail-muted leading-tight">{description}</p>
    </div>
  )
}
