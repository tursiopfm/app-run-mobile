> **Status: Implémenté** · Date: 2026-05-07 · Code: `web/app/(main)/admin/`
> *Snapshot de design — pour l'état actuel, voir le code.*

# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un espace admin complet à Trail Cockpit — rôle `is_admin` Supabase, icône Shield dans la bottom nav, et 6 onglets (Dashboard, Users, Déploiements, Webhooks, Système, Sync) avec données réelles.

**Architecture:** Page Server Component `/admin?tab=xxx` qui vérifie `isAdmin()` côté serveur et redirige si non-admin. Chaque onglet est un Server Component qui fetch ses propres données. `AppShell` passe `isAdmin: boolean` à `BottomNav` pour conditionner l'affichage du 7ème item. Les routes `/api/admin/*` vérifient toutes `isAdmin()` avant de traiter.

**Tech Stack:** Next.js 15 App Router, Supabase (service role pour admin), Vercel REST API v6, TypeScript, Tailwind CSS, Lucide React.

---

## Cartographie des fichiers

| Action | Fichier |
|---|---|
| Créer | `web/lib/database/get-admin.ts` |
| Créer | `web/lib/admin/vercel.ts` |
| Créer | `web/lib/admin/format.ts` |
| Créer | `web/__tests__/admin/get-admin.test.ts` |
| Créer | `web/__tests__/admin/format.test.ts` |
| Remplacer | `web/app/(main)/admin/page.tsx` |
| Créer | `web/app/(main)/admin/components/AdminTabs.tsx` |
| Créer | `web/app/(main)/admin/components/TabDashboard.tsx` |
| Créer | `web/app/(main)/admin/components/TabUsers.tsx` |
| Créer | `web/app/(main)/admin/components/TabDeployments.tsx` |
| Créer | `web/app/(main)/admin/components/TabWebhooks.tsx` |
| Créer | `web/app/(main)/admin/components/TabSystem.tsx` |
| Créer | `web/app/(main)/admin/components/TabSync.tsx` |
| Créer | `web/app/api/admin/deployments/route.ts` |
| Créer | `web/app/api/admin/sync/route.ts` |
| Créer | `web/app/api/admin/users/[id]/route.ts` |
| Modifier | `web/components/navigation/AppShell.tsx` |
| Modifier | `web/components/navigation/BottomNav.tsx` |

---

## Task 1 : Migration Supabase — is_admin + webhook_logs

**Files:**
- Aucun fichier TypeScript — SQL à exécuter dans le dashboard Supabase

- [ ] **Step 1 : Ajouter la colonne is_admin à profiles**

Dans le Supabase Dashboard → SQL Editor, exécuter :

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
```

- [ ] **Step 2 : Passer franck.meri@gmail.com en admin**

```sql
UPDATE profiles
SET is_admin = true
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'franck.meri@gmail.com'
);
```

Vérifier : `SELECT id, is_admin FROM profiles WHERE is_admin = true;` → doit retourner 1 ligne.

- [ ] **Step 3 : Créer la table webhook_logs**

```sql
CREATE TABLE IF NOT EXISTS webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_type text NOT NULL,
  user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  status_code int,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_logs_created_at_idx ON webhook_logs (created_at DESC);
```

- [ ] **Step 4 : Activer RLS sur webhook_logs**

```sql
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
-- Seul le service role peut lire (aucune policy pour anon/authenticated)
```

- [ ] **Step 5 : Mettre à jour le webhook Strava pour logger**

Dans `web/app/api/webhooks/strava/route.ts` (ou `web/app/api/strava/webhook/route.ts`), à la fin du traitement, insérer dans `webhook_logs` :

```ts
// Après avoir traité l'event, logger le résultat
const serviceClient = createServiceClient()
await serviceClient.from('webhook_logs').insert({
  provider: 'strava',
  event_type: body.aspect_type ? `${body.object_type}.${body.aspect_type}` : body.object_type,
  user_id: body.owner_id ? await resolveUserId(body.owner_id, serviceClient) : null,
  status_code: 200,
  payload: body,
})
```

Note : `resolveUserId` est une fonction locale à définir dans ce fichier :
```ts
async function resolveUserId(stravaAthleteId: number, client: ReturnType<typeof createServiceClient>) {
  const { data } = await client
    .from('provider_connections')
    .select('user_id')
    .eq('provider', 'strava')
    .eq('provider_user_id', String(stravaAthleteId))
    .single()
  return data?.user_id ?? null
}
```

- [ ] **Step 6 : Vérifier les deux routes webhook**

Lire `web/app/api/webhooks/strava/route.ts` ET `web/app/api/strava/webhook/route.ts` pour identifier laquelle traite réellement les events entrants, et n'instrumenter que celle-là.

- [ ] **Step 7 : Commit**

```bash
git add web/app/api/webhooks/strava/route.ts web/app/api/strava/webhook/route.ts
git commit -m "feat(admin): table webhook_logs + is_admin sur profiles"
```

---

## Task 2 : Helper isAdmin + utilitaires

**Files:**
- Créer: `web/lib/database/get-admin.ts`
- Créer: `web/lib/admin/format.ts`
- Créer: `web/__tests__/admin/format.test.ts`

- [ ] **Step 1 : Écrire le test de formatRelativeTime**

Créer `web/__tests__/admin/format.test.ts` :

```ts
import { formatRelativeTime, lastLoginColor } from '@/lib/admin/format'

