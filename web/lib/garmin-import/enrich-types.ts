import type { StreamSet } from '@/lib/activities/stream-metrics'
import type { StravaSplit } from '@/lib/activities/detail'

/** Métadonnées légères d'un FIT (peek file_id) pour le matching avant décodage complet. */
export type FitMeta = { startTimeMs: number | null; activityId: string | null }

/** Résultat de décodage complet d'un FIT. `isActivity` distingue les vrais fichiers
 * d'activité (file_id.type='activity') des fichiers de monitoring quotidien (pas/FC/sommeil),
 * très nombreux dans un export et à NE PAS matcher (sinon faux match → stream/carte corrompus). */
export type FitDecoded = FitMeta & { streams: StreamSet; isActivity: boolean }

/** Activité à enrichir (sans streams), projetée pour le matching. */
export type EnrichCandidate = {
  id: string
  provider: string
  providerActivityId: string
  startTime: string
}

/** Un stream prêt à écrire pour une activité, + carte/splits dérivés du FIT (optionnels). */
export type StreamUpload = {
  activityId: string
  streamsGz: string
  pointCount: number
  summaryPolyline?: string      // → raw_payload.map.summary_polyline (carte)
  splits?: StravaSplit[]        // → raw_payload.splits_metric (splits/km)
}

export type EnrichReport = { enriched: number; matched: number; skipped: number; errors: number }
