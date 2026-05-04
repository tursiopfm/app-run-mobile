'use client'

// Mirror of BlockType.CumulMonths from DashboardScreen.kt.
// Multi-line chart: each line = one calendar month's cumulative km by day.
// X-axis = day of month (1..31). Lines from MonthSeries[].

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

export type MonthSeries = {
  label:      string    // "Jan 2025"
  color:      string    // hex
  dailyCumul: number[]  // cumulative km for each day 1..N
}

type Props = {
  months:  MonthSeries[]
  height?: number
}

export function CockpitCumulChart({ months, height = 220 }: Props) {
  const maxDays = Math.max(...months.map((m) => m.dailyCumul.length), 0)

  if (maxDays === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center">
        <span className="text-[12px] text-trail-muted">Aucune donnée</span>
      </div>
    )
  }

  const data = Array.from({ length: maxDays }, (_, i) => {
    const point: Record<string, number | string> = { day: i + 1 }
    for (const m of months) {
      if (i < m.dailyCumul.length) point[m.label] = m.dailyCumul[i]
    }
    return point
  })

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: chart.topPad, right: chart.rightPad, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 12, fill: colors.subtleText }}
            interval={4}
            stroke={colors.border}
            tickLine={false}
            height={20}
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
            labelFormatter={(v) => `Jour ${v}`}
            itemStyle={{ color: colors.text }}
          />
          {months.map((m) => (
            <Line
              key={m.label}
              type="monotone"
              dataKey={m.label}
              stroke={m.color}
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
