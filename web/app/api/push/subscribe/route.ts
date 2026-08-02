import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/database/supabase-server'

type SubscribeBody = {
  endpoint: string
  keys:     { p256dh: string; auth: string }
}

// POST /api/push/subscribe → enregistre l'abonnement de CET appareil.
// Upsert sur `endpoint` : re-souscrire depuis le même appareil met simplement
// la ligne à jour (et la réattribue si le compte a changé).
//
// Authentification par cookies : on valide la session avant toute écriture,
// et on extraits user.id de la session.
//
// Écriture par service role (pas RLS) : un endpoint est lié au NAVIGATEUR,
// pas au compte. Sous RLS utilisateur, l'upsert ne peut pas réattribuer
// l'endpoint d'un compte A à un compte B (la policy UPDATE s'évalue contre la
// ligne existante, pas la nouvelle) ; le service role lève cet obstacle
// technique. Mais ça ne ferme PAS à soi seul la fuite inter-comptes sur un
// navigateur partagé : B ne retouche l'interrupteur que s'il le voit à OFF,
// or `pushManager.getSubscription()` répond « abonné » dès que le navigateur
// a un abonnement actif, peu importe qui l'a créé. C'est le désabonnement à
// la déconnexion (components/settings/AccountSection.tsx) qui ferme
// réellement ce cas, en repartant de zéro côté navigateur avant que B ne se
// connecte.
//
// C'est sûr car user_id vient TOUJOURS de la session validée (user.id), jamais
// du corps de la requête. L'attaquant ne peut donc pas usurper un autre compte.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: SubscribeBody
  try {
    body = (await request.json()) as SubscribeBody
  } catch {
    return NextResponse.json({ error: 'Corps invalide (JSON requis)' }, { status: 400 })
  }

  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: 'endpoint et keys sont requis' }, { status: 400 })
  }

  // Écriture par service role pour franchir la RLS et réattribuer l'endpoint
  // si le compte a changé.
  const serviceSupabase = createServiceClient()
  const { error } = await serviceSupabase.from('push_subscriptions').upsert({
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

  let body: { endpoint?: string }
  try {
    body = (await request.json()) as { endpoint?: string }
  } catch {
    return NextResponse.json({ error: 'Corps invalide (JSON requis)' }, { status: 400 })
  }

  if (!body?.endpoint) return NextResponse.json({ error: 'endpoint requis' }, { status: 400 })

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', body.endpoint)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
