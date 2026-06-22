import { encodeProfile, decodeProfile, rowToRaceTrack, upsertRaceTrack } from '@/lib/race-track/storage'

describe('encode/decodeProfile', () => {
  it('round-trip gzip+base64 d\'un profil dense', () => {
    const profile = { d: [0, 1.5, 3], e: [1000, 1200, 1100] }
    const encoded = encodeProfile(profile)
    expect(typeof encoded).toBe('string')
    expect(decodeProfile(encoded)).toEqual(profile)
  })
})

describe('rowToRaceTrack', () => {
  it('décode une ligne DB en RaceTrack', () => {
    const profile = { d: [0, 2], e: [500, 700] }
    const row = {
      race_id: 'r1', profile_gz: encodeProfile(profile), point_count: 2,
      source: 'gpx_upload', distance_m: 2000, created_at: '2026-06-22T00:00:00Z',
    }
    expect(rowToRaceTrack(row)).toEqual({
      raceId: 'r1', profile, pointCount: 2, source: 'gpx_upload',
      distanceM: 2000, createdAt: '2026-06-22T00:00:00Z',
    })
  })
})

describe('upsertRaceTrack', () => {
  const capture = () => {
    const state: { row: any } = { row: null }
    const supabase = { from: () => ({ upsert: async (row: any) => { state.row = row; return { error: null } } }) }
    return { supabase, state }
  }

  // distance_m est une colonne integer en DB ; un float (distance GPX brute) y est
  // REJETÉ par Postgres ("invalid input syntax for type integer") → upsert lève → 422.
  it('arrondit distance_m à un entier avant l\'insert', async () => {
    const { supabase, state } = capture()
    await upsertRaceTrack(supabase, 'r1', {
      profile: { d: [0, 1], e: [10, 20] }, source: 'gpx_upload', distanceM: 144911.93,
    })
    expect(state.row.distance_m).toBe(144912)
    expect(Number.isInteger(state.row.distance_m)).toBe(true)
  })

  it('tolère distanceM null', async () => {
    const { supabase, state } = capture()
    await upsertRaceTrack(supabase, 'r1', {
      profile: { d: [0, 1], e: [10, 20] }, source: 'utmb_auto', distanceM: null,
    })
    expect(state.row.distance_m).toBeNull()
  })
})
