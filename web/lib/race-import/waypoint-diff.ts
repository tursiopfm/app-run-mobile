// Diff waypoint-par-waypoint entre deux versions d'un tableau. Pur, sans IO.
import type { RaceWaypoint, WaypointDiff, WaypointModified, WaypointFieldChange } from '@/types/plan'

type WP = Omit<RaceWaypoint, 'id' | 'raceId'>

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function suppliesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort(); const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

function fieldChanges(o: WP, n: WP): WaypointFieldChange[] {
  const changes: WaypointFieldChange[] = []
  if (o.km !== n.km) changes.push({ field: 'km', from: o.km, to: n.km })
  if (o.dPlus !== n.dPlus) changes.push({ field: 'dPlus', from: o.dPlus, to: n.dPlus })
  if (o.dMoins !== n.dMoins) changes.push({ field: 'dMoins', from: o.dMoins, to: n.dMoins })
  if (o.cutoffRaw !== n.cutoffRaw) changes.push({ field: 'cutoffRaw', from: o.cutoffRaw, to: n.cutoffRaw })
  if (!suppliesEqual(o.supplies, n.supplies)) changes.push({ field: 'supplies', from: o.supplies, to: n.supplies })
  return changes
}

export function diffWaypoints(oldWps: WP[], newWps: WP[]): WaypointDiff {
  const newRemaining = newWps.map((w, i) => ({ w, i, used: false }))
  const modified: WaypointModified[] = []
  const removed: WP[] = []

  const findMatch = (o: WP) => {
    // Priorité 1 : correspondance par nom normalisé (insensible accents/casse)
    let m = newRemaining.find((c) => !c.used && norm(c.w.name) === norm(o.name))
    if (!m) {
      // Priorité 2 : fallback km ± 1
      let best: typeof newRemaining[number] | undefined
      let bestD = Infinity
      for (const c of newRemaining) {
        if (c.used) continue
        const d = Math.abs(c.w.km - o.km)
        if (d <= 1 && d < bestD) { best = c; bestD = d }
      }
      m = best
    }
    return m
  }

  for (const o of oldWps) {
    const m = findMatch(o)
    if (!m) { removed.push(o); continue }
    m.used = true
    const changes = fieldChanges(o, m.w)
    if (changes.length > 0) modified.push({ name: o.name, changes })
  }

  const added = newRemaining.filter((c) => !c.used).map((c) => c.w)
  return { added, removed, modified }
}
