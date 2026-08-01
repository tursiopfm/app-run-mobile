// Géocodage d'adresses via la Base Adresse Nationale (BAN) — gratuit, sans clé,
// CORS ouvert, appelé côté client (comme le reverse-geocode BigDataCloud du
// rapport matinal). Si la BAN migre (data.geopf.fr/geocodage), seule cette
// constante change.

export type AddressHit = { label: string; lat: number; lng: number }

const BAN_SEARCH_URL = 'https://api-adresse.data.gouv.fr/search/'

/** Parse une réponse GeoJSON BAN. ⚠️ `coordinates` est en ordre [lng, lat]. */
export function parseBanResponse(json: unknown): AddressHit[] {
  const features = (json as { features?: unknown } | null)?.features
  if (!Array.isArray(features)) return []
  const hits: AddressHit[] = []
  for (const f of features) {
    const feature = f as {
      properties?: { label?: unknown }
      geometry?: { coordinates?: unknown }
    }
    const label = feature?.properties?.label
    const coords = feature?.geometry?.coordinates
    if (typeof label !== 'string' || !Array.isArray(coords) || coords.length < 2) continue
    const lng = coords[0]
    const lat = coords[1]
    if (typeof lat !== 'number' || typeof lng !== 'number') continue
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    hits.push({ label, lat, lng })
  }
  return hits
}

/** Recherche d'adresse. Réponse non-ok ou erreur réseau → []. */
export async function searchAddress(q: string): Promise<AddressHit[]> {
  try {
    const res = await fetch(`${BAN_SEARCH_URL}?q=${encodeURIComponent(q)}&limit=5`)
    if (!res.ok) return []
    return parseBanResponse(await res.json())
  } catch {
    return []
  }
}
