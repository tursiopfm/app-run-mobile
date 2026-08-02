import { createServiceClient } from '@/lib/database/supabase-server'

export type PushSubscriptionRow = {
  id:       string
  user_id:  string
  endpoint: string
  p256dh:   string
  auth:     string
}

// Abonnements pas encore notifiés aujourd'hui (heure de Paris), les plus en
// retard d'abord. Le lot est borné : ce qui déborde est repris au tick suivant,
// l'idempotence de last_notified_on garantit qu'aucun n'est doublé.
export async function fetchPendingSubscriptions(
  todayYmd: string,
  limit:    number,
): Promise<PushSubscriptionRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .or(`last_notified_on.is.null,last_notified_on.neq.${todayYmd}`)
    .order('last_notified_on', { ascending: true, nullsFirst: true })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as PushSubscriptionRow[]
}

export async function markNotified(id: string, todayYmd: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('push_subscriptions')
    .update({ last_notified_on: todayYmd })
    .eq('id', id)
  if (error) throw error
}

export async function deleteSubscriptionById(id: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('push_subscriptions').delete().eq('id', id)
  if (error) throw error
}
