import { NextResponse } from 'next/server'
import { processStreamsBackfillBatch } from '@/lib/providers/strava/streams-backfill'

export const runtime = 'nodejs'        // zlib requis (pas edge)
export const dynamic = 'force-dynamic'

const BATCH = 40

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processStreamsBackfillBatch(BATCH)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[cron strava-streams-backfill]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
