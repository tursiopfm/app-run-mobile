export type HrZoneMethod = 'seuils' | 'test30' | 'karvonen' | 'pct_max' | 'auto' | 'deduced' | 'custom'

export type HrZone = {
  zone:  number
  name:  string
  min:   number | null
  max:   number
  color: string
}

export type HrZoneResult = {
  zones:      HrZone[]
  method:     HrZoneMethod
  confidence: 'Excellente' | 'Très bien' | 'Bien' | 'Correcte' | 'Approximative' | 'Adaptative' | 'Personnalisée' | null
  maxHrUsed:  number | null
  missing:    string[]
}

const ZONE_NAMES  = ['Récupération', 'Endurance fondamentale', 'Endurance active', 'Seuil', 'Très intense']
const ZONE_COLORS = ['#4caf50', '#38bdf8', '#f59e0b', '#e8651a', '#ef4444']

function makeZones(ranges: [number | null, number][]): HrZone[] {
  return ranges.map(([min, max], i) => ({
    zone:  i + 1,
    name:  ZONE_NAMES[i],
    min,
    max,
    color: ZONE_COLORS[i],
  }))
}

/**
 * Builds zone ranges from an array of max values per zone.
 * min of zone N = max of zone N-1 + 1 (no overlap, no gap).
 */
function pctRanges(maxes: number[]): [number | null, number][] {
  return maxes.map((max, i) => [i === 0 ? null : maxes[i - 1] + 1, max])
}

export function hrZoneForAvgHr(avgHr: number, zones: HrZone[]): number | null {
  if (zones.length === 0) return null
  for (const z of zones) {
    if (avgHr <= z.max) return z.zone
  }
  return zones[zones.length - 1].zone
}

export type CustomZoneInput = { zone: number; min: number | null; max: number | null }

