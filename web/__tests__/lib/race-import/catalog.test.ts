jest.mock('@/lib/database/supabase-server', () => ({ createServiceClient: jest.fn() }))
import { createServiceClient } from '@/lib/database/supabase-server'
const mockCreate = createServiceClient as jest.Mock

jest.mock('@/lib/race-import/sources/livetrail', () => ({
  listLivetrailRaces: jest.fn(),
}))
import { listLivetrailRaces } from '@/lib/race-import/sources/livetrail'
const mockList = listLivetrailRaces as jest.Mock

import {
  normalizeSearchText, yearFromLivetrailUrl, harvestEventUrls,
  candidatesToRows, rankEventUrls, accumulateCatalog, searchCatalogUrls,
  runCatalogSnapshot,
} from '@/lib/race-import/catalog'
import type { RaceCandidate, RaceTarget } from '@/lib/race-import/find-race'

const target: RaceTarget = { name: 'Ultra Marin', date: '2026-06-26', distance: 177, elevation: 1430 }

function cand(over: Partial<RaceCandidate>): RaceCandidate {
  return {
    url: 'https://x.v3.livetrail.net/fr/2026', parserId: 'livetrail', raceName: 'Grand Raid',
    totalKm: 177, totalDplus: 1430, nbPoints: 14, waypoints: [], confident: false, ...over,
  }
}

describe('normalizeSearchText', () => {
  it('minuscule + sans accent', () => {
    expect(normalizeSearchText('Ultra-Marin ÉCOTRAIL')).toBe('ultra-marin ecotrail')
  })
})

describe('yearFromLivetrailUrl', () => {
  it('v3 /fr/2026/... → 2026', () => {
    expect(yearFromLivetrailUrl('https://ecotrail.v3.livetrail.net/fr/2026/races/80k')).toBe(2026)
  })
  it('parcours.php sans année → null', () => {
    expect(yearFromLivetrailUrl('https://tsj.livetrail.run/parcours.php?course=U')).toBeNull()
  })
})

describe('harvestEventUrls', () => {
  it('extrait les sous-domaines livetrail, exclut utmb.world, déduplique', () => {
    const html = `
      <a href="https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026">x</a>
      <a href="https://live.utmb.world/fr/races/abc">utmb</a>
      <a href="https://comblorane.v3.livetrail.net/fr/2026">y</a>
      <a href="https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026">dup</a>`
    const out = harvestEventUrls(html)
    expect(out).toContain('https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026')
    expect(out).toContain('https://comblorane.v3.livetrail.net/fr/2026')
    expect(out.some((u) => u.includes('utmb.world'))).toBe(false)
    expect(out.filter((u) => u.includes('ultramarin')).length).toBe(1)
  })

  it('ignore le backslash d\'un href échappé (href=\\"…\\")', () => {
    const out = harvestEventUrls('<a href=\\"https://um.v3.livetrail.net/fr/2026\\">x</a>')
    expect(out).toEqual(['https://um.v3.livetrail.net/fr/2026'])
  })
})

describe('candidatesToRows', () => {
  it('filtre livetrail, mappe les champs et dérive l\'année', () => {
    const rows = candidatesToRows([
      cand({ url: 'https://ultramarin.v3.livetrail.net/fr/2026', raceName: 'Grand Raid', totalKm: 177, totalDplus: 1430 }),
      cand({ parserId: 'utmb', url: 'https://x.utmb.world/fr/races/a' }),  // ignoré
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].platform).toBe('livetrail')
    expect(rows[0].event_slug).toBe('ultramarin')
    expect(rows[0].course_name).toBe('Grand Raid')
    expect(rows[0].edition_year).toBe(2026)
    expect(rows[0].total_km).toBe(177)
    expect(rows[0].source_url).toBe('https://ultramarin.v3.livetrail.net/fr/2026')
    expect(rows[0].search_text).toContain('grand raid')
    expect(rows[0].search_text).toContain('ultramarin')
  })
})

describe('rankEventUrls', () => {
  it('classe par proximité distance/D+, URLs distinctes', () => {
    const out = rankEventUrls(target, [
      { source_url: 'https://far.v3.livetrail.net/fr/2026', total_km: 50, total_dplus: 500 },
      { source_url: 'https://good.v3.livetrail.net/fr/2026', total_km: 177, total_dplus: 1430 },
      { source_url: 'https://good.v3.livetrail.net/fr/2026', total_km: 100, total_dplus: 780 },
    ])
    expect(out[0]).toBe('https://good.v3.livetrail.net/fr/2026')
    expect(out).toHaveLength(2)
  })
})

