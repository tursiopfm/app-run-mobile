jest.mock('@/lib/race-import/fetch-url', () => ({
  fetchRaceHtml: jest.fn(async () => '<html>roadbook</html>'),
}))
jest.mock('@/lib/race-import/extract', () => ({
  extractWaypoints: jest.fn(),
}))
jest.mock('@/lib/race-import/catalog', () => ({
  searchCatalogUrls: jest.fn(),
  accumulateCatalog: jest.fn(async () => {}),
}))
jest.mock('@/lib/race-import/search-openai', () => ({
  searchRaceUrls: jest.fn(),
}))

import {
  harvestRaceUrls, rankRaceCandidates,
  resolveCandidates, findRaceCandidates, type RaceTarget,
} from '@/lib/race-import/find-race'
import { extractWaypoints } from '@/lib/race-import/extract'
const mockExtract = extractWaypoints as jest.Mock
import { fetchRaceHtml } from '@/lib/race-import/fetch-url'
const mockFetchHtml = fetchRaceHtml as jest.Mock
import '@/lib/race-import/sources/utmb'        // enregistre le parser utmb
import '@/lib/race-import/sources/livetrail'   // enregistre le parser livetrail
import { searchCatalogUrls, accumulateCatalog } from '@/lib/race-import/catalog'
import { searchRaceUrls } from '@/lib/race-import/search-openai'
const mockSearchCatalog = searchCatalogUrls as jest.Mock
const mockAccumulate = accumulateCatalog as jest.Mock
const mockSearchOpenai = searchRaceUrls as jest.Mock

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

const LIVETRAIL_XML = `<d>
  <courses><c id="GdRaid" n="Grand Raid"/><c id="Raid" n="Raid" sel="1"/></courses>
  <points course="GdRaid">
    <pt n="Départ" km="0" d="0" a="10" b="" />
    <pt n="Arrivée" km="177" d="1430" a="10" b="28-13:00" />
  </points>
  <points course="Raid">
    <pt n="Départ" km="0" d="0" a="5" b="" />
    <pt n="Arrivée" km="100" d="780" a="3" b="26-09:15" />
  </points>
</d>`

function mockFetchLivetrail() {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    const h = new URL(url).hostname
    if (h.endsWith('.livetrail.run') || h.endsWith('.livetrail.net')) {
      return Promise.resolve({ ok: true, text: async () => LIVETRAIL_XML } as any)
    }
    return Promise.resolve({ ok: false, status: 404 } as any)
  })
}

