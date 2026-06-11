import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import type { PendingDiff, RaceWaypoint } from '@/types/plan'

export const runtime = 'nodejs'

type WP = Omit<RaceWaypoint, 'id' | 'raceId'>
const toRow = (raceId: string, w: WP) => ({
  race_id: raceId, order_index: w.orderIndex, name: w.name, km: w.km, km_inter: w.kmInter,
  d_plus: w.dPlus, d_moins: w.dMoins, cutoff_raw: w.cutoffRaw,
  cutoff_kind: w.cutoffRaw === null ? null : w.cutoffKind, type: w.type,
  supplies: w.supplies ?? [], target_override_sec: w.targetOverrideSec ?? null,
})

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: race } = await supabase
    .from('races').select('id').eq('id', params.id).eq('athlete_id', user.id).single()
  if (!race) return NextResponse.json({ error: 'Course introuvable' }, { status: 404 })

  const { data: metaRow } = await supabase
    .from('race_tableau_meta').select('pending_diff').eq('race_id', params.id).maybeSingle()
  const pending = metaRow?.pending_diff as PendingDiff | null | undefined
  if (!pending) return NextResponse.json({ error: 'Aucun diff en attente' }, { status: 409 })

  const body = await request.json() as { action?: 'apply' | 'dismiss' }
  if (body.action !== 'apply' && body.action !== 'dismiss') {
    return NextResponse.json({ error: 'action invalide' }, { status: 400 })
  }

  const nowISO = new Date().toISOString()

  if (body.action === 'apply') {
    const { error: delErr } = await supabase.from('race_waypoints').delete().eq('race_id', params.id)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    const rows = (pending.newWaypoints ?? []).map((w) => toRow(params.id, w))
    if (rows.length > 0) {
      const { error: insErr } = await supabase.from('race_waypoints').insert(rows)
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
    await supabase.from('race_tableau_meta').update({
      edition_year: pending.newMeta.editionYear,
      edition_date: pending.newMeta.editionDate,
      date_explicit: pending.newMeta.dateExplicit,
      freshness_status: pending.newMeta.freshnessStatus,
      source_hash: pending.newMeta.sourceHash,
      source_checked_at: nowISO,
      pending_diff: null,
      pending_diff_at: null,
      updated_at: nowISO,
    }).eq('race_id', params.id)
  } else {
    await supabase.from('race_tableau_meta').update({
      source_hash: pending.newMeta.sourceHash,
      pending_diff: null,
      pending_diff_at: null,
      updated_at: nowISO,
    }).eq('race_id', params.id)
  }

  return NextResponse.json({ ok: true })
}