describe('formatRelativeTime', () => {
  it('retourne "aujourd\'hui" pour une date < 1 heure', () => {
    const d = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    expect(formatRelativeTime(d)).toBe("aujourd'hui")
  })

  it('retourne "hier" pour une date entre 24h et 48h', () => {
    const d = new Date(Date.now() - 36 * 3600 * 1000).toISOString()
    expect(formatRelativeTime(d)).toBe('hier')
  })

  it('retourne "il y a N jours" pour une date > 48h', () => {
    const d = new Date(Date.now() - 5 * 86400 * 1000).toISOString()
    expect(formatRelativeTime(d)).toBe('il y a 5 jours')
  })

  it('retourne "—" pour null', () => {
    expect(formatRelativeTime(null)).toBe('—')
  })
})

describe('lastLoginColor', () => {
  it('retourne green pour connexion < 3 jours', () => {
    const d = new Date(Date.now() - 1 * 86400 * 1000).toISOString()
    expect(lastLoginColor(d)).toBe('text-trail-success')
  })

  it('retourne warning pour connexion > 3 jours', () => {
    const d = new Date(Date.now() - 10 * 86400 * 1000).toISOString()
    expect(lastLoginColor(d)).toBe('text-trail-warning')
  })

  it('retourne muted pour null', () => {
    expect(lastLoginColor(null)).toBe('text-trail-muted')
  })
})
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
cd web && npx jest __tests__/admin/format.test.ts --no-coverage
```

Attendu : FAIL — module not found.

- [ ] **Step 3 : Créer lib/admin/format.ts**

```ts
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffH = diffMs / 3600000
  if (diffH < 24) return "aujourd'hui"
  if (diffH < 48) return 'hier'
  return `il y a ${Math.floor(diffH / 24)} jours`
}

export function lastLoginColor(iso: string | null): string {
  if (!iso) return 'text-trail-muted'
  const diffDays = (Date.now() - new Date(iso).getTime()) / 86400000
  return diffDays < 3 ? 'text-trail-success' : 'text-trail-warning'
}
```

- [ ] **Step 4 : Lancer le test — doit passer**

```bash
cd web && npx jest __tests__/admin/format.test.ts --no-coverage
```

Attendu : PASS (4 tests).

- [ ] **Step 5 : Créer lib/database/get-admin.ts**

```ts
import { cache } from 'react'
import { createServiceClient } from './supabase-server'

export const getIsAdmin = cache(async (userId: string): Promise<boolean> => {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single()
    return data?.is_admin === true
  } catch {
    return false
  }
})
```

- [ ] **Step 6 : Commit**

```bash
git add web/lib/admin/format.ts web/lib/database/get-admin.ts web/__tests__/admin/format.test.ts
git commit -m "feat(admin): helper isAdmin + utilitaire formatRelativeTime"
```

---

## Task 3 : Bottom nav — item Admin conditionnel

**Files:**
- Modifier: `web/components/navigation/AppShell.tsx`
- Modifier: `web/components/navigation/BottomNav.tsx`

- [ ] **Step 1 : Modifier BottomNav pour accepter isAdmin en prop**

Lire `web/components/navigation/BottomNav.tsx` (déjà lu — 40 lignes, `'use client'`, tableau `NAV_ITEMS`).

Remplacer le contenu de `web/components/navigation/BottomNav.tsx` :

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Dumbbell, Calendar, Footprints, Trophy, Settings, ShieldCheck } from 'lucide-react'

const BASE_NAV = [
  { href: '/dashboard',  icon: LayoutGrid, label: 'Cockpit'   },
  { href: '/charge',     icon: Dumbbell,   label: 'Charge'    },
  { href: '/plan',       icon: Calendar,   label: 'Plan'      },
  { href: '/activities', icon: Footprints, label: 'Activités' },
  { href: '/courses',    icon: Trophy,     label: 'Courses'   },
  { href: '/settings',   icon: Settings,   label: 'Réglages'  },
]

const ADMIN_NAV = { href: '/admin', icon: ShieldCheck, label: 'Admin' }

export function BottomNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const items = isAdmin ? [...BASE_NAV, ADMIN_NAV] : BASE_NAV

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-trail-surface border-t border-trail-border pb-safe">
      <div className="flex items-stretch max-w-lg mx-auto">
        {items.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] transition-colors ${
                active ? 'text-trail-primary' : 'text-trail-muted hover:text-trail-text'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className="font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2 : Modifier AppShell pour passer isAdmin**

Modifier `web/components/navigation/AppShell.tsx` — ajouter la résolution `isAdmin` et la passer à `BottomNav` :

```tsx
import type { ReactNode } from 'react'
import Link from 'next/link'
import { BottomNav } from './BottomNav'
import { PullToRefresh } from './PullToRefresh'
import { MoreVertical } from 'lucide-react'
import { createClient } from '@/lib/database/supabase-server'
import { getServerUser } from '@/lib/database/get-user'
import { getIsAdmin } from '@/lib/database/get-admin'

