import type { ReactNode } from 'react'
import Link from 'next/link'
import { BottomNav } from './BottomNav'
import { PullToRefresh } from './PullToRefresh'
import { SyncOnFocus } from './SyncOnFocus'
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
        <SyncOnFocus />
        {children}
      </PullToRefresh>
      <BottomNav isAdmin={isAdmin} />
    </div>
  )
}
