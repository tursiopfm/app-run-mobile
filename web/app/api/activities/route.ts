import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import type { ActivityRow } from '@/components/ui/ActivityCard'

const SELECT_COLS = 'id, name, sport_type, start_time, ces, avg_hr, distance_m, elevation_gain_m, moving_time_sec, manual_sport_type, manual_intensity, manual_distance_m, manual_moving_time_sec, manual_elevation_gain_m'
const PAGE_SIZE = 1000

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const olderThan = req.nextUrl.searchParams.get('olderThan')

  const all: ActivityRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    let q = supabase
      .from('activities')
      .select(SELECT_COLS)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('start_time', { ascending: false })
    if (olderThan) q = q.lt('start_time', olderThan)
    const { data, error } = await q.range(from, from + PAGE_SIZE - 1)
    if (error || !data || data.length === 0) break
    all.push(...(data as ActivityRow[]))
    if (data.length < PAGE_SIZE) break
  }

  return NextResponse.json({ activities: all })
}
