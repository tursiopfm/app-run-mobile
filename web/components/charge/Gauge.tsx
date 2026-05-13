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
    <div className="relative w-full" style={{ height, paddingTop: 5, paddingBottom: 5, marginTop: -5, marginBottom: -5, boxSizing: 'content-box' }}>
      <div className="relative w-full rounded-full overflow-hidden bg-trail-surface" style={{ height }}>
        {zones.map((z, i) => {
          const left  = ((z.from - min) / (max - min)) * 100
          const width = ((z.to - z.from) / (max - min)) * 100
          return (
            <div
              key={i}
              style={{ left: `${left}%`, width: `${width}%`, backgroundColor: z.color }}
              className="absolute top-0 bottom-0"
              aria-hidden
            />
          )
        })}
      </div>
      <div
        className="absolute w-[4px] rounded-full bg-trail-text"
        style={{
          left: `calc(${pct}% - 2px)`,
          top: 0,
          bottom: 0,
          boxShadow: '0 0 0 1.5px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.45)',
        }}
        aria-label={`Valeur ${value}`}
      />
    </div>
  )
}
