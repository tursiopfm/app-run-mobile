// Triathlon : le km n'a pas de sens en cumul multi-sport → volume hebdo en
// heures + répartition nat/vélo/cap pour le héros « Ma semaine ».

import type { SportOverview } from '@/lib/data/dashboard'
import type { SportKey } from '@/lib/design/sports'

export type TriWeek = { totalSec: number; runSec: number; rideSec: number; swimSec: number }

function weekSec(o: SportOverview | undefined): number {
  return (o?.dailyDurationSec ?? []).reduce((s, x) => s + x, 0)
}

export function computeTriWeek(overviews: Record<SportKey, SportOverview>): TriWeek {
  const runSec = weekSec(overviews.run)
  const rideSec = weekSec(overviews.ride)
  const swimSec = weekSec(overviews.swim)
  return { totalSec: runSec + rideSec + swimSec, runSec, rideSec, swimSec }
}

export function formatHoursMin(sec: number): string {
  const totalMin = Math.round(sec / 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}
