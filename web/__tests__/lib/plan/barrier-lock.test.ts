import { barrierElapsedSeries, isBarrierLocked, resolveElapsed, type LockWaypoint } from '@/lib/plan/barrier-lock'
import { estimatePassageTimes } from '@/lib/plan/pacing'

const wp = (over: Partial<LockWaypoint> & { km: number }): LockWaypoint => ({
  dPlus: null, targetOverrideSec: null, cutoffRaw: null, cutoffKind: null, ...over,
})

// Tableau synthétique : départ 19:00 ; barrières A 22:30 (3h30), C 04:30 (J+1, 9h30),
// arrivée D 07:00 (J+1, 12h). B sans barrière (interpolé).
const START = '19:00'
const TABLE: LockWaypoint[] = [
  wp({ km: 0,  dPlus: 0,   cutoffRaw: null }),                               // départ
  wp({ km: 10, dPlus: 100, cutoffRaw: '22:30', cutoffKind: 'clock_time' }),  // A → 12600
  wp({ km: 20, dPlus: 200, cutoffRaw: null }),                              // B → interpolé
  wp({ km: 30, dPlus: 300, cutoffRaw: '04:30', cutoffKind: 'clock_time' }),  // C → 34200
  wp({ km: 40, dPlus: 400, cutoffRaw: '07:00', cutoffKind: 'clock_time' }),  // D → 43200
]
const OBJ_MIN = 720 // 12h = barrière d'arrivée → mode barrières

describe('barrierElapsedSeries', () => {
  it('convertit les barrières horloge en écoulé monotone (passage de minuit)', () => {
    expect(barrierElapsedSeries(TABLE, START)).toEqual([null, 12600, null, 34200, 43200])
  })
  it('ignore les barrières horloge sans heure de départ', () => {
    expect(barrierElapsedSeries(TABLE, undefined)).toEqual([null, null, null, null, null])
  })
})

describe('isBarrierLocked', () => {
  it(`vrai quand objectif ≈ barrière d'arrivée (à la minute)`, () => {
    expect(isBarrierLocked(TABLE, START, 720)).toBe(true)
  })
  it('faux quand objectif < barrière finale', () => {
    expect(isBarrierLocked(TABLE, START, 660)).toBe(false)
  })
  it(`faux sans barrière à l'arrivée`, () => {
    const t = [...TABLE.slice(0, 4), wp({ km: 40, cutoffRaw: null })]
    expect(isBarrierLocked(t, START, 720)).toBe(false)
  })
  it('faux sans heure de départ (barrières horloge)', () => {
    expect(isBarrierLocked(TABLE, undefined, 720)).toBe(false)
  })
})

describe('resolveElapsed — mode barrières', () => {
  it('cale chaque Obj sur sa barrière, interpole les trous au prorata distance', () => {
    const { elapsed, locked } = resolveElapsed(TABLE, START, OBJ_MIN, -1.2)
    expect(locked).toBe(true)
    // A = 3h30 exact (et non une valeur effort-km/fade > barrière) ;
    // B = milieu distance de [km10→12600 ; km30→34200] = 23400 ; D = objectif.
    expect(elapsed).toEqual([0, 12600, 23400, 34200, 43200])
  })
  it('respecte un override manuel comme ancre prioritaire', () => {
    const t = TABLE.map((w, i) => (i === 2 ? { ...w, targetOverrideSec: 20000 } : w))
    const { elapsed } = resolveElapsed(t, START, OBJ_MIN, 0)
    expect(elapsed![2]).toBe(20000)
  })
})

describe('resolveElapsed — mode normal', () => {
  it('retombe sur estimatePassageTimes quand non verrouillé', () => {
    const { elapsed, locked } = resolveElapsed(TABLE, START, 660, 0.5)
    expect(locked).toBe(false)
    const expected = estimatePassageTimes(
      TABLE.map((w) => ({ km: w.km, dPlus: w.dPlus, targetOverrideSec: w.targetOverrideSec })),
      { totalDurationSec: 660 * 60, fade: 0.5 },
    )
    expect(elapsed).toEqual(expected)
  })
  it('elapsed null sans objectif', () => {
    expect(resolveElapsed(TABLE, START, null, 0)).toEqual({ elapsed: null, locked: false })
  })
})
