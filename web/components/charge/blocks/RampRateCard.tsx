'use client'

import { BlockCard } from '@/components/blocks/BlockCard'
import type { ChargeSportPayload, RampRateLabel } from '@/lib/analytics/charge-insights.types'
import { useT } from '@/lib/i18n/I18nProvider'
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
  const L = useT().charge
  const pct = Math.round(payload.rampRate.deltaWeekPct * 100)
  const color = COLOR_BY_LABEL[payload.rampRate.label]
  const txt = L.ramp[payload.rampRate.label]

  return (
    <BlockCard title={L.blocks.rampRateBlock} helpTitle={L.blocks.rampRateBlock} helpBody={L.help.rampRateBlock}>
      <div className="flex items-baseline gap-3">
        <p className="text-display font-bold font-data tabular-nums" style={{ color }}>
          {pct > 0 ? '+' : ''}{pct}%
        </p>
        <p className="text-body font-semibold text-trail-text">{txt}</p>
      </div>
      <p className="mt-2 text-micro text-trail-muted leading-[16px]">
        {L.rampCaption}
      </p>
    </BlockCard>
  )
}
