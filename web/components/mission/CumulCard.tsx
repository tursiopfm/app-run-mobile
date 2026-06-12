'use client'

// Cumul km par mois (3 derniers + courant) avec bascule Année ⇄ Mois.
// Réutilise le chart Expert (valeurs de fin de courbe + infobulle incluses).

import { useState } from 'react'
import { MissionCard, MissionCardLabel } from './cards'
import { CockpitCumulChart } from '@/components/charts/CockpitCumulChart'
import type { SportOverview } from '@/lib/data/dashboard'
import { useT } from '@/lib/i18n/I18nProvider'

export function CumulCard({ overview }: { overview: SportOverview }) {
  const M = useT().mission
  const [period, setPeriod] = useState<'month' | 'year'>('month')
  const months = period === 'month' ? overview.cumulMonths : overview.cumulYears
  if (!months || months.length === 0) return null
  return (
    <MissionCard>
      <div className="flex items-center justify-between mb-2">
        <MissionCardLabel>{period === 'month' ? M.cumulTitleMonth : M.cumulTitleYear}</MissionCardLabel>
        <button
          type="button"
          onClick={() => setPeriod(p => (p === 'month' ? 'year' : 'month'))}
          className="text-[11px] font-bold rounded-full px-2.5 py-[3px] border"
          style={{ borderColor: 'var(--primary)', color: 'var(--primary-text)' }}
        >
          {period === 'month' ? M.cumulToYear : M.cumulToMonth}
        </button>
      </div>
      <CockpitCumulChart months={months} mode={period} height={200} />
    </MissionCard>
  )
}
