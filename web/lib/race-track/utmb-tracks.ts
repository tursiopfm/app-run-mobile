import 'server-only'

const FETCH_TIMEOUT_MS = 10_000
const MAX_BYTES = 8_000_000

// {event}.utmb.world/.../races/{code} → {event}.utmb.world/race/tracks
export function deriveTracksUrl(raceUrl: string): string | null {
  try {
    const u = new URL(raceUrl)
    if (!u.hostname.endsWith('.utmb.world')) return null
    return `${u.origin}/race/tracks`
  } catch {
    return null
  }
}

// Extrait les liens GPX Cloudinary + leur distance (km) lue dans le nom de fichier
// ({DIST}_{K|M}_...). K = kilomètres, M = miles → km.
export function extractGpxCandidates(html: string): { url: string; km: number }[] {
  const urls = Array.from(
    html.matchAll(/https:\/\/res\.cloudinary\.com\/[^\s"'<>)]+?\.gpx/gi),
    (m) => m[0],
  )
  const seen = new Set<string>()
  const out: { url: string; km: number }[] = []
  for (const url of urls) {
    if (seen.has(url)) continue
    seen.add(url)
    const file = decodeURIComponent(url.split('/').pop() ?? '')
    const m = /(\d+)_([KM])_/i.exec(file)
    if (!m) continue
    const n = parseInt(m[1], 10)
    const km = m[2].toUpperCase() === 'M' ? n * 1.60934 : n
    out.push({ url, km })
  }
  return out
}

// Choisit le GPX dont la distance est la plus proche de l'officielle, à ≤ 15%.
export function selectGpxUrl(html: string, officialKm: number): string | null {
  const cands = extractGpxCandidates(html)
  if (cands.length === 0 || !(officialKm > 0)) return null
  let best: { url: string; km: number } | null = null
  let bestErr = Infinity
  for (const c of cands) {
    const err = Math.abs(c.km - officialKm) / officialKm
    if (err < bestErr) { bestErr = err; best = c }
  }
  return best && bestErr <= 0.15 ? best.url : null
}

export async function fetchGpxFromUrl(url: string): Promise<string | null> {
  try {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'TrailCockpitBot/1.0' } })
    clearTimeout(timer)
    if (!res.ok) return null
    const text = await res.text()
    return text.length > MAX_BYTES ? null : text
  } catch {
    return null
  }
}

// Orchestrateur fail-soft : URL course UTMB + distance → texte GPX, ou null.
export async function fetchUtmbTrackGpx(raceUrl: string, officialKm: number): Promise<string | null> {
  const tracksUrl = deriveTracksUrl(raceUrl)
  if (!tracksUrl) return null
  const html = await fetchGpxFromUrl(tracksUrl)
  if (!html) return null
  const gpxUrl = selectGpxUrl(html, officialKm)
  if (!gpxUrl) return null
  return fetchGpxFromUrl(gpxUrl)
}
