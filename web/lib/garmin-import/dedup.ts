// web/lib/garmin-import/dedup.ts
import type { NormalizedActivity } from '@/lib/providers/strava/mapper'
import type { ExistingActivity, GarminMapped, DedupClassification } from './types'

const START_TOLERANCE_MS = 120_000
const PCT_TOLERANCE = 0.01

function within(a: number, b: number, pct: number): boolean {
  const ref = Math.max(Math.abs(a), Math.abs(b))
  if (ref === 0) return true
  return Math.abs(a - b) / ref <= pct
}

export function matchesExisting(g: NormalizedActivity, e: ExistingActivity): boolean {
  const dt = Math.abs(new Date(g.startTime).getTime() - new Date(e.startTime).getTime())
  if (dt > START_TOLERANCE_MS) return false
  if (!within(g.movingTimeSec, e.movingTimeSec, PCT_TOLERANCE)) return false
  if (!within(g.distanceM, e.distanceM, PCT_TOLERANCE)) return false
  return true
}

export function classifyActivities(
  garmin: GarminMapped[],
  existing: ExistingActivity[],
): DedupClassification {
  // Index par jour pour éviter O(n*m) sur de gros historiques.
  const byDay = new Map<string, ExistingActivity[]>()
  for (const e of existing) {
    const day = e.startTime.slice(0, 10)
    const arr = byDay.get(day) ?? []
    arr.push(e)
    byDay.set(day, arr)
  }
  const candidates = (g: NormalizedActivity): ExistingActivity[] => {
    const d = new Date(g.startTime)
    const days = [d, new Date(d.getTime() - 86_400_000), new Date(d.getTime() + 86_400_000)]
      .map(x => x.toISOString().slice(0, 10))
    return days.flatMap(day => byDay.get(day) ?? [])
  }

  const nouvelles: GarminMapped[] = []
  const conflits: DedupClassification['conflits'] = []
  for (const g of garmin) {
    const hit = candidates(g.normalized).find(e => matchesExisting(g.normalized, e))
    if (hit) conflits.push({ garmin: g, existing: hit, decision: 'keep_strava' })
    else nouvelles.push(g)
  }
  return { nouvelles, conflits }
}
