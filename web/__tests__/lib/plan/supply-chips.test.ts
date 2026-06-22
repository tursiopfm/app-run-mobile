import { chartChips, allChips, SUPPLY_META, SUPPLY_ORDER } from '@/lib/plan/supply-chips'

describe('chartChips (vue graphe reduite)', () => {
  it('liquide seul -> [L]', () => {
    expect(chartChips(['liquid'])).toEqual(['liquid'])
  })
  it('liquide+solide -> [S] (le liquide est implicite)', () => {
    expect(chartChips(['liquid', 'solid'])).toEqual(['solid'])
  })
  it('liquide+solide+chaud -> [C] (solide et liquide implicites)', () => {
    expect(chartChips(['liquid', 'solid', 'hot'])).toEqual(['hot'])
  })
  it('chaud + base vie + assistance -> [C, BV, A] dans cet ordre', () => {
    expect(chartChips(['liquid', 'solid', 'hot', 'base_vie', 'assistance']))
      .toEqual(['hot', 'base_vie', 'assistance'])
  })
  it('base vie sans nourriture -> [BV]', () => {
    expect(chartChips(['base_vie'])).toEqual(['base_vie'])
  })
  it('vide -> []', () => {
    expect(chartChips([])).toEqual([])
  })
})

describe('allChips (vue fiche complète)', () => {
  it("conserve toutes les puces dans l'ordre canonique", () => {
    expect(allChips(['assistance', 'liquid', 'hot'])).toEqual(['liquid', 'hot', 'assistance'])
  })
})

describe('SUPPLY_META', () => {
  it('lettres conformes au tableau', () => {
    expect(SUPPLY_META.liquid.letter).toBe('L')
    expect(SUPPLY_META.solid.letter).toBe('S')
    expect(SUPPLY_META.hot.letter).toBe('C')
    expect(SUPPLY_META.base_vie.letter).toBe('BV')
    expect(SUPPLY_META.assistance.letter).toBe('A')
  })
  it('chaque categorie a une couleur hex', () => {
    SUPPLY_ORDER.forEach((s) => expect(SUPPLY_META[s].color).toMatch(/^#[0-9A-Fa-f]{6}$/))
  })
})
