'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { chart } from '@/lib/design/layout'

export type PieSlice = {
  label: string
  value: number  // km
  color: string
  emoji?: string
}

type Props = {
  data:    PieSlice[]
  height?: number
}

const OUTER_R = 58
const INNER_R = Math.round(OUTER_R * (1 - chart.pieRingRatio))  // 26

function PctLabel(props: {
  cx: number; cy: number; midAngle: number
  innerRadius: number; outerRadius: number; percent: number
}) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props
  if (percent < 0.07) return null
  const RADIAN = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
      fontSize={10} fontWeight="700">
      {`${Math.round(percent * 100)}%`}
    </text>
  )
}

export function CockpitPieChart({ data, height = chart.minHeight }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const empty = data.length === 0
  const renderData = empty ? [{ label: '', value: 1, color: '#1E3530' }] : data

  return (
    <div className="flex items-center gap-3" style={{ minHeight: height }}>
      {/* Donut */}
      <div style={{ width: 130, height: 130, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={renderData}
              dataKey="value"
              cx="50%"
              cy="50%"
              outerRadius={OUTER_R}
              innerRadius={INNER_R}
              strokeWidth={0}
              isAnimationActive={false}
              label={empty ? undefined : PctLabel}
              labelLine={false}
            >
              {renderData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-[5px] flex-1 min-w-0">
        {empty ? (
          <span className="text-[14px] text-trail-muted">Aucune donnée</span>
        ) : (
          data.map((entry) => {
            const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0
            return (
              <div key={entry.label} className="flex items-center gap-[5px] min-w-0">
                <span
                  className="flex-shrink-0 rounded-sm"
                  style={{ width: 8, height: 8, backgroundColor: entry.color }}
                />
                {entry.emoji && (
                  <span className="flex-shrink-0 text-[13px] leading-none">{entry.emoji}</span>
                )}
                <span className="text-[13px] text-trail-muted truncate flex-1">{entry.label}</span>
                <span className="text-[13px] font-semibold text-trail-text flex-shrink-0">
                  {entry.value.toFixed(1)} km
                </span>
                <span className="text-[11px] text-trail-muted flex-shrink-0 w-[28px] text-right">
                  {pct}%
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
