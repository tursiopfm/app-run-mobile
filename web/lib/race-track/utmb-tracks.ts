import 'server-only'
import { lookup } from 'node:dns/promises'

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

/**
 * Returns true for IPv4/IPv6 addresses that are private, loopback, link-local,
 * CGNAT, or otherwise reserved — i.e. should never be reached from the internet.
 * Pure function, no I/O.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) → recurse on the v4 part
  const v4mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)
  if (v4mapped) return isPrivateOrReservedIp(v4mapped[1])

  // IPv4
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const parts = ip.split('.').map(Number)
    const [a, b] = parts
    if (a === 0) return true                           // 0.0.0.0/8
    if (a === 10) return true                          // 10.0.0.0/8
    if (a === 127) return true                         // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true            // 169.254.0.0/16 link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true  // 172.16.0.0/12
    if (a === 192 && b === 168) return true            // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 CGNAT
    return false
  }

  // IPv6 — normalise to lower-case for comparison
  const v6 = ip.toLowerCase()
  if (v6 === '::1') return true                       // loopback
  if (v6 === '::') return true                        // unspecified
  if (v6.startsWith('fe80')) return true              // fe80::/10 link-local
  // ULA fc00::/7 covers fc.. and fd..
  if (v6.startsWith('fc') || v6.startsWith('fd')) return true

  return false
}

export async function fetchGpxFromUrl(url: string): Promise<string | null> {
  try {
    // 1. Parse URL — reject malformed or non-https
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return null
    }
    if (parsed.protocol !== 'https:') return null

    // 2. Resolve hostname → IP and block private/reserved ranges
    let resolved: string
    try {
      const result = await lookup(parsed.hostname)
      resolved = result.address
    } catch {
      return null
    }
    if (isPrivateOrReservedIp(resolved)) return null

    // 3. Fetch with existing timeout + size cap
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
