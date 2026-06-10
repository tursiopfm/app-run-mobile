// web/__tests__/lib/garmin-import/enrich-commit.test.ts
import { writeStreamRows } from '@/lib/garmin-import/enrich-commit'
import type { StreamUpload } from '@/lib/garmin-import/enrich-types'

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
