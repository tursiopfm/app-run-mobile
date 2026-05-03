import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('provider_connections')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', 'strava')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
