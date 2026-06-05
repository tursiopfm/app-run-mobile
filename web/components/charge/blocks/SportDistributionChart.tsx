'use client'

import { useState } from 'react'
import { BlockCard } from '@/components/blocks/BlockCard'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { useT } from '@/lib/i18n/I18nProvider'
import { colors } from '@/lib/design/colors'
import { useChartTooltipDismiss } from '@/lib/charts/use-chart-tooltip-dismiss'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

type Win = '7' | '28' | '70'

const SPORT_COLORS = {
  run:   colors.chargeOrange,
  ride:  colors.bikeGreen,
  swim:  colors.swimBlue,
  other: colors.subtleText,
}

export function SportDistributionChart({ payload }: { payload: ChargeSportPayload }) {
  const t = useT()
  const L = t.charge
  const LABELS = { run: t.sports.run, ride: t.sports.bike, swim: t.sports.swim, other: t.intensity.autre } as const
  const [win, setWin] = useState<Win>('28')
  const wrapperRef = useChartTooltipDismiss()
  const d = payload.sportDistribution[win]
  const data = (['run', 'ride', 'swim', 'other'] as const)
    .map(k => ({ name: LABELS[k], value: d[k], color: SPORT_COLORS[k] }))
    .filter(s => s.value > 0)

  return (
    <BlockCard
      title={L.blocks.sportDistribution}
      helpTitle={L.blocks.sportDistribution}
      helpBody={L.help.sportDistribution}
      rightSlot={
        <div className="flex gap-1 mr-1">
          {(['7', '28', '70'] as Win[]).map(w => (
            <button
              key={w}
              onClick={() => setWin(w)}
              className={`text-[10px] px-1.5 py-0.5 rounded-[6px] ${win === w ? 'bg-trail-surface text-trail-text' : 'text-trail-muted'}`}
            >
              {w === '7' ? L.windowWeek : w === '28' ? L.window28d : L.window10w}
            </button>
          ))}
        </div>
      }
    >
      {d.total === 0 ? (
        <p className="text-[12px] text-trail-muted text-center py-6">{L.notEnoughData}</p>
      ) : (
        <div className="flex items-center gap-3">
          <div ref={wrapperRef} style={{ width: 140, height: 140 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius={42} outerRadius={64} paddingAngle={2}>
                  {data.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.border}`, fontSize: 12 }}
                  formatter={(v: number, n) => [`${v} CES`, n]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex-1 space-y-1.5 text-[12px] text-trail-text">
            {data.map(s => (
              <li key={s.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                <span className="flex-1">{s.name}</span>
                <span className="font-semibold">{Math.round((s.value / d.total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </BlockCard>
  )
}
