import type { ReactNode } from 'react'
import Link from 'next/link'
import { getServerUser } from '@/lib/database/get-user'
import { AppShell } from '@/components/navigation/AppShell'
import { ImportProgressBanner } from '@/components/ui/ImportProgressBanner'
import { WhatsNewModal } from '@/components/ui/WhatsNewModal'
import { PreferencesProvider } from '@/lib/preferences/PreferencesProvider'

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const user = await getServerUser()

  // Connecté → expérience app complète (parité avec le layout (main)).
  if (user) {
    return (
      <PreferencesProvider>
        <ImportProgressBanner />
        <AppShell>{children}</AppShell>
        <WhatsNewModal />
      </PreferencesProvider>
    )
  }

  // Visiteur anonyme → chrome minimal + CTA inscription (PreferencesProvider no-op sans user).
  return (
    <PreferencesProvider>
      <div className="min-h-screen flex flex-col bg-trail-bg">
        <header
          className="sticky top-0 z-40 bg-trail-header border-b border-trail-border px-4 pb-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
        >
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <Link
              href="/"
              aria-label="Trail Cockpit — accueil"
              className="text-base font-bold tracking-widest uppercase font-display"
            >
              <span className="text-trail-primary">Trail</span>
              <span className="text-trail-text"> Cockpit</span>
            </Link>
            <Link
              href="/?mode=signup"
              className="text-sm font-semibold rounded-full px-3 py-1.5 bg-trail-primary text-white"
            >
              Créer un compte
            </Link>
          </div>
        </header>

        {/* Le contenu (ActivityDetailClient) gère sa propre largeur max. */}
        <div className="flex-1 min-w-0">{children}</div>

        <footer
          className="sticky bottom-0 z-40 bg-trail-header border-t border-trail-border px-4 py-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
        >
          <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
            <span className="text-sm text-trail-muted">Créé sur Trail Cockpit</span>
            <Link
              href="/?mode=signup"
              aria-label="Découvrir Trail Cockpit et créer un compte"
              className="text-sm font-semibold rounded-full px-4 py-2 bg-trail-primary text-white"
            >
              Découvrir
            </Link>
          </div>
        </footer>
      </div>
    </PreferencesProvider>
  )
}
