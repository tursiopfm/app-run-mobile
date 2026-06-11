import { isDueForRecheck, buildPendingDiff } from '@/lib/race-import/recheck-logic'

describe('isDueForRecheck', () => {
  const now = '2026-06-28T12:00:00.000Z'
  const ago = (days: number) => new Date(Date.parse(now) - days * 86400000).toISOString()
  it('≤3j : due si dernier > 1j', () => {
    expect(isDueForRecheck(2, ago(2), now)).toBe(true)
    expect(isDueForRecheck(2, ago(0.5), now)).toBe(false)
  })
  it('≤14j : due si dernier > 7j', () => {
    expect(isDueForRecheck(10, ago(8), now)).toBe(true)
    expect(isDueForRecheck(10, ago(3), now)).toBe(false)
  })
  it('≤30j : due si dernier > 14j', () => {
    expect(isDueForRecheck(25, ago(15), now)).toBe(true)
    expect(isDueForRecheck(25, ago(10), now)).toBe(false)
  })
  it('>30j : jamais', () => {
    expect(isDueForRecheck(45, ago(60), now)).toBe(false)
  })
  it('jamais checké (null) → due si dans une fenêtre', () => {
    expect(isDueForRecheck(10, null, now)).toBe(true)
    expect(isDueForRecheck(45, null, now)).toBe(false)
  })
  it('course passée → false', () => {
    expect(isDueForRecheck(-1, ago(30), now)).toBe(false)
  })
})

const wp = (over: any = {}) => ({
  orderIndex: 0, name: 'A', km: 0, kmInter: null, dPlus: 0, dMoins: 0,
  cutoffRaw: null, cutoffKind: null, type: 'depart', supplies: [], targetOverrideSec: null, ...over,
})
const extracted = (over: any = {}) => ({
  raceName: null, editionYear: null, editionDate: null, dateExplicit: false,
  startDayOfMonth: null, startTimeRaw: null, waypoints: [wp({ name: 'Départ' }), wp({ name: 'Arrivée', km: 100 })],
  ...over,
})
const now = '2026-06-28T12:00:00.000Z'

describe('buildPendingDiff', () => {
  it('hash identique, pas de changement d\'édition → null', () => {
    const newData = extracted()
    const out = buildPendingDiff({
      oldWaypoints: newData.waypoints, newData, newHash: 'H',
      meta: { source_hash: 'H', edition_year: 2026, freshness_status: 'confirmed' },
      raceDateISO: '2026-07-12', nowISO: now,
    })
    expect(out).toBeNull()
  })

  it('hash différent → pending changed avec résumé', () => {
    const newData = extracted({ waypoints: [wp({ name: 'Départ' }), wp({ name: 'Arrivée', km: 102, cutoffRaw: 'X' })] })
    const out = buildPendingDiff({
      oldWaypoints: [wp({ name: 'Départ' }), wp({ name: 'Arrivée', km: 100 })], newData, newHash: 'H2',
      meta: { source_hash: 'H1', edition_year: 2026, freshness_status: 'confirmed' },
      raceDateISO: '2026-07-12', nowISO: now,
    })
    expect(out!.kind).toBe('changed')
    expect(out!.detectedAt).toBe(now)
    expect(out!.newMeta.sourceHash).toBe('H2')
    expect(out!.summary.modified + out!.summary.added).toBeGreaterThan(0)
  })

  it('édition N-1 → cible (provisional→confirmed) → new_edition', () => {
    const newData = extracted({ editionYear: 2026, editionDate: '2026-07-12', dateExplicit: true })
    const out = buildPendingDiff({
      oldWaypoints: newData.waypoints, newData, newHash: 'H',
      meta: { source_hash: 'H', edition_year: 2025, freshness_status: 'provisional_previous_edition' },
      raceDateISO: '2026-07-12', nowISO: now,
    })
    expect(out!.kind).toBe('new_edition')
    expect(out!.newMeta.freshnessStatus).toBe('confirmed')
  })
})