export function calculateHrZones(params: {
  method:              HrZoneMethod
  maxHr?:              number | null
  restingHr?:          number | null
  aerobicThresholdHr?: number | null
  thresholdHr?:        number | null
  birthYear?:          number | null
  customZones?:        CustomZoneInput[] | null
}): HrZoneResult {
  const { method, maxHr, restingHr, aerobicThresholdHr, thresholdHr, birthYear, customZones } = params
  const missing: string[] = []

  function need(val: number | null | undefined, key: string): number | null {
    if (val == null) { missing.push(key); return null }
    return val
  }

  switch (method) {
    case 'seuils': {
      const max = need(maxHr, 'FC max')
      const aet = need(aerobicThresholdHr, 'Seuil aérobie / AeT')
      const lthr = need(thresholdHr, 'Seuil anaérobie / LTHR')
      if (!max || !aet || !lthr) return { zones: [], method, confidence: 'Excellente', maxHrUsed: max, missing }
      return {
        zones: makeZones([
          [null,      aet - 11],
          [aet - 10,  aet],
          [aet + 1,   lthr - 8],
          [lthr - 7,  lthr + 3],
          [lthr + 4,  max],
        ]),
        method, confidence: 'Excellente', maxHrUsed: max, missing,
      }
    }
    case 'test30': {
      const max  = need(maxHr, 'FC max')
      const lthr = need(thresholdHr, 'Seuil anaérobie / LTHR')
      if (!max || !lthr) return { zones: [], method, confidence: 'Très bien', maxHrUsed: max ?? null, missing }
      const maxes = [0.85, 0.89, 0.94, 0.99].map(p => Math.round(lthr * p)).concat([max])
      return { zones: makeZones(pctRanges(maxes)), method, confidence: 'Très bien', maxHrUsed: max, missing }
    }
    case 'karvonen': {
      const max  = need(maxHr, 'FC max')
      const rest = need(restingHr, 'FC repos')
      if (!max || !rest) return { zones: [], method, confidence: 'Bien', maxHrUsed: max ?? null, missing }
      const reserve = max - rest
      const maxes = [0.60, 0.70, 0.80, 0.90].map(p => Math.round(rest + p * reserve)).concat([max])
      return { zones: makeZones(pctRanges(maxes)), method, confidence: 'Bien', maxHrUsed: max, missing }
    }
    case 'pct_max': {
      const max = need(maxHr, 'FC max')
      if (!max) return { zones: [], method, confidence: 'Correcte', maxHrUsed: null, missing }
      const maxes = [0.72, 0.78, 0.85, 0.92].map(p => Math.round(max * p)).concat([max])
      return { zones: makeZones(pctRanges(maxes)), method, confidence: 'Correcte', maxHrUsed: max, missing }
    }
    case 'auto': {
      const by = need(birthYear, 'Année de naissance')
      if (!by) return { zones: [], method, confidence: 'Approximative', maxHrUsed: null, missing }
      const age = new Date().getFullYear() - by
      const estMax = Math.round(208 - 0.7 * age)
      const maxes = [0.72, 0.78, 0.85, 0.92].map(p => Math.round(estMax * p)).concat([estMax])
      return { zones: makeZones(pctRanges(maxes)), method, confidence: 'Approximative', maxHrUsed: estMax, missing }
    }
    case 'deduced': {
      const max  = need(maxHr, 'FC max observée')
      const rest = need(restingHr, 'FC repos estimée')
      if (!max || !rest) return { zones: [], method, confidence: 'Adaptative', maxHrUsed: max ?? null, missing }
      const reserve = max - rest
      const maxes = [0.60, 0.70, 0.80, 0.90].map(p => Math.round(rest + p * reserve)).concat([max])
      return { zones: makeZones(pctRanges(maxes)), method, confidence: 'Adaptative', maxHrUsed: max, missing }
    }
    case 'custom': {
      if (!customZones || customZones.length !== 5) {
        missing.push('5 zones Z1–Z5')
        return { zones: [], method, confidence: 'Personnalisée', maxHrUsed: null, missing }
      }
      const incomplete = customZones.some(z => z.max == null || (z.zone !== 1 && z.min == null))
      if (incomplete) {
        missing.push('valeurs Z1–Z5')
        return { zones: [], method, confidence: 'Personnalisée', maxHrUsed: null, missing }
      }
      const zones: HrZone[] = customZones.map((z, i) => ({
        zone:  z.zone,
        name:  ZONE_NAMES[i],
        min:   z.min,
        max:   z.max as number,
        color: ZONE_COLORS[i],
      }))
      return { zones, method, confidence: 'Personnalisée', maxHrUsed: zones[4].max, missing }
    }
  }
}

export type HrZoneRecommendation = {
  mode:          HrZoneMethod
  confidence:    'high' | 'good' | 'medium' | 'low' | 'very_low' | null
  canCompute:    boolean
  missingFields: string[]
}

export function getRecommendedHeartRateZoneMode(profile: {
  max_hr?:               number | null
  aerobic_threshold_hr?: number | null
  threshold_hr?:         number | null
  resting_hr?:           number | null
  birth_year?:           number | null
}): HrZoneRecommendation {
  const { max_hr, aerobic_threshold_hr, threshold_hr, resting_hr, birth_year } = profile

  if (max_hr && aerobic_threshold_hr && threshold_hr)
    return { mode: 'seuils',   confidence: 'high',     canCompute: true,  missingFields: [] }
  if (max_hr && threshold_hr)
    return { mode: 'test30',   confidence: 'good',     canCompute: true,  missingFields: [] }
  if (max_hr && resting_hr)
    return { mode: 'karvonen', confidence: 'medium',   canCompute: true,  missingFields: [] }
  if (max_hr)
    return { mode: 'pct_max',  confidence: 'low',      canCompute: true,  missingFields: [] }
  if (birth_year)
    return { mode: 'auto',     confidence: 'very_low', canCompute: true,  missingFields: ['FC max'] }

  return { mode: 'pct_max', confidence: null, canCompute: false, missingFields: ['FC max'] }
}
