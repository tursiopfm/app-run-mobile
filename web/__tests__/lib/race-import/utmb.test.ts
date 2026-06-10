import { utmbParser, mapUtmbSupplies, extractPointsJson, UtmbError, type UtmbPoint }
  from '@/lib/race-import/sources/utmb'

const FIXTURE_HTML = `<!doctype html><html><body><script type="application/json">
{"props":{"race":{"name":"Ultra","points":[
{"name":"Saugues","distance":0,"gainElevation":0,"lossElevation":0,"supplies":"none","isAssistance":false,"hasBag":false,"cutoff":""},
{"name":"Saint Julien des Chazes","distance":17890,"gainElevation":396,"lossElevation":760,"supplies":"drink","isAssistance":false,"hasBag":false,"cutoff":""},
{"name":"Sommet de la Durande","distance":28500,"gainElevation":900,"lossElevation":800,"supplies":"none","isAssistance":false,"hasBag":false,"cutoff":""},
{"name":"Saint Jean Lachalm","distance":72400,"gainElevation":3242,"lossElevation":2900,"supplies":"hotFood","isAssistance":true,"hasBag":true,"cutoff":"sam. 11:20"},
{"name":"Pont de la Roche [deviation]","distance":125900,"gainElevation":4966,"lossElevation":5100,"supplies":"none","isAssistance":false,"hasBag":false,"cutoff":"sam. 23:20"},
{"name":"Le Puy en Velay","distance":138400,"gainElevation":5267,"lossElevation":5550,"supplies":"food","isAssistance":false,"hasBag":true,"cutoff":"dim. 02:15"}
]}},"after":[1,2,3]}
</script></body></html>`

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

describe('extractPointsJson', () => {
  it('extrait les 6 points bruts du HTML', () => {
    const pts = extractPointsJson(FIXTURE_HTML)
    expect(pts).toHaveLength(6)
    expect(pts[0].name).toBe('Saugues')
    expect(pts[5].name).toBe('Le Puy en Velay')
  })
  it('ne s\'arrête pas sur un ] présent dans une chaîne (scanner conscient des strings)', () => {
    const pts = extractPointsJson(FIXTURE_HTML)
    expect(pts[4].name).toBe('Pont de la Roche [deviation]')
  })
  it('lève UtmbError si le bloc "points" est absent', () => {
    expect(() => extractPointsJson('<html>rien</html>')).toThrow(UtmbError)
  })
})

function mockFetchOnce(html: string) {
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, text: async () => html } as any)
}

describe('utmbParser.parse()', () => {
  afterEach(() => jest.restoreAllMocks())

  it('filtre aux points utiles : 6 → 5 (le landmark sans service/barrière est retiré)', async () => {
    mockFetchOnce(FIXTURE_HTML)
    const out = await utmbParser.parse('https://saint-jacques.utmb.world/fr/races/100M')
    expect(out.waypoints).toHaveLength(5)
    expect(out.waypoints.find((w) => w.name === 'Sommet de la Durande')).toBeUndefined()
  })

  it('force depart/arrivee aux extrémités', async () => {
    mockFetchOnce(FIXTURE_HTML)
    const out = await utmbParser.parse('https://saint-jacques.utmb.world/fr/races/100M')
    expect(out.waypoints[0].name).toBe('Saugues')
    expect(out.waypoints[0].type).toBe('depart')
    expect(out.waypoints[4].name).toBe('Le Puy en Velay')
    expect(out.waypoints[4].type).toBe('arrivee')
  })

  it('mappe km / D+ / D- / barrière + les 5 ravitos (St Jean Lachalm)', async () => {
    mockFetchOnce(FIXTURE_HTML)
    const out = await utmbParser.parse('https://saint-jacques.utmb.world/fr/races/100M')
    const w = out.waypoints.find((x) => x.name === 'Saint Jean Lachalm')!
    expect(w.km).toBe(72.4)
    expect(w.dPlus).toBe(3242)
    expect(w.dMoins).toBe(2900)
    expect(w.cutoffRaw).toBe('sam. 11:20')
    expect(w.cutoffKind).toBe('clock_time')
    expect(w.supplies).toEqual(['liquid', 'solid', 'hot', 'base_vie', 'assistance'])
    expect(w.type).toBe('ravito')
  })

  it('point barrière sans ravito (Pont de la Roche) : gardé, supplies vide, type pointage', async () => {
    mockFetchOnce(FIXTURE_HTML)
    const out = await utmbParser.parse('https://saint-jacques.utmb.world/fr/races/100M')
    const w = out.waypoints.find((x) => x.name.startsWith('Pont de la Roche'))!
    expect(w.supplies).toEqual([])
    expect(w.type).toBe('pointage')
    expect(w.cutoffRaw).toBe('sam. 23:20')
  })

  it('départ sans barrière → cutoffRaw/cutoffKind null', async () => {
    mockFetchOnce(FIXTURE_HTML)
    const out = await utmbParser.parse('https://saint-jacques.utmb.world/fr/races/100M')
    expect(out.waypoints[0].cutoffRaw).toBeNull()
    expect(out.waypoints[0].cutoffKind).toBeNull()
  })

  it('lève (→ fallback LLM côté route) si HTTP non-ok', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 404 } as any)
    await expect(
      utmbParser.parse('https://saint-jacques.utmb.world/fr/races/100M'),
    ).rejects.toThrow(UtmbError)
  })
})

it('enregistre le parser dans le registre', () => {
  const { findParserForUrl } = require('@/lib/race-import/sources')
  expect(findParserForUrl('https://saint-jacques.utmb.world/fr/races/100M')?.id).toBe('utmb')
})
