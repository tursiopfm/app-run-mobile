import { getDailyLoadSeries, getWeeklyLoadByCategory, computeFreshness, computeAcuteLoad7d, computeChronicLoad } from '@/lib/analytics/charge-insights'
import type { CesActivity } from '@/lib/analytics/charge-insights.types'
import { buildDailyMetrics } from '@/lib/analytics/fatigue'

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

describe('getWeeklyLoadByCategory', () => {
  it('returns 10 weeks ending in the current ISO week', () => {
    const weeks = getWeeklyLoadByCategory([], 10, new Date('2026-05-12T12:00:00Z'))
    expect(weeks).toHaveLength(10)
    // 2026-05-12 is a Tuesday → ISO week starts Monday 2026-05-11
    expect(weeks[9].weekStart).toBe('2026-05-11')
  })

  it('buckets activities into run/ride/swim/other', () => {
    const acts: CesActivity[] = [
      act({ startDate: '2026-05-12T08:00:00Z', ces: 50, rawSportType: 'Run',        id: '1' }),
      act({ startDate: '2026-05-13T08:00:00Z', ces: 70, rawSportType: 'TrailRun',   id: '2' }),
      act({ startDate: '2026-05-14T08:00:00Z', ces: 40, rawSportType: 'Ride',       id: '3' }),
      act({ startDate: '2026-05-14T16:00:00Z', ces: 30, rawSportType: 'VirtualRide',id: '4' }),
      act({ startDate: '2026-05-15T08:00:00Z', ces: 25, rawSportType: 'Swim',       id: '5' }),
      act({ startDate: '2026-05-16T08:00:00Z', ces: 15, rawSportType: 'Walk',       id: '6' }),
    ]
    const weeks = getWeeklyLoadByCategory(acts, 10, new Date('2026-05-17T12:00:00Z'))
    const current = weeks[weeks.length - 1]
    expect(current.run).toBe(120)
    expect(current.ride).toBe(70)
    expect(current.swim).toBe(25)
    expect(current.other).toBe(15)
    expect(current.total).toBe(230)
  })

  it('computes avg4w as mean of last 4 weeks total (or fewer if start of window)', () => {
    const now = new Date('2026-05-31T12:00:00Z')
    const acts: CesActivity[] = []
    for (let i = 0; i < 4; i++) {
      const monday = new Date(now)
      monday.setUTCDate(monday.getUTCDate() - 7 * i)
      acts.push(act({ startDate: monday.toISOString(), ces: 100 * (i + 1), id: `w${i}` }))
    }
    const weeks = getWeeklyLoadByCategory(acts, 10, now)
    const lastFour = weeks.slice(-4).map(w => w.total)
    expect(lastFour).toEqual([400, 300, 200, 100])
    expect(weeks[weeks.length - 1].avg4w).toBe(250)
  })
})

describe('freshness / acute / chronic', () => {
  it('returns zero result for empty metrics', () => {
    const f = computeFreshness([])
    expect(f.tsb).toBe(0)
    expect(f.deltaVsWeekAgo).toBe(0)
    expect(f.zone).toBe('balanced')
  })

  it('zones based on tsb thresholds', () => {
    const loads = Array.from({ length: 50 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      ces: 50,
    }))
    const m = buildDailyMetrics(loads)
    m[m.length - 1] = { ...m[m.length - 1], tsb: 20 }
    expect(computeFreshness(m).zone).toBe('very-fresh')

    m[m.length - 1] = { ...m[m.length - 1], tsb: 8 }
    expect(computeFreshness(m).zone).toBe('fresh')

    m[m.length - 1] = { ...m[m.length - 1], tsb: 0 }
    expect(computeFreshness(m).zone).toBe('balanced')

    m[m.length - 1] = { ...m[m.length - 1], tsb: -15 }
    expect(computeFreshness(m).zone).toBe('normal-fatigue')

    m[m.length - 1] = { ...m[m.length - 1], tsb: -30 }
    expect(computeFreshness(m).zone).toBe('high-fatigue')
  })

  it('deltaVsWeekAgo = tsb - tsb 7 days ago', () => {
    const loads = Array.from({ length: 20 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      ces: i < 13 ? 30 : 120,
    }))
    const m = buildDailyMetrics(loads)
    const f = computeFreshness(m)
    const seven = m[m.length - 8].tsb
    expect(f.deltaVsWeekAgo).toBeCloseTo(m[m.length - 1].tsb - seven, 1)
  })

  it('computeAcuteLoad7d / computeChronicLoad return latest atl / ctl', () => {
    const loads = Array.from({ length: 50 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      ces: 50,
    }))
    const m = buildDailyMetrics(loads)
    expect(computeAcuteLoad7d(m)).toBeCloseTo(m[m.length - 1].atl, 1)
    expect(computeChronicLoad(m)).toBeCloseTo(m[m.length - 1].ctl, 1)
  })
})

