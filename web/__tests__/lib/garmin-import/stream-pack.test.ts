import { gunzipSync, strFromU8 } from 'fflate'
import { packStreamsClient } from '@/lib/garmin-import/stream-pack'

function b64ToBytes(b64: string): Uint8Array {
  // Node + jsdom both expose Buffer in the jest environment
  return new Uint8Array(Buffer.from(b64, 'base64'))
}

test('packStreamsClient → base64(gzip(JSON)) relisible', () => {
  const s = { time: [0, 5, 10], heartrate: [120, 130, 140], altitude: [100, 101, 102] }
  const b64 = packStreamsClient(s)
  expect(typeof b64).toBe('string')
  const round = JSON.parse(strFromU8(gunzipSync(b64ToBytes(b64))))
  expect(round).toEqual(s)
})

test('empty StreamSet packs and round-trips', () => {
  const b64 = packStreamsClient({})
  const round = JSON.parse(strFromU8(gunzipSync(b64ToBytes(b64))))
  expect(round).toEqual({})
})
