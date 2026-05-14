import Link from 'next/link'
import { User, ChevronRight } from 'lucide-react'

type Props = {
  firstName:        string | null
  lastName:         string | null
  email:            string | null
  avatarUrl:        string | null
  accountCreatedAt: string | null
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function IdentityPreview({
  firstName, lastName, email, avatarUrl, accountCreatedAt,
}: Props) {
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'Athlète'
  return (
    <Link
      href="/profile/identity"
      className="flex items-center gap-3 px-3 py-[10px] rounded-[10px] bg-trail-surface hover:bg-trail-border/30 transition-colors group"
    >
      <div className="w-12 h-12 rounded-full overflow-hidden bg-trail-card border border-trail-border flex items-center justify-center flex-shrink-0">
        {avatarUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          : <User size={20} className="text-trail-muted" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-trail-text truncate">{fullName}</p>
        <p className="text-[11px] text-trail-muted truncate">{email ?? '—'}</p>
        <p className="text-[10px] text-trail-muted/80 mt-[1px]">
          Membre depuis {formatDate(accountCreatedAt)}
        </p>
      </div>
      <ChevronRight size={16} className="text-trail-muted flex-shrink-0 group-hover:text-trail-text transition-colors" />
    </Link>
  )
}
