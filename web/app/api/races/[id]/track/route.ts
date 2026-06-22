import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import { parseGpxTrack } from '@/lib/race-track/parse-gpx-track'
import { resampleProfile } from '@/lib/race-track/resample'
import { upsertRaceTrack, getRaceTrack } from '@/lib/race-track/storage'
import { fetchUtmbTrackGpx, fetchGpxFromUrl } from '@/lib/race-track/utmb-tracks'
import type { RaceTrack } from '@/types/plan'

export const runtime = 'nodejs'

async function ownedRace(supabase: any, id: string, userId: string) {
  const { data } = await supabase
    .from('races').select('id, distance_km').eq('id', id).eq('athlete_id', userId).single()
  return data as { id: string; distance_km: number | string } | null
}

// POST body : { gpxText } | { gpxUrl } | { utmbAuto: true }
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const race = await ownedRace(supabase, params.id, user.id)
  if (!race) return NextResponse.json({ error: 'Course introuvable' }, { status: 404 })
  const officialKm = Number(race.distance_km) || 0

  const body = await request.json() as { gpxText?: string; gpxUrl?: string; utmbAuto?: boolean }

  let gpxText: string | null = null
  let source: RaceTrack['source']
  if (body.utmbAuto === true) {
    const { data: meta } = await supabase
      .from('race_tableau_meta').select('source_url').eq('race_id', params.id).maybeSingle()
    if (!meta?.source_url) return new NextResponse(null, { status: 204 })
    gpxText = await fetchUtmbTrackGpx(meta.source_url, officialKm)
    if (!gpxText) return new NextResponse(null, { status: 204 })
    source = 'utmb_auto'
  } else if (typeof body.gpxUrl === 'string' && body.gpxUrl.length > 0) {
    gpxText = await fetchGpxFromUrl(body.gpxUrl)
    if (!gpxText) return NextResponse.json({ error: 'Trace introuvable à cette URL.' }, { status: 422 })
    source = 'gpx_url'
  } else if (typeof body.gpxText === 'string' && body.gpxText.length > 0) {
    gpxText = body.gpxText
    source = 'gpx_upload'
  } else {
    return NextResponse.json({ error: 'Body invalide.' }, { status: 400 })
  }

  try {
    const { points, distanceM } = parseGpxTrack(gpxText)
    const profile = resampleProfile(points, officialKm > 0 ? officialKm : distanceM / 1000)
    await upsertRaceTrack(supabase, params.id, { profile, source, distanceM })
  } catch {
    return NextResponse.json({ error: 'GPX inexploitable.' }, { status: 422 })
  }
  const track = await getRaceTrack(supabase, params.id)
  return NextResponse.json({ track })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const race = await ownedRace(supabase, params.id, user.id)
  if (!race) return NextResponse.json({ error: 'Course introuvable' }, { status: 404 })
  await supabase.from('race_tracks').delete().eq('race_id', params.id)
  return NextResponse.json({ ok: true })
}
