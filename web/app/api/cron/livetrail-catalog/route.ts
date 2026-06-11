import { NextResponse } from 'next/server'
import { runCatalogSnapshot } from '@/lib/race-import/catalog'
import '@/lib/race-import/sources/livetrail' // side-effect: registerParser (cohérence)

export const runtime = 'nodejs'
export const maxDuration = 60

// Snapshot glissant du catalogue LiveTrail. Déclenché en externe ~hebdo (Bearer CRON_SECRET).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await runCatalogSnapshot()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[cron livetrail-catalog]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
