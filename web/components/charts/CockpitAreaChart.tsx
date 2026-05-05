'use client'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { colors } from '@/lib/design/colors'
import { chart } from '@/lib/design/layout'

export type AreaPoint = {
  date:  string
  value: number
}

type Props = {
  data:       AreaPoint[]
  color?:     string
  height?:    number
  xInterval?: number
}

export function CockpitAreaChart({
  data,
  color     = colors.chargeOrange,
  height    = chart.areaChartHeight,
  xInterval = 0,
}: Props) {
  const gradId = `area-grad-${color.replace('#', '')}`
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: chart.topPad, right: chart.rightPad, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
          <XAxis
            dataKey="date"
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
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={chart.strokeWidth}
            fill={`url(#${gradId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
