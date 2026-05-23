// Endpoint : activités réalisées sur une fenêtre [from, to] inclusive, avec
// les champs minimaux nécessaires au matching séance↔activité dans le bloc
// Vue Semaine de l'onglet Plan.
//
// Overrides manuels prioritaires (manual_sport_type / manual_distance_m /
// manual_elevation_gain_m) — même règle que /api/activities/week-totals.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'

type Row = {
  id: string
  name: string | null
  sport_type: string
  manual_sport_type: string | null
  distance_m: number | null
  manual_distance_m: number | null
  elevation_gain_m: number | null
  manual_elevation_gain_m: number | null
  start_time: string
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const from = req.nextUrl.searchParams.get('from')
  const to   = req.nextUrl.searchParams.get('to')  // inclusif (YYYY-MM-DD)
  if (!from || !to) {
    return NextResponse.json({ error: 'from & to required (YYYY-MM-DD)' }, { status: 400 })
  }

  // `to` inclusif → on filtre start_time < lendemain-de-to.
  const [y, m, d] = to.split('-').map(Number)
  if (!y || !m || !d) {
    return NextResponse.json({ error: 'invalid to date' }, { status: 400 })
  }
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  const toExclusive = next.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('activities')
    .select('id, name, sport_type, manual_sport_type, distance_m, manual_distance_m, elevation_gain_m, manual_elevation_gain_m, start_time')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .gte('start_time', `${from}T00:00:00`)
    .lt('start_time',  `${toExclusive}T00:00:00`)
    .order('start_time', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const activities = ((data ?? []) as Row[]).map(a => ({
    id: a.id,
    name: a.name ?? '',
    date: a.start_time.slice(0, 10),
    sportType: a.manual_sport_type ?? a.sport_type,
    distanceKm: ((a.manual_distance_m ?? a.distance_m) ?? 0) / 1000,
    elevationM: (a.manual_elevation_gain_m ?? a.elevation_gain_m) ?? 0,
  }))

  return NextResponse.json({ activities })
}
