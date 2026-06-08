import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/database/get-user'
import { createClient } from '@/lib/database/supabase-server'
import { parseGpx } from '@/lib/import/parse-gpx'
import { gpxToNormalized } from '@/lib/import/gpx-to-normalized'
import { importActivities } from '@/lib/sync/import-activities'
import type { UserProfileForCes } from '@/lib/analytics/types'

const ALLOWED_SPORTS = new Set(['Run', 'TrailRun', 'Ride', 'Swim', 'Walk', 'Hike'])

export async function POST(req: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: 'Requête invalide' }, { status: 400 }) }
  const file = form.get('file')
  const sport = String(form.get('sport') ?? '')
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  if (!ALLOWED_SPORTS.has(sport)) return NextResponse.json({ error: 'Sport invalide' }, { status: 400 })
  if (file.size > 5_000_000) return NextResponse.json({ error: 'Fichier trop volumineux (max 5 Mo)' }, { status: 400 })

  const fileName = (form.get('fileName') as string | null) ?? (file as File).name ?? undefined
  const xml = await file.text()

  let normalized
  try {
    const parsed = parseGpx(xml)
    normalized = gpxToNormalized(user.id, parsed, sport, fileName)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'GPX illisible' }, { status: 422 })
  }

  const supabase = await createClient()
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('max_hr, resting_hr, threshold_hr, aerobic_threshold_hr, ftp_watts, threshold_pace_run_sec_per_km, threshold_pace_trail_sec_per_km')
    .eq('id', user.id)
    .maybeSingle()
  const profile: UserProfileForCes = profileRow ?? {}

  try {
    const { saved } = await importActivities([normalized], profile)
    return NextResponse.json({ saved })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Import échoué' }, { status: 500 })
  }
}
