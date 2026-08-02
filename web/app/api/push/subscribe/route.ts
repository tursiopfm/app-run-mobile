import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'

type SubscribeBody = {
  endpoint: string
  keys:     { p256dh: string; auth: string }
}

// POST /api/push/subscribe → enregistre l'abonnement de CET appareil.
// Upsert sur `endpoint` : re-souscrire depuis le même appareil met simplement
// la ligne à jour (et la réattribue si le compte a changé).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as SubscribeBody
  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: 'endpoint et keys sont requis' }, { status: 400 })
  }

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id:    user.id,
    endpoint:   body.endpoint,
    p256dh:     body.keys.p256dh,
    auth:       body.keys.auth,
    user_agent: request.headers.get('user-agent'),
  }, { onConflict: 'endpoint' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/push/subscribe → retire l'abonnement de cet appareil.
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint } = (await request.json()) as { endpoint?: string }
  if (!endpoint) return NextResponse.json({ error: 'endpoint requis' }, { status: 400 })

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
