import { gzipSync, strToU8 } from 'fflate'
import type { StreamSet } from '@/lib/activities/stream-metrics'

/** base64(gzip(JSON(streams))) — format interop avec unpackStreams (zlib) côté serveur. */
export function packStreamsClient(s: StreamSet): string {
  const gz = gzipSync(strToU8(JSON.stringify(s)))
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < gz.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(gz.subarray(i, i + CHUNK)) as unknown as number[])
  }
  return btoa(bin)
}
