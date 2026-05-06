'use client'

// Mirror of FullWidthBarStrip Canvas composable from ui/components/KpiTiles.kt
// 7-bar strip (one per day) with proportional heights and labels.
// HTML/CSS implementation to avoid SVG preserveAspectRatio="none" text distortion.

type BarStripProps = {
  values: number[]   // 0..1 ratio per bar
  labels: string[]   // label per bar or empty string
  color: string      // hex
  className?: string
}

const HEIGHT     = 26   // total height (px)
const LABEL_H    = 9    // area reserved above bars for "above-bar" labels
const BAR_H      = HEIGHT - LABEL_H  // 17px max bar height
const MIN_INSIDE = 13   // px threshold: label inside vs above bar

export function BarStrip({ values, labels, color, className = '' }: BarStripProps) {
  const n = values.length
  if (n === 0) return null

  return (
    <div
      className={`flex gap-[2px] items-end ${className}`}
      style={{ height: HEIGHT }}
      aria-hidden
    >
      {values.map((v, i) => {
        const barH  = Math.max(2, BAR_H * Math.min(1, Math.max(0, v)))
        const label = labels[i] ?? ''
        const inside = barH >= MIN_INSIDE

        return (
          <div key={i} className="relative flex-1 flex flex-col items-center justify-end" style={{ height: HEIGHT }}>
            {label && !inside && (
              <span
                className="absolute w-full text-center leading-none"
                style={{
                  fontSize: 8,
                  fontWeight: 600,
                  color,
                  bottom: barH + 1,
                }}
              >
                {label}
              </span>
            )}
            <div
              className="relative w-full flex items-center justify-center overflow-hidden"
              style={{ height: barH, backgroundColor: color, borderRadius: 2 }}
            >
              {label && inside && (
                <span style={{ fontSize: 8, fontWeight: 600, color: '#ffffff', lineHeight: 1 }}>
                  {label}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
