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
import { useChartTooltipDismiss } from '@/lib/charts/use-chart-tooltip-dismiss'

export type MonthSeries = {
  label:      string    // "Jan 2025"
  color:      string    // hex
  dailyCumul: number[]  // cumulative km for each day 1..N
}

type Props = {
  months:  MonthSeries[]
  height?: number
  mode?:   'month' | 'year'
}

// Day-of-year of each month start (non-leap calendar — close enough for tick positions).
const MONTH_TICK_DAYS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]
const MONTH_TICK_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

type DotProps = {
  cx?: number; cy?: number; index?: number;
  payload?: Record<string, unknown>;
  dataKey?: string; color?: string; lastIndex?: number;
}

function EndDot({ cx, cy, index, payload, dataKey, color, lastIndex }: DotProps) {
  if (index !== lastIndex || cx == null || cy == null) return null
  const val = payload?.[dataKey as string]
  if (val == null) return null
  const rounded = Math.round(val as number)
  return (
    <g>
      <circle cx={cx} cy={cy} r={3} fill={color} />
      <text
        x={cx} y={cy - 6}
        textAnchor="middle"
        fontSize={10}
        fill={color}
        fontWeight={700}
      >
        {rounded}
      </text>
    </g>
  )
}

export function CockpitCumulChart({ months, height = 220, mode = 'month' }: Props) {
  const maxDays = Math.max(...months.map((m) => m.dailyCumul.length), 0)
  const wrapperRef = useChartTooltipDismiss()

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
    <div ref={wrapperRef} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: chart.topPad, right: chart.rightPad, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 12, fill: colors.subtleText }}
            {...(mode === 'year'
              ? {
                  ticks: MONTH_TICK_DAYS.filter((d) => d <= maxDays),
                  tickFormatter: (v: number) => {
                    const idx = MONTH_TICK_DAYS.indexOf(v)
                    return idx >= 0 ? MONTH_TICK_LABELS[idx] : ''
                  },
                }
              : { interval: 4 })}
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
            labelFormatter={(v) => (mode === 'year' ? `Jour ${v} de l'année` : `Jour ${v}`)}
            itemStyle={{ color: colors.text }}
          />
          {months.map((m) => {
            const lastIdx = m.dailyCumul.length - 1
            return (
              <Line
                key={m.label}
                type="monotone"
                dataKey={m.label}
                stroke={m.color}
                strokeWidth={2.5}
                dot={(props) => <EndDot {...props} color={m.color} lastIndex={lastIdx} />}
                activeDot={{ r: 3 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
