import { User } from 'lucide-react'

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

export function IdentityCard({ firstName, lastName, email, avatarUrl, accountCreatedAt }: Props) {
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'Athlète'

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[12px] space-y-[12px]">
      <p className="text-[14px] font-bold text-trail-text">Identité</p>

      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-full overflow-hidden bg-trail-surface border border-trail-border flex items-center justify-center flex-shrink-0">
          {avatarUrl
            ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            : <User size={22} className="text-trail-muted" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-trail-text truncate">{fullName}</p>
          <p className="text-[12px] text-trail-muted truncate">{email ?? '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-[8px] text-[12px]">
        <div className="rounded-[10px] bg-trail-surface px-3 py-[8px]">
          <p className="text-[10px] uppercase tracking-wider text-trail-muted">Compte créé</p>
          <p className="text-[13px] text-trail-text mt-[2px]">{formatDate(accountCreatedAt)}</p>
        </div>
        <div className="rounded-[10px] bg-trail-surface px-3 py-[8px]">
          <p className="text-[10px] uppercase tracking-wider text-trail-muted">Abonnement</p>
          <p className="text-[13px] text-trail-text mt-[2px]">Free</p>
        </div>
      </div>
    </div>
  )
}
