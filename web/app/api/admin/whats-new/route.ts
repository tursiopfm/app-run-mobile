import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/database/get-user'
import { getIsAdmin } from '@/lib/database/get-admin'
import { createServiceClient } from '@/lib/database/supabase-server'
import { normalizeBullets } from '@/lib/admin/whats-new'

export async function POST(request: Request) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = await getIsAdmin(user.id)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const bullets = normalizeBullets(body?.bullets)
  if (!title || bullets.length === 0) {
    return NextResponse.json({ error: 'Titre et au moins une puce requis' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('whats_new_popups')
    .insert({ title, bullets })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data.id })
}
