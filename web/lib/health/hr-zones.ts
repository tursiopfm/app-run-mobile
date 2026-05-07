export type HrZoneMethod = 'seuils' | 'test30' | 'karvonen' | 'pct_max' | 'auto' | 'custom'

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
  confidence: 'Excellente' | 'Très bien' | 'Bien' | 'Correcte' | 'Approximative' | 'Personnalisée' | null
  maxHrUsed:  number | null
  missing:    string[]
}

const ZONE_NAMES  = ['Récupération', 'Endurance active', 'Tempo / vallonné', 'Seuil', 'VO₂max / intensif']
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

function pctRanges(base: number, pcts: [number, number | null][], maxHr: number): [number | null, number][] {
  return pcts.map(([lo, hi], i) => [
    i === 0 && lo === 0 ? null : Math.round(base * lo),
    hi == null ? maxHr : Math.round(base * hi),
  ])
}

export function calculateHrZones(params: {
  method:              HrZoneMethod
  maxHr?:              number | null
  restingHr?:          number | null
  aerobicThresholdHr?: number | null
  thresholdHr?:        number | null
  birthYear?:          number | null
}): HrZoneResult {
  const { method, maxHr, restingHr, aerobicThresholdHr, thresholdHr, birthYear } = params
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
      return {
        zones: makeZones(pctRanges(lthr, [[0, 0.85], [0.85, 0.89], [0.90, 0.94], [0.95, 0.99], [1.0, null]], max)),
        method, confidence: 'Très bien', maxHrUsed: max, missing,
      }
    }
    case 'karvonen': {
      const max  = need(maxHr, 'FC max')
      const rest = need(restingHr, 'FC repos')
      if (!max || !rest) return { zones: [], method, confidence: 'Bien', maxHrUsed: max ?? null, missing }
      const reserve = max - rest
      const t = (pct: number) => Math.round(rest + pct * reserve)
      return {
        zones: makeZones([
          [null,    t(0.60)],
          [t(0.60), t(0.70)],
          [t(0.70), t(0.80)],
          [t(0.80), t(0.90)],
          [t(0.90), max],
        ]),
        method, confidence: 'Bien', maxHrUsed: max, missing,
      }
    }
    case 'pct_max': {
      const max = need(maxHr, 'FC max')
      if (!max) return { zones: [], method, confidence: 'Correcte', maxHrUsed: null, missing }
      return {
        zones: makeZones(pctRanges(max, [[0, 0.72], [0.72, 0.78], [0.78, 0.85], [0.85, 0.92], [0.92, null]], max)),
        method, confidence: 'Correcte', maxHrUsed: max, missing,
      }
    }
    case 'auto': {
      const by = need(birthYear, 'Année de naissance')
      if (!by) return { zones: [], method, confidence: 'Approximative', maxHrUsed: null, missing }
      const age = new Date().getFullYear() - by
      const estMax = Math.round(208 - 0.7 * age)
      return {
        zones: makeZones(pctRanges(estMax, [[0, 0.72], [0.72, 0.78], [0.78, 0.85], [0.85, 0.92], [0.92, null]], estMax)),
        method, confidence: 'Approximative', maxHrUsed: estMax, missing,
      }
    }
    default:
      return { zones: [], method, confidence: 'Personnalisée', maxHrUsed: null, missing }
  }
}
