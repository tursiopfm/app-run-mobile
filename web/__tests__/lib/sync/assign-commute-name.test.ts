import { assignCommuteName } from '@/lib/sync/assign-commute-name'
import type { CommuteRoute } from '@/lib/activities/commute'

const route: CommuteRoute = {
  id: 'r1', userId: 'u1', sportType: 'Run', label: 'Runtaf',
  refDistanceM: 9500, distanceTolPct: 15,
  homeLat: 48.7273, homeLng: 2.2702, officeLat: 48.8016, officeLng: 2.2950,
  geoTolM: 250, outboundTitle: 'H→O', returnTitle: 'O→H', hourSplit: 12, active: true,
}

function fakeSupabase(linked: unknown[], numbered: unknown[]) {
  const updates: Record<string, unknown>[] = []
  return {
    updates,
    from: () => {
      let isUpdate = false
      let isNumbered = false
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        gte: () => chain,
        lt: () => chain,
        is: () => chain,
        ilike: () => { isNumbered = true; return chain },
        update: (u: Record<string, unknown>) => { isUpdate = true; updates.push(u); return chain },
        then: (res: (v: unknown) => void) =>
          res(isUpdate ? { error: null } : { data: isNumbered ? numbered : linked, error: null }),
      }
      return chain
    },
  }
}

it('ignore les activités liées à la route mais renommées (seq périmé)', async () => {
  const linked = [
    { id: 'a28', name: '2026#28 O→H', start_time: '2026-11-05T17:58:00Z', commute_seq: 28, commute_route_id: 'r1' },
    // boucle classée TAF à tort puis renommée : seq 32 périmé
    { id: 'loop', name: 'Footing le long de la Bièvre', start_time: '2026-07-22T11:53:00Z', commute_seq: 32, commute_route_id: 'r1' },
  ]
  const sb = fakeSupabase(linked, [linked[0]])
  const res = await assignCommuteName({
    supabase: sb,
    userId: 'u1',
    routes: [route],
    activity: {
      id: 'new', providerActivityId: '1', sportType: 'Run', name: 'Course à pied le matin',
      startTime: '2026-11-12T07:50:00Z',
      rawPayload: { start_latlng: [48.7273, 2.2702], end_latlng: [48.8016, 2.2950] },
    },
  })
  expect(res).toEqual({ matched: true, renamed: true, seq: 29 })
  expect(sb.updates[0].name).toBe('2026#29 H→O')
})
