import { validateCustomZones, type CustomZone } from '@/components/settings/CustomZonesEditor'

const zones = (rows: [number | null, number | null][]): CustomZone[] =>
  rows.map((r, i) => ({ zone: i + 1, min: r[0], max: r[1] }))

describe('validateCustomZones', () => {
  it('passe avec 5 zones continues et croissantes', () => {
    const errs = validateCustomZones(zones([[null, 120], [121, 130], [131, 142], [143, 154], [155, 167]]))
    expect(errs).toEqual([])
  })

  it('détecte un chevauchement', () => {
    const errs = validateCustomZones(zones([[null, 120], [115, 130], [131, 142], [143, 154], [155, 167]]))
    expect(errs[0]).toMatch(/Z2/)
  })

  it('détecte un trou entre zones', () => {
    const errs = validateCustomZones(zones([[null, 120], [125, 130], [131, 142], [143, 154], [155, 167]]))
    expect(errs[0]).toMatch(/Z2/)
  })

  it('détecte min > max sur une zone', () => {
    const errs = validateCustomZones(zones([[null, 120], [121, 130], [142, 131], [143, 154], [155, 167]]))
    expect(errs[0]).toMatch(/Z3/)
  })

  it('détecte une valeur manquante', () => {
    const errs = validateCustomZones(zones([[null, 120], [121, null], [131, 142], [143, 154], [155, 167]]))
    expect(errs[0]).toMatch(/Z2/)
  })
})
