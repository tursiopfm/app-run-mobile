import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import { searchOfficialWebsite } from '@/lib/race-import/search-website'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = (await request.json()) as { name?: string; date?: string }
    if (!body.name || !body.date) {
      return NextResponse.json({ error: 'Champs requis : name, date' }, { status: 400 })
    }
    const url = await searchOfficialWebsite({ name: body.name, date: body.date })
    return NextResponse.json({ url })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 })
  }
}
