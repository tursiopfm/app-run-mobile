// web/__tests__/lib/garmin-import/commit.test.ts
import { commitGarminImport } from '@/lib/garmin-import/commit'
import type { GarminMapped, ConflictItem } from '@/lib/garmin-import/types'

function fakeSupabase() {
  const calls: { table: string; op: string; rows: unknown }[] = []
  const api = {
    from(table: string) {
      return {
        upsert(rows: unknown) {
          calls.push({ table, op: 'upsert', rows })
          return { select: () => ({ data: asRows(rows), error: null }) , data: null, error: null }
        },
        update(rows: unknown) {
          return { eq: () => { calls.push({ table, op: 'update', rows }); return { error: null } } }
        },
      }
    },
  }
  function asRows(rows: unknown) {
    const arr = Array.isArray(rows) ? rows : [rows]
    return arr.map((r, i) => ({ id: `db-${i}`, provider_activity_id: (r as { provider_activity_id: string }).provider_activity_id }))
  }
  return { api, calls }
}

const g = (id: string): GarminMapped => ({
  normalized: {
    userId: 'u', provider: 'garmin', providerActivityId: id, sportType: 'running', name: 'n',
    startTime: '2024-01-01T08:00:00.000Z', durationSec: 3600, movingTimeSec: 3600, distanceM: 10000,
    elevationGainM: 100, avgHr: 150, maxHr: 170, avgPower: null, calories: null,
    externalTrainingLoad: null, rawPayload: {},
  },
  elevationLossM: 120,
})

test('insère les nouvelles + leurs métriques CES', async () => {
  const { api, calls } = fakeSupabase()
  const report = await commitGarminImport(api as never, 'u', { nouvelles: [g('1')], conflits: [] }, {})
  expect(report.imported).toBe(1)
  expect(calls.some(c => c.table === 'activities' && c.op === 'upsert')).toBe(true)
  expect(calls.some(c => c.table === 'activity_metrics' && c.op === 'upsert')).toBe(true)
})

test("remplacement : soft-delete de l'existant + insert Garmin", async () => {
  const { api, calls } = fakeSupabase()
  const conflit: ConflictItem = {
    garmin: g('2'),
    existing: { id: 'strava-row', provider: 'strava', providerActivityId: 's', startTime: '2024-01-01T08:00:00.000Z', movingTimeSec: 3600, durationSec: 3600, distanceM: 10000, avgHr: 150, elevationGainM: 100 },
    decision: 'replace_garmin',
  }
  const report = await commitGarminImport(api as never, 'u', { nouvelles: [], conflits: [conflit] }, {})
  expect(report.conflictsReplaced).toBe(1)
  // soft-delete = update deleted_at sur activities
  expect(calls.some(c => c.table === 'activities' && c.op === 'update')).toBe(true)
})

test('keep_strava : aucune écriture pour le conflit', async () => {
  const { api, calls } = fakeSupabase()
  const conflit: ConflictItem = {
    garmin: g('3'),
    existing: { id: 'x', provider: 'strava', providerActivityId: 's', startTime: '2024-01-01T08:00:00.000Z', movingTimeSec: 3600, durationSec: 3600, distanceM: 10000, avgHr: 150, elevationGainM: 100 },
    decision: 'keep_strava',
  }
  const report = await commitGarminImport(api as never, 'u', { nouvelles: [], conflits: [conflit] }, {})
  expect(report.conflictsKeptStrava).toBe(1)
  expect(calls).toHaveLength(0)
})
