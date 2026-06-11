import { NextResponse } from 'next/server'
import { runFreshnessRecheck } from '@/lib/race-import/recheck'
import '@/lib/race-import/sources/livetrail' // side-effect: registerParser
import '@/lib/race-import/sources/utmb'       // side-effect: registerParser

export const runtime = 'nodejs'
export const maxDuration = 60

// Re-check de fraîcheur des tableaux des courses planifiées. Déclenché en externe (Bearer).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await runFreshnessRecheck()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[cron race-freshness]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
