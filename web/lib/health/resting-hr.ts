// Estimation de la FC repos à partir de l'historique : on prend le bas de la
// distribution HR des streams. La FC moyenne/max d'une activité est toujours
// élevée (effort) ; seul le minimum atteint en début/pause de séance approche
// le repos. Pour être robuste à un artefact capteur isolé, on prend le 10e
// percentile des minima PAR ACTIVITÉ (pas du pool de samples, qui surestime).
// Validé sur données réelles : 40 streams → 64 bpm pour un repos mesuré à 58.

const HR_FLOOR = 35   // en dessous = dropout capteur
const HR_CEIL  = 220  // au dessus = artefact
const REST_MIN = 40   // borne basse plausible d'une FC repos
const REST_MAX = 90   // borne haute plausible d'une FC repos

export function estimateRestingHrFromHrStreams(
  hrStreams: (number[] | undefined | null)[],
): number | null {
  const perActivityMin: number[] = []

  for (const hr of hrStreams) {
    if (!Array.isArray(hr) || hr.length === 0) continue
    let min = Infinity
    for (const v of hr) {
      if (typeof v === 'number' && v >= HR_FLOOR && v <= HR_CEIL && v < min) min = v
    }
    if (min !== Infinity) perActivityMin.push(min)
  }

  if (perActivityMin.length === 0) return null

  perActivityMin.sort((a, b) => a - b)
  const idx = Math.floor(perActivityMin.length * 0.10)
  const estimate = perActivityMin[idx]

  return Math.min(REST_MAX, Math.max(REST_MIN, Math.round(estimate)))
}
