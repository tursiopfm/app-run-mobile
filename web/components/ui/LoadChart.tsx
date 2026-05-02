'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

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
            <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f97316" stopOpacity={0}   />
          </linearGradient>
          <linearGradient id="gradCtl" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#22d3ee" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2f45" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: '#1e2235', border: '1px solid #2a2f45', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#e8eaf0' }} />
        <Area type="monotone" dataKey="atl" stroke="#f97316" strokeWidth={2} fill="url(#gradAtl)" name="Fatigue" />
        <Area type="monotone" dataKey="ctl" stroke="#22d3ee" strokeWidth={2} fill="url(#gradCtl)" name="Fitness" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
