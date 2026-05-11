import {
  splitColor,
  fmtPaceSec,
  fmtDurationSec,
  splitPaceSec,
} from '@/lib/activities/detail'

// ── fmtPaceSec ────────────────────────────────────────────────────────────────
describe('fmtPaceSec', () => {
  it('formats pace seconds as mm:ss', () => {
    expect(fmtPaceSec(648)).toBe('10:48')   // 10 min 48 sec
    expect(fmtPaceSec(570)).toBe('9:30')
    expect(fmtPaceSec(60)).toBe('1:00')
  })
  it('returns — for null or 0', () => {
    expect(fmtPaceSec(null)).toBe('—')
    expect(fmtPaceSec(0)).toBe('—')
  })
  it('handles fractional seconds without producing :60', () => {
    expect(fmtPaceSec(59.6)).toBe('1:00')   // rounds up, no :60
    expect(fmtPaceSec(119.6)).toBe('2:00')  // carries over correctly
    expect(fmtPaceSec(648.4)).toBe('10:48') // rounds down, matches existing test
  })
})

// ── fmtDurationSec ────────────────────────────────────────────────────────────
describe('fmtDurationSec', () => {
  it('formats seconds as Xh YYmin', () => {
    expect(fmtDurationSec(7362)).toBe('2h02')   // 2h 2min 42s → display 2h02
    expect(fmtDurationSec(5400)).toBe('1h30')
    expect(fmtDurationSec(600)).toBe('10min')
  })
  it('returns — for null or 0', () => {
    expect(fmtDurationSec(null)).toBe('—')
    expect(fmtDurationSec(0)).toBe('—')
  })
})

// ── splitPaceSec ──────────────────────────────────────────────────────────────
describe('splitPaceSec', () => {
  it('computes pace in sec/km from a strava split', () => {
    // moving_time=570sec, distance=1000m → 9:30/km
    expect(splitPaceSec({ moving_time: 570, distance: 1000 })).toBe(570)
    // moving_time=648sec, distance=1000m → 10:48/km
    expect(splitPaceSec({ moving_time: 648, distance: 1000 })).toBe(648)
  })
  it('handles partial last split', () => {
    // 500m in 300sec → 600 sec/km
    expect(splitPaceSec({ moving_time: 300, distance: 500 })).toBe(600)
  })
  it('returns null if distance is 0', () => {
    expect(splitPaceSec({ moving_time: 0, distance: 0 })).toBeNull()
  })
})

// ── splitColor ────────────────────────────────────────────────────────────────
describe('splitColor', () => {
  // avgPace = 648 sec/km (10:48/km)
  const avg = 648
  it('returns orange/red for splits ≤ -10% faster', () => {
    expect(splitColor(580, avg)).toBe('#e8651a')   // 580/648 = -10.5%
  })
  it('returns orange for splits -10% to 0%', () => {
    expect(splitColor(610, avg)).toBe('#ff7043')   // 610/648 = -5.9%
  })
  it('returns yellow for splits 0% to +10%', () => {
    expect(splitColor(680, avg)).toBe('#ffb300')   // 680/648 = +4.9%
  })
  it('returns light green for splits +10% to +20%', () => {
    expect(splitColor(745, avg)).toBe('#8bc34a')   // 745/648 = +15%
  })
  it('returns green for splits > +20%', () => {
    expect(splitColor(800, avg)).toBe('#4caf50')   // 800/648 = +23.5%
  })
  it('returns muted for null avg', () => {
    expect(splitColor(600, 0)).toBe('#8892a4')
  })
})

// ── New tests for StravaLap utilities ──────────────────────────────────────────

import type { StravaLap } from '@/lib/activities/detail'
import { lapPaceSec, detectFastLaps, fmtLapDist } from '@/lib/activities/detail'

// Fixture helper
function makeLap(overrides: Partial<StravaLap> & { split: number }): StravaLap {
  const { split, ...rest } = overrides
  return {
    id: split * 100,
    name: `Lap ${split}`,
    elapsed_time: 600,
    moving_time: 600,
    distance: 1000,
    average_speed: 1000 / 600, // ~1.667 m/s
    total_elevation_gain: 0,
    lap_index: split - 1,
    split,
    ...rest,
  }
}

