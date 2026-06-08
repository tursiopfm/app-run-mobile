// Mirror of ProgressRow composable from ui/components/KpiTiles.kt

type ProgressRowProps = {
  label: string
  current: number
  target: number
  bgColor: string    // hex — trail.progress-run-bg / volume / dplus
  fgColor: string    // hex — trail.primary / success / accent
  unit?: string
  className?: string
}

function formatVal(v: number): string {
  if (v >= 100) return Math.round(v).toString()
  if (v % 1 === 0) return v.toString()
  return v.toFixed(1)
}

export function ProgressRow({
  label,
  current,
  target,
  bgColor,
  fgColor,
  unit = '',
  className = '',
}: ProgressRowProps) {
  const ratio = target <= 0 ? 0 : Math.min(1, Math.max(0, current / target))
  const pct   = Math.round(ratio * 100)

  return (
    <div className={className}>
      <p className="text-caption font-semibold text-trail-text leading-tight">
        {label} &bull; {formatVal(current)} / {formatVal(target)} ({pct}%){unit ? ` ${unit}` : ''}
      </p>
      <div className="mt-1 h-4 rounded-sm overflow-hidden" style={{ backgroundColor: bgColor }}>
        <div
          className="h-full rounded-sm"
          style={{ width: `${ratio * 100}%`, backgroundColor: fgColor }}
        />
      </div>
    </div>
  )
}
