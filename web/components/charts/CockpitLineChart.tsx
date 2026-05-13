'use client'

// Mirror of LineChart composable from ui/components/Charts.kt.
// stroke=4px, dot r=5.5, margin mirrors Android canvas padding.

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from 'recharts'
import { colors } from '@/lib/design/colors'
import { chart } from '@/lib/design/layout'

export type LinePoint = {
  date: string
  [key: string]: number | string
}

export type LineSeries = {
  key:   string
  label: string
  color: string
}

type Props = {
  data:      LinePoint[]
  series:    LineSeries[]
  height?:   number
  xInterval?: number
  showDots?:   boolean   // false → no dot on each point (used in Charge tab)
  showLabels?: boolean   // true → display the numeric value above each point
  labelFormatter?: (v: number) => string
}

export function CockpitLineChart({
  data,
  series,
  height = chart.minHeight,
  xInterval,
  showDots = true,
  showLabels = false,
  labelFormatter,
}: Props) {
  const interval = xInterval ?? Math.max(0, Math.floor(data.length / 8) - 1)

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: chart.topPad, right: chart.rightPad, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: colors.subtleText }}
            angle={chart.xLabelRotation}
            textAnchor="end"
            interval={interval}
            stroke={colors.border}
            tickLine={false}
            height={48}
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
          />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={chart.strokeWidth}
              dot={showDots ? { r: chart.dotRadius, fill: s.color, strokeWidth: 0 } : false}
              activeDot={{ r: chart.dotRadius + 1 }}
              isAnimationActive={false}
            >
              {showLabels && (
                <LabelList
                  dataKey={s.key}
                  position="top"
                  offset={6}
                  style={{ fontSize: 10, fill: s.color, fontWeight: 600 }}
                  formatter={(v: number) =>
                    v > 0 ? (labelFormatter ? labelFormatter(v) : String(v)) : ''
                  }
                />
              )}
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
