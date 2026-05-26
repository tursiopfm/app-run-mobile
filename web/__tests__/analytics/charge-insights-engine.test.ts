import { computeLoadInsights } from '@/lib/analytics/charge-insights'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'

function payload(p: Partial<ChargeSportPayload>): ChargeSportPayload {
  return {
    dailyMetrics:          [],
    dailyLoads:            [],
    weeklyLoadByCategory:  [],
    sportDistribution:     { '7': { run: 0, ride: 0, swim: 0, other: 0, total: 0 }, '28': { run: 0, ride: 0, swim: 0, other: 0, total: 0 }, '70': { run: 0, ride: 0, swim: 0, other: 0, total: 0 } },
    intensityDistribution: { '7': [], '28': [], '70': [] },
    top:                   [],
    monotony7d:            1.0,
    strain7d:              0,
    activeDays7d:          0,
    peakDay7d:             null,
    rampRate:              { deltaWeekPct: 0, label: 'stable', prevWeekZero: false },
    insights:              { status: 'balanced', headline: '', notes: [] },
    noCesActivities7d:     0,
    noCesActivities28d:    0,
    historyDays:           60,
    ...p,
  }
}

function metricsWithTsb(tsb: number, ctl = 50) {
  return [{ date: '2026-05-12', dailyLoad: 0, atl: ctl - tsb, ctl, tsb }]
}

describe('computeLoadInsights — status branches', () => {
  it('insufficient when historyDays < 14', () => {
    const r = computeLoadInsights(payload({ historyDays: 7 }))
    expect(r.status).toBe('insufficient')
  })

  it('overloaded when tsb <= -25', () => {
    const r = computeLoadInsights(payload({ dailyMetrics: metricsWithTsb(-30) }))
    expect(r.status).toBe('overloaded')
  })

  it('peak when ewma ratio > 1.5', () => {
    const r = computeLoadInsights(payload({
      dailyMetrics: metricsWithTsb(-5),
      dailyLoads: Array.from({ length: 28 }, (_, i) => ({ date: '', ces: i < 21 ? 30 : 200 })),
    }))
    expect(r.status).toBe('peak')
  })

  it('loaded when tsb <= -10 and ratio ok', () => {
    const r = computeLoadInsights(payload({ dailyMetrics: metricsWithTsb(-15), dailyLoads: Array(28).fill({ date: '', ces: 30 }) }))
    expect(r.status).toBe('loaded')
  })

  it('under-trained when tsb >= 15 and chronic < 30', () => {
    const r = computeLoadInsights(payload({ dailyMetrics: metricsWithTsb(20, 20) }))
    expect(r.status).toBe('under-trained')
  })

  it('very-fresh when tsb >= 15 and chronic ok', () => {
    const r = computeLoadInsights(payload({ dailyMetrics: metricsWithTsb(20, 60) }))
    expect(r.status).toBe('very-fresh')
  })

  it('light when ratio < 0.75', () => {
    const r = computeLoadInsights(payload({
      dailyMetrics: metricsWithTsb(2, 50),
      dailyLoads: Array.from({ length: 28 }, (_, i) => ({ date: '', ces: i < 21 ? 50 : 10 })),
    }))
    expect(r.status).toBe('light')
  })

  it('progressing when ratio in [1.25, 1.5]', () => {
    const r = computeLoadInsights(payload({
      dailyMetrics: metricsWithTsb(-2, 50),
      dailyLoads: Array.from({ length: 28 }, (_, i) => ({ date: '', ces: i < 21 ? 30 : 50 })),
    }))
    expect(r.status).toBe('progressing')
  })

  it('balanced by default', () => {
    const r = computeLoadInsights(payload({ dailyMetrics: metricsWithTsb(0, 50), dailyLoads: Array(28).fill({ date: '', ces: 30 }) }))
    expect(r.status).toBe('balanced')
  })
})

describe('computeLoadInsights — notes', () => {
  it('adds run-heavy note when run/total > 0.7', () => {
    const r = computeLoadInsights(payload({
      historyDays: 60,
      dailyMetrics: metricsWithTsb(0, 50),
      sportDistribution: {
        '7': { run: 80, ride: 10, swim: 5, other: 5, total: 100 },
        '28': { run: 200, ride: 50, swim: 30, other: 20, total: 300 },
        '70': { run: 200, ride: 50, swim: 30, other: 20, total: 300 },
      },
    }))
    expect(r.notes.some(n => n.code === 'run-heavy')).toBe(true)
  })

  it('adds no-ces note carrying the count when noCesActivities28d > 0', () => {
    const r = computeLoadInsights(payload({ noCesActivities28d: 3, historyDays: 60 }))
    expect(r.notes.some(n => n.code === 'no-ces' && n.n === 3)).toBe(true)
  })

  it('adds concentrated note when activeDays7d <= 2 and sum7d > 0', () => {
    const r = computeLoadInsights(payload({
      historyDays: 60,
      dailyLoads: Array.from({ length: 28 }, (_, i) => ({ date: '', ces: i >= 26 ? 200 : 0 })),
      activeDays7d: 2,
    }))
    expect(r.notes.some(n => n.code === 'concentrated')).toBe(true)
  })

  it('adds monotonous note when monotony >= 2.0', () => {
    const r = computeLoadInsights(payload({ historyDays: 60, monotony7d: 2.5 }))
    expect(r.notes.some(n => n.code === 'monotonous')).toBe(true)
  })
})
