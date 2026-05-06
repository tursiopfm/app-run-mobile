'use client'

// Mirror of ComboBarLineChart composable from ui/components/Charts.kt.
// bars = D+ elevation (left Y, blue) | line = km (right Y, orange) | dual Y-axes.

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from 'recharts'
import { colors } from '@/lib/design/colors'
import { chart } from '@/lib/design/layout'

export type ComboPoint = {
  label: string
  dPlus: number   // bars, left Y-axis
  km:    number   // line, right Y-axis
}

type Props = {
  data:       ComboPoint[]
  lineColor?: string
  barColor?:  string
  height?:    number
}

export function CockpitComboChart({
  data,
  lineColor = colors.chargeOrange,
  barColor  = colors.seriesBlue,
  height    = 220,
}: Props) {
  const gap = `${Math.round((1 - chart.comboBarRatio) * 100)}%`

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: chart.topPadCombo, right: 44, left: 0, bottom: 0 }}
          barCategoryGap={gap}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: colors.subtleText }}
            angle={chart.comboLabelRotation}
            textAnchor="end"
            interval={0}
            stroke={colors.border}
            tickLine={false}
            height={70}
          />
          <YAxis
            yAxisId="bar"
            orientation="left"
            tick={{ fontSize: 12, fill: barColor, fontWeight: 600 }}
            stroke="none"
            tickLine={false}
            axisLine={false}
            tickCount={chart.comboYTickCount}
            width={38}
          />
          <YAxis
            yAxisId="line"
            orientation="right"
            tick={{ fontSize: 12, fill: lineColor, fontWeight: 600 }}
            stroke="none"
            tickLine={false}
            axisLine={false}
            tickCount={chart.comboYTickCount}
            width={38}
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
          <Bar
            yAxisId="bar"
            dataKey="dPlus"
            name="D+ (m)"
            fill={barColor}
            fillOpacity={0.7}
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="dPlus"
              position="top"
              style={{ fontSize: 9, fill: barColor, fontWeight: 600 }}
              formatter={(v: number) => v > 0 ? v.toLocaleString('fr-FR') : ''}
            />
          </Bar>
          <Line
            yAxisId="line"
            type="monotone"
            dataKey="km"
            name="km"
            stroke={lineColor}
            strokeWidth={chart.strokeWidth}
            dot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="km"
              position="top"
              style={{ fontSize: 9, fill: lineColor, fontWeight: 600 }}
              formatter={(v: number) => v > 0 ? Math.round(v) : ''}
            />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
