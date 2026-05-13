// web/lib/analytics/charge-kpi-status.ts
// Mots-statut colorés affichés sous les 3 KPIs du bloc "État du jour".
// Fonctions pures — pas de dépendance UI. Le mapping id → label est dans labels.ts.

import { FRESHNESS } from './charge-thresholds'
import { dark as palette } from '@/lib/design/colors'

export type FatigueStatusId   = 'high' | 'usual' | 'low'
export type FitnessStatusId   = 'building' | 'progressing' | 'solid' | 'very-solid'
export type FreshnessStatusId = 'very-fresh' | 'fresh' | 'balanced' | 'normal-fatigue' | 'high-fatigue'

export type KpiStatus<T> = { id: T; color: string }

const FATIGUE_HIGH_RATIO = 1.15
const FATIGUE_LOW_RATIO  = 0.85

export function kpiStatusFatigue(atl: number, ctl: number): KpiStatus<FatigueStatusId> {
  if (ctl <= 0) return { id: 'usual', color: palette.subtleText }
  if (atl > ctl * FATIGUE_HIGH_RATIO) return { id: 'high',  color: palette.seriesOrange }
  if (atl < ctl * FATIGUE_LOW_RATIO)  return { id: 'low',   color: palette.seriesBlue }
  return { id: 'usual', color: palette.subtleText }
}

export function kpiStatusFitness(ctl: number): KpiStatus<FitnessStatusId> {
  if (ctl < 20) return { id: 'building',    color: palette.subtleText }
  if (ctl < 40) return { id: 'progressing', color: palette.seriesBlue }
  if (ctl < 60) return { id: 'solid',       color: palette.seriesGreen }
  return         { id: 'very-solid',        color: palette.seriesGreen }
}

export function kpiStatusFreshness(tsb: number): KpiStatus<FreshnessStatusId> {
  if (tsb >= FRESHNESS.veryFresh)     return { id: 'very-fresh',     color: palette.seriesBlue }
  if (tsb >= FRESHNESS.fresh)         return { id: 'fresh',          color: palette.seriesBlue }
  if (tsb >  FRESHNESS.normalFatigue) return { id: 'balanced',       color: palette.seriesGreen }
  if (tsb >  FRESHNESS.highFatigue)   return { id: 'normal-fatigue', color: palette.seriesYellow }
  return                                     { id: 'high-fatigue',   color: palette.seriesRed }
}
