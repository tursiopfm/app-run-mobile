import type { StreamSet } from '@/lib/activities/stream-metrics'

export type FitResult = {
  id: string
  streams?: StreamSet
  startTimeMs?: number | null
  pointCount?: number
  isActivity?: boolean
  error?: string
}

type Job = { id: string; bytes: ArrayBuffer; resolve: (r: FitResult) => void }

export type FitPool = {
  decode: (id: string, bytes: ArrayBuffer) => Promise<FitResult>
  terminate: () => void
}

/** Pool de Web Workers décodant des FIT en parallèle (concurrence bornée). */
export function createFitPool(): FitPool {
  const hw = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 2) : 2
  const size = Math.max(1, Math.min(hw - 1, 4))
  const workers: Worker[] = []
  const idle: Worker[] = []
  const queue: Job[] = []
  const pending = new Map<string, (r: FitResult) => void>()

  function pump() {
    while (idle.length && queue.length) {
      const w = idle.pop()!
      const job = queue.shift()!
      pending.set(job.id, job.resolve)
      // Transferable : l'ArrayBuffer est transféré (zéro-copie) au worker.
      w.postMessage({ id: job.id, bytes: job.bytes }, [job.bytes])
    }
  }

  for (let i = 0; i < size; i++) {
    const w = new Worker(new URL('../../workers/fit-parser.worker.ts', import.meta.url))
    w.onmessage = (e: MessageEvent<FitResult>) => {
      const res = e.data
      const resolve = pending.get(res.id)
      pending.delete(res.id)
      idle.push(w)
      resolve?.(res)
      pump()
    }
    w.onerror = () => {
      // En cas d'erreur worker non capturée, libérer le worker pour ne pas bloquer la file.
      idle.push(w)
      pump()
    }
    workers.push(w)
    idle.push(w)
  }

  function decode(id: string, bytes: ArrayBuffer): Promise<FitResult> {
    return new Promise<FitResult>((resolve) => {
      queue.push({ id, bytes, resolve })
      pump()
    })
  }

  function terminate() {
    for (const w of workers) w.terminate()
    workers.length = 0
    idle.length = 0
    queue.length = 0
    pending.clear()
  }

  return { decode, terminate }
}
