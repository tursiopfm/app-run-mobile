// Logique pure de détection des trajets domicile-travail (Runtaf / Vélotaf).
// Aucune dépendance DB/réseau — 100% testable.

export type LatLng = [number, number]

export type CommuteRoute = {
  id: string
  userId: string
  sportType: string
  label: string
  refDistanceM: number
  distanceTolPct: number
  homeLat: number | null
  homeLng: number | null
  officeLat: number | null
  officeLng: number | null
  geoTolM: number
  outboundTitle: string
  returnTitle: string
  hourSplit: number
  active: boolean
}

export type CommuteDirection = 'outbound' | 'return'

export type CommuteGeo = {
  distanceM: number | null
  start: LatLng | null
  end: LatLng | null
  localHour: number | null
}

export type CommuteMatch = {
  route: CommuteRoute
  direction: CommuteDirection
}

function asLatLng(value: unknown): LatLng | null {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  ) {
    return [value[0], value[1]]
  }
  return null
}

/** Lit défensivement la géoloc/heure depuis le raw_payload Strava. */
export function extractCommuteGeo(rawPayload: unknown): CommuteGeo {
  const p = (rawPayload ?? {}) as Record<string, unknown>

  const distanceM =
    typeof p.distance === 'number' && Number.isFinite(p.distance) ? p.distance : null

  const start = asLatLng(p.start_latlng)
  const end = asLatLng(p.end_latlng)

  // start_date_local ex "2026-05-28T07:45:00Z" → heure aux positions 11-13
  let localHour: number | null = null
  if (typeof p.start_date_local === 'string' && p.start_date_local.length >= 13) {
    const h = parseInt(p.start_date_local.slice(11, 13), 10)
    localHour = Number.isFinite(h) ? h : null
  }

  return { distanceM, start, end, localHour }
}

/** Distance haversine en mètres (R = 6371000). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Détecte si une activité correspond à un trajet domicile-travail et dans quel sens.
 * Direction : géoloc d'abord, heure en secours.
 */
export function matchCommute(
  input: { sportType: string; geo: CommuteGeo },
  routes: CommuteRoute[],
): CommuteMatch | null {
  for (const route of routes) {
    if (!route.active) continue
    if (route.sportType.toLowerCase() !== input.sportType.toLowerCase()) continue

    const { geo } = input
    // Distance requise et dans la tolérance
    if (geo.distanceM == null) continue
    const tol = (route.refDistanceM * route.distanceTolPct) / 100
    if (Math.abs(geo.distanceM - route.refDistanceM) > tol) continue

    const direction = resolveDirection(geo, route)
    if (direction == null) continue

    return { route, direction }
  }
  return null
}

function resolveDirection(geo: CommuteGeo, route: CommuteRoute): CommuteDirection | null {
  const routeHasGeo =
    route.homeLat != null &&
    route.homeLng != null &&
    route.officeLat != null &&
    route.officeLng != null

  // Route avec Home/Office (cas standard) : géo strict, pas de fallback heure si géo non concluante
  // (sinon n'importe quelle activité de la bonne distance et bon créneau horaire est classée trajet).
  if (routeHasGeo) {
    if (geo.start == null) return null
    const dHome = haversineMeters(geo.start, [route.homeLat!, route.homeLng!])
    const dOffice = haversineMeters(geo.start, [route.officeLat!, route.officeLng!])
    if (dHome <= route.geoTolM && dHome <= dOffice) return 'outbound'
    if (dOffice <= route.geoTolM) return 'return'
    return null
  }

  // Route sans Home/Office (cas dégénéré, ne devrait pas arriver via l'UI) : fallback heure pur.
  if (geo.localHour != null) {
    return geo.localHour < route.hourSplit ? 'outbound' : 'return'
  }

  return null
}

/** Construit le titre incrémenté, ex `2026#21 🏠 Home🏃‍♂️➡️🏃Office 🏢`. */
export function buildCommuteTitle(
  route: CommuteRoute,
  direction: CommuteDirection,
  year: number,
  seq: number,
): string {
  return `${year}#${seq} ${direction === 'outbound' ? route.outboundTitle : route.returnTitle}`
}

/** Si `name` commence par `${year}#N`, retourne N, sinon null. */
export function parseCommuteSeq(name: string | null, year: number): number | null {
  if (!name) return null
  const m = name.match(new RegExp(`^${year}#(\\d+)`))
  return m ? parseInt(m[1], 10) : null
}