describe('resolveCandidates — LiveTrail événement', () => {
  afterEach(() => jest.restoreAllMocks())

  it('depuis une page événement, liste toutes les courses et choisit par distance/D+', async () => {
    mockFetchLivetrail()
    const target = { name: 'Ultra Marin', date: '2026-06-26', distance: 177, elevation: 1430 }
    const out = await resolveCandidates(target, [
      'https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026',
    ])
    expect(out.length).toBeGreaterThanOrEqual(2)
    expect(out[0].raceName).toBe('Grand Raid')
    expect(out[0].totalKm).toBe(177)
    expect(out[0].confident).toBe(true)
    expect(out.find((c) => c.raceName === 'Raid')!.confident).toBe(false)
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

describe('resolveCandidates — fallback générique', () => {
  beforeEach(() => { mockExtract.mockReset() })
  afterEach(() => { jest.restoreAllMocks(); mockExtract.mockReset() })

  it('extrait au LLM une URL « autre » quand aucun candidat parsable confident', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 } as any)
    mockExtract.mockResolvedValue({
      raceName: 'Ultra Marin', editionYear: null,
      waypoints: [
        { orderIndex: 0, name: 'Départ', km: 0, kmInter: null, dPlus: 0, dMoins: 0, cutoffRaw: null, cutoffKind: null, type: 'depart', supplies: [], targetOverrideSec: null },
        { orderIndex: 1, name: 'Arrivée', km: 177, kmInter: null, dPlus: 1430, dMoins: 1430, cutoffRaw: null, cutoffKind: null, type: 'arrivee', supplies: [], targetOverrideSec: null },
      ],
    })
    const target = { name: 'Ultra Marin', date: '2026-06-26', distance: 177, elevation: 1430 }
    const out = await resolveCandidates(target, ['https://www.ultra-marin.fr/grand-raid'])
    expect(mockExtract).toHaveBeenCalledTimes(1)
    expect(out).toHaveLength(1)
    expect(out[0].parserId).toBe('generic')
    expect(out[0].totalKm).toBe(177)
    expect(out[0].confident).toBe(true)
  })

  it('NE déclenche PAS le LLM si un candidat parsable confident existe', async () => {
    mockFetchUtmb()
    mockExtract.mockResolvedValue({ raceName: null, editionYear: null, waypoints: [] })
    const target = { name: 'X', date: '2026-06-12', distance: 138, elevation: 5300 }
    const out = await resolveCandidates(target, [
      'https://saint-jacques.utmb.world/fr/races/100M',
      'https://www.exemple.com/autre',
    ])
    expect(out[0].confident).toBe(true)
    expect(mockExtract).not.toHaveBeenCalled()
  })
})

describe('resolveCandidates — découverte via le site officiel', () => {
  beforeEach(() => { mockExtract.mockReset() })
  afterEach(() => {
    jest.restoreAllMocks()
    mockExtract.mockReset()
    mockFetchHtml.mockReset()
    mockFetchHtml.mockImplementation(async () => '<html>roadbook</html>')
  })

  it('suit les liens du site officiel vers livetrail puis résout la bonne course', async () => {
    mockFetchLivetrail()  // global.fetch → XML livetrail pour les hôtes livetrail
    mockFetchHtml.mockImplementation(async (url: string) => {
      if (url.endsWith('/ledirect')) {
        return '<a href="https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026">suivi</a>'
      }
      if (url.includes('ultra-marin.fr')) {
        return '<nav><a href="https://www.ultra-marin.fr/ledirect">Le direct</a></nav>'
      }
      return '<html></html>'
    })
    const target = { name: 'Ultra Marin', date: '2026-06-26', distance: 177, elevation: 1430 }
    const out = await resolveCandidates(target, ['https://www.ultra-marin.fr/'])
    expect(out[0].raceName).toBe('Grand Raid')
    expect(out[0].totalKm).toBe(177)
    expect(out[0].confident).toBe(true)
    expect(mockExtract).not.toHaveBeenCalled()
  })
})

describe('findRaceCandidates — catalogue d\'abord', () => {
  beforeEach(() => { mockSearchCatalog.mockReset(); mockAccumulate.mockReset(); mockSearchOpenai.mockReset() })
  afterEach(() => jest.restoreAllMocks())

  it('hit catalogue confident → renvoie sans appeler OpenAI', async () => {
    mockFetchLivetrail()
    mockSearchCatalog.mockResolvedValue(['https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026'])
    const target = { name: 'Ultra Marin', date: '2026-06-26', distance: 177, elevation: 1430 }
    const out = await findRaceCandidates(target)
    expect(out[0].raceName).toBe('Grand Raid')
    expect(out[0].confident).toBe(true)
    expect(mockSearchOpenai).not.toHaveBeenCalled()
  })

  it('catalogue vide → fallback OpenAI + accumulation', async () => {
    mockFetchLivetrail()
    mockSearchCatalog.mockResolvedValue([])
    mockSearchOpenai.mockResolvedValue(['https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026'])
    const target = { name: 'Ultra Marin', date: '2026-06-26', distance: 177, elevation: 1430 }
    const out = await findRaceCandidates(target)
    expect(mockSearchOpenai).toHaveBeenCalledTimes(1)
    expect(out[0].raceName).toBe('Grand Raid')
    expect(mockAccumulate).toHaveBeenCalledTimes(1)
    expect((mockAccumulate.mock.calls[0][0] as any[])[0].raceName).toBe('Grand Raid')
  })

  it('hit catalogue NON confident → fallback OpenAI', async () => {
    mockFetchLivetrail()
    mockSearchCatalog.mockResolvedValue(['https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026'])
    mockSearchOpenai.mockResolvedValue([])
    const target = { name: 'Ultra Marin', date: '2026-06-26', distance: 250, elevation: 9000 }
    await findRaceCandidates(target)
    expect(mockSearchOpenai).toHaveBeenCalledTimes(1)
  })
})