describe('accumulateCatalog', () => {
  afterEach(() => jest.clearAllMocks())

  it('upsert les lignes livetrail avec onConflict', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null })
    mockCreate.mockReturnValue({ from: jest.fn().mockReturnValue({ upsert }) })
    await accumulateCatalog([cand({ url: 'https://um.v3.livetrail.net/fr/2026', raceName: 'Grand Raid' })])
    expect(upsert).toHaveBeenCalledTimes(1)
    const [rows, opts] = upsert.mock.calls[0]
    expect(rows[0].event_slug).toBe('um')
    expect(opts.onConflict).toBe('platform,event_slug,course_name,edition_year')
  })

  it('aucun candidat livetrail → pas de client DB', async () => {
    await accumulateCatalog([cand({ parserId: 'utmb', url: 'https://x.utmb.world/fr/races/a' })])
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('searchCatalogUrls', () => {
  afterEach(() => jest.clearAllMocks())

  function mockSelect(data: unknown) {
    const limit = jest.fn().mockResolvedValue({ data, error: null })
    const or = jest.fn().mockReturnValue({ limit })
    const eq = jest.fn().mockReturnValue({ or })
    const select = jest.fn().mockReturnValue({ eq })
    mockCreate.mockReturnValue({ from: jest.fn().mockReturnValue({ select }) })
    return { select, eq, or }
  }

  it('tokenise le nom, classe et renvoie les URLs distinctes', async () => {
    const { or } = mockSelect([
      { source_url: 'https://good.v3.livetrail.net/fr/2026', total_km: 177, total_dplus: 1430 },
      { source_url: 'https://far.v3.livetrail.net/fr/2026', total_km: 50, total_dplus: 500 },
    ])
    const out = await searchCatalogUrls(target)
    expect(or).toHaveBeenCalledWith('search_text.ilike.%ultra%,search_text.ilike.%marin%')
    expect(out[0]).toBe('https://good.v3.livetrail.net/fr/2026')
  })

  it('nom sans token ≥3 → [] sans requête', async () => {
    const out = await searchCatalogUrls({ ...target, name: 'a b' })
    expect(out).toEqual([])
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('erreur DB → []', async () => {
    const limit = jest.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
    mockCreate.mockReturnValue({ from: jest.fn().mockReturnValue({
      select: () => ({ eq: () => ({ or: () => ({ limit }) }) }) }) })
    expect(await searchCatalogUrls(target)).toEqual([])
  })
})

describe('runCatalogSnapshot', () => {
  afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks() })

  it('fetch /fr/events, énumère les événements et upsert', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '<a href="https://um.v3.livetrail.net/fr/2026">x</a>',
    } as any)
    mockList.mockResolvedValue([
      { raceName: 'Grand Raid', data: { raceName: null, editionYear: null, waypoints: [
        { orderIndex: 0, name: 'D', km: 0, kmInter: null, dPlus: 0, dMoins: 0, cutoffRaw: null, cutoffKind: null, type: 'depart', supplies: [], targetOverrideSec: null },
        { orderIndex: 1, name: 'A', km: 177, kmInter: null, dPlus: 1430, dMoins: 0, cutoffRaw: null, cutoffKind: null, type: 'arrivee', supplies: [], targetOverrideSec: null },
      ] } },
    ])
    const upsert = jest.fn().mockResolvedValue({ error: null })
    mockCreate.mockReturnValue({ from: jest.fn().mockReturnValue({ upsert }) })

    const out = await runCatalogSnapshot()
    expect(out.events).toBe(1)
    expect(upsert).toHaveBeenCalled()
    expect(upsert.mock.calls[0][0][0].event_slug).toBe('um')
    expect(upsert.mock.calls[0][0][0].total_km).toBe(177)
  })

  it('déduplique par slug (même événement, URLs différentes → 1 seul fetch)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        '<a href="https://um.v3.livetrail.net/fr/2026">a</a><a href="https://um.v3.livetrail.net/">b</a>',
    } as any)
    mockList.mockResolvedValue([
      { raceName: 'Grand Raid', data: { raceName: null, editionYear: null, waypoints: [
        { orderIndex: 0, name: 'D', km: 0, kmInter: null, dPlus: 0, dMoins: 0, cutoffRaw: null, cutoffKind: null, type: 'depart', supplies: [], targetOverrideSec: null },
        { orderIndex: 1, name: 'A', km: 177, kmInter: null, dPlus: 1430, dMoins: 0, cutoffRaw: null, cutoffKind: null, type: 'arrivee', supplies: [], targetOverrideSec: null },
      ] } },
    ])
    mockCreate.mockReturnValue({ from: jest.fn().mockReturnValue({ upsert: jest.fn().mockResolvedValue({ error: null }) }) })

    const out = await runCatalogSnapshot()
    expect(out.events).toBe(1)
    expect(mockList).toHaveBeenCalledTimes(1)
  })
})
