// Parser LiveTrail : contourne le SPA v3 (HTML non-extractible) en interrogeant
// l'API XML legacy /parcours.php?course={raceId}.
// Domaines reconnus : livetrail.net, v3.livetrail.net, livetrail.run.
import 'server-only'
import { XMLParser } from 'fast-xml-parser'
import type { ExtractedRaceData, WaypointType } from '@/types/plan'
import { validateExtractedRaceData } from '../schema'
import { type RaceParser, registerParser } from './index'

const FETCH_TIMEOUT_MS = 10_000
const MAX_BYTES = 2_000_000

export class LivetrailError extends Error {}

// Extraction slug (sous-domaine) + raceId depuis URL collée.
// Formats supportés :
//   - https://{slug}.v3.livetrail.net/fr/2026/races/{raceId}
//   - https://{slug}.livetrail.net/parcours.php?course={raceId}
//   - https://{slug}.livetrail.run/parcours.php?course={raceId}
export function extractSlugAndRaceId(
  rawUrl: string,
): { slug: string; raceId: string } {
  let u: URL
  try {
    u = new URL(rawUrl)
  } catch {
    throw new LivetrailError(`URL invalide : ${rawUrl}`)
  }

  // Slug = premier segment du hostname.
  const slug = u.hostname.split('.')[0]
  if (!slug) {
    throw new LivetrailError(`Slug introuvable dans hostname : ${u.hostname}`)
  }

  // raceId : query param "course" en priorité, sinon segment "/races/{id}".
  const fromQuery = u.searchParams.get('course')
  if (fromQuery) return { slug, raceId: fromQuery }

  const match = u.pathname.match(/\/races\/([^/?#]+)/)
  if (match) return { slug, raceId: match[1] }

  throw new LivetrailError(
    `raceId introuvable dans l'URL (ni ?course= ni /races/{id}) : ${rawUrl}`,
  )
}

async function fetchXml(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'TrailCockpitBot/1.0' },
    })
    if (!res.ok) {
      throw new LivetrailError(`HTTP ${res.status} sur ${url}`)
    }
    const text = await res.text()
    if (text.length > MAX_BYTES) {
      throw new LivetrailError('Réponse XML > 2 Mo')
    }
    return text
  } finally {
    clearTimeout(timer)
  }
}

// Tente .livetrail.run d'abord (endpoint XML stable), retry sur .livetrail.net
// en cas d'échec (réseau ou non-200).
async function fetchParcoursXml(slug: string, raceId: string): Promise<string> {
  const param = encodeURIComponent(raceId)
  const runUrl = `https://${slug}.livetrail.run/parcours.php?course=${param}`
  try {
    return await fetchXml(runUrl)
  } catch {
    const netUrl = `https://${slug}.livetrail.net/parcours.php?course=${param}`
    return await fetchXml(netUrl)
  }
}

// Fetch toutes les courses d'un événement (slug) — parcours.php renvoie tous les
// blocs quel que soit le param. Vérifié : sans param = avec param = tous les blocs.
async function fetchParcoursXmlBySlug(slug: string): Promise<string> {
  const runUrl = `https://${slug}.livetrail.run/parcours.php`
  try {
    return await fetchXml(runUrl)
  } catch {
    return await fetchXml(`https://${slug}.livetrail.net/parcours.php`)
  }
}

// "DD-HH:MM" (format hp/hd LiveTrail) → jour-du-mois + heure de départ.
export function parseLivetrailStart(
  hp: string | undefined,
): { day: number; time: string } | null {
  if (!hp) return null
  const m = /^(\d{1,2})-(\d{2}:\d{2})$/.exec(hp.trim())
  if (!m) return null
  const day = Number(m[1])
  if (day < 1 || day > 31) return null
  return { day, time: m[2] }
}

// Année d'édition depuis le path d'une URL LiveTrail v3 (/fr/2026/...). null sinon.
// cf. catalog.ts yearFromLivetrailUrl — dupliqué ici pour éviter un cycle d'import livetrail↔catalog.
export function extractYearFromLivetrailUrl(url: string): number | null {
  let path: string
  try { path = new URL(url).pathname } catch { return null }
  const m = path.match(/\/((?:19|20)\d{2})(?:\/|$)/)
  return m ? Number(m[1]) : null
}

type RawPt = {
  '@_n'?: string
  '@_km'?: string | number
  '@_d'?: string | number
  '@_a'?: string | number
  '@_b'?: string
  '@_hp'?: string
}

type RawPoints = {
  '@_course'?: string
  pt?: RawPt | RawPt[]
}

type RawCourse = { '@_id'?: string; '@_n'?: string }

type RawDoc = {
  d?: {
    courses?: { c?: RawCourse | RawCourse[] }
    points?: RawPoints | RawPoints[]
  }
}

function parseXml(xml: string): RawDoc {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
    trimValues: true,
  })
  return parser.parse(xml) as RawDoc
}

