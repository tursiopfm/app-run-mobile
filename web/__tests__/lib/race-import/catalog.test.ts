jest.mock('@/lib/database/supabase-server', () => ({ createServiceClient: jest.fn() }))
import { createServiceClient } from '@/lib/database/supabase-server'
const mockCreate = createServiceClient as jest.Mock

import {
  normalizeSearchText, yearFromLivetrailUrl, harvestEventUrls,
  candidatesToRows, rankEventUrls,
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
