'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { colors } from '@/lib/design/colors'
import { chart } from '@/lib/design/layout'

export type LineSeries = {
  key:   string
  label: string
  color: string
}

type Props = {
  data:       Array<Record<string, number | string>>
  series:     LineSeries[]
  height?:    number
  xInterval?: number
  showDots?:  boolean
  xKey?:      string
}

export function CockpitLineChart({
  data,
  series,
  height    = 220,
  xInterval = 0,
  showDots  = true,
  xKey      = 'date',
}: Props) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: chart.topPad, right: chart.rightPad, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
          <XAxis
            dataKey={xKey}
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
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={chart.strokeWidth}
              dot={showDots ? { r: chart.dotRadius, fill: s.color, strokeWidth: 0 } : false}
              activeDot={showDots ? { r: chart.dotRadius + 1 } : false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
