type GoalProgressRowProps = {
  label:   string
  current: number
  target:  number
  unit:    string
  color:   string
}

function formatVal(v: number): string {
  if (v >= 100) return Math.round(v).toString()
  if (v % 1 === 0) return v.toString()
  return v.toFixed(1)
}

export function GoalProgressRow({ label, current, target, unit, color }: GoalProgressRowProps) {
  const ratio = target <= 0 ? 0 : Math.min(1, Math.max(0, current / target))

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[13px] text-trail-text">{label}</span>
        <span className="text-[13px] font-bold" style={{ color }}>
          {formatVal(current)}{unit} / {formatVal(target)}{unit}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${ratio * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
