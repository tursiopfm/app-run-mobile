'use client'

import { BlockCard } from '@/components/blocks/BlockCard'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { MONOTONY, STRAIN } from '@/lib/analytics/charge-thresholds'
import { useT } from '@/lib/i18n/I18nProvider'
import { colors } from '@/lib/design/colors'

function fmtDate(iso: string): string {
  if (!iso) return '—'
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function MonotonyStrainCard({ payload }: { payload: ChargeSportPayload }) {
  const L = useT().charge
  const monoColor   = payload.monotony7d >= MONOTONY.repetitiveMin ? colors.runRed
                    : payload.monotony7d > MONOTONY.variedMax     ? colors.seriesYellow
                    : colors.greenOk
  const strainColor = payload.strain7d > STRAIN.high                ? colors.runRed
                    : payload.strain7d > STRAIN.high * 0.7         ? colors.seriesYellow
                    : colors.greenOk

  return (
    <BlockCard title={L.blocks.monotonyStrain} helpTitle={L.blocks.monotonyStrain} helpBody={L.help.monotonyStrain}>
      <div className="grid grid-cols-2 gap-2 mt-1">
        <div className="rounded-[10px] bg-trail-surface px-3 py-2">
          <p className="text-[10px] text-trail-muted">{L.monoTitle}</p>
          <p className="text-[18px] font-bold font-data tabular-nums mt-0.5" style={{ color: monoColor }}>{payload.monotony7d.toFixed(2)}</p>
          <p className="text-[10px] text-trail-muted mt-0.5">{L.monoUnit}</p>
        </div>
        <div className="rounded-[10px] bg-trail-surface px-3 py-2">
          <p className="text-[10px] text-trail-muted">{L.strainTitle}</p>
          <p className="text-[18px] font-bold font-data tabular-nums mt-0.5" style={{ color: strainColor }}>{payload.strain7d}</p>
          <p className="text-[10px] text-trail-muted mt-0.5">{L.strainUnit}</p>
        </div>
        <div className="rounded-[10px] bg-trail-surface px-3 py-2">
          <p className="text-[10px] text-trail-muted">{L.activeDays}</p>
          <p className="text-[18px] font-bold font-data tabular-nums mt-0.5 text-trail-text">{payload.activeDays7d}/7</p>
        </div>
        <div className="rounded-[10px] bg-trail-surface px-3 py-2">
          <p className="text-[10px] text-trail-muted">{L.peakDay}</p>
          <p className="text-[18px] font-bold font-data tabular-nums mt-0.5 text-trail-text">
            {payload.peakDay7d ? payload.peakDay7d.ces : 0}
          </p>
          <p className="text-[10px] text-trail-muted mt-0.5">
            {payload.peakDay7d ? fmtDate(payload.peakDay7d.date) : '—'}
          </p>
        </div>
      </div>
    </BlockCard>
  )
}
