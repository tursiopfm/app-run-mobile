'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid, Dumbbell, Calendar, Footprints, Trophy,
  ShieldCheck, Settings, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = {
  isAdmin: boolean
  displayName: string | null
}

export function DesktopSidebar({ isAdmin, displayName }: Props) {
  const pathname = usePathname()
  const tabs = useT().tabs
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('sidebar_collapsed') !== 'false'
  })

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar_collapsed', String(next))
  }

  const width = collapsed ? 64 : 240

  const NAV = [
    { href: '/dashboard',  icon: LayoutGrid, label: tabs.cockpit },
    { href: '/charge',     icon: Dumbbell,   label: tabs.charge },
    { href: '/plan',       icon: Calendar,   label: tabs.plan },
    { href: '/activities', icon: Footprints, label: tabs.activities },
    { href: '/courses',    icon: Trophy,     label: tabs.courses },
  ]
  if (isAdmin) NAV.push({ href: '/admin', icon: ShieldCheck, label: 'Admin' })

  const BOTTOM = [
    { href: '/settings', icon: Settings, label: 'Réglages' },
  ]

  const initials = displayName
    ? displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <>
      {/* Spacer in flex flow to push content right */}
      <div
        className="hidden md:block shrink-0 transition-[width] duration-200"
        style={{ width }}
      />

      {/* Fixed sidebar */}
      <nav
        className="hidden md:flex fixed top-0 left-0 bottom-0 z-40 flex-col bg-trail-surface border-r border-trail-border transition-[width] duration-200 overflow-hidden"
        style={{ width }}
      >
        {/* Logo */}
        <div className="shrink-0 flex items-center gap-3 px-3 h-14 border-b border-trail-border">
          <div className="w-9 h-9 shrink-0 rounded-lg bg-trail-primary flex items-center justify-center text-white font-bold text-base">
            T
          </div>
          {!collapsed && (
            <span className="text-sm font-bold tracking-widest uppercase whitespace-nowrap">
              <span className="text-trail-primary">Trail</span>
              <span className="text-trail-text"> Cockpit</span>
            </span>
          )}
        </div>

        {/* Nav items */}
        <div className="flex-1 flex flex-col gap-1 px-2 py-3 overflow-y-auto">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={`group relative flex items-center gap-3 rounded-lg transition-colors ${
                  collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
                } ${
                  active
                    ? 'bg-trail-primary/12 text-trail-primary'
                    : 'text-trail-muted hover:bg-trail-border/40 hover:text-trail-text'
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 1.8} className="shrink-0" />
                {!collapsed && (
                  <span className="text-[13px] font-medium whitespace-nowrap">{label}</span>
                )}
                {collapsed && (
                  <span className="pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md bg-trail-card border border-trail-border text-trail-text text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                    {label}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Bottom section */}
        <div className="shrink-0 border-t border-trail-border px-2 py-2 space-y-1">
          {BOTTOM.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={`group relative flex items-center gap-3 rounded-lg transition-colors ${
                  collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
                } ${
                  active
                    ? 'bg-trail-primary/12 text-trail-primary'
                    : 'text-trail-muted hover:bg-trail-border/40 hover:text-trail-text'
                }`}
              >
                <Icon size={20} strokeWidth={1.8} className="shrink-0" />
                {!collapsed && (
                  <span className="text-[13px] font-medium whitespace-nowrap">{label}</span>
                )}
                {collapsed && (
                  <span className="pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md bg-trail-card border border-trail-border text-trail-text text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                    {label}
                  </span>
                )}
              </Link>
            )
          })}

          {/* Toggle button */}
          <button
            onClick={toggle}
            className={`w-full flex items-center gap-3 rounded-lg py-2.5 text-trail-muted hover:bg-trail-border/40 hover:text-trail-text transition-colors ${
              collapsed ? 'justify-center px-0' : 'px-3'
            }`}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!collapsed && (
              <span className="text-[13px] font-medium whitespace-nowrap">Réduire</span>
            )}
          </button>

          {/* User card */}
          <Link
            href="/profile"
            className={`flex items-center gap-3 rounded-lg py-2 transition-colors hover:bg-trail-border/40 ${
              collapsed ? 'justify-center px-0' : 'px-3'
            }`}
          >
            <div className="w-8 h-8 shrink-0 rounded-full bg-trail-primary flex items-center justify-center text-white text-xs font-semibold">
              {initials}
            </div>
            {!collapsed && displayName && (
              <span className="text-[13px] font-medium text-trail-text truncate">{displayName}</span>
            )}
          </Link>
        </div>
      </nav>
    </>
  )
}
