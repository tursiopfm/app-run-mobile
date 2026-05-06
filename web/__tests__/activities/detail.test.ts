import {
  splitColor,
  estimateHrZones,
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

// ── estimateHrZones ───────────────────────────────────────────────────────────
describe('estimateHrZones', () => {
  it('returns 5 zones whose durations sum to movingTimeSec', () => {
    const zones = estimateHrZones(148, 185, 7362)
    const total = zones.reduce((s, z) => s + z.durationSec, 0)
    expect(total).toBe(7362)
    expect(zones).toHaveLength(5)
  })
  it('assigns most time to zone containing avg_hr', () => {
    // avg 148, max 185 → avg% = 0.80 → falls in Z4 (80-90%)
    const zones = estimateHrZones(148, 185, 7362)
    const z4 = zones.find(z => z.label === 'Z4 Seuil')!
    const maxZone = zones.reduce((a, b) => a.durationSec > b.durationSec ? a : b)
    expect(maxZone.label).toBe(z4.label)
  })
  it('labels and colors are correct', () => {
    const zones = estimateHrZones(120, 185, 3600)
    expect(zones[0].label).toBe('Z1 Récup')
    expect(zones[0].color).toBe('#42a5f5')
    expect(zones[4].label).toBe('Z5 VO2max')
    expect(zones[4].color).toBe('#e8651a')
  })
})
