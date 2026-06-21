import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import { rowToRaceWaypoint, rowToTableauMeta } from '@/lib/race-import/schema'
import { computeFreshness, type DetectedEdition } from '@/lib/race-import/freshness'
import { hashWaypoints } from '@/lib/race-import/hash'
import type { RaceWaypoint } from '@/types/plan'

export const runtime = 'nodejs'

// GET /api/races/[id]/waypoints → liste ordonnée.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('race_waypoints')
    .select('*')
    .eq('race_id', params.id)
    .order('order_index', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: metaRow } = await supabase
    .from('race_tableau_meta')
    .select('*')
    .eq('race_id', params.id)
    .maybeSingle()

  const waypoints: RaceWaypoint[] = (data ?? []).map(rowToRaceWaypoint as any)
  return NextResponse.json({ waypoints, meta: metaRow ? rowToTableauMeta(metaRow) : null })
}

// PUT /api/races/[id]/waypoints → remplace TOUS les waypoints.
// Body : { waypoints: Array<Omit<RaceWaypoint, 'id' | 'raceId'>> }
export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Vérifier que la course appartient au user (sécurité même si RLS le ferait).
  const { data: race, error: raceErr } = await supabase
    .from('races')
    .select('id, date')
    .eq('id', params.id)
    .eq('athlete_id', user.id)
    .single()
  if (raceErr || !race) {
    return NextResponse.json({ error: 'Course introuvable' }, { status: 404 })
  }

  const body = await request.json() as {
    waypoints: Array<Omit<RaceWaypoint, 'id' | 'raceId'>>
    meta?: {
      editionYear: number | null
      editionDate: string | null
      dateExplicit: boolean
      startDayOfMonth: number | null
      sourceUrl: string | null
    }
  }
  const rows = (body.waypoints ?? []).map((w) => ({
    race_id: params.id,
    order_index: w.orderIndex,
    name: w.name,
    km: w.km,
    km_inter: w.kmInter,
    d_plus: w.dPlus,
    d_moins: w.dMoins,
    altitude: w.altitude,
    cutoff_raw: w.cutoffRaw,
    cutoff_kind: w.cutoffRaw === null ? null : w.cutoffKind,
    type: w.type,
    supplies: w.supplies ?? [],
    target_override_sec: w.targetOverrideSec ?? null,
  }))

  // Stratégie remplacement : delete + insert dans une seule requête transactionnelle.
  const { error: delErr } = await supabase
    .from('race_waypoints')
    .delete()
    .eq('race_id', params.id)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  if (rows.length === 0) {
    return NextResponse.json({ waypoints: [] })
  }

  const { data: inserted, error: insErr } = await supabase
    .from('race_waypoints')
    .insert(rows)
    .select('*')
    .order('order_index', { ascending: true })

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  if (body.meta) {
    // La meta vient du client → on borne chaque champ avant calcul/persistance.
    // Sinon une valeur aberrante (ex. editionYear géant, date non calendaire)
    // ferait échouer le cast `date` Postgres et perdrait la meta en silence.
    const m = body.meta
    const targetYear = Number((race.date as string).slice(0, 4))
    const editionYear =
      typeof m.editionYear === 'number' && Number.isInteger(m.editionYear) &&
      m.editionYear >= 2000 && m.editionYear <= targetYear + 1
        ? m.editionYear
        : null
    const editionDate =
      typeof m.editionDate === 'string' &&
      /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(m.editionDate)
        ? m.editionDate
        : null
    const startDayOfMonth =
      typeof m.startDayOfMonth === 'number' && m.startDayOfMonth >= 1 && m.startDayOfMonth <= 31
        ? m.startDayOfMonth
        : null
    const dateExplicit = m.dateExplicit === true
    const sourceUrl = typeof m.sourceUrl === 'string' ? m.sourceUrl : null

    const detected: DetectedEdition = { editionYear, editionDate, dateExplicit, startDayOfMonth }
    const fresh = computeFreshness(detected, race.date as string)
    const { error: metaErr } = await supabase.from('race_tableau_meta').upsert({
      race_id: params.id,
      edition_year: fresh.editionYear,
      edition_date: fresh.editionDate,
      date_explicit: dateExplicit,
      freshness_status: fresh.freshnessStatus,
      source_url: sourceUrl,
      source_hash: hashWaypoints(body.waypoints ?? []),
      source_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'race_id' })
    if (metaErr) console.warn('[waypoints] upsert race_tableau_meta échouée:', metaErr.message)
  }

  const waypoints: RaceWaypoint[] = (inserted ?? []).map(rowToRaceWaypoint as any)
  return NextResponse.json({ waypoints })
}
