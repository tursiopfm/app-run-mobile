'use client'

type Zone = { from: number; to: number; color: string; label?: string }

type Props = {
  value: number
  min: number
  max: number
  zones: Zone[]
  height?: number
}

export function Gauge({ value, min, max, zones, height = 14 }: Props) {
  const clamped = Math.max(min, Math.min(max, value))
  const pct = ((clamped - min) / (max - min)) * 100
  return (
    <div className="w-full" style={{ height }}>
      <div className="relative w-full rounded-full overflow-hidden bg-trail-surface" style={{ height }}>
        {zones.map((z, i) => {
          const left  = ((z.from - min) / (max - min)) * 100
          const width = ((z.to - z.from) / (max - min)) * 100
          return (
            <div
              key={i}
              style={{ left: `${left}%`, width: `${width}%`, backgroundColor: z.color, opacity: 0.35 }}
              className="absolute top-0 bottom-0"
              aria-hidden
            />
          )
        })}
        <div
          className="absolute top-[-3px] bottom-[-3px] w-[3px] rounded-full bg-trail-text"
          style={{ left: `calc(${pct}% - 1.5px)` }}
          aria-label={`Valeur ${value}`}
        />
      </div>
    </div>
  )
}
