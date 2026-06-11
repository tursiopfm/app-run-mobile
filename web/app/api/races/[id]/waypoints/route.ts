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
    const detected: DetectedEdition = {
      editionYear: body.meta.editionYear,
      editionDate: body.meta.editionDate,
      dateExplicit: body.meta.dateExplicit,
      startDayOfMonth: body.meta.startDayOfMonth,
    }
    const fresh = computeFreshness(detected, race.date as string)
    await supabase.from('race_tableau_meta').upsert({
      race_id: params.id,
      edition_year: fresh.editionYear,
      edition_date: fresh.editionDate,
      date_explicit: body.meta.dateExplicit,
      freshness_status: fresh.freshnessStatus,
      source_url: body.meta.sourceUrl,
      source_hash: hashWaypoints(body.waypoints ?? []),
      source_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'race_id' })
  }

  const waypoints: RaceWaypoint[] = (inserted ?? []).map(rowToRaceWaypoint as any)
  return NextResponse.json({ waypoints })
}
