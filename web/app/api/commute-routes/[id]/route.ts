import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import { rowToCommuteRoute } from '@/lib/sync/assign-commute-name'

type PatchBody = {
  label?: string
  outboundTitle?: string
  returnTitle?: string
  distanceTolPct?: number
  geoTolM?: number
  hourSplit?: number
  active?: boolean
}

// PATCH /api/commute-routes/[id] → maj partielle (scope user).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as PatchBody

  const update: Record<string, unknown> = {}
  if (body.label != null) update.label = body.label
  if (body.outboundTitle != null) update.outbound_title = body.outboundTitle
  if (body.returnTitle != null) update.return_title = body.returnTitle
  if (body.distanceTolPct != null) update.distance_tol_pct = body.distanceTolPct
  if (body.geoTolM != null) update.geo_tol_m = body.geoTolM
  if (body.hourSplit != null) update.hour_split = body.hourSplit
  if (body.active != null) update.active = body.active

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
  }

  const { data: row, error } = await supabase
    .from('commute_routes')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!row) return NextResponse.json({ error: 'Trajet introuvable' }, { status: 404 })

  return NextResponse.json({ route: rowToCommuteRoute(row) })
}

// DELETE /api/commute-routes/[id] → supprime le trajet (scope user).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('commute_routes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
