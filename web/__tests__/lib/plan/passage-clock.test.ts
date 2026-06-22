import { passageClocks } from '@/lib/plan/passage-clock'

const flat = (kms: number[]) =>
  kms.map((km) => ({ km, dPlus: 0, targetOverrideSec: null }))

describe('passageClocks', () => {
  it('objectif absent → tout vide', () => {
    expect(passageClocks(flat([0, 10, 20]), { startTime: '08:00', totalDurationSec: null, fade: 0 }))
      .toEqual(['', '', ''])
  })
  it('heure de départ absente → tout vide', () => {
    expect(passageClocks(flat([0, 10, 20]), { startTime: null, totalDurationSec: 7200, fade: 0 }))
      .toEqual(['', '', ''])
  })
  it('départ 08:00, cible 2h, 3 points réguliers → 08:00 / 09:00 / 10:00', () => {
    expect(passageClocks(flat([0, 10, 20]), { startTime: '08:00', totalDurationSec: 7200, fade: 0 }))
      .toEqual(['08:00', '09:00', '10:00'])
  })
  it('passage minuit sans date → préfixe J+1', () => {
    const out = passageClocks(flat([0, 10]), { startTime: '22:00', totalDurationSec: 10800, fade: 0 })
    expect(out[0]).toBe('22:00')
    expect(out[1]).toBe('J+1 01:00')
  })
  it('passage minuit avec date connue → jour de semaine court', () => {
    // 2026-06-20 = samedi → +1 jour = dimanche.
    const out = passageClocks(flat([0, 10]), {
      startTime: '22:00', totalDurationSec: 10800, fade: 0, startDateIso: '2026-06-20',
    })
    expect(out[1]).toBe('dim. 01:00')
  })
})
