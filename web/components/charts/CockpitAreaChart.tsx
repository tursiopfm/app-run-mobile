'use client'

// Mirror of AreaChart composable from ui/components/Charts.kt.
// Single-series filled area chart. Used in LoadTab for daily fatigue (ATL).

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
import { useChartTooltipDismiss } from '@/lib/charts/use-chart-tooltip-dismiss'

export type AreaPoint = {
  date:  string
  value: number
}

type Props = {
  data:      AreaPoint[]
  color?:    string
  height?:   number
  xInterval?: number
}

export function CockpitAreaChart({
  data,
  color = colors.chargeOrange,
  height = chart.areaChartHeight,
  xInterval,
}: Props) {
  const interval = xInterval ?? Math.max(0, Math.floor(data.length / 8) - 1)
  const gradientId = 'area-gradient'
  const wrapperRef = useChartTooltipDismiss()

  return (
    <div ref={wrapperRef} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: chart.topPad, right: chart.rightPad, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
          <XAxis
            dataKey="date"
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
            itemStyle={{ color }}
          />
          <Area
            type="monotone"
            dataKey="value"
            name="Charge"
            stroke={color}
            strokeWidth={chart.strokeWidth}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: chart.dotRadius, fill: color, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
