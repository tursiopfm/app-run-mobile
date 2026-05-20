// Endpoint : totaux d'activités réalisées sur une période (lundi → lundi
// exclusif), filtrés par catégorie sportive. Utilisé par ResumeSemaineBlock
// (onglet Plan) pour afficher Réalisé km / D+ / charge cohérents avec
// l'aggrégation hebdo du bloc Objectifs (onglet Cockpit, lib/data/dashboard).
//
// Les overrides `manual_sport_type`, `manual_distance_m`, `manual_elevation_gain_m`
// sont prioritaires sur les valeurs Strava — même règle que buildSportOverview.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import { SPORT_TYPE_MAP, type SportKey } from '@/lib/design/sports'

type Row = {
  sport_type: string
  manual_sport_type: string | null
  distance_m: number | null
  manual_distance_m: number | null
  elevation_gain_m: number | null
  manual_elevation_gain_m: number | null
  ces: number | null
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const from = req.nextUrl.searchParams.get('from')
  const to   = req.nextUrl.searchParams.get('to')          // exclusif (ex: lundi suivant)
  const cat  = (req.nextUrl.searchParams.get('category') ?? 'run') as SportKey
  if (!from || !to) {
    return NextResponse.json({ error: 'from & to required (YYYY-MM-DD)' }, { status: 400 })
  }
  const sportTypes = SPORT_TYPE_MAP[cat] as readonly string[] | null
  if (!sportTypes) {
    return NextResponse.json({ error: 'invalid category' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('activities')
    .select('sport_type, manual_sport_type, distance_m, manual_distance_m, elevation_gain_m, manual_elevation_gain_m, ces')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .gte('start_time', `${from}T00:00:00`)
    .lt('start_time',  `${to}T00:00:00`)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let km = 0
  let dPlus = 0
  let ces = 0
  let sessions = 0
  for (const a of (data ?? []) as Row[]) {
    const effectiveSport = a.manual_sport_type ?? a.sport_type
    if (!sportTypes.includes(effectiveSport)) continue
    km    += ((a.manual_distance_m       ?? a.distance_m)       ?? 0) / 1000
    dPlus +=  (a.manual_elevation_gain_m ?? a.elevation_gain_m) ?? 0
    ces   += a.ces ?? 0
    sessions++
  }

  return NextResponse.json({
    km:       Math.round(km * 10) / 10,
    dPlus:    Math.round(dPlus),
    ces:      Math.round(ces),
    sessions,
  })
}
