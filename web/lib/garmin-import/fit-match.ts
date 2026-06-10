import type { FitMeta, EnrichCandidate } from './enrich-types'

const TOL_MS = 120_000

export type ActivityIndex = {
  byActivityId: Map<string, EnrichCandidate>
  byTime: { ms: number; c: EnrichCandidate }[]
}

export function buildActivityIndex(cands: EnrichCandidate[]): ActivityIndex {
  const byActivityId = new Map<string, EnrichCandidate>()
  const byTime: { ms: number; c: EnrichCandidate }[] = []
  for (const c of cands) {
    if (c.provider === 'garmin') byActivityId.set(c.providerActivityId, c)
    byTime.push({ ms: new Date(c.startTime).getTime(), c })
  }
  byTime.sort((a, b) => a.ms - b.ms)
  return { byActivityId, byTime }
}

export function matchFit(meta: FitMeta, idx: ActivityIndex): EnrichCandidate | null {
  if (meta.activityId && idx.byActivityId.has(meta.activityId)) return idx.byActivityId.get(meta.activityId)!
  if (meta.startTimeMs == null) return null
  let best: EnrichCandidate | null = null
  let bestDiff = TOL_MS + 1
  for (const e of idx.byTime) {
    const d = Math.abs(e.ms - meta.startTimeMs)
    if (d <= TOL_MS && d < bestDiff) { best = e.c; bestDiff = d }
  }
  return best
}
