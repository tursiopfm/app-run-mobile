import { computeTriWeek, formatHoursMin } from '@/lib/mission/tri-week'
import type { SportOverview } from '@/lib/data/dashboard'

function overview(dailyDurationSec: number[]): SportOverview {
  return {
    weekKm: 0, weekDPlus: 0, weekSessions: 0,
    dailyKm: [], dailyDPlus: [], dailyDurationSec, dailyLabels: [],
    ytdKm: 0, ytdDPlus: 0, ytdSessions: 0, monthlyKm: [], monthlyDPlus: [],
    atl: 0, ctl: 0, tsb: 0, weekCes: 0, last7Tsb: [],
    weeklyPoints: [], cumulMonths: [], cumulYears: [],
    workoutTypeBreakdown: [], dailyHistory: [],
  }
}

describe('computeTriWeek', () => {
  it('somme les durées hebdo par discipline', () => {
    const r = computeTriWeek({
      run:  overview([3600, 0, 0, 0, 0, 0, 0]),         // 1h
      ride: overview([0, 7200, 0, 0, 0, 0, 0]),         // 2h
      swim: overview([0, 0, 1800, 0, 0, 0, 0]),         // 30'
      all:  overview([3600, 7200, 1800, 0, 0, 0, 0]),
    } as never)
    expect(r).toEqual({ totalSec: 12600, runSec: 3600, rideSec: 7200, swimSec: 1800 })
  })
})

describe('formatHoursMin', () => {
  it('formate en h/min compactes', () => {
    expect(formatHoursMin(12600)).toBe('3h30')
    expect(formatHoursMin(3600)).toBe('1h')
    expect(formatHoursMin(2700)).toBe('45 min')
    expect(formatHoursMin(0)).toBe('0 min')
  })
})
