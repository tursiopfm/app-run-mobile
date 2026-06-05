import { buildChargeMetrics } from '@/lib/analytics/charge-insights'
import type { CesActivity } from '@/lib/analytics/charge-insights.types'

function act(startDate: string, ces: number): CesActivity {
  return {
    id:              `id-${startDate}`,
    rawSportType:    'Run',
    name:            'Test',
    startDate:       `${startDate}T08:00:00Z`,
    ces,
    movingTimeSec:   3600,
    distanceMeters:  10000,
    elevationGainM:  0,
    avgHr:           null,
    manualIntensity: null,
    workoutType:     null,
  }
}

// One activity per day between two dates, with optional per-day overrides.
function dailyHistory(
  startISO: string,
  endISO: string,
  ces: number,
  overrides: Record<string, number> = {},
): CesActivity[] {
  const out: CesActivity[] = []
  let cur = new Date(`${startISO}T00:00:00Z`)
  const end = new Date(`${endISO}T00:00:00Z`)
  while (cur <= end) {
    const d = cur.toISOString().slice(0, 10)
    out.push(act(d, overrides[d] ?? ces))
    cur = new Date(cur.getTime() + 86_400_000)
  }
  return out
}

function tsbOn(metrics: { date: string; tsb: number }[], date: string): number {
  const m = metrics.find(x => x.date === date)
  if (!m) throw new Error(`no metric for ${date}`)
  return m.tsb
}

describe('buildChargeMetrics — past-day freshness is stable as now advances', () => {
  // Reproduces the reported bug: the Charge page recomputed ATL/CTL/TSB over a
  // sliding 90-day window seeded at the window's first day. When that first day
  // flipped from a rest day (5) to a big session (280), the slow CTL — and thus
  // the freshness of *every* recent day — jumped ~20+ points between two page
  // loads. buildChargeMetrics must seed the EWMA on enough history that a fixed
  // past day's freshness does not move when `now` advances one day.
  it('TSB of a fixed past day does not change when now moves forward one day', () => {
    const history = dailyHistory('2025-01-01', '2026-06-05', 100, {
      '2026-03-07': 5,    // becomes the 90-day-window seed for now = 2026-06-04
      '2026-03-08': 280,  // becomes the 90-day-window seed for now = 2026-06-05
    })

    const target = '2026-06-01'
    const yesterday = buildChargeMetrics(history, new Date('2026-06-04T12:00:00Z'))
    const today     = buildChargeMetrics(history, new Date('2026-06-05T12:00:00Z'))

    expect(tsbOn(today.dailyMetrics, target)).toBeCloseTo(tsbOn(yesterday.dailyMetrics, target), 1)
  })

  it('exposes at most the display window ending today', () => {
    const history = dailyHistory('2025-01-01', '2026-06-05', 100)
    const { dailyMetrics, dailyLoads } = buildChargeMetrics(history, new Date('2026-06-05T12:00:00Z'))

    expect(dailyMetrics.length).toBeLessThanOrEqual(90)
    expect(dailyLoads.length).toBe(dailyMetrics.length)
    expect(dailyMetrics[dailyMetrics.length - 1].date).toBe('2026-06-05')
  })
})
