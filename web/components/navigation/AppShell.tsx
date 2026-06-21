import type { ReactNode } from 'react'
import { BottomNav } from './BottomNav'
import { DesktopSidebar } from './DesktopSidebar'
import { PullToRefresh } from './PullToRefresh'
import { SyncOnFocus } from './SyncOnFocus'
import { SettingsLink } from './SettingsLink'
import { createClient } from '@/lib/database/supabase-server'
import { getServerUser } from '@/lib/database/get-user'
import { getIsAdmin } from '@/lib/database/get-admin'
import { getServerT } from '@/lib/i18n/server'
import { getServerAppMode } from '@/lib/preferences/server'
import { AppModeToggle } from '@/components/settings/AppModeToggle'
import { ExpertModeHint } from '@/components/settings/ExpertModeHint'

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
  const [displayName, user, mode] = await Promise.all([fetchDisplayName(), getServerUser(), getServerAppMode()])
  const isAdmin = user ? await getIsAdmin(user.id) : false
  const settingsAria = getServerT().settings.title

  return (
    <div className="flex min-h-screen bg-trail-bg">
      <DesktopSidebar isAdmin={isAdmin} displayName={displayName} mode={mode} />
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <header
          className="sticky top-0 z-40 bg-trail-header border-b border-trail-border px-4 pb-3 md:hidden"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
        >
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <span className="text-base font-bold tracking-widest uppercase font-display">
              <span className="text-trail-primary">Trail</span>
              <span className="text-trail-text"> Cockpit</span>
            </span>
            <div className="flex items-center gap-2">
              {/* Bouton de bascule UNIQUEMENT en Mode Mission (affiche « Expert »),
                  décalé à gauche du nom. En Expert : pas de bouton ici. */}
              {mode === 'mission' && <AppModeToggle variant="compact" initialMode={mode} />}
              {displayName && (
                <span className="text-sm font-semibold text-trail-primary">{displayName}</span>
              )}
              {/* En Mode Mission, l'accès Réglages se fait via la roue dentée
                  de la barre du bas → on masque le ⋮ ici. */}
              {mode !== 'mission' && <SettingsLink ariaLabel={settingsAria} />}
            </div>
          </div>
        </header>
        <PullToRefresh>
          <SyncOnFocus />
          {children}
        </PullToRefresh>
        <BottomNav isAdmin={isAdmin} mode={mode} />
      </div>
      <ExpertModeHint />
    </div>
  )
}
