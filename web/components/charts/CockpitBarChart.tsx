'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { colors } from '@/lib/design/colors'
import { chart } from '@/lib/design/layout'

export type BarPoint = {
  label: string
  value: number
  color?: string
}

type Props = {
  data:       BarPoint[]
  color?:     string
  height?:    number
  xInterval?: number
}

export function CockpitBarChart({
  data,
  color     = colors.chargeOrange,
  height    = 200,
  xInterval = 0,
}: Props) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: chart.topPadBar, right: chart.rightPad, left: 0, bottom: 0 }}
          barCategoryGap={`${Math.round((1 - chart.barWidthRatio) * 100)}%`}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: colors.subtleText }}
            angle={chart.xLabelRotation}
            textAnchor="end"
            interval={xInterval}
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
            width={36}
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
          />
          <Bar dataKey="value" fill={color} radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color ?? color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
