import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`Missing required environment variable: ${name}`)
  return val
}

/** Server client authenticated as the current user via session cookies.
 * Must only be called from Server Components, Server Actions, or Route Handlers. */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

/** Service-role client that bypasses RLS.
 * Use only in trusted server contexts (webhooks, cron jobs). Never expose to the browser. */
export function createServiceClient() {
  return createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  )
}
