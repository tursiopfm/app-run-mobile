import type { DailyMetrics } from './fatigue'

export type UltraReadyScore = {
  score: number
  label: 'not_ready' | 'building' | 'approaching' | 'ready' | 'peak'
  freshness: number
  fitnessLevel: number
  loadRatio: number
}

export function computeUltraReady(metrics: DailyMetrics[], targetDate?: string): UltraReadyScore {
  if (metrics.length === 0) {
    return { score: 0, label: 'not_ready', freshness: 0, fitnessLevel: 0, loadRatio: 1 }
  }
  const latest = targetDate
    ? (metrics.find((m) => m.date === targetDate) ?? metrics[metrics.length - 1])
    : metrics[metrics.length - 1]

  const freshness    = latest.tsb
  const fitnessLevel = latest.ctl
  const loadRatio    = latest.ctl > 0 ? latest.atl / latest.ctl : 1

  // Score 0–100: freshness weight 40%, fitness 40%, load balance 20%
  const freshnessScore = Math.min(Math.max(freshness / 20, 0), 1) * 40
  const fitnessScore   = Math.min(fitnessLevel / 150, 1) * 40
  const loadScore      = Math.max(0, (1.2 - loadRatio) / 0.7) * 20
  const score          = Math.round(freshnessScore + fitnessScore + loadScore)

  const label: UltraReadyScore['label'] =
    score < 20 ? 'not_ready'
    : score < 40 ? 'building'
    : score < 60 ? 'approaching'
    : score < 80 ? 'ready'
    : 'peak'

  return { score, label, freshness, fitnessLevel, loadRatio: Math.round(loadRatio * 100) / 100 }
}
