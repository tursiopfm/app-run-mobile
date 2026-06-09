// web/app/api/garmin-import/commit/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/database/get-user'
import { createClient, createServiceClient } from '@/lib/database/supabase-server'
import { classifyActivities } from '@/lib/garmin-import/dedup'
import { commitGarminImport } from '@/lib/garmin-import/commit'
import type { GarminMapped, ConflictItem, ExistingActivity } from '@/lib/garmin-import/types'
import type { UserProfileForCes } from '@/lib/analytics/types'

type Body = {
  nouvelles: GarminMapped[]
  conflits: ConflictItem[]   // avec décisions de l'utilisateur
}

export async function POST(req: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Body
  try { body = (await req.json()) as Body } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }) }

  // user_id dérivé de la session — on écrase tout user_id client (sécurité RLS-équivalente).
  const forceUser = (m: GarminMapped): GarminMapped => ({ ...m, normalized: { ...m.normalized, userId: user.id } })
  const nouvelles = (body.nouvelles ?? []).map(forceUser)
  const conflits = (body.conflits ?? []).map(c => ({ ...c, garmin: forceUser(c.garmin) }))

  // Profil pour le CES.
  const rls = await createClient()
  const { data: profileRow } = await rls
    .from('profiles')
    .select('max_hr, resting_hr, threshold_hr, aerobic_threshold_hr, ftp_watts, threshold_pace_run_sec_per_km, threshold_pace_trail_sec_per_km')
    .eq('id', user.id).maybeSingle()
  const profile: UserProfileForCes = profileRow ?? {}

  // RE-CHECK anti-concurrence : recharger l'état DB courant et reclasser.
  const all = [...nouvelles, ...conflits.map(c => c.garmin)]
  const dates = all.map(m => m.normalized.startTime).sort()
  const service = createServiceClient()
  const { data: existRows } = await service
    .from('activities')
    .select('id, provider, provider_activity_id, start_time, moving_time_sec, duration_sec, distance_m, avg_hr, elevation_gain_m')
    .eq('user_id', user.id).is('deleted_at', null)
    .gte('start_time', dates[0] ?? '1970-01-01').lte('start_time', dates[dates.length - 1] ?? '2999-01-01')
  const existing: ExistingActivity[] = (existRows ?? []).map(r => ({
    id: String(r.id), provider: String(r.provider), providerActivityId: String(r.provider_activity_id),
    startTime: String(r.start_time), movingTimeSec: Number(r.moving_time_sec ?? 0),
    durationSec: Number(r.duration_sec ?? 0), distanceM: Number(r.distance_m ?? 0),
    avgHr: r.avg_hr != null ? Number(r.avg_hr) : null,
    elevationGainM: r.elevation_gain_m != null ? Number(r.elevation_gain_m) : null,
  }))

  // Reclasse SANS perdre les décisions utilisateur : une nouvelle qui matche désormais
  // une ligne existante devient un conflit défaut keep_strava (sécurité anti-doublon).
  const fresh = classifyActivities(all, existing)
  const decisionByExisting = new Map(conflits.map(c => [c.existing.id, c.decision]))
  const merged = {
    nouvelles: fresh.nouvelles,
    conflits: fresh.conflits.map(c => ({ ...c, decision: decisionByExisting.get(c.existing.id) ?? 'keep_strava' as const })),
  }

  try {
    const report = await commitGarminImport(service, user.id, merged, profile)
    return NextResponse.json(report)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Commit échoué' }, { status: 500 })
  }
}
