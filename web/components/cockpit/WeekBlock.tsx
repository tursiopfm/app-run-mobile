'use client'

import { useState } from 'react'
import { WeekTable, type DaySession } from '@/components/ui/WeekTable'
import { colors } from '@/lib/design/colors'
import { SPORT_CONFIG, ALL_SPORT_KEYS, type SportKey } from '@/lib/design/sports'
import { type SportOverview } from '@/lib/data/dashboard'

type Props = {
  sportOverviews: Record<SportKey, SportOverview>
  allSessions: DaySession[]
}

const DAY_ABBR = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export function WeekBlock({ sportOverviews, allSessions }: Props) {
  const [activeSport, setActiveSport] = useState<SportKey>('all')

  const sessions: DaySession[] =
    activeSport === 'all'
      ? allSessions
      : DAY_ABBR.map((day, i) => ({
          day,
          label: sportOverviews[activeSport].dailyLabels?.[i] ?? '',
          volumeKm: sportOverviews[activeSport].dailyKm[i] ?? 0,
          dPlus: Math.round(sportOverviews[activeSport].dailyDPlus[i] ?? 0),
        }))

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      <div className="flex items-center justify-between mb-[6px]">
        <p className="text-[13px] font-semibold text-trail-text">Semaine en cours</p>
        <div className="flex gap-1">
          {ALL_SPORT_KEYS.map((sport) => {
            const cfg = SPORT_CONFIG[sport]
            const isActive = activeSport === sport
            return (
              <button
                key={sport}
                onClick={() => setActiveSport(sport)}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors"
                style={{
                  backgroundColor: isActive ? cfg.color : 'transparent',
                  color: isActive ? '#fff' : colors.subtleText,
                  border: `1px solid ${isActive ? cfg.color : colors.border}`,
                }}
              >
                {cfg.shortLabel}
              </button>
            )
          })}
        </div>
      </div>
      <WeekTable sessions={sessions} />
    </div>
  )
}
