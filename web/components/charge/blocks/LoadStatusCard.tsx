'use client'

import { BlockCard } from '../BlockCard'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { charge as L } from '@/lib/design/labels'
import { colors } from '@/lib/design/colors'
import {
  kpiStatusFatigue,
  kpiStatusFitness,
  kpiStatusFreshness,
} from '@/lib/analytics/charge-kpi-status'

export function LoadStatusCard({ payload }: { payload: ChargeSportPayload }) {
  const last = payload.dailyMetrics[payload.dailyMetrics.length - 1]
  const atl  = Math.round(last?.atl ?? 0)
  const ctl  = Math.round(last?.ctl ?? 0)
  const tsb  = Math.round(last?.tsb ?? 0)

  const verdict = L.verdict[payload.insights.status]

  const fatigueStatus   = kpiStatusFatigue(atl, ctl)
  const fitnessStatus   = kpiStatusFitness(ctl)
  const freshnessStatus = kpiStatusFreshness(tsb)

  const fatigueLabel   = L.kpiStatus.fatigue[fatigueStatus.id]
  const fitnessLabel   = L.kpiStatus.fitness[fitnessStatus.id]
  const freshnessLabel = L.kpiStatus.freshness[freshnessStatus.id]

  return (
    <BlockCard title={L.blocks.status} helpTitle={L.blocks.status} helpBody={L.help.status}>
      <div className="mb-1">
        <p className="text-[14px] font-bold text-trail-text leading-[18px]">{verdict.action}</p>
        <p className="text-[12px] text-trail-muted mt-1 leading-[16px]">{verdict.reason}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <KpiCell
          label={L.recentFatigue}
          labelColor={colors.chargeOrange}
          value={atl}
          statusLabel={fatigueLabel}
          statusColor={fatigueStatus.color}
          tooltip={`ATL: ${atl}`}
        />
        <KpiCell
          label={L.baseFitness}
          labelColor={colors.seriesBlue}
          value={ctl}
          statusLabel={fitnessLabel}
          statusColor={fitnessStatus.color}
          tooltip={`CTL: ${ctl}`}
        />
        <KpiCell
          label={L.freshness}
          labelColor={colors.seriesYellow}
          value={tsb}
          statusLabel={freshnessLabel}
          statusColor={freshnessStatus.color}
          tooltip={`TSB: ${tsb}`}
        />
      </div>
    </BlockCard>
  )
}

type KpiCellProps = {
  label:       string
  labelColor:  string
  value:       number
  statusLabel: string
  statusColor: string
  tooltip:     string
}

function KpiCell({ label, labelColor, value, statusLabel, statusColor, tooltip }: KpiCellProps) {
  return (
    <div className="rounded-[10px] bg-trail-surface px-2 py-2 text-center" title={tooltip}>
      <p className="text-[10px] font-semibold" style={{ color: labelColor }}>{label}</p>
      <p className="text-[18px] font-black mt-0.5 text-trail-text">{value}</p>
      <p
        className="text-[10px] font-medium mt-0.5 flex items-center justify-center gap-1 leading-[14px]"
        style={{ color: statusColor }}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor }} />
        {statusLabel}
      </p>
    </div>
  )
}
