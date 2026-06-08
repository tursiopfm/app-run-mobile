'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { BlockCard } from '@/components/blocks/BlockCard'
import { Gauge } from '../Gauge'
import { computeFreshness } from '@/lib/analytics/charge-insights'
import { FRESHNESS } from '@/lib/analytics/charge-thresholds'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { useT } from '@/lib/i18n/I18nProvider'
import { colors } from '@/lib/design/colors'

export function FreshnessCard({ payload }: { payload: ChargeSportPayload }) {
  const L = useT().charge
  const f = computeFreshness(payload.dailyMetrics)
  const zoneLabel = L.freshnessZone[f.zone]
  const zoneInterpret: Record<string, string> = L.freshnessInterpret

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
  const qualifier   = isUp   ? L.freshnessDeltaFresher
                    : isDown ? L.freshnessDeltaTired
                    :          L.freshnessDeltaStable
  const previousTsb = f.tsb - f.deltaVsWeekAgo

  return (
    <BlockCard title={L.blocks.freshness} helpTitle={L.blocks.freshness} helpBody={L.help.freshness}>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div>
          <p className="text-[22px] font-bold font-data tabular-nums text-trail-text">{Math.round(f.tsb)}</p>
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
        previousLabel={L.freshnessSevenDaysAgo(Math.round(previousTsb))}
        min={min}
        max={max}
        zones={zones}
      />
      <p className="mt-3 text-[11px] text-trail-muted leading-[16px]">{zoneInterpret[f.zone]}</p>
    </BlockCard>
  )
}