// Workout: warm-up / fast / recovery / fast / cool-down
const workoutLaps: StravaLap[] = [
  makeLap({ split: 1, distance: 3360, moving_time: 1187, average_speed: 3360 / 1187 }), // ~353 s/km
  makeLap({ split: 2, distance: 3080, moving_time: 922,  average_speed: 3080 / 922 }),  // ~299 s/km (fast)
  makeLap({ split: 3, distance: 220,  moving_time: 182,  average_speed: 220 / 182 }),   // ~827 s/km (short)
  makeLap({ split: 4, distance: 3080, moving_time: 930,  average_speed: 3080 / 930 }),  // ~302 s/km (fast)
  makeLap({ split: 5, distance: 1920, moving_time: 736,  average_speed: 1920 / 736 }),  // ~383 s/km
]

// ── lapPaceSec ────────────────────────────────────────────────────────────────
describe('lapPaceSec', () => {
  it('returns seconds per km from average_speed', () => {
    // average_speed=3.34 m/s → 1000/3.34 ≈ 299 s/km
    const lap = makeLap({ split: 1, average_speed: 3.34 })
    expect(lapPaceSec(lap)).toBe(299)
  })

  it('returns null when average_speed is 0', () => {
    const lap = makeLap({ split: 1, average_speed: 0 })
    expect(lapPaceSec(lap)).toBeNull()
  })

  it('rounds to nearest integer', () => {
    // 1000 / 2.5 = 400.0
    expect(lapPaceSec(makeLap({ split: 1, average_speed: 2.5 }))).toBe(400)
    // 1000 / 3.0 ≈ 333.33 → 333
    expect(lapPaceSec(makeLap({ split: 1, average_speed: 3.0 }))).toBe(333)
  })
})

// ── detectFastLaps ────────────────────────────────────────────────────────────
describe('detectFastLaps', () => {
  it('detects fast laps (laps 2 and 4 in workout example)', () => {
    const fast = detectFastLaps(workoutLaps)
    expect(fast.has(2)).toBe(true)
    expect(fast.has(4)).toBe(true)
    expect(fast.has(1)).toBe(false)
    expect(fast.has(3)).toBe(false)
    expect(fast.has(5)).toBe(false)
  })

  it('returns empty set when all laps have the same pace', () => {
    const uniform = [
      makeLap({ split: 1, average_speed: 2.5 }),
      makeLap({ split: 2, average_speed: 2.5 }),
      makeLap({ split: 3, average_speed: 2.5 }),
    ]
    expect(detectFastLaps(uniform).size).toBe(0)
  })

  it('returns empty set for 0 or 1 laps', () => {
    expect(detectFastLaps([]).size).toBe(0)
    expect(detectFastLaps([makeLap({ split: 1 })]).size).toBe(0)
  })

  it('ignores laps with average_speed=0 in median calculation', () => {
    const laps = [
      makeLap({ split: 1, average_speed: 0 }),  // invalid
      makeLap({ split: 2, average_speed: 3.5 }), // ~286 s/km (fast)
      makeLap({ split: 3, average_speed: 2.0 }), // 500 s/km (slow)
      makeLap({ split: 4, average_speed: 2.0 }), // 500 s/km (slow)
    ]
    const fast = detectFastLaps(laps)
    expect(fast.has(2)).toBe(true)
    expect(fast.has(1)).toBe(false)
  })
})

// ── fmtLapDist ────────────────────────────────────────────────────────────────
describe('fmtLapDist', () => {
  it('formats >= 1000m as km with 2 decimals', () => {
    expect(fmtLapDist(3360)).toBe('3.36 km')
    expect(fmtLapDist(1000)).toBe('1.00 km')
    expect(fmtLapDist(3080)).toBe('3.08 km')
  })

  it('formats < 1000m as rounded meters', () => {
    expect(fmtLapDist(220)).toBe('220 m')
    expect(fmtLapDist(430)).toBe('430 m')
    expect(fmtLapDist(999)).toBe('999 m')
  })
})

