// Cache court-terme du couple { supabase, athleteId } pour mutualiser le
// supabase.auth.getUser() lors du burst de fetches au mount de PlanClient.
// Sans ce cache, 15+ appels concurrents (chaque bloc + chaque fonction storage)
// déclenchent autant de requêtes auth — visible sur le réseau et lent.
//
// Pas d'invalidation explicite : le TTL court (10 s) suffit pour absorber le
// burst initial sans accumuler de staleness en cas de sign-out / sign-in.

import { createClient } from '@/lib/database/supabase-client'

type SupabaseLike = ReturnType<typeof createClient>
export type AuthedClient = { supabase: SupabaseLike; athleteId: string }

const AUTH_TTL_MS = 10_000

let cached: { promise: Promise<AuthedClient | null>; expiresAt: number } | null = null

export function getAuthedClient(): Promise<AuthedClient | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  const now = Date.now()
  if (cached && cached.expiresAt > now) {
    return cached.promise
  }
  const promise = (async (): Promise<AuthedClient | null> => {
    try {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      const athleteId = data.user?.id
      if (!athleteId) return null
      return { supabase, athleteId }
    } catch {
      return null
    }
  })()
  cached = { promise, expiresAt: now + AUTH_TTL_MS }
  return promise
}

// Force le re-fetch du user au prochain appel — à utiliser après un signOut /
// signIn explicite si on veut éviter d'attendre l'expiration du TTL.
export function invalidateAuthCache(): void {
  cached = null
}
