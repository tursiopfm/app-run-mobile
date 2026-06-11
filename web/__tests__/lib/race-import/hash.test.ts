import { hashWaypoints } from '@/lib/race-import/hash'

const wp = (over: any = {}) => ({
  orderIndex: 0, name: 'A', km: 0, kmInter: null, dPlus: 0, dMoins: 0,
  cutoffRaw: null, cutoffKind: null, type: 'depart', supplies: [], targetOverrideSec: null, ...over,
})

describe('hashWaypoints', () => {
  it('déterministe, insensible à l\'ordre du tableau', () => {
    const a = hashWaypoints([wp({ orderIndex: 0 }), wp({ orderIndex: 1, name: 'B', km: 10 })])
    const b = hashWaypoints([wp({ orderIndex: 1, name: 'B', km: 10 }), wp({ orderIndex: 0 })])
    expect(a).toBe(b)
  })
  it('change si un km/cutoff/supply change', () => {
    const base = hashWaypoints([wp()])
    expect(hashWaypoints([wp({ km: 1 })])).not.toBe(base)
    expect(hashWaypoints([wp({ cutoffRaw: 'sam. 10:00' })])).not.toBe(base)
    expect(hashWaypoints([wp({ supplies: ['liquid'] })])).not.toBe(base)
  })
  it('insensible à l\'ordre des supplies', () => {
    expect(hashWaypoints([wp({ supplies: ['solid', 'liquid'] })]))
      .toBe(hashWaypoints([wp({ supplies: ['liquid', 'solid'] })]))
  })
})
