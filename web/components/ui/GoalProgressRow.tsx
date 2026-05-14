// Mirror of GoalProgressRow composable in DashboardScreen.kt (line 6291).
// Layout: label LEFT | current/target RIGHT — thin 6px bar below.

type GoalProgressRowProps = {
  label:   string
  current: number
  target:  number
  unit:    string
  color:   string  // hex
}

function fmt(v: number): string {
  if (v >= 100) return Math.round(v).toString()
  if (v % 1 === 0) return v.toString()
  return v.toFixed(1)
}

export function GoalProgressRow({ label, current, target, unit, color }: GoalProgressRowProps) {
  const ratio = target <= 0 ? 0 : Math.min(1, Math.max(0, current / target))

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <span className="text-[16px] text-trail-muted">{label}</span>
        <span className="text-[16px] font-semibold">
          <span className="text-trail-text">{fmt(current)}{unit}</span>
          <span className="text-trail-muted"> / {fmt(target)}{unit}</span>
        </span>
      </div>
      <div className="mt-[6px] h-[6px] rounded-full bg-trail-border overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${ratio * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
