export type EnvSection = {
  title: string
  description: string
  color: string
  vars: readonly string[]
}

export const ENV_SECTIONS: readonly EnvSection[] = [
  {
    title: 'Base de données — Supabase',
    description: 'Connexion et authentification utilisateurs',
    color: 'text-trail-accent',
    vars: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
  },
  {
    title: 'Synchronisation — Strava OAuth',
    description: 'Connexion et import des activités sportives',
    color: 'text-trail-warning',
    vars: ['STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET', 'STRAVA_WEBHOOK_VERIFY_TOKEN'],
  },
  {
    title: 'Déploiements — Vercel API',
    description: 'Lecture des déploiements depuis le dashboard admin',
    color: 'text-trail-primary',
    vars: ['VERCEL_TOKEN', 'VERCEL_PROJECT_ID'],
  },
]

export function envSummary() {
  const all = ENV_SECTIONS.flatMap(s => s.vars)
  const present = all.filter(v => !!process.env[v]).length
  return { present, total: all.length, missing: all.length - present }
}
