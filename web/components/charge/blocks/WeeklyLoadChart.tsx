'use client'

import { BlockCard } from '../BlockCard'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { charge as L } from '@/lib/design/labels'
import { colors } from '@/lib/design/colors'
import { useChartTooltipDismiss } from '@/lib/charts/use-chart-tooltip-dismiss'
import {
  Bar, XAxis, YAxis, Tooltip, Legend, Line, ComposedChart, ResponsiveContainer, CartesianGrid,
} from 'recharts'

const SPORT_COLORS = {
  run:   colors.chargeOrange,
  ride:  colors.seriesGreen,
  swim:  colors.seriesBlue,
  other: colors.subtleText,
}

export function WeeklyLoadChart({ payload }: { payload: ChargeSportPayload }) {
  const wrapperRef = useChartTooltipDismiss()
  const data = payload.weeklyLoadByCategory.map(w => ({
    week:  w.weekLabel,
    run:   Math.round(w.run),
    ride:  Math.round(w.ride),
    swim:  Math.round(w.swim),
    other: Math.round(w.other),
    avg4w: Math.round(w.avg4w),
  }))

  return (
    <BlockCard title={L.blocks.weeklyLoad} helpTitle={L.blocks.weeklyLoad} helpBody={L.help.weeklyLoad}>
      <div ref={wrapperRef} style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={colors.border} strokeDasharray="2 2" />
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: colors.subtleText }} />
            <YAxis tick={{ fontSize: 10, fill: colors.subtleText }} />
            <Tooltip
              contentStyle={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.border}`, fontSize: 12 }}
              labelStyle={{ color: colors.text }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="run"   stackId="a" fill={SPORT_COLORS.run}   name="Course" />
            <Bar dataKey="ride"  stackId="a" fill={SPORT_COLORS.ride}  name="Vélo" />
            <Bar dataKey="swim"  stackId="a" fill={SPORT_COLORS.swim}  name="Natation" />
            <Bar dataKey="other" stackId="a" fill={SPORT_COLORS.other} name="Autres" />
            <Line type="monotone" dataKey="avg4w" stroke={colors.text} strokeWidth={1.5} dot={false} name="Moy 4 sem." />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </BlockCard>
  )
}