async function fetchDisplayName(): Promise<string | null> {
  try {
    const user = await getServerUser()
    if (!user) return null
    const supabase = await createClient()
    const { data } = await supabase
      .from('profiles')
      .select('first_name,last_name')
      .eq('id', user.id)
      .single()
    if (data?.first_name) return [data.first_name, data.last_name].filter(Boolean).join(' ')
    return user.email?.split('@')[0] ?? null
  } catch {
    return null
  }
}

export async function AppShell({ children }: { children: ReactNode }) {
  const [displayName, user] = await Promise.all([fetchDisplayName(), getServerUser()])
  const isAdmin = user ? await getIsAdmin(user.id) : false

  return (
    <div className="flex flex-col min-h-screen bg-trail-bg">
      <header className="sticky top-0 z-40 bg-trail-header border-b border-trail-border px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <span className="text-base font-bold tracking-widest uppercase">
            <span className="text-trail-primary">Trail</span>
            <span className="text-trail-text"> Cockpit</span>
          </span>
          <div className="flex items-center gap-2">
            {displayName && (
              <span className="text-sm font-semibold text-trail-primary">{displayName}</span>
            )}
            <Link
              href="/profile"
              className="text-trail-muted hover:text-trail-text p-1 -mr-1"
              aria-label="Profil"
            >
              <MoreVertical size={18} />
            </Link>
          </div>
        </div>
      </header>
      <PullToRefresh>
        {children}
      </PullToRefresh>
      <BottomNav isAdmin={isAdmin} />
    </div>
  )
}
```

- [ ] **Step 3 : Vérifier que le build passe**

```bash
cd web && npx tsc --noEmit
```

Attendu : aucune erreur TypeScript.

- [ ] **Step 4 : Vérifier manuellement**

Démarrer le dev server (`cd web && npm run dev`), se connecter avec `franck.meri@gmail.com`. L'icône 🛡 "Admin" doit apparaître en 7ème position dans la bottom nav. Avec un autre compte, elle doit être absente.

- [ ] **Step 5 : Commit**

```bash
git add web/components/navigation/BottomNav.tsx web/components/navigation/AppShell.tsx
git commit -m "feat(admin): icône Shield dans bottom nav pour compte admin"
```

---

## Task 4 : Page /admin — squelette avec onglets

**Files:**
- Remplacer: `web/app/(main)/admin/page.tsx`
- Créer: `web/app/(main)/admin/components/AdminTabs.tsx`

- [ ] **Step 1 : Créer AdminTabs.tsx (client component)**

```tsx
// web/app/(main)/admin/components/AdminTabs.tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const TABS = [
  { id: 'dashboard',    label: '📊 Dashboard'    },
  { id: 'users',        label: '👥 Users'         },
  { id: 'deployments',  label: '🚀 Déploiements'  },
  { id: 'webhooks',     label: '🔗 Webhooks'      },
  { id: 'system',       label: '⚙️ Système'       },
  { id: 'sync',         label: '🔄 Sync'          },
]

