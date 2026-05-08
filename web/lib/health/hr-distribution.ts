import type { HrZone } from './hr-zones'

export type HeartRateZoneDistributionResult = {
  source:     'hr_stream' | 'laps' | 'avg_max_estimate' | 'none'
  confidence: 'high' | 'medium' | 'low' | 'none'
  zones: {
    zone:      1 | 2 | 3 | 4 | 5
    seconds:   number
    percent:   number
    estimated: boolean
  }[]
  warnings: string[]
}

function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x))
  const p = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  const r = 1 - p * Math.exp(-x * x)
  return x >= 0 ? r : -r
}

function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}

export function estimateHrZoneDistribution(params: {
  avgHr:       number | null | undefined
  maxHr:       number | null | undefined
  durationSec: number
  zones:       HrZone[]
}): HeartRateZoneDistributionResult {
  const { avgHr, maxHr, durationSec, zones } = params

  if (!avgHr || !maxHr || zones.length === 0) {
    return {
      source:     'none',
      confidence: 'none',
      zones:      [],
      warnings:   ['Pas de données FC disponibles.'],
    }
  }

  const sigma = Math.max((maxHr - avgHr) / 2, 1)

  const raw = zones.map(z => {
    const lo = z.min ?? 0
    const hi = z.max
    const p  = normalCdf((hi - avgHr) / sigma) - normalCdf((lo - avgHr) / sigma)
    return Math.max(p, 0)
  })

  const total = raw.reduce((a, b) => a + b, 0)
  const percents = raw.map(p => (total > 0 ? p / total : 1 / zones.length))

  // Distribute seconds; last zone absorbs rounding residue
  let remaining = durationSec
  const zoneSeconds = percents.map((pct, i) => {
    if (i === percents.length - 1) return remaining
    const s = Math.round(durationSec * pct)
    remaining -= s
    return s
  })

  return {
    source:     'avg_max_estimate',
    confidence: 'low',
    zones: zones.map((z, i) => ({
      zone:      z.zone as 1 | 2 | 3 | 4 | 5,
      seconds:   zoneSeconds[i],
      percent:   Math.round(percents[i] * 100),
      estimated: true,
    })),
    warnings: [
      'Temps en zones estimé à partir de la FC moyenne et FC max activité. Fiabilité faible.',
      'Ne pas utiliser pour des décisions fortes de coaching.',
    ],
  }
}
