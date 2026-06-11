import { NextResponse } from 'next/server'
import { findRaceCandidates, type RaceTarget } from '@/lib/race-import/find-race'
import '@/lib/race-import/sources/utmb'        // side-effect: registerParser
import '@/lib/race-import/sources/livetrail'   // side-effect: registerParser

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<RaceTarget>
    if (!body.name || !body.date || body.distance == null || body.elevation == null) {
      throw new Error('Champs requis : name, date, distance, elevation')
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
