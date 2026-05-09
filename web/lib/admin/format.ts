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
