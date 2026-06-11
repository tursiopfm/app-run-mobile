// Décisions PURES du re-check (sans IO/server-only) : cadence + construction du diff.
import type { ExtractedRaceData, PendingDiff, RaceWaypoint } from '@/types/plan'
import { computeFreshness } from './freshness'
import { diffWaypoints } from './waypoint-diff'

type WP = Omit<RaceWaypoint, 'id' | 'raceId'>

// Cadence resserrée : approxime J-30/J-14/J-3 avec pour seul état source_checked_at.
export function isDueForRecheck(
  daysUntilRace: number,
  lastCheckedAtISO: string | null,
  nowISO: string,
): boolean {
  if (daysUntilRace < 0) return false
  let minStaleDays: number
  if (daysUntilRace <= 3) minStaleDays = 1
  else if (daysUntilRace <= 14) minStaleDays = 7
  else if (daysUntilRace <= 30) minStaleDays = 14
  else return false
  if (lastCheckedAtISO == null) return true
  const ageDays = (Date.parse(nowISO) - Date.parse(lastCheckedAtISO)) / 86400000
  return ageDays > minStaleDays
}

export interface BuildPendingDiffParams {
  oldWaypoints: WP[]
  newData: ExtractedRaceData
  newHash: string
  meta: { source_hash: string | null; edition_year: number | null; freshness_status: string }
  raceDateISO: string
  nowISO: string
}

// Compare la nouvelle source à la meta stockée → PendingDiff ou null (aucun changement).
export function buildPendingDiff(p: BuildPendingDiffParams): PendingDiff | null {
  const newFresh = computeFreshness(
    {
      editionYear: p.newData.editionYear,
      editionDate: p.newData.editionDate,
      dateExplicit: p.newData.dateExplicit,
      startDayOfMonth: p.newData.startDayOfMonth,
    },
    p.raceDateISO,
  )

  const isNewEdition =
    p.meta.freshness_status === 'provisional_previous_edition' &&
    (newFresh.freshnessStatus === 'confirmed' ||
      (newFresh.editionYear != null && p.meta.edition_year != null && newFresh.editionYear > p.meta.edition_year))
  const isChanged = p.newHash !== p.meta.source_hash

  if (!isNewEdition && !isChanged) return null

  const diff = diffWaypoints(p.oldWaypoints, p.newData.waypoints)
  return {
    kind: isNewEdition ? 'new_edition' : 'changed',
    detectedAt: p.nowISO,
    newWaypoints: p.newData.waypoints,
    newMeta: {
      editionYear: newFresh.editionYear,
      editionDate: newFresh.editionDate,
      dateExplicit: p.newData.dateExplicit,
      freshnessStatus: newFresh.freshnessStatus,
      sourceHash: p.newHash,
    },
    summary: {
      added: diff.added.length,
      removed: diff.removed.length,
      modified: diff.modified.length,
      modifiedDetails: diff.modified,
    },
  }
}
