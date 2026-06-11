// Catalogue LiveTrail : index léger (nom→événement) pour résoudre une course sans OpenAI,
// + accumulation passive, recherche et snapshot. AUCUN waypoint stocké (re-fetch frais).
// (Les imports createServiceClient / listLivetrailRaces sont ajoutés en Task 3 / Task 6,
//  quand les fonctions qui les utilisent sont écrites — évite les imports inutilisés.)
import 'server-only'
import type { RaceCandidate, RaceTarget } from './find-race'

// ── Helpers purs ──

// Minuscule + sans accent, pour les ILIKE.
export function normalizeSearchText(s: string): string {
  // Diacritiques combinants U+0300–U+036F (séparés par NFD).
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// Année depuis une URL LiveTrail v3 (/fr/2026/...). null sinon.
export function yearFromLivetrailUrl(url: string): number | null {
  const m = url.match(/\/((?:19|20)\d{2})(?:\/|$)/)
  return m ? Number(m[1]) : null
}

function slugFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.split('.')[0] || null
  } catch {
    return null
  }
}

// Liens d'événement LiveTrail dans un HTML. Exclut utmb.world (déjà couvert par utmbParser).
export function harvestEventUrls(html: string): string[] {
  const re = /https?:\/\/[a-z0-9-]+\.(?:v3\.)?livetrail\.(?:net|run)[^\s"'<>)]*/gi
  const out: string[] = []
  const seen = new Set<string>()
  for (const m of Array.from(html.matchAll(re))) {
    const u = m[0]
    if (seen.has(u)) continue
    seen.add(u)
    out.push(u)
  }
  return out
}

export interface CatalogRow {
  platform: string
  event_slug: string
  event_name: string | null
  course_name: string | null
  edition_year: number | null
  total_km: number | null
  total_dplus: number | null
  source_url: string
  search_text: string
  last_seen_at: string
}

// Candidats résolus → lignes catalogue (pur, testable sans DB). Ne garde que LiveTrail.
export function candidatesToRows(candidates: RaceCandidate[]): CatalogRow[] {
  const now = new Date().toISOString()
  const rows: CatalogRow[] = []
  for (const c of candidates) {
    if (c.parserId !== 'livetrail') continue
    const slug = slugFromUrl(c.url)
    if (!slug) continue
    const courseName = c.raceName
    rows.push({
      platform: 'livetrail',
      event_slug: slug,
      event_name: null,
      course_name: courseName,
      edition_year: yearFromLivetrailUrl(c.url),
      total_km: c.totalKm,
      total_dplus: c.totalDplus,
      source_url: c.url,
      search_text: normalizeSearchText([courseName ?? '', slug].join(' ')),
      last_seen_at: now,
    })
  }
  return rows
}

export interface CatalogMatch {
  source_url: string
  total_km: number | null
  total_dplus: number | null
}

// Classe les lignes matchées par proximité distance/D+, renvoie les source_url DISTINCTS.
export function rankEventUrls(target: RaceTarget, rows: CatalogMatch[]): string[] {
  const scored = rows.map((r) => {
    const errKm = Math.abs((r.total_km ?? 0) - target.distance) / Math.max(target.distance, 1)
    const errD =
      target.elevation > 0 && r.total_dplus != null
        ? Math.abs(r.total_dplus - target.elevation) / target.elevation
        : 0.5
    return { url: r.source_url, score: errKm + errD }
  })
  scored.sort((a, b) => a.score - b.score)
  const out: string[] = []
  const seen = new Set<string>()
  for (const s of scored) {
    if (seen.has(s.url)) continue
    seen.add(s.url)
    out.push(s.url)
  }
  return out
}
