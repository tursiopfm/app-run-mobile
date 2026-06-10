/// <reference lib="webworker" />
import { decodeFitToStreams } from '@/lib/garmin-import/fit-decode'

const ctx = self as unknown as DedicatedWorkerGlobalScope

ctx.onmessage = (e: MessageEvent<{ id: string; bytes: ArrayBuffer }>) => {
  const { id, bytes } = e.data
  try {
    const { streams, startTimeMs, isActivity } = decodeFitToStreams(new Uint8Array(bytes))
    ctx.postMessage({ id, streams, startTimeMs, isActivity, pointCount: streams.time?.length ?? 0 })
  } catch (err) {
    ctx.postMessage({ id, error: err instanceof Error ? err.message : 'decode error' })
  }
}
