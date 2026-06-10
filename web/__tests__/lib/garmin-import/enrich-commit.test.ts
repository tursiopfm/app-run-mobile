// web/__tests__/lib/garmin-import/enrich-commit.test.ts
import { writeStreamRows, mergeMapAndSplits } from '@/lib/garmin-import/enrich-commit'
import type { StreamUpload } from '@/lib/garmin-import/enrich-types'
import type { StravaSplit } from '@/lib/activities/detail'

function fakeSupabase() {
  const calls: { table: string; rows: unknown }[] = []
  return {
    calls,
    api: { from(table: string) { return { upsert(rows: unknown) { calls.push({ table, rows }); return { error: null } } } } },
  }
}

test('writeStreamRows upsert activity_streams avec source garmin', async () => {
  const { api, calls } = fakeSupabase()
  const uploads: StreamUpload[] = [
    { activityId: 'a1', streamsGz: 'GZ1', pointCount: 42 },
    { activityId: 'a2', streamsGz: 'GZ2', pointCount: 7 },
  ]
  const n = await writeStreamRows(api as never, 'user-1', uploads)
  expect(n).toBe(2)
  expect(calls).toHaveLength(1)
  expect(calls[0].table).toBe('activity_streams')
  const rows = calls[0].rows as Array<Record<string, unknown>>
  expect(rows[0]).toMatchObject({ activity_id: 'a1', user_id: 'user-1', source: 'garmin', point_count: 42, streams_gz: 'GZ1', downsample_s: 5 })
})

test('writeStreamRows : liste vide → 0, aucun appel', async () => {
  const { api, calls } = fakeSupabase()
  const n = await writeStreamRows(api as never, 'user-1', [])
  expect(n).toBe(0)
  expect(calls).toHaveLength(0)
})

test('writeStreamRows : dédupe par activity_id en gardant le plus riche (évite ON CONFLICT double)', async () => {
  const { api, calls } = fakeSupabase()
  const uploads: StreamUpload[] = [
    { activityId: 'a1', streamsGz: 'LOW', pointCount: 10 },
    { activityId: 'a1', streamsGz: 'HIGH', pointCount: 99 },
    { activityId: 'a2', streamsGz: 'X', pointCount: 5 },
  ]
  const n = await writeStreamRows(api as never, 'u', uploads)
  expect(n).toBe(2)
  const rows = calls[0].rows as Array<Record<string, unknown>>
  expect(rows).toHaveLength(2)
  const a1 = rows.find(r => r.activity_id === 'a1')!
  expect(a1.streams_gz).toBe('HIGH')
  expect(a1.point_count).toBe(99)
})

function fakeSupabaseMerge(existing: Record<string, Record<string, unknown>>) {
  const updates: { id: string; raw: Record<string, unknown> }[] = []
  const api = {
    from() {
      return {
        select() {
          return {
            in(_c: string, ids: string[]) {
              return {
                eq() {
                  return { data: ids.map(id => ({ id, raw_payload: existing[id] ?? {} })), error: null }
                },
              }
            },
          }
        },
        update(row: { raw_payload: Record<string, unknown> }) {
          return {
            eq(_c: string, id: string) {
              return { eq() { updates.push({ id, raw: row.raw_payload }); return { error: null } } }
            },
          }
        },
      }
    },
  }
  return { api, updates }
}

test('mergeMapAndSplits : merge map.summary_polyline + splits_metric en préservant raw_payload', async () => {
  const { api, updates } = fakeSupabaseMerge({ a1: { source: 'garmin_gdpr', summary: { x: 1 } } })
  const uploads: StreamUpload[] = [
    { activityId: 'a1', streamsGz: 'GZ', pointCount: 10, summaryPolyline: 'ENC', splits: [{ split: 1 } as StravaSplit] },
  ]
  const n = await mergeMapAndSplits(api as never, 'u', uploads)
  expect(n).toBe(1)
  expect(updates).toHaveLength(1)
  const raw = updates[0].raw as { source: string; summary: unknown; map: { summary_polyline: string }; splits_metric: unknown[] }
  expect(raw.source).toBe('garmin_gdpr')          // préservé
  expect(raw.summary).toEqual({ x: 1 })            // préservé
  expect(raw.map.summary_polyline).toBe('ENC')
  expect(raw.splits_metric).toHaveLength(1)
})

test('mergeMapAndSplits : uploads sans carte/splits → 0, aucune écriture', async () => {
  const { api, updates } = fakeSupabaseMerge({})
  const n = await mergeMapAndSplits(api as never, 'u', [{ activityId: 'a1', streamsGz: 'GZ', pointCount: 10 }])
  expect(n).toBe(0)
  expect(updates).toHaveLength(0)
})
