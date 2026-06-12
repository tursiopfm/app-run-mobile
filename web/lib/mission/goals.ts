// Objectifs hebdo/année du Mode Mission — MÊME stockage que le GoalsBlock Expert
// (localStorage cockpit_goals_targets) : un objectif saisi en Mission est visible
// en Expert et inversement.

import type { SportKey } from '@/lib/design/sports'

export const GOALS_TARGETS_KEY = 'cockpit_goals_targets'

export type MissionGoals = { weekKm?: number; weekDPlus?: number; yearKm?: number }

type Store = Partial<Record<SportKey, MissionGoals>>

function readStore(): Store {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(GOALS_TARGETS_KEY)
    return raw ? (JSON.parse(raw) as Store) : {}
  } catch { return {} }
}

export function readMissionGoals(sport: SportKey): MissionGoals {
  return readStore()[sport] ?? {}
}

// Merge les champs passés dans `goals` avec les champs existants.
// Une valeur `undefined` EXPLICITE (clé présente dans l'objet) efface la clé stockée.
// Une clé absente de `goals` laisse la valeur existante intacte.
export function saveMissionGoals(sport: SportKey, goals: MissionGoals): void {
  const store = readStore()
  const current = store[sport] ?? {}
  const merged: MissionGoals = { ...current }

  for (const k of Object.keys(goals) as (keyof MissionGoals)[]) {
    if (k in goals) {
      const v = goals[k]
      if (v === undefined) {
        delete merged[k]
      } else {
        merged[k] = v as number
      }
    }
  }

  store[sport] = merged
  window.localStorage.setItem(GOALS_TARGETS_KEY, JSON.stringify(store))
}

const MS_DAY = 86_400_000

// Fraction de l'année écoulée (jour courant inclus), années bissextiles gérées.
export function yearElapsedFraction(todayISO: string): number {
  const d = new Date(`${todayISO}T00:00:00Z`)
  const start = Date.UTC(d.getUTCFullYear(), 0, 1)
  const end = Date.UTC(d.getUTCFullYear() + 1, 0, 1)
  const day = Math.floor((d.getTime() - start) / MS_DAY) + 1
  return day / Math.round((end - start) / MS_DAY)
}

// Projection fin d'année sur le rythme actuel, arrondie à 10 km.
// null si données trop maigres (< 14 jours écoulés ou ytd nul).
export function projectYearKm(ytdKm: number, todayISO: string): number | null {
  const frac = yearElapsedFraction(todayISO)
  if (ytdKm <= 0 || frac < 14 / 365) return null
  return Math.round(ytdKm / frac / 10) * 10
}
