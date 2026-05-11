import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('activities')
    .select('max_hr, moving_time_sec')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .gte('start_time', oneYearAgo)
    .not('max_hr', 'is', null)
    .limit(2000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
