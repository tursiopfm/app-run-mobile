'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, LogOut } from 'lucide-react'
import { createClient } from '@/lib/database/supabase-client'
import { useT } from '@/lib/i18n/I18nProvider'

export function AccountSection() {
  const router = useRouter()
  const L = useT().settings
  const [email, setEmail] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
    })
  }, [])

  async function handleLogout() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (!email) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 px-3 py-[10px] rounded-[10px] bg-trail-surface">
        <div className="w-10 h-10 rounded-[12px] bg-trail-card border border-trail-border flex items-center justify-center flex-shrink-0">
          <Mail size={18} className="text-trail-muted" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-micro font-semibold uppercase tracking-wider text-trail-muted">{L.emailLabel}</p>
          <p className="text-body-sm text-trail-text truncate">{email}</p>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-[6px] px-3 py-[6px] rounded-full border border-red-500/25 text-red-400 text-micro font-semibold tracking-wide hover:bg-red-500/10 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          <LogOut size={12} />
          {loggingOut ? '…' : L.logoutLabel}
        </button>
      </div>
    </div>
  )
}
