// web/lib/garmin-import/types.ts
import type { NormalizedActivity } from '@/lib/providers/strava/mapper'

/** Activité brute telle que lue dans summarizedActivities.json (champs partiels, unités Garmin). */
export type GarminSummaryActivity = {
  activityId?: number
  activityType?: string | { typeKey?: string }
  beginTimestamp?: number      // epoch ms GMT
  startTimeLocal?: number       // epoch ms (heure locale)
  distance?: number             // centimètres
  duration?: number             // millisecondes (elapsed)
  movingDuration?: number       // millisecondes
  elevationGain?: number        // centimètres
  elevationLoss?: number        // centimètres
  avgHr?: number
  maxHr?: number
  avgSpeed?: number             // unité à valider empiriquement
  calories?: number
  activityName?: string
}

/** Résultat du mapping d'une activité, avec D− conservé pour le CES au commit. */
export type GarminMapped = {
  normalized: NormalizedActivity
  elevationLossM: number | null
}

export type MapWarning = { activityId: string; field: string; message: string }

/** Activité existante en base, projetée pour le matching de doublons. */
export type ExistingActivity = {
  id: string
  provider: string
  providerActivityId: string
  startTime: string            // ISO
  movingTimeSec: number
  durationSec: number
  distanceM: number
  avgHr: number | null
  elevationGainM: number | null
}

export type ConflictDecision = 'keep_strava' | 'replace_garmin'

export type ConflictItem = {
  garmin: GarminMapped
  existing: ExistingActivity
  decision: ConflictDecision   // défaut 'keep_strava'
}

export type DedupClassification = {
  nouvelles: GarminMapped[]
  conflits: ConflictItem[]
}

export type ImportReport = {
  totalParsed: number
  imported: number
  conflictsKeptStrava: number
  conflictsReplaced: number
  errors: number
  warnings: MapWarning[]
  periodStart: string | null
  periodEnd: string | null
}
