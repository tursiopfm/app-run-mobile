import {
  deriveSegment, formatElapsedToClock, parseClockToElapsed,
  formatElapsedShort, parseElapsedShort, marginToBarrier, formatMargin, formatBarrierClock,
} from '@/lib/plan/waypoint-view'

describe('deriveSegment', () => {
  const wps = [
    { km: 0, dPlus: 0, dMoins: 0 },
    { km: 10, dPlus: 300, dMoins: 100 },
    { km: 25, dPlus: 800, dMoins: 250 },
  ]
  it('point 0 : pas de tronçon', () => {
    expect(deriveSegment(wps, 0)).toEqual({ interKm: null, dPlusSeg: null, dMoinsSeg: null })
  })
  it('tronçon = différence du cumulé', () => {
    expect(deriveSegment(wps, 2)).toEqual({ interKm: 15, dPlusSeg: 500, dMoinsSeg: 150 })
  })
  it('cumulé null → tronçon null', () => {
    const w = [{ km: 0, dPlus: null, dMoins: null }, { km: 5, dPlus: null, dMoins: null }]
    expect(deriveSegment(w, 1)).toEqual({ interKm: 5, dPlusSeg: null, dMoinsSeg: null })
  })
})

describe('formatElapsedToClock', () => {
  it('même jour', () => {
    expect(formatElapsedToClock('20:00', 7500)).toEqual({ label: '22:05', dayIndex: 1 })
  })
  it('jour suivant → préfixe Jx', () => {
    expect(formatElapsedToClock('20:00', 15600)).toEqual({ label: 'J2 00:20', dayIndex: 2 })
  })
  it('départ invalide → null', () => {
    expect(formatElapsedToClock('', 1000)).toBeNull()
  })
  it("tolère 'HH:MM:SS' (Postgres time)", () => {
    expect(formatElapsedToClock('19:00:00', 7500)).toEqual({ label: '21:05', dayIndex: 1 })
  })
})

describe('parseClockToElapsed', () => {
  it('même jour : différence directe', () => {
    expect(parseClockToElapsed('20:00', '22:05', 0)).toBe(7500)
  })
  it('passage de minuit : choisit le 1er jour >= écoulé mini', () => {
    expect(parseClockToElapsed('20:00', '00:20', 14000)).toBe(15600)
  })
  it('saisie invalide → null', () => {
    expect(parseClockToElapsed('20:00', 'xx', 0)).toBeNull()
  })
})

describe('formatElapsedShort / parseElapsedShort', () => {
  it('formate en XhYY', () => {
    expect(formatElapsedShort(7500)).toBe('2h05')
    expect(formatElapsedShort(133200)).toBe('37h00')
  })
  it('parse XhYY / X:YY / Xh', () => {
    expect(parseElapsedShort('2h05')).toBe(7500)
    expect(parseElapsedShort('2:05')).toBe(7500)
    expect(parseElapsedShort('37h')).toBe(133200)
    expect(parseElapsedShort('xx')).toBeNull()
  })
})

describe('marginToBarrier / formatMargin', () => {
  it('barrière horloge → battement avant barrière', () => {
    // départ 20:00, objectif écoulé 2h05 (passage 22:05), barrière 22:30 → +25min
    expect(marginToBarrier('20:00', 7500, '26-22:30', 'clock_time')).toEqual({ sec: 1500, level: 'warn' })
  })
  it('barrière elapsed', () => {
    // barrière = 3h écoulées, objectif 2h05 → +55min
    expect(marginToBarrier('20:00', 7500, '03:00', 'elapsed')).toEqual({ sec: 3300, level: 'ok' })
  })
  it('pas de barrière → null', () => {
    expect(marginToBarrier('20:00', 7500, null, null)).toBeNull()
  })
  it('barrière un peu AVANT l objectif → marge négative (jour le plus proche, pas +24h)', () => {
    // départ 19:00, objectif 6h46 (24360s), barrière 27-01:00 = 6h écoulées → -46min
    expect(marginToBarrier('19:00', 24360, '27-01:00', 'clock_time')).toEqual({ sec: -2760, level: 'bad' })
  })
  it('formate la marge signée', () => {
    expect(formatMargin(1500)).toBe('+25min')
    expect(formatMargin(5400)).toBe('+1h30')
    expect(formatMargin(-600)).toBe('-10min')
  })
})

describe('formatBarrierClock', () => {
  it('nettoie une barrière brute en heure d horloge (même jour)', () => {
    expect(formatBarrierClock('20:00', '26-22:30', 'clock_time', 7500)).toBe('22:30')
  })
  it('jour suivant via préfixe Jx', () => {
    expect(formatBarrierClock('20:00', '27-01:00', 'clock_time', 14000)).toBe('J2 01:00')
  })
  it('sans heure de départ → chaîne brute', () => {
    expect(formatBarrierClock(undefined, '26-22:30', 'clock_time', 0)).toBe('26-22:30')
  })
  it('pas de barrière → null', () => {
    expect(formatBarrierClock('20:00', null, null, 0)).toBeNull()
  })
})
