// JSON Schema pour OpenAI Structured Outputs + validateur métier + conversion.
import type {
  ExtractedRaceData,
  CutoffKind,
  WaypointType,
  RaceWaypoint,
} from '@/types/plan'

// ── JSON Schema pour response_format: { type: 'json_schema', json_schema: ... } ──
export const RACE_EXTRACTION_JSON_SCHEMA = {
  name: 'race_roadbook_extraction',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      race_name: { type: ['string', 'null'] },
      edition_year: { type: ['number', 'null'] },
      waypoints: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            order_index: { type: 'number' },
            name: { type: 'string' },
            km: { type: 'number' },
            km_inter: { type: ['number', 'null'] },
            d_plus: { type: ['number', 'null'] },
            d_moins: { type: ['number', 'null'] },
            cutoff_raw: { type: ['string', 'null'] },
            cutoff_kind: {
              type: 'string',
              enum: ['clock_time', 'elapsed', 'unknown'],
            },
            type: {
              type: 'string',
              enum: ['depart', 'ravito', 'pointage', 'arrivee', 'autre'],
            },
          },
          required: [
            'order_index', 'name', 'km', 'km_inter', 'd_plus', 'd_moins',
            'cutoff_raw', 'cutoff_kind', 'type',
          ],
        },
      },
    },
    required: ['race_name', 'edition_year', 'waypoints'],
  },
} as const

type RawWaypoint = {
  order_index: number
  name: string
  km: number
  km_inter: number | null
  d_plus: number | null
  d_moins: number | null
  cutoff_raw: string | null
  cutoff_kind: 'clock_time' | 'elapsed' | 'unknown'
  type: WaypointType
}

type RawExtraction = {
  race_name: string | null
  edition_year: number | null
  waypoints: RawWaypoint[]
}

// ── Conversion snake_case (LLM) → camelCase (TS) ──
export function rawToExtractedRaceData(raw: RawExtraction): ExtractedRaceData {
  return {
    raceName: raw.race_name,
    editionYear: raw.edition_year,
    waypoints: raw.waypoints.map((w) => ({
      orderIndex: w.order_index,
      name: w.name,
      km: w.km,
      kmInter: w.km_inter,
      dPlus: w.d_plus,
      dMoins: w.d_moins,
      cutoffRaw: w.cutoff_raw,
      // Si pas de cutoff brut, le kind n'a pas de sens — on nullifie.
      cutoffKind: w.cutoff_raw === null ? null : (w.cutoff_kind as CutoffKind),
      type: w.type,
    })),
  }
}

// ── Validation métier + normalisation (réindexation, fix depart/arrivee) ──
export class ValidationError extends Error {}

export function validateExtractedRaceData(
  data: ExtractedRaceData,
): ExtractedRaceData {
  const wps = [...data.waypoints]

  // Cas vide → on accepte.
  if (wps.length === 0) return data

  // Tri par km croissant (sécurité, le LLM peut se tromper).
  wps.sort((a, b) => a.km - b.km)

  // 1) km strictement croissants.
  for (let i = 1; i < wps.length; i++) {
    if (wps[i].km <= wps[i - 1].km) {
      throw new ValidationError(
        `km doivent être strictement croissants (waypoint ${i} : km=${wps[i].km} <= km=${wps[i - 1].km} précédent)`,
      )
    }
  }

  // 2) Non-négativité.
  for (const w of wps) {
    if (w.kmInter !== null && w.kmInter < 0) {
      throw new ValidationError(`km_inter négatif sur "${w.name}"`)
    }
    if (w.dPlus !== null && w.dPlus < 0) {
      throw new ValidationError(`d_plus négatif sur "${w.name}"`)
    }
    if (w.dMoins !== null && w.dMoins < 0) {
      throw new ValidationError(`d_moins négatif sur "${w.name}"`)
    }
  }

  // 3) depart/arrivee forcés aux extrémités.
  wps[0] = { ...wps[0], type: 'depart' }
  wps[wps.length - 1] = { ...wps[wps.length - 1], type: 'arrivee' }

  // 4) order_index séquentiel.
  const reindexed = wps.map((w, i) => ({ ...w, orderIndex: i }))

  return {
    raceName: data.raceName,
    editionYear: data.editionYear,
    waypoints: reindexed,
  }
}

// ── Helpers DB ↔ TS ──
type DbRow = {
  id: string
  race_id: string
  order_index: number
  name: string
  km: number | string
  km_inter: number | string | null
  d_plus: number | null
  d_moins: number | null
  cutoff_raw: string | null
  cutoff_kind: CutoffKind | null
  type: WaypointType
}

export function rowToRaceWaypoint(row: DbRow): RaceWaypoint {
  return {
    id: row.id,
    raceId: row.race_id,
    orderIndex: row.order_index,
    name: row.name,
    km: Number(row.km),
    kmInter: row.km_inter === null ? null : Number(row.km_inter),
    dPlus: row.d_plus,
    dMoins: row.d_moins,
    cutoffRaw: row.cutoff_raw,
    cutoffKind: row.cutoff_kind,
    type: row.type,
  }
}
