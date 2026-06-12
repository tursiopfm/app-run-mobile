'use client'

import { useState } from 'react'
import { readMissionGoals, saveMissionGoals, type MissionGoals } from '@/lib/mission/goals'
import type { SportKey } from '@/lib/design/sports'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = { sport: SportKey; defaults: { weekKm?: number; weekDPlus?: number }; onClose: () => void; onSaved: () => void }

export function GoalsModal({ sport, defaults, onClose, onSaved }: Props) {
  const M = useT().mission
  const current = readMissionGoals(sport)
  const [weekKm, setWeekKm] = useState(String(current.weekKm ?? defaults.weekKm ?? ''))
  const [weekDPlus, setWeekDPlus] = useState(String(current.weekDPlus ?? defaults.weekDPlus ?? ''))
  const [yearKm, setYearKm] = useState(String(current.yearKm ?? ''))

  function save() {
    const goals: MissionGoals = {}
    if (weekKm.trim() !== '' && Number(weekKm) > 0) goals.weekKm = Number(weekKm)
    if (weekDPlus.trim() !== '' && Number(weekDPlus) > 0) goals.weekDPlus = Number(weekDPlus)
    goals.yearKm = yearKm.trim() !== '' && Number(yearKm) > 0 ? Number(yearKm) : undefined
    saveMissionGoals(sport, goals)
    onSaved(); onClose()
  }

  const row = 'flex items-center justify-between gap-3 rounded-[10px] border border-trail-border bg-trail-bg px-3 py-2.5 text-[13px]'
  const input = 'w-24 bg-transparent text-right font-display font-bold tabular-nums text-trail-text outline-none'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-[16px] bg-trail-card border border-trail-border p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[15px] font-semibold text-trail-muted font-display">{M.goalsModalTitle}</p>
          <button onClick={onClose} className="text-trail-muted text-[16px]" aria-label="Fermer">✕</button>
        </div>
        <div className="space-y-2">
          <label className={row}>
            <span className="text-trail-muted">{M.goalsWeekKm}</span>
            <span>
              <input className={input} inputMode="numeric" value={weekKm} onChange={e => setWeekKm(e.target.value)} />
              {' '}<span className="text-trail-muted">km</span>
            </span>
          </label>
          <label className={row}>
            <span className="text-trail-muted">{M.goalsWeekDPlus}</span>
            <span>
              <input className={input} inputMode="numeric" value={weekDPlus} onChange={e => setWeekDPlus(e.target.value)} />
              {' '}<span className="text-trail-muted">m</span>
            </span>
          </label>
          <label className={row}>
            <span className="text-trail-muted">{M.goalsYearKm}</span>
            <span>
              <input className={input} inputMode="numeric" value={yearKm} onChange={e => setYearKm(e.target.value)} placeholder="—" />
              {' '}<span className="text-trail-muted">km</span>
            </span>
          </label>
        </div>
        <p className="text-[10px] mt-2.5 leading-relaxed text-trail-muted">{M.goalsYearEmptyHint}</p>
        <div className="flex justify-end gap-3 mt-3.5 text-[12px] font-bold">
          <button onClick={onClose} className="text-trail-muted px-2 py-1.5">{M.goalsCancel}</button>
          <button onClick={save} className="rounded-full px-4 py-1.5" style={{ background: 'var(--primary)', color: 'var(--ink-900)' }}>{M.goalsSave}</button>
        </div>
      </div>
    </div>
  )
}
