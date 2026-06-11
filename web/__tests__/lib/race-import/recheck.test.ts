jest.mock('@/lib/database/supabase-server', () => ({ createServiceClient: jest.fn() }))
jest.mock('@/lib/race-import/sources', () => ({ findParserForUrl: jest.fn() }))
jest.mock('@/lib/race-import/hash', () => ({ hashWaypoints: jest.fn(() => 'NEWHASH') }))

import { runFreshnessRecheck } from '@/lib/race-import/recheck'
import { createServiceClient } from '@/lib/database/supabase-server'
import { findParserForUrl } from '@/lib/race-import/sources'

const oldRow = (over: any = {}) => ({
  id: 'x', race_id: 'r1', order_index: 0, name: 'Départ', km: 0, km_inter: null,
  d_plus: 0, d_moins: 0, cutoff_raw: null, cutoff_kind: null, type: 'depart',
  supplies: [], target_override_sec: null, ...over,
})

function makeClient(metaRows: any[], oldRows: any[], capture: any[]) {
  return {
    from(table: string) {
      if (table === 'race_tableau_meta') {
        const q: any = {
          select: () => q, not: () => q, is: () => q,
          gte: () => Promise.resolve({ data: metaRows, error: null }),
          update: (patch: any) => ({ eq: (_c: string, id: string) => { capture.push({ id, patch }); return Promise.resolve({ error: null }) } }),
        }
        return q
      }
      const q2: any = { select: () => q2, eq: () => q2, order: () => Promise.resolve({ data: oldRows, error: null }) }
      return q2
    },
  }
}

const parseResult = (over: any = {}) => ({
  raceName: null, editionYear: 2026, editionDate: null, dateExplicit: false,
  startDayOfMonth: null, startTimeRaw: null,
  waypoints: [{ orderIndex: 0, name: 'Départ', km: 0, kmInter: null, dPlus: 0, dMoins: 0, cutoffRaw: null, cutoffKind: null, type: 'depart', supplies: [], targetOverrideSec: null }],
  ...over,
})
const farFuture = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10)

describe('runFreshnessRecheck', () => {
  afterEach(() => jest.restoreAllMocks())

  it('hash changé → update avec pending_diff', async () => {
    const capture: any[] = []
    ;(createServiceClient as jest.Mock).mockReturnValue(makeClient(
      [{ race_id: 'r1', source_url: 'https://x.livetrail.run/parcours.php?course=A', source_hash: 'OLD', edition_year: 2026, freshness_status: 'confirmed', source_checked_at: null, races: { date: farFuture } }],
      [oldRow()], capture,
    ))
    ;(findParserForUrl as jest.Mock).mockReturnValue({
      id: 'livetrail',
      parse: async () => parseResult({ waypoints: [{ orderIndex: 0, name: 'Départ', km: 0, kmInter: null, dPlus: 0, dMoins: 0, cutoffRaw: 'NEW', cutoffKind: 'clock_time', type: 'depart', supplies: [], targetOverrideSec: null }] }),
    })
    const res = await runFreshnessRecheck()
    expect(res.changed).toBe(1)
    expect(capture).toHaveLength(1)
    expect(capture[0].patch.pending_diff.kind).toBe('changed')
    expect(capture[0].patch.source_checked_at).toBeDefined()
  })

  it('hash identique → update source_checked_at SANS pending_diff', async () => {
    const capture: any[] = []
    ;(createServiceClient as jest.Mock).mockReturnValue(makeClient(
      [{ race_id: 'r1', source_url: 'https://x.livetrail.run/parcours.php?course=A', source_hash: 'NEWHASH', edition_year: 2026, freshness_status: 'confirmed', source_checked_at: null, races: { date: farFuture } }],
      [oldRow()], capture,
    ))
    ;(findParserForUrl as jest.Mock).mockReturnValue({ id: 'livetrail', parse: async () => parseResult() })
    const res = await runFreshnessRecheck()
    expect(res.changed).toBe(0)
    expect(capture[0].patch.pending_diff).toBeUndefined()
    expect(capture[0].patch.source_checked_at).toBeDefined()
  })

  it('source_url générique (parser absent) → exclu du tick, n\'occupe pas de slot', async () => {
    const capture: any[] = []
    ;(createServiceClient as jest.Mock).mockReturnValue(makeClient(
      [{ race_id: 'r1', source_url: 'https://site-officiel.fr/course', source_hash: 'OLD', edition_year: 2026, freshness_status: 'confirmed', source_checked_at: null, races: { date: farFuture } }],
      [oldRow()], capture,
    ))
    ;(findParserForUrl as jest.Mock).mockReturnValue(null)
    const res = await runFreshnessRecheck()
    expect(res.checked).toBe(0)
    expect(capture).toHaveLength(0)
  })
})
