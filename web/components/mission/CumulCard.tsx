'use client'

// Cumul km par mois/année (Mission). Reprend la présentation du bloc Expert
// (en-tête + sport coloré + onglets Mois/Année + chart + légende), mono-sport :
// pas de carousel, pas de sélecteur de sport (points), pas de réglages (⋮).

import { useState } from 'react'
import { MissionCard } from './cards'
import { CockpitCumulChart } from '@/components/charts/CockpitCumulChart'
import type { SportOverview } from '@/lib/data/dashboard'
import { SPORT_CONFIG, type SportKey } from '@/lib/design/sports'
import { sportLabel } from '@/lib/design/sports-i18n'
import { colors } from '@/lib/design/colors'
import { useT } from '@/lib/i18n/I18nProvider'

type Period = 'month' | 'year'

export function CumulCard({ overview, sport }: { overview: SportOverview; sport: SportKey }) {
  const t = useT()
  const L = t.cockpit
  const [period, setPeriod] = useState<Period>('month')
  const cfg = SPORT_CONFIG[sport]
  const months = period === 'month' ? overview.cumulMonths : overview.cumulYears.slice(-3)
  if (!months || months.length === 0) return null

  return (
    <MissionCard>
      {/* En-tête repris du bloc Expert, sans le ⋮ */}
      <div className="flex items-center justify-between mb-[6px]">
        <div className="flex items-center gap-1">
          <span className="text-[15px] font-semibold text-trail-muted font-display">{L.cumulHeader(period)}</span>
          <span className="text-[15px] font-semibold" style={{ color: cfg.color }}>{sportLabel(sport, t)}</span>
        </div>
        <div className="flex gap-1">
          {(['month', 'year'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="text-micro font-semibold px-2 py-0.5 rounded-full transition-colors"
              style={{
                backgroundColor: period === p ? cfg.color : 'transparent',
                color:           period === p ? '#fff' : colors.subtleText,
                border:          `1px solid ${period === p ? cfg.color : colors.border}`,
              }}
            >
              {L.periodLong[p]}
            </button>
          ))}
        </div>
      </div>

      <CockpitCumulChart months={months} mode={period} height={220} />

      {/* Légende */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {months.map((m) => (
          <span key={m.label} className="flex items-center gap-1 text-micro text-trail-muted">
            <span className="inline-block w-3 h-[3px] rounded-full" style={{ backgroundColor: m.color }} />
            {m.label}
          </span>
        ))}
      </div>
    </MissionCard>
  )
}
