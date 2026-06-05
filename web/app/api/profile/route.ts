import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import { onboardingCompletionPatch } from '@/lib/profile/onboarding-completion'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = [
    'first_name', 'last_name', 'birth_date', 'sex',
    'max_hr', 'threshold_hr', 'resting_hr', 'aerobic_threshold_hr',
    'ftp_watts', 'weight_kg', 'year_goal_km', 'birth_year',
    'threshold_pace_run_sec_per_km', 'threshold_pace_trail_sec_per_km',
    'hr_zone_method', 'hr_zones_custom', 'hr_method_updated_at',
    'plan_auto_push_title', 'onboarding_skipped',
    'onboarding_discipline', 'onboarding_mission', 'onboarding_mode', 'onboarding_data_source',
  ]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  if ('sex' in update && update.sex != null && !['male','female','other'].includes(String(update.sex))) {
    return NextResponse.json({ error: 'Invalid sex' }, { status: 400 })
  }

  // Keep birth_year in sync when birth_date is updated (used by HR auto method).
  if ('birth_date' in update && !('birth_year' in update)) {
    if (typeof update.birth_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(update.birth_date)) {
      update.birth_year = Number(update.birth_date.slice(0, 4))
    } else if (update.birth_date == null) {
      update.birth_year = null
    }
  }

  Object.assign(update, onboardingCompletionPatch(body))

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
