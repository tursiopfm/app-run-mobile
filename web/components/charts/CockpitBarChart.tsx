'use client'

// Mirror of BarChart composable from ui/components/Charts.kt.
// barWidthRatio=0.55, rotated x-labels, per-bar color via Cell.

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import { colors } from '@/lib/design/colors'
import { chart } from '@/lib/design/layout'

export type BarPoint = {
  label: string
  value: number
  color?: string
}

type Props = {
  data:         BarPoint[]
  defaultColor?: string
  height?:      number
  xInterval?:   number
}

export function CockpitBarChart({
  data,
  defaultColor = colors.chargeOrange,
  height = chart.minHeight,
  xInterval,
}: Props) {
  const interval = xInterval ?? 0
  const gap = `${Math.round((1 - chart.barWidthRatio) * 100)}%`

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: chart.topPadBar, right: chart.rightPad, left: 0, bottom: 0 }}
          barCategoryGap={gap}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: colors.subtleText }}
            angle={chart.xLabelRotation}
            textAnchor="end"
            interval={interval}
            stroke={colors.border}
            tickLine={false}
            height={70}
          />
          <YAxis
            tick={{ fontSize: 12, fill: colors.subtleText }}
            stroke="none"
            tickLine={false}
            axisLine={false}
            tickCount={chart.yTickCount}
            width={34}
          />
          <Tooltip
            contentStyle={{
              background:   colors.cardBg,
              border:       `1px solid ${colors.border}`,
              borderRadius: 6,
              fontSize:     12,
            }}
            labelStyle={{ color: colors.subtleText }}
            itemStyle={{ color: colors.text }}
            cursor={{ fill: colors.border + '40' }}
          />
          <Bar dataKey="value" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color ?? defaultColor} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