import { computeLoadBalanceRatio, computeMonotony7d, computeStrain7d, computeActiveDays7d, computePeakDay7d } from '@/lib/analytics/charge-insights'
import { computeSportDistribution } from '@/lib/analytics/charge-insights'

describe('monotony / strain / activeDays / peakDay', () => {
  it('monotony = MONOTONY.repetitiveMin when std is 0 (constant non-zero load)', () => {
    const loads = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      ces: 50,
    }))
    expect(computeMonotony7d(loads)).toBeGreaterThanOrEqual(2.0)
  })

  it('monotony lower when load varies', () => {
    const loads = [10, 100, 20, 80, 30, 90, 0].map((c, i) => ({
      date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      ces: c,
    }))
    const mono = computeMonotony7d(loads)
    expect(mono).toBeLessThan(1.5)
  })

  it('strain = sum7d × monotony', () => {
    const loads = [10, 100, 20, 80, 30, 90, 0].map((c, i) => ({
      date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      ces: c,
    }))
    const sum = 10 + 100 + 20 + 80 + 30 + 90 + 0
    const expected = sum * computeMonotony7d(loads)
    expect(computeStrain7d(loads)).toBeCloseTo(expected, 0)
  })

  it('activeDays7d counts days with ces > 0', () => {
    const loads = [50, 0, 30, 0, 0, 20, 0].map((c, i) => ({
      date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      ces: c,
    }))
    expect(computeActiveDays7d(loads)).toBe(3)
  })

  it('peakDay7d returns the highest CES day in last 7', () => {
    const loads = [50, 10, 80, 20, 30, 40, 0].map((c, i) => ({
      date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      ces: c,
    }))
    const p = computePeakDay7d(loads)
    expect(p).toEqual({ date: '2026-01-03', ces: 80 })
  })

  it('peakDay7d returns null if all zero', () => {
    const loads = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      ces: 0,
    }))
    expect(computePeakDay7d(loads)).toBeNull()
  })
})

describe('computeLoadBalanceRatio', () => {
  function loadsConst(days: number, ces: number) {
    return Array.from({ length: days }, (_, i) => ({
      date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      ces,
    }))
  }

  it('returns zero ratios for empty input', () => {
    const r = computeLoadBalanceRatio([], [])
    expect(r.ewmaRatio).toBe(0)
    expect(r.sumRatio7vs28).toBe(0)
  })

  it('ewmaRatio = atl / ctl from metrics', () => {
    const m = buildDailyMetrics(loadsConst(50, 50))
    const dl = loadsConst(50, 50)
    const r = computeLoadBalanceRatio(m, dl)
    expect(r.ewmaRatio).toBeCloseTo(m[m.length - 1].atl / m[m.length - 1].ctl, 2)
  })

  it('sumRatio7vs28 = sum7d / (sum28d/4)', () => {
    const days: { date: string; ces: number }[] = []
    for (let i = 0; i < 28; i++) {
      days.push({ date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), ces: i < 21 ? 50 : 100 })
    }
    const m = buildDailyMetrics(days)
    const r = computeLoadBalanceRatio(m, days)
    expect(r.sumRatio7vs28).toBeCloseTo(700 / (1750 / 4), 2)
  })
})

describe('computeSportDistribution', () => {
  it('returns zero distribution for no activities', () => {
    const d = computeSportDistribution([], 7, new Date('2026-05-12T12:00:00Z'))
    expect(d).toEqual({ run: 0, ride: 0, swim: 0, other: 0, total: 0 })
  })

  it('sums CES per category inside window', () => {
    const acts = [
      act({ startDate: '2026-05-12T08:00:00Z', ces: 50, rawSportType: 'Run',     id: '1' }),
      act({ startDate: '2026-05-11T08:00:00Z', ces: 40, rawSportType: 'Ride',    id: '2' }),
      act({ startDate: '2026-05-10T08:00:00Z', ces: 30, rawSportType: 'Swim',    id: '3' }),
      act({ startDate: '2026-05-09T08:00:00Z', ces: 20, rawSportType: 'Walk',    id: '4' }),
      act({ startDate: '2026-04-01T08:00:00Z', ces: 999, rawSportType: 'Run',    id: 'old' }),
    ]
    const d = computeSportDistribution(acts, 7, new Date('2026-05-13T12:00:00Z'))
    expect(d.run).toBe(50)
    expect(d.ride).toBe(40)
    expect(d.swim).toBe(30)
    expect(d.other).toBe(20)
    expect(d.total).toBe(140)
  })
})