// Un bloc <points course="X"> → ExtractedRaceData (waypoints + validate).
function mapPointsBlock(block: RawPoints): ExtractedRaceData {
  const ptsRaw = block.pt
  if (!ptsRaw) {
    throw new LivetrailError('Aucun point de passage dans le bloc <points>')
  }
  const pts: RawPt[] = Array.isArray(ptsRaw) ? ptsRaw : [ptsRaw]

  const num = (v: string | number | undefined): number | null =>
    v !== undefined && v !== '' ? Number(v) : null

  // D- dérivé de l'altitude (le XML n'expose pas de D-).
  const departAltitude = num(pts[0]?.['@_a'])

  const waypoints = pts.map((p, idx) => {
    const rawCutoff = p['@_b']
    const cutoffRaw = rawCutoff && rawCutoff.length > 0 ? rawCutoff : null
    const km = p['@_km'] !== undefined ? Number(p['@_km']) : 0
    const dPlusRaw = p['@_d']
    const dPlus =
      dPlusRaw !== undefined && dPlusRaw !== ''
        ? parseInt(String(dPlusRaw), 10)
        : null
    const altitude = num(p['@_a'])
    const dMoins =
      dPlus !== null && altitude !== null && departAltitude !== null
        ? Math.max(0, Math.round(dPlus - (altitude - departAltitude)))
        : null
    const type: WaypointType = idx === 0 ? 'depart' : 'ravito'
    return {
      orderIndex: idx,
      name: (p['@_n'] ?? '').trim(),
      km,
      kmInter: null,
      dPlus,
      dMoins,
      altitude,
      cutoffRaw,
      cutoffKind: cutoffRaw === null ? null : ('clock_time' as const),
      type,
      supplies: [],
      targetOverrideSec: null,
    }
  })

  const start = parseLivetrailStart(pts[0]?.['@_hp'])
  return validateExtractedRaceData({ raceName: null, editionYear: null, editionDate: null, dateExplicit: false, startDayOfMonth: start?.day ?? null, startTimeRaw: start?.time ?? null, waypoints })
}

function mapXmlToExtracted(xml: string, raceId: string): ExtractedRaceData {
  const doc = parseXml(xml)
  const pointsBlocks = doc?.d?.points
  if (!pointsBlocks) {
    throw new LivetrailError('XML sans bloc <points>')
  }
  const blocks = Array.isArray(pointsBlocks) ? pointsBlocks : [pointsBlocks]
  const block = blocks.find((b) => b['@_course'] === raceId)
  if (!block) {
    throw new LivetrailError(`Bloc <points course="${raceId}"> introuvable`)
  }
  return mapPointsBlock(block)
}

// Depuis n'importe quelle URL LiveTrail (même page événement) : renvoie TOUTES les
// courses de l'événement avec leur nom (depuis <courses><c n>). Le classement par
// distance/D+ (côté find-race) choisit la bonne.
export async function listLivetrailRaces(
  url: string,
): Promise<Array<{ raceName: string | null; data: ExtractedRaceData }>> {
  let slug: string
  try {
    slug = new URL(url).hostname.split('.')[0]
  } catch {
    throw new LivetrailError(`URL invalide : ${url}`)
  }
  if (!slug) throw new LivetrailError(`Slug introuvable : ${url}`)

  const xml = await fetchParcoursXmlBySlug(slug)
  const doc = parseXml(xml)

  const coursesRaw = doc?.d?.courses?.c
  const courses: RawCourse[] = coursesRaw
    ? (Array.isArray(coursesRaw) ? coursesRaw : [coursesRaw])
    : []
  const nameById = new Map<string, string>()
  for (const c of courses) {
    if (c['@_id']) nameById.set(c['@_id'], (c['@_n'] ?? '').trim())
  }

  const pointsBlocks = doc?.d?.points
  if (!pointsBlocks) throw new LivetrailError('XML sans bloc <points>')
  const blocks = Array.isArray(pointsBlocks) ? pointsBlocks : [pointsBlocks]

  const year = extractYearFromLivetrailUrl(url)
  const out: Array<{ raceName: string | null; data: ExtractedRaceData }> = []
  for (const block of blocks) {
    try {
      const data = mapPointsBlock(block)
      const id = block['@_course']
      out.push({ raceName: (id ? nameById.get(id) : undefined) ?? null, data: { ...data, editionYear: year, dateExplicit: year != null } })
    } catch {
      // bloc invalide (course sans points exploitables) → on l'ignore
    }
  }
  return out
}

export const livetrailParser: RaceParser = {
  id: 'livetrail',

  match(url: string): boolean {
    try {
      const h = new URL(url).hostname
      return h.endsWith('.livetrail.net') || h.endsWith('.livetrail.run')
    } catch {
      return false
    }
  },

  async parse(url: string): Promise<ExtractedRaceData> {
    const { slug, raceId } = extractSlugAndRaceId(url)
    const xml = await fetchParcoursXml(slug, raceId)
    const data = mapXmlToExtracted(xml, raceId)
    const year = extractYearFromLivetrailUrl(url)
    return { ...data, editionYear: year, dateExplicit: year != null }
  },
}

registerParser(livetrailParser)
