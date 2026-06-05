'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { colors } from '@/lib/design/colors'

type LoadChartProps = {
  data: { date: string; atl: number; ctl: number }[]
  height?: number
}

export function LoadChart({ data, height = 180 }: LoadChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gradAtl" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={colors.chargeOrange} stopOpacity={0.3} />
            <stop offset="95%" stopColor={colors.chargeOrange} stopOpacity={0}   />
          </linearGradient>
          <linearGradient id="gradCtl" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={colors.seriesBlue} stopOpacity={0.3} />
            <stop offset="95%" stopColor={colors.seriesBlue} stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
        <XAxis dataKey="date" tick={{ fill: colors.subtleText, fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fill: colors.subtleText, fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: colors.text }} />
        <Area type="monotone" dataKey="atl" stroke={colors.chargeOrange} strokeWidth={2} fill="url(#gradAtl)" name="Fatigue" />
        <Area type="monotone" dataKey="ctl" stroke={colors.seriesBlue} strokeWidth={2} fill="url(#gradCtl)" name="Fitness" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
