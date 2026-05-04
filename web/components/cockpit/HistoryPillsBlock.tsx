'use client'

// Mirror of BlockType.Days (DaysRun) from DashboardScreen.kt.
// 3 periods: Sem. (7 days), Mois (last 5 weeks), An (12 months).

import { useState } from 'react'
import { colors } from '@/lib/design/colors'

export type DayPill = {
  label:    string   // 'L'|'M'|'M'|'J'|'V'|'S'|'D'
  volumeKm: number
  dPlus:    number
}

export type WeekPill = {
  label: string   // 'DD/MM'
  km:    number
  dPlus: number
}

type Props = {
  daySessions:  DayPill[]   // 7 items Mon..Sun
  weeklyPoints: WeekPill[]  // last 10 weeks (we take last 5 for Mois)
  monthlyRunKm: number[]    // 12 items Jan..Dec
}

const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

type Period = 'week' | 'month' | 'year'

export function HistoryPillsBlock({ daySessions, weeklyPoints, monthlyRunKm }: Props) {
  const [period, setPeriod] = useState<Period>('week')

  type PillData = { label: string; km: number; dPlus: number }

  const pills: PillData[] = (() => {
    switch (period) {
      case 'week':
        return daySessions.map((s) => ({ label: s.label, km: s.volumeKm, dPlus: s.dPlus }))
      case 'month':
        return weeklyPoints.slice(-5).map((w) => ({ label: w.label, km: w.km, dPlus: w.dPlus }))
      case 'year':
        return monthlyRunKm.map((km, i) => ({ label: MONTH_LETTERS[i], km, dPlus: 0 }))
    }
  })()

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      <div className="flex items-center justify-between mb-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-semibold text-trail-muted">Historique</span>
          <span className="text-[15px] font-semibold" style={{ color: colors.chargeOrange }}>Course 🏃</span>
        </div>
        <div className="flex gap-1">
          {(['week', 'month', 'year'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors"
              style={{
                backgroundColor: period === p ? colors.chargeOrange : 'transparent',
                color:           period === p ? '#fff' : colors.subtleText,
                border:          `1px solid ${period === p ? colors.chargeOrange : colors.border}`,
              }}
            >
              {p === 'week' ? 'Sem.' : p === 'month' ? 'Mois' : 'An'}
            </button>
          ))}
        </div>
      </div>

      <div
        className="flex gap-[5px]"
        style={{ overflowX: period === 'year' ? 'auto' : 'visible' }}
      >
        {pills.map((pill, i) => (
          <HistoryPill key={i} label={pill.label} km={pill.km} dPlus={pill.dPlus} flex={period !== 'year'} />
        ))}
      </div>
    </div>
  )
}

function HistoryPill({
  label, km, dPlus, flex,
}: {
  label: string; km: number; dPlus: number; flex: boolean
}) {
  return (
    <div
      className="rounded-[8px] bg-trail-surface border border-trail-border px-1.5 py-2 flex flex-col items-center gap-[2px]"
      style={{ flex: flex ? '1' : 'none', minWidth: flex ? 0 : 44 }}
    >
      <span className="text-[11px] font-semibold text-trail-muted leading-none">{label}</span>
      {km > 0 ? (
        <>
          <span className="text-[13px] font-bold leading-tight" style={{ color: colors.chargeOrange }}>
            {km < 10 ? km.toFixed(1) : Math.round(km)}
          </span>
          <span className="text-[10px] text-trail-muted leading-none">km</span>
        </>
      ) : (
        <span className="text-[13px] font-bold leading-tight text-trail-muted">—</span>
      )}
      {dPlus > 0 && (
        <>
          <span className="text-[11px] font-semibold leading-tight" style={{ color: colors.seriesBlue }}>
            {Math.round(dPlus)}
          </span>
          <span className="text-[10px] text-trail-muted leading-none">m D+</span>
        </>
      )}
    </div>
  )
}
