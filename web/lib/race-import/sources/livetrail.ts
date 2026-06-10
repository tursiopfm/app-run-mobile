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

type RawPt = {
  '@_n'?: string
  '@_km'?: string | number
  '@_d'?: string | number
  '@_b'?: string
}

type RawPoints = {
  '@_course'?: string
  pt?: RawPt | RawPt[]
}

type RawDoc = {
  d?: {
    points?: RawPoints | RawPoints[]
  }
}

function mapXmlToExtracted(
  xml: string,
  raceId: string,
): ExtractedRaceData {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
    trimValues: true,
  })
  const doc = parser.parse(xml) as RawDoc

  const pointsBlocks = doc?.d?.points
  if (!pointsBlocks) {
    throw new LivetrailError('XML sans bloc <points>')
  }
  const blocks = Array.isArray(pointsBlocks) ? pointsBlocks : [pointsBlocks]
  const block = blocks.find((b) => b['@_course'] === raceId)
  if (!block) {
    throw new LivetrailError(`Bloc <points course="${raceId}"> introuvable`)
  }

  // Garde-fou : fast-xml-parser collapse en objet si un seul <pt>.
  const ptsRaw = block.pt
  if (!ptsRaw) {
    throw new LivetrailError(`Aucun point de passage pour la course ${raceId}`)
  }
  const pts: RawPt[] = Array.isArray(ptsRaw) ? ptsRaw : [ptsRaw]

  const waypoints = pts.map((p, idx) => {
    const rawCutoff = p['@_b']
    const cutoffRaw = rawCutoff && rawCutoff.length > 0 ? rawCutoff : null
    const km = p['@_km'] !== undefined ? Number(p['@_km']) : 0
    const dPlusRaw = p['@_d']
    const dPlus =
      dPlusRaw !== undefined && dPlusRaw !== ''
        ? parseInt(String(dPlusRaw), 10)
        : null
    // type sera réécrit par validateExtractedRaceData pour depart/arrivee.
    const type: WaypointType = idx === 0 ? 'depart' : 'ravito'
    return {
      orderIndex: idx,
      name: (p['@_n'] ?? '').trim(),
      km,
      kmInter: null,
      dPlus,
      dMoins: null,
      cutoffRaw,
      cutoffKind: cutoffRaw === null ? null : ('clock_time' as const),
      type,
      supplies: [],
      targetOverrideSec: null,
    }
  })

  // validate : réindexe order_index, force depart/arrivee, trie par km, vérifie strict croissant.
  return validateExtractedRaceData({
    raceName: null,
    editionYear: null,
    waypoints,
  })
}

export const livetrailParser: RaceParser = {
  id: 'livetrail',

  match(url: string): boolean {
    const u = url.toLowerCase()
    return (
      u.includes('livetrail.net') ||
      u.includes('v3.livetrail.net') ||
      u.includes('livetrail.run')
    )
  },

  async parse(url: string): Promise<ExtractedRaceData> {
    const { slug, raceId } = extractSlugAndRaceId(url)
    const xml = await fetchParcoursXml(slug, raceId)
    return mapXmlToExtracted(xml, raceId)
  },
}

registerParser(livetrailParser)
