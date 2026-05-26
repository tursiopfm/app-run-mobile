'use client'

import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import { useT } from '@/lib/i18n/I18nProvider'
import { colors } from '@/lib/design/colors'
import { useChartTooltipDismiss } from '@/lib/charts/use-chart-tooltip-dismiss'
import type { DailyMetrics } from '@/lib/analytics/fatigue'

export function FitnessFatigue10dChart({ dailyMetrics }: { dailyMetrics: DailyMetrics[] }) {
  const L = useT().charge
  const data = dailyMetrics.slice(-10).map(m => ({
    date: m.date.slice(5),
    atl:  Math.round(m.atl),
    ctl:  Math.round(m.ctl),
    tsb:  Math.round(m.tsb),
  }))
  const wrapperRef = useChartTooltipDismiss()

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      <div className="flex items-center justify-between mb-[6px]">
        <h3 className="text-[15px] font-semibold text-trail-muted">{L.blocks.fitnessFatigue}</h3>
      </div>
      <div ref={wrapperRef} style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={colors.border} strokeDasharray="2 2" />
            <XAxis dataKey="date" interval={2} tick={{ fontSize: 10, fill: colors.subtleText }} />
            <YAxis tick={{ fontSize: 10, fill: colors.subtleText }} />
            <Tooltip
              contentStyle={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.border}`, fontSize: 12 }}
              labelStyle={{ color: colors.text }}
            />
            <Area dataKey="tsb" type="monotone" fill={colors.seriesYellow} stroke="none" fillOpacity={0.18} />
            <Line dataKey="atl" type="monotone" stroke={colors.chargeOrange} strokeWidth={2} dot={false} />
            <Line dataKey="ctl" type="monotone" stroke={colors.seriesBlue}    strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        <span className="flex items-center gap-1.5 text-[11px] text-trail-muted">
          <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: colors.chargeOrange }} />{L.recentFatigue}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-trail-muted">
          <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: colors.seriesBlue }} />{L.baseFitness}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-trail-muted">
          <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: colors.seriesYellow, opacity: 0.5 }} />{L.freshness}
        </span>
      </div>
    </div>
  )
}
