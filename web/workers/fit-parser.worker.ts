/// <reference lib="webworker" />
import { decodeFitToStreams } from '@/lib/garmin-import/fit-decode'

const ctx = self as unknown as DedicatedWorkerGlobalScope

ctx.onmessage = (e: MessageEvent<{ id: string; bytes: ArrayBuffer }>) => {
  const { id, bytes } = e.data
  try {
    const { streams, startTimeMs } = decodeFitToStreams(new Uint8Array(bytes))
    ctx.postMessage({ id, streams, startTimeMs, pointCount: streams.time?.length ?? 0 })
  } catch (err) {
    ctx.postMessage({ id, error: err instanceof Error ? err.message : 'decode error' })
  }
}
