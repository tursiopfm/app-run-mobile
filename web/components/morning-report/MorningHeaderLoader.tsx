'use client'

import { useEffect, useState } from 'react'
import { getMainRace, getAllMacrocycles, pickActiveMacrocycle } from '@/lib/plan/storage'
import { MorningHeader } from './MorningHeader'
import type { Race, TrainingPlan } from '@/types/plan'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + 'T00:00:00')
  const b = new Date(toISO   + 'T00:00:00')
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

function weekIndex(startDateISO: string, endDateISO: string, todayDateISO: string): { idx: number; total: number } {
  const total = Math.max(1, Math.ceil(daysBetween(startDateISO, endDateISO) / 7))
  const sinceStart = daysBetween(startDateISO, todayDateISO)
  const idx = Math.max(1, Math.min(total, Math.floor(sinceStart / 7) + 1))
  return { idx, total }
}

export function MorningHeaderLoader() {
  const [race, setRace] = useState<Race | null>(null)
  const [macro, setMacro] = useState<TrainingPlan | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getMainRace(), getAllMacrocycles()])
      .then(([r, macros]) => {
        if (cancelled) return
        const today = todayISO()
        setRace(r)
        setMacro(pickActiveMacrocycle(macros, today))
      })
      .catch(() => { /* silencieux : header reste sans race/macro */ })
    return () => { cancelled = true }
  }, [])

  const today = todayISO()
  const daysToRace = race ? daysBetween(today, race.date) : null
  const week = macro ? weekIndex(macro.startDate, macro.endDate, today) : null

  return (
    <MorningHeader
      date={new Date()}
      raceName={race?.name}
      daysToRace={daysToRace != null && daysToRace >= 0 ? daysToRace : null}
      weekIndex={week?.idx ?? null}
      totalWeeks={week?.total ?? null}
    />
  )
}
