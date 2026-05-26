'use client'

import { useState } from 'react'
import { BlockCard } from '@/components/blocks/BlockCard'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { useT } from '@/lib/i18n/I18nProvider'
import { colors } from '@/lib/design/colors'

function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function LoadHeatmap28d({ payload }: { payload: ChargeSportPayload }) {
  const L = useT().charge
  const DAYS_HEADER = L.daysHeader
  const cells = payload.dailyLoads.slice(-28)
  const max   = Math.max(1, ...cells.map(c => c.ces))
  const [tip, setTip] = useState<{ date: string; ces: number } | null>(null)

  return (
    <BlockCard title={L.blocks.heatmap} helpTitle={L.blocks.heatmap} helpBody={L.help.heatmap}>
      <div className="grid grid-cols-7 gap-1 mt-1">
        {DAYS_HEADER.map((d, i) => (
          <div key={i} className="text-[10px] text-trail-muted text-center">{d}</div>
        ))}
        {cells.map((c, i) => {
          const opacity = c.ces === 0 ? 0.08 : 0.2 + (c.ces / max) * 0.8
          return (
            <button
              key={i}
              onMouseEnter={() => setTip({ date: c.date, ces: Math.round(c.ces) })}
              onMouseLeave={() => setTip(null)}
              onClick={() => setTip(t => t?.date === c.date ? null : { date: c.date, ces: Math.round(c.ces) })}
              aria-label={`${fmtDate(c.date)} : ${Math.round(c.ces)} CES`}
              className="aspect-square rounded-[4px]"
              style={{ backgroundColor: colors.chargeOrange, opacity }}
            />
          )
        })}
      </div>
      <div className="flex justify-between items-center mt-3 text-[11px] text-trail-muted">
        <span>{L.heatLess}</span>
        <div className="flex gap-1">
          {[0.15, 0.35, 0.55, 0.75, 0.95].map((o, i) => (
            <span key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors.chargeOrange, opacity: o }} />
          ))}
        </div>
        <span>{L.heatMore}</span>
      </div>
      {tip && (
        <p className="mt-2 text-[11px] text-trail-text text-center">
          <strong>{fmtDate(tip.date)}</strong> · {tip.ces} CES
        </p>
      )}
    </BlockCard>
  )
}
