'use client'

import { BlockCard } from '@/components/blocks/BlockCard'
import { computeLoadBalanceRatio } from '@/lib/analytics/charge-insights'
import { LOAD_BALANCE } from '@/lib/analytics/charge-thresholds'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { charge as L } from '@/lib/design/labels'
import { colors } from '@/lib/design/colors'

function pct(r: number): string {
  return `${Math.round(r * 100)}%`
}

function zoneOf(r: number): { label: string; color: string } {
  if (r === 0)                       return { label: '—',                 color: colors.subtleText }
  if (r < LOAD_BALANCE.low)          return { label: 'Charge faible',     color: colors.subtleText }
  if (r < LOAD_BALANCE.balanced)     return { label: 'Équilibrée',         color: colors.greenOk    }
  if (r < LOAD_BALANCE.high)         return { label: 'Progression élevée', color: colors.chargeOrange }
  return                              { label: 'Pic de charge',           color: colors.runRed    }
}

export function AcuteChronicCard({ payload }: { payload: ChargeSportPayload }) {
  const sum7  = Math.round(payload.dailyLoads.slice(-7).reduce((s, d) => s + d.ces, 0))
  const sum28 = Math.round(payload.dailyLoads.slice(-28).reduce((s, d) => s + d.ces, 0))
  const ratio = computeLoadBalanceRatio(payload.dailyMetrics, payload.dailyLoads).sumRatio7vs28
  const zone  = zoneOf(ratio)

  return (
    <BlockCard title={L.blocks.acuteChronic} helpTitle={L.blocks.acuteChronic} helpBody={L.help.acuteChronic}>
      <div className="grid grid-cols-2 gap-3 mt-1">
        <div className="rounded-[10px] bg-trail-surface px-3 py-2">
          <p className="text-[10px] text-trail-muted">{L.acuteLoad}</p>
          <p className="text-[22px] font-black mt-0.5 text-trail-text">{sum7}</p>
        </div>
        <div className="rounded-[10px] bg-trail-surface px-3 py-2">
          <p className="text-[10px] text-trail-muted">{L.chronicLoad}</p>
          <p className="text-[22px] font-black mt-0.5 text-trail-text">{sum28}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[11px] text-trail-muted">{L.loadBalance}</span>
        <span className="text-[14px] font-bold" style={{ color: zone.color }}>{pct(ratio)}</span>
        <span className="text-[11px] font-semibold" style={{ color: zone.color }}>· {zone.label}</span>
      </div>
      <p className="mt-2 text-[11px] text-trail-muted leading-[16px]">
        Tes 7 derniers jours représentent <strong className="text-trail-text">{pct(ratio)}</strong> de ta charge habituelle sur 28 jours.
      </p>
    </BlockCard>
  )
}