export function AdminTabs({ activeTab }: { activeTab: string }) {
  const router = useRouter()

  return (
    <div className="flex gap-0 border-b border-trail-border overflow-x-auto">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => router.push(`/admin?tab=${id}`)}
          className={`px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
            activeTab === id
              ? 'text-trail-primary border-trail-primary'
              : 'text-trail-muted border-transparent hover:text-trail-text'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2 : Remplacer web/app/(main)/admin/page.tsx**

```tsx
import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/database/get-user'
import { getIsAdmin } from '@/lib/database/get-admin'
import { AdminTabs } from './components/AdminTabs'
import { TabDashboard } from './components/TabDashboard'
import { TabUsers } from './components/TabUsers'
import { TabDeployments } from './components/TabDeployments'
import { TabWebhooks } from './components/TabWebhooks'
import { TabSystem } from './components/TabSystem'
import { TabSync } from './components/TabSync'

const VALID_TABS = ['dashboard', 'users', 'deployments', 'webhooks', 'system', 'sync'] as const
type Tab = typeof VALID_TABS[number]

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const isAdmin = await getIsAdmin(user.id)
  if (!isAdmin) redirect('/dashboard')

  const { tab } = await searchParams
  const activeTab: Tab = VALID_TABS.includes(tab as Tab) ? (tab as Tab) : 'dashboard'

  return (
    <div className="flex flex-col">
      <div className="bg-trail-warning/10 border-b border-trail-warning/30 px-4 py-2">
        <p className="text-xs text-trail-warning font-medium">⚠ Zone admin — accès restreint</p>
      </div>

      <AdminTabs activeTab={activeTab} />

      <div className="px-4 py-4">
        {activeTab === 'dashboard'   && <TabDashboard />}
        {activeTab === 'users'       && <TabUsers />}
        {activeTab === 'deployments' && <TabDeployments />}
        {activeTab === 'webhooks'    && <TabWebhooks />}
        {activeTab === 'system'      && <TabSystem />}
        {activeTab === 'sync'        && <TabSync />}
      </div>
    </div>
  )
}
```

- [ ] **Step 3 : Créer les 6 stubs de composants (pour que le build passe)**

Créer chacun de ces fichiers avec un stub minimal :

`web/app/(main)/admin/components/TabDashboard.tsx` :
```tsx
export async function TabDashboard() {
  return <div className="text-trail-muted text-sm">Dashboard — à implémenter</div>
}
```

Répéter pour `TabUsers`, `TabDeployments`, `TabWebhooks`, `TabSystem` (même contenu, nom différent, fonction `async`).

`web/app/(main)/admin/components/TabSync.tsx` :
```tsx
'use client'
export function TabSync() {
  return <div className="text-trail-muted text-sm">Sync — à implémenter</div>
}
```

- [ ] **Step 4 : Vérifier le build**

```bash
cd web && npx tsc --noEmit
```

Attendu : aucune erreur.

- [ ] **Step 5 : Vérifier manuellement**

Aller sur `/admin` — les 6 onglets apparaissent, cliquer dessus change l'URL (`?tab=users` etc.), le contenu stub s'affiche. Un non-admin redirigé vers `/dashboard`.

- [ ] **Step 6 : Commit**

```bash
git add web/app/\(main\)/admin/
git commit -m "feat(admin): squelette page /admin avec 6 onglets et protection is_admin"
```

---

## Task 5 : TabDashboard — données réelles

**Files:**
- Modifier: `web/app/(main)/admin/components/TabDashboard.tsx`

- [ ] **Step 1 : Remplacer le stub TabDashboard**

```tsx
import { createServiceClient } from '@/lib/database/supabase-server'
import { Users, Plug, Activity, Webhook, AlertTriangle, Rocket } from 'lucide-react'

async function fetchDashboardStats() {
  const supabase = createServiceClient()

  const [
    { count: userCount },
    { count: stravaCount },
    { count: activityCount },
    { count: webhookCount },
    { count: errorCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('provider_connections').select('*', { count: 'exact', head: true }).eq('provider', 'strava'),
    supabase.from('activities').select('*', { count: 'exact', head: true }),
    supabase.from('webhook_logs').select('*', { count: 'exact', head: true }),
    supabase.from('webhook_logs').select('*', { count: 'exact', head: true })
      .gte('status_code', 500)
      .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
  ])

  return {
    userCount: userCount ?? 0,
    stravaCount: stravaCount ?? 0,
    activityCount: activityCount ?? 0,
    webhookCount: webhookCount ?? 0,
    errorCount: errorCount ?? 0,
  }
}

export async function TabDashboard() {
  const stats = await fetchDashboardStats()

  const STATS = [
    { icon: Users,         label: 'Utilisateurs',       value: String(stats.userCount),    color: 'text-trail-accent'   },
    { icon: Plug,          label: 'Connexions Strava',   value: String(stats.stravaCount),  color: 'text-trail-success'  },
    { icon: Activity,      label: 'Activités importées', value: String(stats.activityCount),color: 'text-trail-primary'  },
    { icon: Webhook,       label: 'Webhooks reçus',      value: String(stats.webhookCount), color: 'text-trail-warning'  },
    { icon: AlertTriangle, label: 'Erreurs (24h)',        value: String(stats.errorCount),   color: stats.errorCount > 0 ? 'text-trail-danger' : 'text-trail-success' },
    { icon: Rocket,        label: 'Déploiement',          value: 'Voir onglet →',            color: 'text-trail-muted'    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {STATS.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="bg-trail-card border border-trail-border rounded-2xl p-4">
          <Icon size={18} className={`${color} mb-2`} />
          <p className="text-2xl font-bold text-trail-text">{value}</p>
          <p className="text-xs text-trail-muted mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier manuellement**

Aller sur `/admin?tab=dashboard` — les 5 KPIs doivent afficher des valeurs réelles issues de Supabase.

- [ ] **Step 3 : Commit**

```bash
git add web/app/\(main\)/admin/components/TabDashboard.tsx
git commit -m "feat(admin): TabDashboard avec données réelles Supabase"
```

---

## Task 6 : TabUsers — liste utilisateurs

**Files:**
- Modifier: `web/app/(main)/admin/components/TabUsers.tsx`

- [ ] **Step 1 : Remplacer le stub TabUsers**

```tsx
import { createServiceClient } from '@/lib/database/supabase-server'
import { formatRelativeTime, lastLoginColor } from '@/lib/admin/format'

async function fetchUsers() {
  const supabase = createServiceClient()

  // auth.users via service role admin API
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 100 })
  if (error) throw error

  // profiles (is_admin)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, is_admin')

  // provider_connections (strava)
  const { data: connections } = await supabase
    .from('provider_connections')
    .select('user_id')
    .eq('provider', 'strava')

  // activities count par user
  const { data: actCounts } = await supabase
    .from('activities')
    .select('user_id')

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))
  const stravaSet = new Set((connections ?? []).map(c => c.user_id))
  const actCountMap = new Map<string, number>()
  for (const a of actCounts ?? []) {
    actCountMap.set(a.user_id, (actCountMap.get(a.user_id) ?? 0) + 1)
  }

  return users.map(u => ({
    id: u.id,
    email: u.email ?? '—',
    createdAt: u.created_at,
    lastSignIn: u.last_sign_in_at ?? null,
    isAdmin: profileMap.get(u.id)?.is_admin === true,
    stravaConnected: stravaSet.has(u.id),
    activityCount: actCountMap.get(u.id) ?? 0,
  }))
}

export async function TabUsers() {
  const users = await fetchUsers()

  return (
    <div className="space-y-3">
      {users.map(u => (
        <div key={u.id} className="bg-trail-card border border-trail-border rounded-2xl p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-trail-text truncate">{u.email}</p>
              <p className="text-xs text-trail-muted">
                Inscrit le {new Date(u.createdAt).toLocaleDateString('fr-FR')}
              </p>
              <p className={`text-xs ${lastLoginColor(u.lastSignIn)}`}>
                ⏱ Dernière connexion : {formatRelativeTime(u.lastSignIn)}
              </p>
            </div>
            <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
              u.isAdmin
                ? 'bg-trail-success/10 text-trail-success'
                : 'bg-trail-muted/10 text-trail-muted'
            }`}>
              {u.isAdmin ? '🛡 Admin' : 'User'}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              u.stravaConnected
                ? 'bg-trail-primary/10 text-trail-primary'
                : 'bg-trail-warning/10 text-trail-warning'
            }`}>
              {u.stravaConnected ? '✓ Strava' : '✗ Strava'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-trail-accent/10 text-trail-accent">
              {u.activityCount} activités
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier manuellement**

Aller sur `/admin?tab=users` — les utilisateurs réels de Supabase apparaissent avec leur email, date d'inscription, dernière connexion colorée, badges Strava et compteur d'activités.

- [ ] **Step 3 : Commit**

```bash
git add web/app/\(main\)/admin/components/TabUsers.tsx
git commit -m "feat(admin): TabUsers avec données réelles auth.users + Strava"
```

---

## Task 7 : API Vercel + lib/admin/vercel.ts

**Files:**
- Créer: `web/lib/admin/vercel.ts`
- Créer: `web/app/api/admin/deployments/route.ts`
- Créer: `web/__tests__/admin/vercel.test.ts`

- [ ] **Step 1 : Écrire le test du parseur Vercel**

Créer `web/__tests__/admin/vercel.test.ts` :

```ts
import { parseVercelDeployment } from '@/lib/admin/vercel'

const RAW = {
  uid: 'dpl_abc123',
  url: 'trail-cockpit-abc.vercel.app',
  name: 'trail-cockpit',
  target: 'production',
  readyState: 'READY',
  meta: { githubCommitMessage: 'fix(web): correction bug', githubCommitSha: 'abc1234def' },
  createdAt: Date.now() - 2 * 3600 * 1000,
}

describe('parseVercelDeployment', () => {
  it('extrait les champs correctement', () => {
    const d = parseVercelDeployment(RAW)
    expect(d.uid).toBe('dpl_abc123')
    expect(d.environment).toBe('Production')
    expect(d.state).toBe('READY')
    expect(d.commitMessage).toBe('fix(web): correction bug')
    expect(d.commitHash).toBe('abc1234')
    expect(d.url).toBe('https://trail-cockpit-abc.vercel.app')
  })

  it('truncate commitHash à 7 caractères', () => {
    const d = parseVercelDeployment({ ...RAW, meta: { githubCommitSha: '0123456789abcdef' } })
    expect(d.commitHash).toBe('0123456')
  })

  it('retourne null pour url si target != production', () => {
    const d = parseVercelDeployment({ ...RAW, target: null })
    expect(d.url).toBeNull()
  })
})
```

- [ ] **Step 2 : Lancer le test — doit échouer**

```bash
cd web && npx jest __tests__/admin/vercel.test.ts --no-coverage
```

Attendu : FAIL — module not found.

- [ ] **Step 3 : Créer lib/admin/vercel.ts**

```ts
export interface VercelDeployment {
  uid: string
  environment: string
  state: string
  commitMessage: string
  commitHash: string
  url: string | null
  createdAt: number
}

export function parseVercelDeployment(raw: Record<string, unknown>): VercelDeployment {
  const meta = (raw.meta ?? {}) as Record<string, string>
  const sha = meta.githubCommitSha ?? ''
  return {
    uid: String(raw.uid ?? ''),
    environment: raw.target === 'production' ? 'Production' : 'Preview',
    state: String(raw.readyState ?? raw.state ?? ''),
    commitMessage: meta.githubCommitMessage ?? meta.commitMessage ?? '—',
    commitHash: sha.slice(0, 7),
    url: raw.target === 'production' ? `https://${raw.url}` : null,
    createdAt: Number(raw.createdAt ?? 0),
  }
}

export async function fetchVercelDeployments(): Promise<VercelDeployment[]> {
  const token = process.env.VERCEL_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID
  if (!token || !projectId) return []

  const res = await fetch(
    `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=10`,
    { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 60 } }
  )
  if (!res.ok) return []

  const json = await res.json()
  return (json.deployments ?? []).map(parseVercelDeployment)
}
```

- [ ] **Step 4 : Lancer le test — doit passer**

```bash
cd web && npx jest __tests__/admin/vercel.test.ts --no-coverage
```

Attendu : PASS (3 tests).

- [ ] **Step 5 : Créer /api/admin/deployments/route.ts**

```ts
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/database/get-user'
import { getIsAdmin } from '@/lib/database/get-admin'
import { fetchVercelDeployments } from '@/lib/admin/vercel'

export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = await getIsAdmin(user.id)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const deployments = await fetchVercelDeployments()
  return NextResponse.json({ deployments })
}
```

- [ ] **Step 6 : Commit**

```bash
git add web/lib/admin/vercel.ts web/app/api/admin/deployments/route.ts web/__tests__/admin/vercel.test.ts
git commit -m "feat(admin): lib Vercel API + route /api/admin/deployments"
```

---

## Task 8 : TabDeployments

**Files:**
- Modifier: `web/app/(main)/admin/components/TabDeployments.tsx`

- [ ] **Step 1 : Remplacer le stub TabDeployments**

```tsx
import { fetchVercelDeployments } from '@/lib/admin/vercel'
import { formatRelativeTime } from '@/lib/admin/format'

const STATE_CONFIG: Record<string, { color: string; dot: string; label: string }> = {
  READY:    { color: 'text-trail-success', dot: 'bg-trail-success', label: 'Ready' },
  ERROR:    { color: 'text-trail-danger',  dot: 'bg-trail-danger',  label: 'Error' },
  BUILDING: { color: 'text-trail-warning', dot: 'bg-trail-warning', label: 'Building' },
  CANCELED: { color: 'text-trail-muted',   dot: 'bg-trail-muted',   label: 'Canceled' },
}

export async function TabDeployments() {
  const deployments = await fetchVercelDeployments()

  if (deployments.length === 0) {
    return (
      <div className="bg-trail-card border border-trail-border rounded-2xl p-4 text-center">
        <p className="text-xs text-trail-muted">
          Aucun déploiement — vérifier VERCEL_TOKEN et VERCEL_PROJECT_ID
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {deployments.map(d => {
        const cfg = STATE_CONFIG[d.state] ?? STATE_CONFIG.CANCELED
        return (
          <div key={d.uid} className="bg-trail-card border border-trail-border rounded-2xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                <span className="text-sm font-semibold text-trail-text">{d.environment}</span>
              </div>
              <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
            </div>
            <p className="text-xs text-trail-muted truncate">{d.commitMessage}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-trail-muted font-mono">{d.commitHash}</span>
              <span className="text-xs text-trail-muted">{formatRelativeTime(new Date(d.createdAt).toISOString())}</span>
            </div>
            {d.url && (
              <a href={d.url} target="_blank" rel="noreferrer"
                className="text-xs text-trail-primary underline">
                ↗ {d.url.replace('https://', '')}
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2 : Ajouter VERCEL_TOKEN et VERCEL_PROJECT_ID**

Dans Vercel Dashboard → Settings → Environment Variables, ajouter :
- `VERCEL_TOKEN` : token créé sur `vercel.com/account/tokens` (scope : lecture, pas d'expiration)
- `VERCEL_PROJECT_ID` : visible dans Project Settings → General → Project ID

Localement, ajouter dans `web/.env.local` :
```
VERCEL_TOKEN=<ton_token>
VERCEL_PROJECT_ID=<ton_project_id>
```

- [ ] **Step 3 : Vérifier manuellement**

Aller sur `/admin?tab=deployments` — les 10 derniers déploiements Vercel apparaissent avec état, message de commit, hash et durée relative.

- [ ] **Step 4 : Commit**

```bash
git add web/app/\(main\)/admin/components/TabDeployments.tsx web/.env.local
git commit -m "feat(admin): TabDeployments avec données live Vercel"
```

Note : s'assurer que `.env.local` est dans `.gitignore` (il l'est par défaut dans Next.js).

---

## Task 9 : TabWebhooks

**Files:**
- Modifier: `web/app/(main)/admin/components/TabWebhooks.tsx`

- [ ] **Step 1 : Remplacer le stub TabWebhooks**

```tsx
import { createServiceClient } from '@/lib/database/supabase-server'

async function fetchWebhookLogs() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('webhook_logs')
    .select('id, provider, event_type, user_id, status_code, created_at')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) return []
  return data ?? []
}

export async function TabWebhooks() {
  const logs = await fetchWebhookLogs()

  if (logs.length === 0) {
    return (
      <div className="bg-trail-card border border-trail-border rounded-2xl p-4 text-center">
        <p className="text-xs text-trail-muted">Aucun webhook enregistré pour l'instant.</p>
      </div>
    )
  }

  return (
    <div className="bg-trail-card border border-trail-border rounded-2xl divide-y divide-trail-border">
      {logs.map(log => {
        const ok = (log.status_code ?? 200) < 500
        return (
          <div key={log.id} className="flex items-center justify-between px-4 py-3 gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-trail-text">{log.event_type}</p>
              <p className="text-xs text-trail-muted">{log.provider}</p>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-xs font-semibold ${ok ? 'text-trail-success' : 'text-trail-danger'}`}>
                {ok ? '✓' : '✗'} {log.status_code ?? 200}
              </p>
              <p className="text-xs text-trail-muted">
                {new Date(log.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier manuellement**

Aller sur `/admin?tab=webhooks` — les logs apparaissent. Si vide, déclencher une activité sur Strava pour générer un webhook, puis revérifier.

- [ ] **Step 3 : Commit**

```bash
git add web/app/\(main\)/admin/components/TabWebhooks.tsx
git commit -m "feat(admin): TabWebhooks avec historique webhook_logs"
```

---

## Task 10 : TabSystem

**Files:**
- Modifier: `web/app/(main)/admin/components/TabSystem.tsx`

- [ ] **Step 1 : Remplacer le stub TabSystem**

```tsx
const SECTIONS = [
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

export async function TabSystem() {
  return (
    <div className="space-y-4">
      {SECTIONS.map(section => (
        <div key={section.title} className="bg-trail-card border border-trail-border rounded-2xl p-4 space-y-3">
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest ${section.color}`}>{section.title}</p>
            <p className="text-xs text-trail-muted mt-0.5">{section.description}</p>
          </div>
          <div className="space-y-2">
            {section.vars.map(varName => {
              const present = !!process.env[varName]
              return (
                <div key={varName} className="flex items-center justify-between">
                  <span className="text-xs text-trail-muted font-mono">{varName}</span>
                  <span className={`text-xs font-semibold ${present ? 'text-trail-success' : 'text-trail-warning'}`}>
                    {present ? '✓' : '⚠ manquant'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Application */}
      <div className="bg-trail-card border border-trail-border rounded-2xl p-4 space-y-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-trail-success">Application</p>
          <p className="text-xs text-trail-muted mt-0.5">Informations sur l'environnement d'exécution</p>
        </div>
        <div className="space-y-2">
          {[
            { label: 'Environnement', value: process.env.NODE_ENV ?? '—' },
            { label: 'Next.js',       value: process.env.NEXT_RUNTIME ?? 'nodejs' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs text-trail-muted">{label}</span>
              <span className="text-xs font-semibold text-trail-accent">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier manuellement**

Aller sur `/admin?tab=system` — les 4 sections apparaissent. Les variables présentes affichent ✓ vert, les absentes ⚠ orange.

- [ ] **Step 3 : Commit**

```bash
git add web/app/\(main\)/admin/components/TabSystem.tsx
git commit -m "feat(admin): TabSystem avec check variables d'env par section"
```

---

## Task 11 : Route /api/admin/sync + TabSync

**Files:**
- Créer: `web/app/api/admin/sync/route.ts`
- Modifier: `web/app/(main)/admin/components/TabSync.tsx`

- [ ] **Step 1 : Créer /api/admin/sync/route.ts**

```ts
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/database/get-user'
import { getIsAdmin } from '@/lib/database/get-admin'
import { createServiceClient } from '@/lib/database/supabase-server'
import { stravaSyncer } from '@/lib/providers/strava/syncer'
import { importActivities } from '@/lib/sync/import-activities'

export async function POST(request: Request) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = await getIsAdmin(user.id)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as { userId?: string; all?: boolean }
  const supabase = createServiceClient()

  // Résoudre la liste des user IDs à synchroniser
  let userIds: string[] = []
  if (body.all) {
    const { data: connections } = await supabase
      .from('provider_connections')
      .select('user_id')
      .eq('provider', 'strava')
    userIds = (connections ?? []).map(c => c.user_id as string)
  } else if (body.userId) {
    userIds = [body.userId]
  } else {
    return NextResponse.json({ error: 'userId or all required' }, { status: 400 })
  }

  const results: { userId: string; status: 'ok' | 'error'; message?: string }[] = []

  for (const uid of userIds) {
    try {
      const activities = await stravaSyncer.fetchActivities(uid, { fullSync: false })
      await importActivities(activities)
      results.push({ userId: uid, status: 'ok' })
    } catch (err) {
      results.push({ userId: uid, status: 'error', message: err instanceof Error ? err.message : 'Sync failed' })
    }
  }

  return NextResponse.json({ results })
}
```

- [ ] **Step 2 : Remplacer le stub TabSync**

```tsx
'use client'

import { useState } from 'react'

export function TabSync() {
  const [selectedUserId, setSelectedUserId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  async function syncOne() {
    if (!selectedUserId.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId.trim() }),
      })
      const data = await res.json()
      setResult(data.results?.[0]?.status === 'ok' ? '✓ Sync réussie' : `✗ ${data.results?.[0]?.message ?? 'Erreur'}`)
    } catch {
      setResult('✗ Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  async function syncAll() {
    setShowConfirm(false)
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      const data = await res.json()
      const ok = (data.results ?? []).filter((r: { status: string }) => r.status === 'ok').length
      const fail = (data.results ?? []).filter((r: { status: string }) => r.status === 'error').length
      setResult(`✓ ${ok} sync OK · ${fail} erreurs`)
    } catch {
      setResult('✗ Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Sync individuelle */}
      <div className="bg-trail-card border border-trail-border rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-trail-accent">Sync individuelle</p>
        <p className="text-xs text-trail-muted">Saisir l'UUID Supabase de l'utilisateur</p>
        <input
          type="text"
          value={selectedUserId}
          onChange={e => setSelectedUserId(e.target.value)}
          placeholder="UUID utilisateur…"
          className="w-full bg-trail-surface border border-trail-border rounded-xl px-3 py-2 text-sm text-trail-text placeholder:text-trail-muted outline-none focus:border-trail-primary"
        />
        <button
          onClick={syncOne}
          disabled={loading || !selectedUserId.trim()}
          className="w-full bg-trail-primary text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50"
        >
          {loading ? 'Sync en cours…' : 'Sync →'}
        </button>
      </div>

      {/* Sync de masse */}
      <div className="bg-trail-card border border-trail-border rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-trail-danger">Sync de masse</p>
        <p className="text-xs text-trail-muted">Déclenche une sync Strava pour tous les utilisateurs connectés.</p>
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            disabled={loading}
            className="w-full bg-trail-danger text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50"
          >
            Sync tous ⚠
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-trail-warning font-semibold text-center">Confirmer la sync de masse ?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-trail-surface border border-trail-border text-trail-muted rounded-xl py-2 text-sm"
              >
                Annuler
              </button>
              <button
                onClick={syncAll}
                className="flex-1 bg-trail-danger text-white rounded-xl py-2 text-sm font-semibold"
              >
                Confirmer
              </button>
            </div>
          </div>
        )}
      </div>

      {result && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
          result.startsWith('✓') ? 'bg-trail-success/10 text-trail-success' : 'bg-trail-danger/10 text-trail-danger'
        }`}>
          {result}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3 : Vérifier manuellement**

Aller sur `/admin?tab=sync`. Saisir un UUID utilisateur et cliquer "Sync →" — le résultat doit s'afficher. Tester "Sync tous" → confirmer → vérifier le message de résultat.

- [ ] **Step 4 : Commit**

```bash
git add web/app/api/admin/sync/route.ts web/app/\(main\)/admin/components/TabSync.tsx
git commit -m "feat(admin): TabSync + route /api/admin/sync individuelle et masse"
```

---

## Task 12 : Route suppression utilisateur

**Files:**
- Créer: `web/app/api/admin/users/[id]/route.ts`

- [ ] **Step 1 : Créer la route DELETE**

```ts
import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/database/get-user'
import { getIsAdmin } from '@/lib/database/get-admin'
import { createServiceClient } from '@/lib/database/supabase-server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = await getIsAdmin(user.id)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  // Empêcher la suppression de son propre compte depuis l'admin
  if (id === user.id) {
    return NextResponse.json({ error: 'Cannot delete own account' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2 : Ajouter le bouton Supprimer dans TabUsers**

Dans `web/app/(main)/admin/components/TabUsers.tsx`, la suppression nécessite une interaction client (confirmation). Ajouter un `UserActions` client component dans le même dossier :

Créer `web/app/(main)/admin/components/UserActions.tsx` :
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function UserActions({ userId, email }: { userId: string; email: string }) {
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function deleteUser() {
    setLoading(true)
    await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
    setLoading(false)
    setConfirm(false)
    router.refresh()
  }

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="text-xs text-trail-danger underline mt-1"
      >
        Supprimer
      </button>
    )
  }

  return (
    <div className="flex gap-2 mt-1 items-center">
      <span className="text-xs text-trail-warning">Supprimer {email} ?</span>
      <button onClick={() => setConfirm(false)} className="text-xs text-trail-muted underline">Annuler</button>
      <button onClick={deleteUser} disabled={loading} className="text-xs text-trail-danger underline font-semibold">
        {loading ? '…' : 'Confirmer'}
      </button>
    </div>
  )
}
```

Puis dans `TabUsers.tsx`, importer et utiliser `UserActions` dans chaque carte :
```tsx
import { UserActions } from './UserActions'
// Dans le JSX de chaque carte user, après les badges :
<UserActions userId={u.id} email={u.email} />
```

- [ ] **Step 3 : Vérifier manuellement**

Sur `/admin?tab=users`, le bouton "Supprimer" apparaît sous chaque user (sauf le sien). Cliquer → confirmation → cliquer "Confirmer" → la liste se rafraîchit sans l'utilisateur supprimé. Cliquer "Annuler" annule sans suppression.

- [ ] **Step 4 : Commit final**

```bash
git add web/app/api/admin/users/ web/app/\(main\)/admin/components/UserActions.tsx web/app/\(main\)/admin/components/TabUsers.tsx
git commit -m "feat(admin): suppression utilisateur avec confirmation depuis TabUsers"
```

---

## Récapitulatif des tests à faire tourner avant de livrer

```bash
cd web && npx jest __tests__/admin/ --no-coverage
```

Attendu : 7 tests passants (4 format + 3 vercel).

```bash
cd web && npx tsc --noEmit
```

Attendu : 0 erreurs TypeScript.
