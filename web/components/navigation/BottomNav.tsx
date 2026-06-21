'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Dumbbell, Calendar, Footprints, Trophy, ShieldCheck, Settings } from 'lucide-react'
import { useT } from '@/lib/i18n/I18nProvider'

// Fallback si le router Next.js est gelé (cas reproductible après visite de
// /charge avec ordre de blocs custom — voir tasks/lessons). Si l'URL n'a pas
// changé 700ms après le click, on déclenche une navigation native via
// location.href. L'utilisateur voit un reload léger plutôt qu'un gel total.
// À retirer une fois la cause racine corrigée.
function navWithFallback(href: string) {
  const start = location.pathname
  setTimeout(() => {
    if (location.pathname === start) {
      console.warn('[BottomNav] router stuck 700ms after click, fallback ->', href)
      location.href = href
    }
  }, 700)
}

export function BottomNav({ isAdmin = false, mode = 'expert' }: { isAdmin?: boolean; mode?: 'mission' | 'expert' }) {
  const pathname = usePathname()
  const tabs = useT().tabs
  // Mode Mission : onglets Charge et Courses masqués (réservés à l'Expert).
  const MISSION_HIDDEN = ['/charge', '/courses']
  const BASE_NAV = [
    { href: '/dashboard',  icon: LayoutGrid, label: tabs.cockpit    },
    { href: '/charge',     icon: Dumbbell,   label: tabs.charge     },
    { href: '/plan',       icon: Calendar,   label: tabs.plan       },
    { href: '/activities', icon: Footprints, label: tabs.activities },
    { href: '/courses',    icon: Trophy,     label: tabs.courses    },
  ].filter(item => mode !== 'mission' || !MISSION_HIDDEN.includes(item.href))
  // En Mode Mission, l'accès aux Réglages passe par la barre du bas (la roue
  // dentée du header est masquée — voir AppShell). Même style que les onglets.
  const items = [...BASE_NAV]
  if (mode === 'mission') items.push({ href: '/settings', icon: Settings, label: 'Réglages' })
  if (isAdmin) items.push({ href: '/admin', icon: ShieldCheck, label: 'Admin' })

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-trail-surface border-t border-trail-border pb-safe md:hidden">
      <div className="flex items-stretch max-w-lg mx-auto">
        {items.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={() => navWithFallback(href)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] transition-colors ${
                active ? 'text-trail-primary' : 'text-trail-muted hover:text-trail-text'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className="font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
