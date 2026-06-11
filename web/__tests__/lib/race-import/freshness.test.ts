import { computeFreshness, type DetectedEdition } from '@/lib/race-import/freshness'

const base: DetectedEdition = {
  editionYear: null, editionDate: null, dateExplicit: false, startDayOfMonth: null,
}

describe('computeFreshness', () => {
  it('année détectée == cible, jour inconnu → confirmed', () => {
    const r = computeFreshness({ ...base, editionYear: 2026 }, '2026-06-28')
    expect(r.freshnessStatus).toBe('confirmed')
    expect(r.editionYear).toBe(2026)
  })

  it('editionDate explicite même année → confirmed (jour ignoré)', () => {
    const r = computeFreshness({ ...base, editionDate: '2026-08-28', dateExplicit: true }, '2026-08-29')
    expect(r.freshnessStatus).toBe('confirmed')
    expect(r.editionYear).toBe(2026)
    expect(r.editionDate).toBe('2026-08-28')
  })

  it('année détectée < cible → provisional_previous_edition (garde l\'année réelle)', () => {
    const r = computeFreshness({ ...base, editionYear: 2025 }, '2026-06-28')
    expect(r.freshnessStatus).toBe('provisional_previous_edition')
    expect(r.editionYear).toBe(2025)
  })

  it('année détectée > cible → unknown', () => {
    const r = computeFreshness({ ...base, editionYear: 2027 }, '2026-06-28')
    expect(r.freshnessStatus).toBe('unknown')
  })

  it('aucune année détectée → unknown', () => {
    const r = computeFreshness({ ...base }, '2026-06-28')
    expect(r.freshnessStatus).toBe('unknown')
    expect(r.editionYear).toBeNull()
  })

  it('même année + jour XML qui concorde → confirmed + editionDate reconstruite', () => {
    const r = computeFreshness({ ...base, editionYear: 2026, startDayOfMonth: 28 }, '2026-06-28')
    expect(r.freshnessStatus).toBe('confirmed')
    expect(r.editionDate).toBe('2026-06-28')
  })

  it('même année + jour XML différent → unknown (incohérent)', () => {
    const r = computeFreshness({ ...base, editionYear: 2026, startDayOfMonth: 14 }, '2026-06-28')
    expect(r.freshnessStatus).toBe('unknown')
    expect(r.editionDate).toBeNull()
  })

  it('date fiche non parsable → unknown', () => {
    const r = computeFreshness({ ...base, editionYear: 2026 }, '')
    expect(r.freshnessStatus).toBe('unknown')
  })
})
