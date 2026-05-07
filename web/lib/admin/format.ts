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
