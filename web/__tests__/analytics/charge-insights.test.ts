import { getDailyLoadSeries } from '@/lib/analytics/charge-insights'
import type { CesActivity } from '@/lib/analytics/charge-insights.types'

function act(partial: Partial<CesActivity> & { startDate: string; ces: number; id?: string }): CesActivity {
  return {
    id:              partial.id ?? `id-${partial.startDate}`,
    rawSportType:    partial.rawSportType ?? 'Run',
    name:            partial.name ?? 'Test',
    startDate:       partial.startDate,
    ces:             partial.ces,
    movingTimeSec:   partial.movingTimeSec ?? 3600,
    distanceMeters:  partial.distanceMeters ?? 10000,
    elevationGainM:  partial.elevationGainM ?? 0,
    avgHr:           partial.avgHr ?? null,
    manualIntensity: partial.manualIntensity ?? null,
    workoutType:     partial.workoutType ?? null,
  }
}

describe('getDailyLoadSeries', () => {
  it('returns all-zero series for no activities', () => {
    const series = getDailyLoadSeries([], 30)
    expect(series).toHaveLength(30)
    expect(series.every(d => d.ces === 0)).toBe(true)
  })

  it('aggregates CES by day across activities', () => {
    const acts = [
      act({ startDate: '2026-05-01T08:00:00Z', ces: 50 }),
      act({ startDate: '2026-05-01T16:00:00Z', ces: 30, id: '2' }),
      act({ startDate: '2026-05-02T08:00:00Z', ces: 40, id: '3' }),
    ]
    const series = getDailyLoadSeries(acts, 5, new Date('2026-05-03T00:00:00Z'))
    const map = Object.fromEntries(series.map(d => [d.date, d.ces]))
    expect(map['2026-05-01']).toBe(80)
    expect(map['2026-05-02']).toBe(40)
    expect(map['2026-05-03']).toBe(0)
  })

  it('returns exactly `days` consecutive entries ending today', () => {
    const series = getDailyLoadSeries([], 7, new Date('2026-05-10T12:00:00Z'))
    expect(series).toHaveLength(7)
    expect(series[0].date).toBe('2026-05-04')
    expect(series[6].date).toBe('2026-05-10')
  })

  it('ignores activities outside the window', () => {
    const acts = [act({ startDate: '2026-04-01T08:00:00Z', ces: 999 })]
    const series = getDailyLoadSeries([], 7, new Date('2026-05-10T12:00:00Z'))
    expect(series.every(d => d.ces === 0)).toBe(true)
  })
})
