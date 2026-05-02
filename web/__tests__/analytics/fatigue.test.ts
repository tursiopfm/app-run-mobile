import { computeEwma, buildDailyMetrics, type DailyLoad } from '@/lib/analytics/fatigue'

function makeLoads(days: number, cesPerDay: number): DailyLoad[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date('2026-01-01')
    d.setDate(d.getDate() + i)
    return { date: d.toISOString().split('T')[0], ces: cesPerDay }
  })
}

describe('computeEwma', () => {
  it('initializes to first day CES', () => {
    const result = computeEwma(makeLoads(5, 100), 7)
    expect(result[0].ewma).toBeCloseTo(100, 0)
  })

  it('converges toward steady-state CES', () => {
    const result = computeEwma(makeLoads(60, 80), 7)
    expect(result[result.length - 1].ewma).toBeGreaterThan(70)
    expect(result[result.length - 1].ewma).toBeLessThan(85)
  })
})

describe('buildDailyMetrics', () => {
  it('TSB equals CTL minus ATL', () => {
    const result = buildDailyMetrics(makeLoads(30, 50))
    const last = result[result.length - 1]
    expect(last.tsb).toBeCloseTo(last.ctl - last.atl, 1)
  })

  it('fills gaps between sparse dates with 0 CES', () => {
    const loads: DailyLoad[] = [
      { date: '2026-01-01', ces: 100 },
      { date: '2026-01-05', ces: 80 },
    ]
    const result = buildDailyMetrics(loads)
    expect(result.length).toBe(5)
    expect(result[1].dailyLoad).toBe(0)
  })

  it('ATL is more reactive than CTL', () => {
    const loads = [
      ...makeLoads(20, 50),
      ...Array.from({ length: 10 }, (_, i) => ({
        date: new Date(new Date('2026-01-21').getTime() + i * 86400000).toISOString().split('T')[0],
        ces: 200,
      })),
    ]
    const result = buildDailyMetrics(loads)
    const last = result[result.length - 1]
    expect(last.atl).toBeGreaterThan(last.ctl)
  })
})
