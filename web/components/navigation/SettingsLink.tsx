'use client'

import Link from 'next/link'
import { MoreVertical } from 'lucide-react'
import { hapticTap } from '@/lib/haptics'

// Lien ⋮ du header vers les Réglages, isolé en client component pour porter le
// retour haptique au tap (AppShell étant un server component).
export function SettingsLink({ ariaLabel }: { ariaLabel: string }) {
  return (
    <Link
      href="/settings"
      onClick={() => hapticTap()}
      className="text-trail-muted hover:text-trail-text p-1 -mr-1"
      aria-label={ariaLabel}
    >
      <MoreVertical size={18} />
    </Link>
  )
}
