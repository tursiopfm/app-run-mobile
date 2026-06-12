import { formeVerdict, cursorPctFromTsb } from '@/lib/mission/forme-verdict'

describe('cursorPctFromTsb', () => {
  it('clampe à [-35, 25] et renvoie un % linéaire', () => {
    expect(cursorPctFromTsb(-35)).toBe(0)
    expect(cursorPctFromTsb(25)).toBe(100)
    expect(cursorPctFromTsb(-5)).toBe(50)     // milieu de l'échelle
    expect(cursorPctFromTsb(-100)).toBe(0)    // clamp bas
    expect(cursorPctFromTsb(100)).toBe(100)   // clamp haut
  })
})

describe('formeVerdict', () => {
  it('high-fatigue → adapter', () => {
    expect(formeVerdict('high-fatigue')).toEqual({ tone: 'adapt', zone: 'high-fatigue' })
  })
  it('normal-fatigue → continuer (fatigue d\'entraînement normale)', () => {
    expect(formeVerdict('normal-fatigue').tone).toBe('continue')
  })
  it('balanced / fresh / very-fresh → continuer', () => {
    expect(formeVerdict('balanced').tone).toBe('continue')
    expect(formeVerdict('fresh').tone).toBe('continue')
    expect(formeVerdict('very-fresh').tone).toBe('continue')
  })
})
