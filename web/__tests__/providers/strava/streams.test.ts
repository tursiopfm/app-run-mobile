import { downsampleStreams, packStreams, unpackStreams, fetchStravaStreams } from '@/lib/providers/strava/streams'

describe('downsampleStreams', () => {
  it('garde ~1 point par fenêtre de 5 s + le dernier point', () => {
    const time = Array.from({ length: 11 }, (_, i) => i) // 0..10
    const ds = downsampleStreams({ time, altitude: time.map((t) => t * 2) }, 5)
    expect(ds.time).toEqual([0, 5, 10])
    expect(ds.altitude).toEqual([0, 10, 20])
  })
  it('renvoie tel quel si pas de time', () => {
    const s = { altitude: [1, 2, 3] }
    expect(downsampleStreams(s, 5)).toEqual(s)
  })
})

describe('pack/unpack', () => {
  it('round-trip gzip base64', () => {
    const s = { time: [0, 5, 10], altitude: [1, 2, 3], heartrate: [120, 130, 140] }
    const packed = packStreams(s)
    expect(typeof packed).toBe('string')
    expect(unpackStreams(packed)).toEqual(s)
  })
})

describe('fetchStravaStreams', () => {
  afterEach(() => { jest.restoreAllMocks() })

  it('mappe key_by_type → StreamSet', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        time: { data: [0, 1, 2] },
        altitude: { data: [10, 11, 12] },
        velocity_smooth: { data: [3, 3, 3] },
        grade_smooth: { data: [0, 5, 5] },
      }),
    }) as unknown as typeof fetch
    const s = await fetchStravaStreams('tok', 123)
    expect(s.time).toEqual([0, 1, 2])
    expect(s.velocity).toEqual([3, 3, 3])
    expect(s.grade).toEqual([0, 5, 5])
    expect(s.heartrate).toBeUndefined()
  })

  it('429 → erreur rateLimited', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 }) as unknown as typeof fetch
    await expect(fetchStravaStreams('tok', 1)).rejects.toMatchObject({ rateLimited: true })
  })

  it('404 → StreamSet vide (activité sans streams)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch
    expect(await fetchStravaStreams('tok', 1)).toEqual({})
  })
})
