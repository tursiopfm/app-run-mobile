'use client'

// Mirror of FullWidthBarStrip Canvas composable from ui/components/KpiTiles.kt
// 7-bar strip (one per day) with proportional heights and labels.
// Implemented as SVG for precise sub-pixel control matching the Android Canvas output.

type BarStripProps = {
  values: number[]   // 0..1 ratio per bar
  labels: string[]   // day abbreviations (Mon, Tue…) or empty string
  color: string      // hex
  className?: string
}

const HEIGHT      = 26   // total svg height (px) — matches Android 26.dp
const LABEL_H     = 9    // area reserved above bars for "above-bar" labels
const BAR_H       = HEIGHT - LABEL_H  // 17px max bar height
const GAP         = 2    // px between bars
const MIN_INSIDE  = 13   // px threshold: label inside vs above bar
const CORNER      = 2    // px border-radius

export function BarStrip({ values, labels, color, className = '' }: BarStripProps) {
  const n = values.length
  if (n === 0) return null

  return (
    <svg
      viewBox={`0 0 100 ${HEIGHT}`}
      preserveAspectRatio="none"
      className={`w-full ${className}`}
      style={{ height: HEIGHT }}
      aria-hidden
    >
      {values.map((v, i) => {
        const slotW  = (100 - GAP * (n - 1)) / n
        const barW   = slotW
        const x      = i * (slotW + GAP)
        const barH   = Math.max(2, BAR_H * Math.min(1, Math.max(0, v)))
        const barY   = HEIGHT - barH
        const label  = labels[i] ?? ''
        const inside = barH >= MIN_INSIDE

        return (
          <g key={i}>
            <rect
              x={x}
              y={barY}
              width={barW}
              height={barH}
              rx={CORNER}
              fill={color}
            />
            {label && (
              <text
                x={x + barW / 2}
                y={inside ? barY + barH / 2 + 4 : barY - 2}
                textAnchor="middle"
                fontSize={8}
                fontWeight={600}
                fill={inside ? '#ffffff' : color}
              >
                {label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
