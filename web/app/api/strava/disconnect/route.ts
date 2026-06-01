import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import { revokeStravaToken } from '@/lib/providers/strava/auth'

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Révoque le token côté Strava avant de supprimer la connexion locale.
  // Best-effort : si la révocation échoue (token déjà invalide, réseau…),
  // on supprime quand même localement.
  const { data: conn } = await supabase
    .from('provider_connections')
    .select('access_token')
    .eq('user_id', user.id)
    .eq('provider', 'strava')
    .single()

  if (conn?.access_token) {
    try {
      await revokeStravaToken(conn.access_token)
    } catch (e) {
      console.warn('[disconnect] strava revoke failed:', e)
    }
  }

  const { error } = await supabase
    .from('provider_connections')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', 'strava')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
