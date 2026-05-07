import { createServiceClient } from '@/lib/database/supabase-server'
import { formatRelativeTime, lastLoginColor } from '@/lib/admin/format'
import { UserActions } from './UserActions'

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
    isAdmin: (profileMap.get(u.id) as any)?.is_admin === true,
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
          <UserActions userId={u.id} email={u.email} />
        </div>
      ))}
    </div>
  )
}
