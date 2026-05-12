'use client'

import { BlockCard } from '../BlockCard'
import { Gauge } from '../Gauge'
import { computeFreshness } from '@/lib/analytics/charge-insights'
import { FRESHNESS } from '@/lib/analytics/charge-thresholds'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { charge as L } from '@/lib/design/labels'
import { colors } from '@/lib/design/colors'

const ZONE_INTERPRET: Record<string, string> = {
  'very-fresh':     "Tu es très frais. Attention au sous-entraînement si cette situation dure trop longtemps.",
  fresh:            "Tu es bien reposé.",
  balanced:         "Charge et forme équilibrées.",
  'normal-fatigue': "Fatigue normale d'entraînement. Cohérent en phase de charge.",
  'high-fatigue':   "Fatigue élevée. Pense à insérer une journée de récupération.",
}

export function FreshnessCard({ payload }: { payload: ChargeSportPayload }) {
  const f = computeFreshness(payload.dailyMetrics)
  const zoneLabel = L.freshnessZone[f.zone]

  const min = -40, max = 30
  const zones = [
    { from: min,                       to: FRESHNESS.highFatigue,    color: colors.runRed },
    { from: FRESHNESS.highFatigue,     to: FRESHNESS.normalFatigue,  color: colors.seriesYellow },
    { from: FRESHNESS.normalFatigue,   to: FRESHNESS.fresh,          color: colors.greenOk },
    { from: FRESHNESS.fresh,           to: max,                      color: colors.seriesBlue },
  ]
  const arrow = f.deltaVsWeekAgo > 1 ? '↗' : f.deltaVsWeekAgo < -1 ? '↘' : '→'

  return (
    <BlockCard title={L.blocks.freshness} helpTitle={L.blocks.freshness} helpBody={L.help.freshness}>
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <p className="text-[22px] font-black text-trail-text">{Math.round(f.tsb)}</p>
          <p className="text-[12px] font-semibold text-trail-text">{zoneLabel}</p>
        </div>
        <span className="text-[12px] text-trail-muted">
          {arrow} {f.deltaVsWeekAgo > 0 ? '+' : ''}{f.deltaVsWeekAgo} vs J-7
        </span>
      </div>
      <Gauge value={f.tsb} min={min} max={max} zones={zones} />
      <p className="mt-3 text-[11px] text-trail-muted leading-[16px]">{ZONE_INTERPRET[f.zone]}</p>
    </BlockCard>
  )
}
