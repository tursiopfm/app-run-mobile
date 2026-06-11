import {
  normalizeTokens, nameSimilarity, harvestRaceUrls, rankRaceCandidates,
  type RaceTarget,
} from '@/lib/race-import/find-race'

describe('normalizeTokens', () => {
  it('minuscule, sans accents/ponctuation, en tokens', () => {
    expect(normalizeTokens('Ultra du Saint-Jacques !')).toEqual(['ultra', 'du', 'saint', 'jacques'])
  })
})

describe('nameSimilarity', () => {
  it('proche → score élevé', () => {
    expect(nameSimilarity('Ultra du Saint-Jacques', 'Ultra Saint Jacques')).toBeGreaterThan(0.5)
  })
  it('différent → score bas', () => {
    expect(nameSimilarity('Ultra du Saint-Jacques', 'Marathon de Paris')).toBeLessThan(0.2)
  })
  it('chaîne vide → 0', () => {
    expect(nameSimilarity('X', '')).toBe(0)
  })
})

describe('harvestRaceUrls', () => {
  it('déduplique, ignore les URLs invalides, garde l\'ordre', () => {
    const out = harvestRaceUrls([
      'https://a.utmb.world/fr/races/100M',
      'pas-une-url',
      'https://a.utmb.world/fr/races/100M#x',   // doublon (fragment ignoré)
      'https://tsj.livetrail.run/parcours.php?course=Ultra',
    ])
    expect(out).toEqual([
      'https://a.utmb.world/fr/races/100M',
      'https://tsj.livetrail.run/parcours.php?course=Ultra',
    ])
  })
})

describe('rankRaceCandidates', () => {
  const target: RaceTarget = { name: 'Ultra Saint-Jacques', date: '2026-06-12', distance: 139, elevation: 6000 }
  const base = { url: '', parserId: 'utmb', nbPoints: 10, waypoints: [] as any }

  it('choisit la bonne variante par distance (100M vs 100K)', () => {
    const out = rankRaceCandidates(target, [
      { ...base, url: 'k', raceName: 'Grand Trail Saint-Jacques', totalKm: 86, totalDplus: 3200 },
      { ...base, url: 'm', raceName: 'Ultra du Saint-Jacques', totalKm: 138.6, totalDplus: 5900 },
    ])
    expect(out[0].url).toBe('m')
    expect(out[0].confident).toBe(true)
    expect(out.find((c) => c.url === 'k')!.confident).toBe(false)
  })

  it('D+ manquant → pénalité → non confident', () => {
    const out = rankRaceCandidates(target, [
      { ...base, url: 'm', raceName: 'Ultra du Saint-Jacques', totalKm: 138.6, totalDplus: null },
    ])
    expect(out[0].confident).toBe(false)
  })
})
