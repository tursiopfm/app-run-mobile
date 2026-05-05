'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Dumbbell, Calendar, Footprints, Trophy, Settings } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',  icon: LayoutGrid, label: 'Cockpit'   },
  { href: '/charge',     icon: Dumbbell,   label: 'Charge'    },
  { href: '/plan',       icon: Calendar,   label: 'Plan'      },
  { href: '/activities', icon: Footprints, label: 'Activités' },
  { href: '/courses',    icon: Trophy,     label: 'Courses'   },
  { href: '/settings',   icon: Settings,   label: 'Réglages'  },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-trail-surface border-t border-trail-border pb-safe">
      <div className="flex items-stretch max-w-lg mx-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
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
