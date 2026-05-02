'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, LayoutDashboard, Activity, Bot, Settings } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/',           icon: Home,            label: 'Accueil'   },
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/activities', icon: Activity,        label: 'Activités' },
  { href: '/coach',      icon: Bot,             label: 'Coach'     },
  { href: '/settings',   icon: Settings,        label: 'Réglages'  },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-trail-surface border-t border-trail-border pb-safe">
      <div className="flex items-stretch max-w-lg mx-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-3 text-xs transition-colors ${
                active ? 'text-trail-primary' : 'text-trail-muted hover:text-trail-text'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className="font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
