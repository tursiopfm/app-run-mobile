'use client'

import { useState } from 'react'
import { colors } from '@/lib/design/colors'
import { SPORT_CONFIG, ALL_SPORT_KEYS, type SportKey } from '@/lib/design/sports'
import { sportShortLabel } from '@/lib/design/sports-i18n'
import { type SportOverview } from '@/lib/data/dashboard'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = {
  sportOverviews: Record<SportKey, SportOverview>
  allSessions: { day: string; label: string; volumeKm: number; dPlus: number; durationSec: number }[]
}

const DAY_ABBR = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function fmtDuration(totalSec: number): string {
  if (totalSec <= 0) return '—'
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`
}

export function WeekBlock({ sportOverviews, allSessions }: Props) {
  const t = useT()
  const L = t.cockpit
  const [activeSport, setActiveSport] = useState<SportKey>('run')

  const sessions = activeSport === 'all'
    ? allSessions
    : DAY_ABBR.map((day, i) => ({
        day,
        label:       sportOverviews[activeSport].dailyLabels?.[i] ?? '',
        volumeKm:    sportOverviews[activeSport].dailyKm[i]            ?? 0,
        dPlus:       Math.round(sportOverviews[activeSport].dailyDPlus[i] ?? 0),
        durationSec: Math.round(sportOverviews[activeSport].dailyDurationSec?.[i] ?? 0),
      }))

  const cfg      = SPORT_CONFIG[activeSport]
  const totalKm  = sessions.reduce((s, r) => s + r.volumeKm, 0)
  const totalDp  = sessions.reduce((s, r) => s + r.dPlus, 0)
  const totalSec = sessions.reduce((s, r) => s + (r.durationSec ?? 0), 0)
  const durLabel = fmtDuration(totalSec)

  function fmtKm(v: number) {
    if (v === 0) return null
    return v < 10 ? v.toFixed(1) : Math.round(v).toString()
  }

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-[10px]">
        <p className="text-[15px] font-semibold text-trail-text font-display">{L.blockLabel.week}</p>
        <div className="flex gap-1">
          {ALL_SPORT_KEYS.map((sport) => {
            const scfg = SPORT_CONFIG[sport]
            const isActive = activeSport === sport
            return (
              <button
                key={sport}
                onClick={() => setActiveSport(sport)}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors"
                style={{
                  backgroundColor: isActive ? scfg.color : 'transparent',
                  color:           isActive ? '#fff' : colors.subtleText,
                  border:          `1px solid ${isActive ? scfg.color : colors.border}`,
                }}
              >
                {sportShortLabel(sport, t)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Day cards */}
      <div className="flex gap-[4px]">
        {sessions.map((s, i) => {
          const km = fmtKm(s.volumeKm)
          const hasActivity = km !== null
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-[2px] py-[7px] px-[2px] rounded-[8px]"
              style={{
                backgroundColor: hasActivity ? `${cfg.color}18` : 'transparent',
                border:          `1px solid ${hasActivity ? cfg.color + '45' : 'transparent'}`,
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 700, color: colors.subtleText }}>{s.day}</span>
              {hasActivity ? (
                <>
                  <span style={{ fontSize: 13, fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{km}</span>
                  <span style={{ fontSize: 8, color: colors.subtleText, lineHeight: 1 }}>km</span>
                  {s.dPlus > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 600, color: '#4db6f0', lineHeight: 1 }}>
                      {s.dPlus}m
                    </span>
                  )}
                </>
              ) : (
                <span style={{ fontSize: 12, color: '#2a3040', fontWeight: 700 }}>—</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary row */}
      <div
        className="flex justify-around items-center mt-[8px] pt-[8px]"
        style={{ borderTop: `1px solid ${colors.border}` }}
      >
        <div className="flex flex-col items-center gap-[1px]">
          <span style={{ fontSize: 13, fontWeight: 800, color: cfg.color }}>
            {totalKm > 0 ? (totalKm < 10 ? totalKm.toFixed(1) : Math.round(totalKm)) : '—'}
            {totalKm > 0 && <span style={{ fontSize: 9, fontWeight: 400, color: colors.subtleText }}> km</span>}
          </span>
          <span style={{ fontSize: 9, color: colors.subtleText }}>{L.totalLabel}</span>
        </div>
        <div className="flex flex-col items-center gap-[1px]">
          <span style={{ fontSize: 13, fontWeight: 800, color: '#4db6f0' }}>
            {totalDp > 0 ? `${totalDp}` : '—'}
            {totalDp > 0 && <span style={{ fontSize: 9, fontWeight: 400, color: colors.subtleText }}> m</span>}
          </span>
          <span style={{ fontSize: 9, color: colors.subtleText }}>{L.dPlusShort}</span>
        </div>
        <div className="flex flex-col items-center gap-[1px]">
          <span style={{ fontSize: 13, fontWeight: 800, color: '#4caf50' }}>{durLabel}</span>
          <span style={{ fontSize: 9, color: colors.subtleText }}>{L.durationShort}</span>
        </div>
      </div>
    </div>
  )
}
