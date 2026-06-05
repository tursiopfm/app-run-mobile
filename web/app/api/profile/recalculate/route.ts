import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import { recalculateUserEffortScores } from '@/lib/sync/recalculate-scores'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { recalculated, errors } = await recalculateUserEffortScores(user.id)

  return NextResponse.json({ recalculated, errors })
}
