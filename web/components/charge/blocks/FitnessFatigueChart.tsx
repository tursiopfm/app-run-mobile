'use client'

import { BlockCard } from '../BlockCard'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { charge as L } from '@/lib/design/labels'
import { colors } from '@/lib/design/colors'
import { kpiStatusFreshness } from '@/lib/analytics/charge-kpi-status'
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'

export function FitnessFatigueChart({ payload }: { payload: ChargeSportPayload }) {
  const data = payload.dailyMetrics.slice(-70).map(m => ({
    date: m.date.slice(5),
    atl:  Math.round(m.atl),
    ctl:  Math.round(m.ctl),
    tsb:  Math.round(m.tsb),
  }))

  const lastTsb = data.length ? data[data.length - 1].tsb : 0
  const freshnessColor = kpiStatusFreshness(lastTsb).color

  return (
    <BlockCard title={L.blocks.fitnessFatigue} helpTitle={L.blocks.fitnessFatigue} helpBody={L.help.fitnessFatigue}>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={colors.border} strokeDasharray="2 2" />
            <XAxis dataKey="date" interval={6} tick={{ fontSize: 10, fill: colors.subtleText }} />
            <YAxis tick={{ fontSize: 10, fill: colors.subtleText }} />
            <Tooltip
              contentStyle={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.border}`, fontSize: 12 }}
              labelStyle={{ color: colors.text }}
              itemSorter={(item) => {
                const order: Record<string, number> = { atl: 0, ctl: 1, tsb: 2 }
                return order[item.dataKey as string] ?? 99
              }}
              formatter={(v: number, n) =>
                n === 'atl' ? [v, 'Fatigue récente (ATL)']
                : n === 'ctl' ? [v, 'Base de forme (CTL)']
                : [v, 'Fraîcheur (TSB)']
              }
            />
            <Area dataKey="tsb" type="monotone" fill={freshnessColor} stroke="none" fillOpacity={0.18} />
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
          <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: freshnessColor, opacity: 0.5 }} />{L.freshness}
        </span>
      </div>
    </BlockCard>
  )
}
