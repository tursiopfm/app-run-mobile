import { estimatePassageTimes, type PacingWaypoint } from '@/lib/plan/pacing'

const flat = (kms: number[]): PacingWaypoint[] =>
  kms.map((km) => ({ km, dPlus: 0, targetOverrideSec: null }))

describe('estimatePassageTimes', () => {
  it('point 0 = 0 et arrivée = temps cible, strictement croissant (plat, sans fade)', () => {
    const out = estimatePassageTimes(flat([0, 10, 20]), { totalDurationSec: 7200, fade: 0 })
    expect(out).toEqual([0, 3600, 7200])
  })

  it('pondère par le D+ cumulé (tronçon plus dur = plus de temps)', () => {
    const wps: PacingWaypoint[] = [
      { km: 0, dPlus: 0, targetOverrideSec: null },
      { km: 10, dPlus: 1000, targetOverrideSec: null }, // +1000 m → effort 20
      { km: 20, dPlus: 1000, targetOverrideSec: null }, // +0 m    → effort 10
    ]
    const out = estimatePassageTimes(wps, { totalDurationSec: 7200, fade: 0 })
    expect(out).toEqual([0, 4800, 7200])
  })

  it('fade > 0 ralentit la 2e moitié', () => {
    const out = estimatePassageTimes(flat([0, 10, 20]), { totalDurationSec: 7200, fade: 1 })
    expect(out[0]).toBe(0)
    expect(out[2]).toBe(7200)
    const seg1 = out[1] - out[0]
    const seg2 = out[2] - out[1]
    expect(out[1]).toBe(2700)
    expect(seg2).toBeGreaterThan(seg1)
  })

  it('un override fige le point et redistribue les tronçons suivants', () => {
    const wps: PacingWaypoint[] = [
      { km: 0, dPlus: 0, targetOverrideSec: null },
      { km: 10, dPlus: 0, targetOverrideSec: null },
      { km: 20, dPlus: 0, targetOverrideSec: 8000 }, // figé
      { km: 30, dPlus: 0, targetOverrideSec: null },
    ]
    const out = estimatePassageTimes(wps, { totalDurationSec: 10800, fade: 0 })
    expect(out).toEqual([0, 4000, 8000, 10800])
  })

  it('cas dégénérés', () => {
    expect(estimatePassageTimes([], { totalDurationSec: 1000, fade: 0 })).toEqual([])
    expect(estimatePassageTimes(flat([0]), { totalDurationSec: 1000, fade: 0 })).toEqual([0])
  })
})
