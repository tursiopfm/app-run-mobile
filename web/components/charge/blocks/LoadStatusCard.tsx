'use client'

import { useState } from 'react'
import { BlockCard } from '@/components/blocks/BlockCard'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { charge as L } from '@/lib/design/labels'
import { colors } from '@/lib/design/colors'
import {
  kpiStatusFatigue,
  kpiStatusFitness,
  kpiStatusFreshness,
} from '@/lib/analytics/charge-kpi-status'
import { FreshnessHelpSheet } from '@/components/ui/FreshnessHelpSheet'
import { FatigueHelpSheet } from '@/components/ui/FatigueHelpSheet'
import { FitnessHelpSheet } from '@/components/ui/FitnessHelpSheet'

type HelpKey = 'fatigue' | 'fitness' | 'freshness' | null

export function LoadStatusCard({ payload }: { payload: ChargeSportPayload }) {
  const [openHelp, setOpenHelp] = useState<HelpKey>(null)

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
          tooltip={`ATL: ${atl}`}
          onClick={() => setOpenHelp('fatigue')}
        />
        <KpiCell
          label={L.baseFitness}
          labelColor={colors.seriesBlue}
          value={ctl}
          statusLabel={fitnessLabel}
          tooltip={`CTL: ${ctl}`}
          onClick={() => setOpenHelp('fitness')}
        />
        <KpiCell
          label={L.freshness}
          labelColor={colors.seriesYellow}
          value={tsb}
          statusLabel={freshnessLabel}
          tooltip={`TSB: ${tsb}`}
          onClick={() => setOpenHelp('freshness')}
        />
      </div>
      {openHelp === 'fatigue' && (
        <FatigueHelpSheet currentId={fatigueStatus.id} onClose={() => setOpenHelp(null)} />
      )}
      {openHelp === 'fitness' && (
        <FitnessHelpSheet currentId={fitnessStatus.id} onClose={() => setOpenHelp(null)} />
      )}
      {openHelp === 'freshness' && (
        <FreshnessHelpSheet currentId={freshnessStatus.id} onClose={() => setOpenHelp(null)} />
      )}
    </BlockCard>
  )
}

type KpiCellProps = {
  label:       string
  labelColor:  string
  value:       number
  statusLabel: string
  tooltip:     string
  onClick:     () => void
}

function KpiCell({ label, labelColor, value, statusLabel, tooltip, onClick }: KpiCellProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      aria-label={`${label} — voir les explications`}
      className="rounded-[10px] bg-trail-surface px-2 py-2 text-center hover:brightness-110 transition cursor-pointer w-full"
    >
      <p className="text-[12px] font-semibold" style={{ color: labelColor }}>{label}</p>
      <p className="text-[18px] font-black mt-0.5 text-trail-text">{value}</p>
      <p className="text-[11px] font-medium mt-0.5 text-trail-muted leading-[14px]">
        {statusLabel}
      </p>
    </button>
  )
}
