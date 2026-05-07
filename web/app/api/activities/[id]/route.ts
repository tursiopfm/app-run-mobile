import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import { getValidStravaToken } from '@/lib/providers/strava/token'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    name?:                    string
    manual_sport_type?:       string | null
    manual_intensity?:        string | null
    manual_distance_m?:       number | null
    manual_moving_time_sec?:  number | null
    manual_elevation_gain_m?: number | null
  }

  const { name, manual_sport_type, manual_intensity,
          manual_distance_m, manual_moving_time_sec, manual_elevation_gain_m } = body

  const { error } = await supabase
    .from('activities')
    .update({ name, manual_sport_type, manual_intensity,
              manual_distance_m, manual_moving_time_sec, manual_elevation_gain_m })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch the activity to get its Strava ID before deleting
  const { data: activity, error: lookupErr } = await supabase
    .from('activities')
    .select('id, provider, provider_activity_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (lookupErr || !activity) {
    return NextResponse.json({ error: 'Activité introuvable' }, { status: 404 })
  }

  // For Strava activities, delete from Strava first so the next sync doesn't re-insert it
  if (activity.provider === 'strava' && activity.provider_activity_id) {
    console.log('[delete] suppression Strava activity_id=', activity.provider_activity_id)
    try {
      const accessToken = await getValidStravaToken(user.id)
      const res = await fetch(
        `https://www.strava.com/api/v3/activities/${activity.provider_activity_id}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
      )
      // 204 = supprimée, 404 = déjà absente côté Strava — les deux sont OK
      if (!res.ok && res.status !== 404) {
        const msg = res.status === 403
          ? 'Strava refuse la suppression de cette activité (droits insuffisants — supprime-la directement sur Strava)'
          : `Erreur Strava ${res.status} — réessaie ou supprime sur Strava`
        console.warn('[delete] Strava error', res.status)
        return NextResponse.json({ error: msg }, { status: 400 })
      }
      console.log('[delete] Strava ok status=', res.status)
    } catch (err) {
      console.error('[delete] Strava unreachable', err)
      return NextResponse.json(
        { error: `Impossible de contacter Strava : ${err instanceof Error ? err.message : err}` },
        { status: 500 },
      )
    }
  }

  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  console.log('[delete] supprimée localement id=', id)
  return NextResponse.json({ ok: true })
}
