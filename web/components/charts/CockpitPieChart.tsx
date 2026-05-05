'use client'

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import { colors } from '@/lib/design/colors'
import { chart } from '@/lib/design/layout'

export type PieSlice = {
  label: string
  value: number
  color: string
}

type Props = {
  data:    PieSlice[]
  height?: number
}

export function CockpitPieChart({ data, height = 220 }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const filtered = data.filter((d) => d.value > 0)

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={filtered}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={`${Math.round((1 - chart.pieRingRatio) * 50)}%`}
            outerRadius="80%"
            paddingAngle={1}
            stroke="none"
            isAnimationActive={false}
          >
            {filtered.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [
              `${value.toFixed(1)} (${total > 0 ? Math.round((value / total) * 100) : 0}%)`,
              name,
            ]}
            contentStyle={{
              background:   colors.cardBg,
              border:       `1px solid ${colors.border}`,
              borderRadius: 6,
              fontSize:     12,
            }}
            labelStyle={{ color: colors.subtleText }}
            itemStyle={{ color: colors.text }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ fontSize: 12, color: colors.subtleText }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
