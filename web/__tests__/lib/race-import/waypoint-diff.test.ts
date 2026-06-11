import { diffWaypoints } from '@/lib/race-import/waypoint-diff'

const wp = (over: any = {}) => ({
  orderIndex: 0, name: 'A', km: 0, kmInter: null, dPlus: 0, dMoins: 0,
  cutoffRaw: null, cutoffKind: null, type: 'depart', supplies: [], targetOverrideSec: null, ...over,
})

describe('diffWaypoints', () => {
  it('identiques → diff vide', () => {
    const a = [wp({ name: 'Départ' }), wp({ name: 'Arrivée', km: 100 })]
    const d = diffWaypoints(a, a.map((x) => ({ ...x })))
    expect(d.added).toEqual([]); expect(d.removed).toEqual([]); expect(d.modified).toEqual([])
  })

  it('ajout / suppression par nom', () => {
    const oldW = [wp({ name: 'Départ' }), wp({ name: 'Col', km: 50 })]
    const newW = [wp({ name: 'Départ' }), wp({ name: 'Refuge', km: 60 })]
    const d = diffWaypoints(oldW, newW)
    expect(d.added.map((w) => w.name)).toEqual(['Refuge'])
    expect(d.removed.map((w) => w.name)).toEqual(['Col'])
    expect(d.modified).toEqual([])
  })

  it('modification d\'un champ (barrière) sur waypoint apparié par nom (accents/casse)', () => {
    const oldW = [wp({ name: 'Col de Bavella', km: 50, cutoffRaw: 'sam. 10:00' })]
    const newW = [wp({ name: 'col de bavella', km: 50, cutoffRaw: 'sam. 11:30' })]
    const d = diffWaypoints(oldW, newW)
    expect(d.added).toEqual([]); expect(d.removed).toEqual([])
    expect(d.modified).toHaveLength(1)
    expect(d.modified[0].changes.map((c) => c.field)).toEqual(['cutoffRaw'])
  })

  it('km + supplies (ordre indifférent) détectés', () => {
    const oldW = [wp({ name: 'R1', km: 12, supplies: ['liquid', 'solid'] })]
    const newW = [wp({ name: 'R1', km: 13, supplies: ['solid', 'liquid', 'hot'] })]
    const d = diffWaypoints(oldW, newW)
    const fields = d.modified[0].changes.map((c) => c.field).sort()
    expect(fields).toEqual(['km', 'supplies'])
  })

  it('appariement fallback km quand le nom diffère (± 1 km)', () => {
    const oldW = [wp({ name: 'Ravito 1', km: 30, dPlus: 1000 })]
    const newW = [wp({ name: 'Ravitaillement 1', km: 30.5, dPlus: 1200 })]
    const d = diffWaypoints(oldW, newW)
    expect(d.added).toEqual([]); expect(d.removed).toEqual([])
    expect(d.modified[0].changes.map((c) => c.field)).toContain('dPlus')
  })
})
