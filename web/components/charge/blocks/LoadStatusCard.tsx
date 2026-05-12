'use client'

import { BlockCard } from '../BlockCard'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { charge as L } from '@/lib/design/labels'
import { colors } from '@/lib/design/colors'

const STATUS_COLOR: Record<string, string> = {
  insufficient:    colors.subtleText,
  overloaded:      colors.runRed,
  peak:            colors.seriesYellow,
  loaded:          colors.seriesYellow,
  'under-trained': colors.seriesBlue,
  'very-fresh':    colors.seriesBlue,
  light:           colors.subtleText,
  progressing:     colors.chargeOrange,
  balanced:        colors.greenOk,
}

function toHex(c: string, op: number) {
  return `${c}${Math.round(op * 255).toString(16).padStart(2, '0')}`
}

export function LoadStatusCard({ payload }: { payload: ChargeSportPayload }) {
  const last = payload.dailyMetrics[payload.dailyMetrics.length - 1]
  const atl  = Math.round(last?.atl ?? 0)
  const ctl  = Math.round(last?.ctl ?? 0)
  const tsb  = Math.round(last?.tsb ?? 0)
  const color = STATUS_COLOR[payload.insights.status] ?? colors.greenOk
  const statusLabel = (L.status as Record<string, string>)[payload.insights.status] ?? ''

  return (
    <BlockCard title={L.blocks.status} helpTitle={L.blocks.status} helpBody={L.help.status}>
      <div className="flex items-center justify-between">
        <div className="flex-1 pr-3">
          <p className="text-[15px] font-bold text-trail-text">{L.blocks.status}</p>
          <p className="text-[11px] text-trail-muted mt-1 leading-[16px]">{payload.insights.headline}</p>
        </div>
        <span
          className="inline-flex items-center rounded-full px-3 py-[6px] text-[11px] font-semibold leading-none flex-shrink-0"
          style={{
            backgroundColor: toHex(color, 0.15),
            color,
            border:          `1px solid ${toHex(color, 0.5)}`,
          }}
        >
          {statusLabel}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="rounded-[10px] bg-trail-surface px-2 py-2 text-center" title={`ATL: ${atl}`}>
          <p className="text-[10px] text-trail-muted">{L.recentFatigue}</p>
          <p className="text-[18px] font-black mt-0.5" style={{ color: colors.chargeOrange }}>{atl}</p>
        </div>
        <div className="rounded-[10px] bg-trail-surface px-2 py-2 text-center" title={`CTL: ${ctl}`}>
          <p className="text-[10px] text-trail-muted">{L.baseFitness}</p>
          <p className="text-[18px] font-black mt-0.5" style={{ color: colors.seriesBlue }}>{ctl}</p>
        </div>
        <div className="rounded-[10px] bg-trail-surface px-2 py-2 text-center" title={`TSB: ${tsb}`}>
          <p className="text-[10px] text-trail-muted">{L.freshness}</p>
          <p className="text-[18px] font-black mt-0.5" style={{ color }}>{tsb}</p>
        </div>
      </div>
    </BlockCard>
  )
}
