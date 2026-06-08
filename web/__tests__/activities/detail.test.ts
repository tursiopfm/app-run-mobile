import type { StravaLap } from '@/lib/activities/detail'
import {
  paceGradientColor,
  fmtPaceSec,
  fmtDurationSec,
  splitPaceSec,
  lapPaceSec,
  detectFastLaps,
  analyzeFractionne,
  fmtLapDist,
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
  it('formats seconds as Xh MM:SS', () => {
    expect(fmtDurationSec(7362)).toBe('2h02:42')
    expect(fmtDurationSec(5400)).toBe('1h30:00')
    expect(fmtDurationSec(600)).toBe('10:00')
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

// ── paceGradientColor ───────────────────────────────────────────────────────────
describe('paceGradientColor', () => {
  // Échelle : minPace (le plus rapide) → orange ; ≥ avg×1.12 (lent) → bleu.
  const minPace = 351
  const avg = 374
  it('returns orange (#ff7900) for the fastest split (pace = minPace)', () => {
    expect(paceGradientColor(minPace, minPace, avg)).toBe('#ff7900')
  })
  it('saturates to blue (#38bdf8) for a split ≥ 12% slower than average', () => {
    expect(paceGradientColor(Math.ceil(avg * 1.12) + 50, minPace, avg)).toBe('#38bdf8')
    // a huge outlier (a walked climb) also saturates blue
    expect(paceGradientColor(575, minPace, avg)).toBe('#38bdf8')
  })
  it('returns a warm tone (more red than blue) for a faster-than-average split', () => {
    const c = paceGradientColor(360, minPace, avg)            // ~6:00, plus rapide que la moyenne
    const r = parseInt(c.slice(1, 3), 16)
    const b = parseInt(c.slice(5, 7), 16)
    expect(r).toBeGreaterThan(b)
  })
  it('returns a valid 7-char hex for any in-range pace', () => {
    for (const p of [351, 360, 374, 390, 405, 420, 575]) {
      expect(paceGradientColor(p, minPace, avg)).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
  it('returns muted (#8892a4) when avg is missing', () => {
    expect(paceGradientColor(360, minPace, 0)).toBe('#8892a4')
  })
})

// ── New tests for StravaLap utilities ──────────────────────────────────────────

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

// ── analyzeFractionne ───────────────────────────────────────────────────────────
// Real session reported by Franck: "Frac 3×2000 + 1000 r=1'30".
// The 2 000 m reps are auto-lapped into 2×1 km; laps 18 (4:58) and 19 (4:23) are
// the cool-down and must NOT be flagged fast.
function lap(split: number, distance: number, moving: number): StravaLap {
  return makeLap({ split, distance, moving_time: moving, average_speed: distance / moving })
}
const realSession: StravaLap[] = [
  lap(1, 1000, 354), lap(2, 1000, 352), lap(3, 1000, 348),
  lap(4, 1000, 335), lap(5, 1000, 333), lap(6, 731, 245),  // warm-up
  lap(7, 1020, 229), lap(8, 1020, 228),                    // effort 1 (2 000 m)
  lap(9, 228, 93),                                          // recovery
  lap(10, 1000, 222), lap(11, 1000, 221),                  // effort 2 (2 000 m)
  lap(12, 207, 99),                                         // recovery
  lap(13, 1010, 215), lap(14, 999, 214),                   // effort 3 (2 000 m)
  lap(15, 233, 114),                                        // recovery
  lap(16, 1010, 201),                                       // effort 4 (1 000 m)
  lap(17, 1000, 361), lap(18, 1000, 298), lap(19, 122, 32),// cool-down
]

describe('analyzeFractionne', () => {
  it('does NOT flag the cool-down jog laps (18 at 4:58, 19 at 4:23)', () => {
    const fast = detectFastLaps(realSession)
    expect(fast.has(18)).toBe(false)
    expect(fast.has(19)).toBe(false)
    // the 7 genuine effort laps are flagged
    for (const k of [7, 8, 10, 11, 13, 14, 16]) expect(fast.has(k)).toBe(true)
  })

  it('reconstructs 4 efforts, grouping the 2×1 km reps', () => {
    const a = analyzeFractionne(realSession)
    expect(a.isInterval).toBe(true)
    expect(a.efforts).toHaveLength(4)
    expect(a.efforts[0].laps).toHaveLength(2)   // 2 000 m = 2 laps merged
    expect(a.efforts[3].laps).toHaveLength(1)   // 1 000 m = single lap
    expect(a.structureLabel).toBe('3 × 2 000 m + 1 000 m')
  })

  it('detects warm-up, 3 recoveries and cool-down phases', () => {
    const a = analyzeFractionne(realSession)
    expect(a.warmup?.laps).toHaveLength(6)
    expect(a.cooldown?.laps).toHaveLength(3)
    expect(a.items.filter(it => it.type === 'recovery')).toHaveLength(3)
  })

  it('computes a sensible average effort pace (~3:35/km)', () => {
    const a = analyzeFractionne(realSession)
    expect(a.avgEffortPaceSec).toBeGreaterThan(210)
    expect(a.avgEffortPaceSec).toBeLessThan(225)
  })

  it('returns isInterval=false for a steady run', () => {
    const steady = [
      makeLap({ split: 1, average_speed: 2.5 }),
      makeLap({ split: 2, average_speed: 2.52 }),
      makeLap({ split: 3, average_speed: 2.48 }),
    ]
    const a = analyzeFractionne(steady)
    expect(a.isInterval).toBe(false)
    expect(a.efforts).toHaveLength(0)
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

