// web/lib/garmin-import/unzip.ts
import { unzipSync, strFromU8 } from 'fflate'
import type { GarminSummaryActivity } from './types'

const SUMMARY_RE = /DI-Connect-Fitness\/.*summarizedActivities.*\.json$/i

/** Déballe le contenu d'un fichier summarizedActivities (wrapper variable). */
function parseSummaryJson(text: string): GarminSummaryActivity[] {
  let json: unknown
  try { json = JSON.parse(text) } catch { return [] }
  // Formes connues : [{ summarizedActivitiesExport: [...] }] | [...] | { summarizedActivitiesExport: [...] }
  if (Array.isArray(json)) {
    if (json.length && typeof json[0] === 'object' && json[0] != null && 'summarizedActivitiesExport' in (json[0] as object)) {
      return (json as { summarizedActivitiesExport?: GarminSummaryActivity[] }[])
        .flatMap(w => w.summarizedActivitiesExport ?? [])
    }
    return json as GarminSummaryActivity[]
  }
  if (json && typeof json === 'object' && 'summarizedActivitiesExport' in json) {
    return (json as { summarizedActivitiesExport?: GarminSummaryActivity[] }).summarizedActivitiesExport ?? []
  }
  return []
}

/**
 * Extrait toutes les activités résumées du ZIP Garmin.
 * Le filtre de unzipSync ne décompresse QUE les fichiers summarized (les
 * UploadedFiles_*.zip volumineux ne sont jamais décompressés en Phase 1).
 */
export function extractSummaries(zip: Uint8Array): GarminSummaryActivity[] {
  const out: GarminSummaryActivity[] = []
  const files = unzipSync(zip, { filter: (f) => SUMMARY_RE.test(f.name) })
  for (const name of Object.keys(files)) {
    out.push(...parseSummaryJson(strFromU8(files[name])))
  }
  return out
}
