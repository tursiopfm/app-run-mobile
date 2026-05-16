'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { BlockCard } from '@/components/blocks/BlockCard'
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

  const min = -50, max = 30
  const zones = [
    { from: min,                       to: FRESHNESS.highFatigue,    color: colors.runRed       },
    { from: FRESHNESS.highFatigue,     to: FRESHNESS.normalFatigue,  color: colors.seriesYellow },
    { from: FRESHNESS.normalFatigue,   to: FRESHNESS.fresh,          color: colors.greenOk      },
    { from: FRESHNESS.fresh,           to: FRESHNESS.veryFresh,      color: colors.seriesBlue   },
    { from: FRESHNESS.veryFresh,       to: max,                      color: '#7DD3FC'           },
  ]

  const delta       = Math.round(f.deltaVsWeekAgo)
  const isUp        = delta > 1
  const isDown      = delta < -1
  const TrendIcon   = isUp ? TrendingUp : isDown ? TrendingDown : Minus
  const trendColor  = isUp ? colors.greenOk : isDown ? colors.runRed : colors.subtleText
  const qualifier   = isUp   ? "plus frais qu'il y a 7 jours"
                    : isDown ? "plus fatigué qu'il y a 7 jours"
                    :          'stable depuis 7 jours'
  const previousTsb = f.tsb - f.deltaVsWeekAgo

  return (
    <BlockCard title={L.blocks.freshness} helpTitle={L.blocks.freshness} helpBody={L.help.freshness}>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div>
          <p className="text-[22px] font-black text-trail-text">{Math.round(f.tsb)}</p>
          <p className="text-[12px] font-semibold text-trail-text">{zoneLabel}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-trail-muted text-right leading-snug">
          <TrendIcon size={14} strokeWidth={2.5} color={trendColor} aria-hidden />
          <span>
            <strong style={{ color: trendColor }}>{delta > 0 ? '+' : ''}{delta}</strong>
            <span className="mx-1 opacity-60">·</span>
            {qualifier}
          </span>
        </span>
      </div>
      <Gauge
        value={f.tsb}
        previousValue={previousTsb}
        previousLabel={`Il y a 7 jours : ${Math.round(previousTsb)}`}
        min={min}
        max={max}
        zones={zones}
      />
      <p className="mt-3 text-[11px] text-trail-muted leading-[16px]">{ZONE_INTERPRET[f.zone]}</p>
    </BlockCard>
  )
}
