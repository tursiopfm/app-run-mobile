/**
 * Dernière trace d'utilisation d'un compte.
 * `last_sign_in_at` n'est écrit qu'à une authentification réelle (saisie du code OTP) :
 * une session prolongée par rotation du refresh token le laisse figé pendant des semaines.
 * `updated_at`, lui, bouge à chaque renouvellement de session — on garde la plus récente.
 */
export function lastSeenAt(
  lastSignInAt: string | null | undefined,
  updatedAt: string | null | undefined,
): string | null {
  const dates = [lastSignInAt, updatedAt].filter((d): d is string => !!d)
  if (dates.length === 0) return null
  return dates.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b))
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffH = diffMs / 3600000
  if (diffH < 24) return "aujourd'hui"
  if (diffH < 48) return 'hier'
  return `il y a ${Math.floor(diffH / 24)} jours`
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${date} ${time}`
}

export function lastLoginColor(iso: string | null): string {
  if (!iso) return 'text-trail-muted'
  const diffDays = (Date.now() - new Date(iso).getTime()) / 86400000
  return diffDays < 3 ? 'text-trail-success' : 'text-trail-warning'
}
