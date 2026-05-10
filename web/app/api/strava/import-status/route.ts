import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('provider_connections')
    .select('import_status, import_total, import_oldest_at, import_started_at, import_completed_at, import_last_error')
    .eq('user_id', user.id)
    .eq('provider', 'strava')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!data) {
    return NextResponse.json(
      {
        status: 'idle',
        total: 0,
        oldestAt: null,
        startedAt: null,
        completedAt: null,
        error: null,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const row = data as {
    import_status: string
    import_total: number
    import_oldest_at: string | null
    import_started_at: string | null
    import_completed_at: string | null
    import_last_error: string | null
  }

  return NextResponse.json(
    {
      status: row.import_status,
      total: row.import_total,
      oldestAt: row.import_oldest_at,
      startedAt: row.import_started_at,
      completedAt: row.import_completed_at,
      error: row.import_last_error,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { action?: string }
  if (body.action !== 'retry') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const { error } = await supabase
    .from('provider_connections')
    .update({
      import_status: 'pending',
      import_last_error: null,
      import_updated_at: null,
    })
    .eq('user_id', user.id)
    .eq('provider', 'strava')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
