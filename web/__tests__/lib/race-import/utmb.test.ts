import { utmbParser, mapUtmbSupplies, type UtmbPoint } from '@/lib/race-import/sources/utmb'

const pt = (over: Partial<UtmbPoint>): UtmbPoint => ({
  name: 'X', distance: 1000, gainElevation: 0, lossElevation: 0,
  supplies: 'none', isAssistance: false, hasBag: false, cutoff: '', ...over,
})

describe('mapUtmbSupplies', () => {
  it('none + aucun flag → []', () => {
    expect(mapUtmbSupplies(pt({ supplies: 'none' }))).toEqual([])
  })
  it('drink → liquide', () => {
    expect(mapUtmbSupplies(pt({ supplies: 'drink' }))).toEqual(['liquid'])
  })
  it('food → liquide + solide', () => {
    expect(mapUtmbSupplies(pt({ supplies: 'food' }))).toEqual(['liquid', 'solid'])
  })
  it('hotFood → liquide + solide + chaud', () => {
    expect(mapUtmbSupplies(pt({ supplies: 'hotFood' }))).toEqual(['liquid', 'solid', 'hot'])
  })
  it('hotFood + bag + assistance → les 5 dans l\'ordre canonique', () => {
    expect(mapUtmbSupplies(pt({ supplies: 'hotFood', hasBag: true, isAssistance: true })))
      .toEqual(['liquid', 'solid', 'hot', 'base_vie', 'assistance'])
  })
  it('none + assistance seule → [assistance]', () => {
    expect(mapUtmbSupplies(pt({ supplies: 'none', isAssistance: true }))).toEqual(['assistance'])
  })
  it('food + bag → liquide + solide + base vie', () => {
    expect(mapUtmbSupplies(pt({ supplies: 'food', hasBag: true })))
      .toEqual(['liquid', 'solid', 'base_vie'])
  })
})

describe('utmbParser.match()', () => {
  it('matche une page course UTMB (sous-domaine + /races/)', () => {
    expect(utmbParser.match('https://saint-jacques.utmb.world/fr/races/100M')).toBe(true)
  })
  it('rejette la home UTMB (pas de /races/)', () => {
    expect(utmbParser.match('https://saint-jacques.utmb.world/fr')).toBe(false)
  })
  it('rejette livetrail', () => {
    expect(utmbParser.match('https://tsj.livetrail.run/parcours.php?course=Ultra')).toBe(false)
  })
  it('rejette une URL invalide', () => {
    expect(utmbParser.match('pas-une-url')).toBe(false)
  })
})
