import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import { findRaceCandidates, type RaceTarget } from '@/lib/race-import/find-race'
import '@/lib/race-import/sources/utmb'        // side-effect: registerParser
import '@/lib/race-import/sources/livetrail'   // side-effect: registerParser

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = (await request.json()) as Partial<RaceTarget>
    if (!body.name || !body.date || body.distance == null || body.elevation == null) {
      return NextResponse.json({ error: 'Champs requis : name, date, distance, elevation' }, { status: 400 })
    }
    const candidates = await findRaceCandidates({
      name: body.name,
      date: body.date,
      distance: body.distance,
      elevation: body.elevation,
    })
    return NextResponse.json({ candidates })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 })
  }
}
