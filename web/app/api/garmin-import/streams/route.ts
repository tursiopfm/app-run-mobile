// web/app/api/garmin-import/streams/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/database/get-user'
import { createServiceClient } from '@/lib/database/supabase-server'
import { writeStreamRows } from '@/lib/garmin-import/enrich-commit'
import { recalculateUserEffortScores } from '@/lib/sync/recalculate-scores'
import type { StreamUpload } from '@/lib/garmin-import/enrich-types'

export async function POST(req: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: { uploads?: StreamUpload[] }
  try { body = (await req.json()) as { uploads?: StreamUpload[] } } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }) }
  const service = createServiceClient()
  try {
    const written = await writeStreamRows(service, user.id, body.uploads ?? [])
    if (req.nextUrl.searchParams.get('recalc') === '1') await recalculateUserEffortScores(user.id)
    return NextResponse.json({ written })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Écriture streams échouée' }, { status: 500 })
  }
}
