import {
  normalizeTokens, nameSimilarity, harvestRaceUrls, rankRaceCandidates,
  resolveCandidates, type RaceTarget,
} from '@/lib/race-import/find-race'
import '@/lib/race-import/sources/utmb'        // enregistre le parser utmb
import '@/lib/race-import/sources/livetrail'   // enregistre le parser livetrail

// HTML UTMB minimal (JSON "points" embarqué) — dernier point Le Puy 138.4 km / 5267 D+.
const UTMB_HTML = `<html><body><script type="application/json">
{"race":{"name":"Ultra du Saint-Jacques","points":[
{"name":"Saugues","distance":0,"gainElevation":0,"lossElevation":0,"supplies":"none","isAssistance":false,"hasBag":false,"cutoff":""},
{"name":"Saint Jean Lachalm","distance":72400,"gainElevation":3242,"lossElevation":2900,"supplies":"hotFood","isAssistance":true,"hasBag":true,"cutoff":"sam. 11:20"},
{"name":"Le Puy en Velay","distance":138400,"gainElevation":5267,"lossElevation":5550,"supplies":"food","isAssistance":false,"hasBag":true,"cutoff":"dim. 02:15"}
]}}
</script></body></html>`

function mockFetchUtmb() {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (new URL(url).hostname.endsWith('.utmb.world')) {
      return Promise.resolve({ ok: true, text: async () => UTMB_HTML } as any)
    }
    return Promise.resolve({ ok: false, status: 404 } as any)
  })
}

describe('resolveCandidates', () => {
  afterEach(() => jest.restoreAllMocks())
  const target: RaceTarget = { name: 'Ultra Saint-Jacques', date: '2026-06-12', distance: 138, elevation: 5300 }

  it('parse les URLs UTMB, ignore les non-parsables, déduplique fr/en, classe', async () => {
    mockFetchUtmb()
    const out = await resolveCandidates(target, [
      'https://saint-jacques.utmb.world/fr/races/100M',
      'https://www.exemple.com/blog',                       // pas de parser → ignoré
      'https://saint-jacques.utmb.world/en/races/100M',     // même course → dédupliquée
    ])
    expect(out).toHaveLength(1)
    expect(out[0].parserId).toBe('utmb')
    expect(out[0].totalKm).toBe(138.4)
    expect(out[0].totalDplus).toBe(5267)
    expect(out[0].confident).toBe(true)
    expect(out[0].waypoints.length).toBeGreaterThan(0)
  })

  it('aucune URL parsable → []', async () => {
    mockFetchUtmb()
    const out = await resolveCandidates(target, ['https://www.exemple.com/x'])
    expect(out).toEqual([])
  })
})

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
