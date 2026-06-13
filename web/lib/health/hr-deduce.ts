export type DeducedHrValues = {
  maxHrObserved:      number | null
  restingHrEstimated: number | null
  lthrEstimated:      number | null
  computedAt:         string
}

export type ActivityForDeduce = {
  max_hr:          number | null
  moving_time_sec: number
}

export type StravaAthleteData = {
  resting_heart_rate?: number | null
} | null

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p))
  return sorted[idx]
}

// FC max physiologiquement plausible : écarte les artefacts capteur (ex. 251 bpm).
const isPlausibleMaxHr = (v: number | null | undefined): v is number =>
  v != null && v > 0 && v <= 230

export function deduceFromActivities(
  activities: ActivityForDeduce[],
  athleteData: StravaAthleteData,
  restingHrFromHistory: number | null = null,
): DeducedHrValues {
  const maxHrs = activities
    .map(a => a.max_hr)
    .filter(isPlausibleMaxHr)

  const maxHrObserved = maxHrs.length > 0 ? Math.max(...maxHrs) : null

  // Champ Strava (rarement renseigné) en priorité, sinon déduit de l'historique.
  const restingHrEstimated = athleteData?.resting_heart_rate ?? restingHrFromHistory ?? null

  const longRunsMaxHr = activities
    .filter(a => a.moving_time_sec >= 1800 && isPlausibleMaxHr(a.max_hr))
    .map(a => a.max_hr as number)
    .sort((a, b) => a - b)

  const lthrEstimated = percentile(longRunsMaxHr, 0.90)

  return {
    maxHrObserved,
    restingHrEstimated,
    lthrEstimated,
    computedAt: new Date().toISOString(),
  }
}
