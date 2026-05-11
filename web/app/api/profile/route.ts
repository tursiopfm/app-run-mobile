import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = [
    'first_name', 'last_name',
    'max_hr', 'threshold_hr', 'resting_hr', 'aerobic_threshold_hr',
    'ftp_watts', 'weight_kg', 'year_goal_km', 'birth_year',
    'threshold_pace_run_sec_per_km', 'threshold_pace_trail_sec_per_km',
    'hr_zone_method', 'hr_zones_custom', 'hr_method_updated_at',
  ]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
