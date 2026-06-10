import { deriveSegment, formatElapsedToClock, parseClockToElapsed } from '@/lib/plan/waypoint-view'

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
