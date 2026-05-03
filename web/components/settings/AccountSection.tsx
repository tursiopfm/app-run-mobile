'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/database/supabase-client'

export function AccountSection() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
    })
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (!email) return null

  return (
    <section>
      <p className="text-xs font-semibold text-trail-muted uppercase tracking-wide mb-2 px-1">Compte</p>
      <div className="bg-trail-card border border-trail-border rounded-2xl divide-y divide-trail-border">
        <div className="flex items-center justify-between p-4">
          <p className="text-sm text-trail-muted">Email</p>
          <p className="text-sm text-trail-text truncate max-w-[200px]">{email}</p>
        </div>
        <div className="p-4">
          <button
            onClick={handleLogout}
            className="w-full text-sm text-red-500 font-medium py-1"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </section>
  )
}
