// Catalogue LiveTrail : index léger (nom→événement) pour résoudre une course sans OpenAI,
// + accumulation passive, recherche et snapshot. AUCUN waypoint stocké (re-fetch frais).
import 'server-only'
import { createServiceClient } from '@/lib/database/supabase-server'
import type { RaceCandidate, RaceTarget } from './find-race'
import { listLivetrailRaces } from './sources/livetrail'
import type { ExtractedRaceData } from '@/types/plan'

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

// ── Couche DB (service role) ──

const SEARCH_TOP_K = 5

// Accumulation passive : upsert des candidats LiveTrail résolus. Best-effort.
export async function accumulateCatalog(candidates: RaceCandidate[]): Promise<void> {
  const rows = candidatesToRows(candidates)
  if (rows.length === 0) return
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('livetrail_catalog')
    .upsert(rows, { onConflict: 'platform,event_slug,course_name,edition_year' })
  if (error) console.warn('[catalog] upsert error:', error.message)
}

// Recherche catalogue : tokens du nom → ILIKE → URLs d'événement classées (sans OpenAI).
export async function searchCatalogUrls(target: RaceTarget): Promise<string[]> {
  // Tokens alphanumériques (évite toute injection dans le filtre PostgREST .or()).
  const tokens = normalizeSearchText(target.name)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3)
  if (tokens.length === 0) return []

  const supabase = createServiceClient()
  const orFilter = tokens.map((t) => `search_text.ilike.%${t}%`).join(',')
  const { data, error } = await supabase
    .from('livetrail_catalog')
    .select('source_url, total_km, total_dplus')
    .eq('platform', 'livetrail')
    .or(orFilter)
    .limit(100)
  if (error || !data) return []
  return rankEventUrls(target, data as CatalogMatch[]).slice(0, SEARCH_TOP_K)
}

const SNAPSHOT_MAX_EVENTS = 30
const SNAPSHOT_UA = 'TrailCockpitBot/1.0 (+https://trailcockpit.run)'
const SNAPSHOT_DELAY_MS = 300 // throttle poli entre événements (host externe sans robots.txt)

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// Événement (raceName + waypoints) → candidats LiveTrail réutilisables par accumulateCatalog.
function racesToCandidates(
  url: string,
  races: Array<{ raceName: string | null; data: ExtractedRaceData }>,
): RaceCandidate[] {
  const out: RaceCandidate[] = []
  for (const r of races) {
    const wps = r.data.waypoints
    if (wps.length === 0) continue
    const last = wps[wps.length - 1]
    out.push({
      url, parserId: 'livetrail', raceName: r.raceName,
      totalKm: last.km, totalDplus: last.dPlus, nbPoints: wps.length,
      waypoints: wps, confident: false,
    })
  }
  return out
}

// Snapshot glissant : lit /fr/events, énumère les événements à venir et upsert le catalogue.
// Séquentiel + cap (poli). User-Agent identifiable. Best-effort par événement.
export async function runCatalogSnapshot(): Promise<{ events: number; upserted: number }> {
  const res = await fetch('https://web.livetrail.net/fr/events', {
    headers: { 'User-Agent': SNAPSHOT_UA },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} sur /fr/events`)
  const html = await res.text()
  const eventUrls = harvestEventUrls(html).slice(0, SNAPSHOT_MAX_EVENTS)

  let upserted = 0
  for (let i = 0; i < eventUrls.length; i++) {
    if (i > 0) await sleep(SNAPSHOT_DELAY_MS) // throttle entre événements
    try {
      const races = await listLivetrailRaces(eventUrls[i])
      const candidates = racesToCandidates(eventUrls[i], races)
      await accumulateCatalog(candidates)
      upserted += candidates.length
    } catch {
      /* événement injoignable → ignoré */
    }
  }
  return { events: eventUrls.length, upserted }
}
