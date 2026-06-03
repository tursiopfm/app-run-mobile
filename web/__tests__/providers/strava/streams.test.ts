import { downsampleStreams, packStreams, unpackStreams } from '@/lib/providers/strava/streams'

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
