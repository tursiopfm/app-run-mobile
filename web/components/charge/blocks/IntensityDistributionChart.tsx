'use client'

import { useState } from 'react'
import { BlockCard } from '../BlockCard'
import type { ChargeSportPayload, IntensityLabel } from '@/lib/analytics/charge-insights.types'
import { charge as L } from '@/lib/design/labels'
import { colors } from '@/lib/design/colors'

type Win = '7' | '28' | '70'

const INTENSITY_COLORS: Record<IntensityLabel, string> = {
  'Récupération':     colors.greenOk,
  'Footing':          colors.pieFooting,
  'Endurance active': colors.pieSortieLongue,
  'Seuil':            colors.pieSeuil,
  'VMA':              colors.pieVma,
  'Non déterminée':   colors.subtleText,
}

export function IntensityDistributionChart({ payload }: { payload: ChargeSportPayload }) {
  const [win, setWin] = useState<Win>('28')
  const data = payload.intensityDistribution[win]
  const total = data.reduce((s, x) => s + x.ces, 0)

  const intenseShare = data
    .filter(x => x.label === 'Seuil' || x.label === 'VMA')
    .reduce((s, x) => s + x.ces, 0)
  const intenseRatio = total > 0 ? intenseShare / total : 0
  const note =
    total === 0                ? null :
    intenseRatio > 0.4          ? "Beaucoup de charge en intensité haute." :
    intenseRatio < 0.1          ? "Majorité de charge en endurance fondamentale." :
                                   "Mix équilibré entre endurance et intensité."

  return (
    <BlockCard
      title={L.blocks.intensityDistribution}
      helpTitle={L.blocks.intensityDistribution}
      helpBody={L.help.intensityDistribution}
      rightSlot={
        <div className="flex gap-1 mr-1">
          {(['7', '28', '70'] as Win[]).map(w => (
            <button
              key={w}
              onClick={() => setWin(w)}
              className={`text-[10px] px-1.5 py-0.5 rounded-[6px] ${win === w ? 'bg-trail-surface text-trail-text' : 'text-trail-muted'}`}
            >
              {w === '7' ? '7j' : w === '28' ? '28j' : '10 sem.'}
            </button>
          ))}
        </div>
      }
    >
      {total === 0 ? (
        <p className="text-[12px] text-trail-muted text-center py-6">{L.notEnoughData}</p>
      ) : (
        <>
          <ul className="space-y-1.5 mt-1">
            {data.map(x => {
              const pct = Math.round((x.ces / total) * 100)
              return (
                <li key={x.label}>
                  <div className="flex items-center text-[12px] text-trail-text">
                    <span className="w-2.5 h-2.5 rounded-sm mr-2" style={{ backgroundColor: INTENSITY_COLORS[x.label] }} />
                    <span className="flex-1">{x.label}</span>
                    <span className="font-semibold">{pct}%</span>
                  </div>
                  <div className="mt-0.5 h-1.5 rounded-full bg-trail-surface overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: INTENSITY_COLORS[x.label] }} />
                  </div>
                </li>
              )
            })}
          </ul>
          {note && <p className="mt-3 text-[11px] text-trail-muted leading-[16px]">{note}</p>}
        </>
      )}
    </BlockCard>
  )
}
