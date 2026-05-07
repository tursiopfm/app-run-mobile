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

  // Tente la suppression côté Strava (best-effort).
  // Strava n'autorise la suppression via API que pour les activités créées par l'app —
  // les activités GPS (Garmin, Apple Watch…) retournent 404. Dans ce cas on supprime
  // quand même localement et on informe l'utilisateur de supprimer aussi sur Strava.
  let stravaWarning: string | null = null
  if (activity.provider === 'strava' && activity.provider_activity_id) {
    console.log('[delete] strava_id=', activity.provider_activity_id)
    try {
      const accessToken = await getValidStravaToken(user.id)
      const stravaRes = await fetch(
        `https://www.strava.com/api/v3/activities/${activity.provider_activity_id}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
      )
      console.log('[delete] strava_status=', stravaRes.status)
      if (stravaRes.status === 204) {
        // Vraiment supprimée sur Strava — ne reviendra pas au prochain sync
      } else if (stravaRes.status === 404 || stravaRes.status === 403) {
        // Activité enregistrée par GPS ou droits insuffisants — on supprime localement
        // mais elle peut revenir au prochain sync si toujours présente sur Strava
        stravaWarning = 'Supprimée de l\'app. Si elle réapparaît, supprime-la aussi sur Strava — la prochaine sync la retirera définitivement.'
      } else {
        stravaWarning = `Strava ${stravaRes.status} — supprimée localement, vérifie sur Strava.`
      }
    } catch (err) {
      console.warn('[delete] strava_unreachable', err)
      stravaWarning = 'Strava inaccessible — supprimée localement uniquement.'
    }
  }

  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  console.log('[delete] local_ok id=', id)
  return NextResponse.json({ ok: true, warning: stravaWarning })
}
