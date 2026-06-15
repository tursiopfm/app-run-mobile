import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/database/get-user'
import { getIsAdmin } from '@/lib/database/get-admin'
import { createServiceClient } from '@/lib/database/supabase-server'
import { normalizeBullets } from '@/lib/admin/whats-new'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = await getIsAdmin(user.id)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => null)
  const supabase = createServiceClient()

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof body?.title === 'string') {
    const title = body.title.trim()
    if (!title) return NextResponse.json({ error: 'Titre vide' }, { status: 400 })
    patch.title = title
  }
  if (body?.bullets !== undefined) {
    const bullets = normalizeBullets(body.bullets)
    if (bullets.length === 0) return NextResponse.json({ error: 'Au moins une puce requise' }, { status: 400 })
    patch.bullets = bullets
  }

  // Activation : une seule active à la fois. Désactiver les autres AVANT d'activer
  // celle-ci (sinon l'index unique partiel whats_new_popups_one_active échoue).
  if (body?.is_active === true) {
    const { error: deactErr } = await supabase
      .from('whats_new_popups')
      .update({ is_active: false })
      .neq('id', id)
    if (deactErr) return NextResponse.json({ error: deactErr.message }, { status: 500 })
    patch.is_active = true
  } else if (body?.is_active === false) {
    patch.is_active = false
  }

  const { error } = await supabase.from('whats_new_popups').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = await getIsAdmin(user.id)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const supabase = createServiceClient()
  const { error } = await supabase.from('whats_new_popups').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
