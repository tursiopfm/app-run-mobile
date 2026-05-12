'use client'

import { BlockCard } from '../BlockCard'
import type { ChargeSportPayload, RampRateLabel } from '@/lib/analytics/charge-insights.types'
import { charge as L } from '@/lib/design/labels'
import { colors } from '@/lib/design/colors'

const COLOR_BY_LABEL: Record<RampRateLabel, string> = {
  'fast-rise':           colors.runRed,
  'controlled-rise':     colors.chargeOrange,
  'stable':              colors.greenOk,
  'progressive-resume':  colors.seriesBlue,
  'declining':           colors.seriesYellow,
  'sharp-decline':       colors.subtleText,
}

export function RampRateCard({ payload }: { payload: ChargeSportPayload }) {
  const pct = Math.round(payload.rampRate.deltaWeekPct * 100)
  const color = COLOR_BY_LABEL[payload.rampRate.label]
  const txt = L.ramp[payload.rampRate.label]

  return (
    <BlockCard title={L.blocks.rampRateBlock} helpTitle={L.blocks.rampRateBlock} helpBody={L.help.rampRateBlock}>
      <div className="flex items-baseline gap-3">
        <p className="text-[28px] font-black" style={{ color }}>
          {pct > 0 ? '+' : ''}{pct}%
        </p>
        <p className="text-[14px] font-semibold text-trail-text">{txt}</p>
      </div>
      <p className="mt-2 text-[11px] text-trail-muted leading-[16px]">
        Variation de la charge totale entre la semaine en cours et la précédente.
      </p>
    </BlockCard>
  )
}
