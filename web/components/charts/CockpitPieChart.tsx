'use client'

// Mirror of PieChart composable from ui/components/Charts.kt.
// Donut: innerRadius = outerRadius * (1 - pieRingRatio) = outerRadius * 0.45.
// Legend: colored 10×10 squares + 14px labels, km values right-aligned.

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { chart } from '@/lib/design/layout'

export type PieSlice = {
  label: string
  value: number  // km
  color: string
}

type Props = {
  data:    PieSlice[]
  height?: number
}

const OUTER_R = 58
const INNER_R = Math.round(OUTER_R * (1 - chart.pieRingRatio))  // 26

export function CockpitPieChart({ data, height = chart.minHeight }: Props) {
  return (
    <div className="flex items-center gap-3" style={{ minHeight: height }}>
      {/* Donut */}
      <div style={{ width: 130, height: 130, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.length > 0 ? data : [{ label: '', value: 1, color: '#1E3530' }]}
              dataKey="value"
              cx="50%"
              cy="50%"
              outerRadius={OUTER_R}
              innerRadius={INNER_R}
              strokeWidth={0}
              isAnimationActive={false}
            >
              {(data.length > 0 ? data : [{ label: '', value: 1, color: '#1E3530' }]).map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-[5px] flex-1 min-w-0">
        {data.length === 0 ? (
          <span className="text-[14px] text-trail-muted">Aucune donnée</span>
        ) : (
          data.map((entry) => (
            <div key={entry.label} className="flex items-center gap-[5px] min-w-0">
              <span
                className="flex-shrink-0 rounded-sm"
                style={{ width: 10, height: 10, backgroundColor: entry.color }}
              />
              <span className="text-[14px] text-trail-muted truncate flex-1">{entry.label}</span>
              <span className="text-[14px] font-semibold text-trail-text flex-shrink-0">
                {entry.value.toFixed(1)} km
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
