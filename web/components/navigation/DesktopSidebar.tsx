'use client'

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid, Dumbbell, Calendar, Footprints, Trophy,
  ShieldCheck, Settings, PanelLeft, PanelLeftClose,
} from 'lucide-react'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = {
  isAdmin: boolean
  displayName: string | null
  mode?: 'mission' | 'expert'
}

export function DesktopSidebar({ isAdmin, displayName, mode = 'expert' }: Props) {
  const pathname = usePathname()
  const tabs = useT().tabs
  const [pinned, setPinned] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('sidebar_pinned') === 'true'
  })
  const [hovered, setHovered] = useState(false)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const expanded = pinned || hovered

  const spacerWidth = pinned ? 240 : 64
  const navWidth = expanded ? 240 : 64

  function pin() {
    setPinned(true)
    localStorage.setItem('sidebar_pinned', 'true')
  }
  function unpin() {
    setPinned(false)
    setHovered(false)
    localStorage.setItem('sidebar_pinned', 'false')
  }

  function handleMouseEnter() {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    if (!pinned) setHovered(true)
  }
  function handleMouseLeave() {
    if (!pinned) {
      leaveTimer.current = setTimeout(() => setHovered(false), 150)
    }
  }

  const handleNavClick = useCallback(() => {
    if (!pinned) setHovered(false)
  }, [pinned])

  // Mode Mission : onglets Charge et Courses masqués (réservés à l'Expert).
  const MISSION_HIDDEN = ['/charge', '/courses']
  const NAV = [
    { href: '/dashboard',  icon: LayoutGrid, label: tabs.cockpit },
    { href: '/charge',     icon: Dumbbell,   label: tabs.charge },
    { href: '/plan',       icon: Calendar,   label: tabs.plan },
    { href: '/activities', icon: Footprints, label: tabs.activities },
    { href: '/courses',    icon: Trophy,     label: tabs.courses },
  ].filter(item => mode !== 'mission' || !MISSION_HIDDEN.includes(item.href))
  if (isAdmin) NAV.push({ href: '/admin', icon: ShieldCheck, label: 'Admin' })

  const initials = displayName
    ? displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <>
      {/* Spacer — only follows pinned state */}
      <div
        className="hidden md:block shrink-0 transition-[width] duration-200"
        style={{ width: spacerWidth }}
      />

      {/* Fixed sidebar */}
      <nav
        className="hidden md:flex fixed top-0 left-0 bottom-0 z-40 flex-col bg-trail-surface border-r border-trail-border transition-[width] duration-200 overflow-hidden"
        style={{ width: navWidth }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Header: logo + toggle */}
        <div className="shrink-0 flex items-center gap-3 px-3 h-14 border-b border-trail-border">
          <Image src="/icons/icon-192.png" alt="Trail Cockpit" width={36} height={36} className="shrink-0 rounded-lg" />
          {expanded && (
            <span className="flex-1 text-sm font-bold tracking-widest uppercase whitespace-nowrap">
              <span className="text-trail-primary">Trail</span>
              <span className="text-trail-text"> Cockpit</span>
            </span>
          )}
          {/* Toggle pin/unpin — always visible in header */}
          <button
            onClick={pinned ? unpin : pin}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-trail-muted hover:bg-trail-border/40 hover:text-trail-text transition-colors"
          >
            {pinned ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
          </button>
        </div>

        {/* Nav items */}
        <div className="flex-1 flex flex-col gap-1 px-2 py-3 overflow-y-auto">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={handleNavClick}
                title={!expanded ? label : undefined}
                className={`group relative flex items-center gap-3 rounded-lg transition-colors ${
                  expanded ? 'px-3 py-2.5' : 'justify-center px-0 py-2.5'
                } ${
                  active
                    ? 'bg-trail-primary/12 text-trail-primary'
                    : 'text-trail-muted hover:bg-trail-border/40 hover:text-trail-text'
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 1.8} className="shrink-0" />
                {expanded && (
                  <span className="text-[13px] font-medium whitespace-nowrap">{label}</span>
                )}
                {!expanded && (
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
          <Link
            href="/settings"
            onClick={handleNavClick}
            title={!expanded ? 'Réglages' : undefined}
            className={`group relative flex items-center gap-3 rounded-lg transition-colors ${
              expanded ? 'px-3 py-2.5' : 'justify-center px-0 py-2.5'
            } ${
              pathname.startsWith('/settings')
                ? 'bg-trail-primary/12 text-trail-primary'
                : 'text-trail-muted hover:bg-trail-border/40 hover:text-trail-text'
            }`}
          >
            <Settings size={20} strokeWidth={1.8} className="shrink-0" />
            {expanded && (
              <span className="text-[13px] font-medium whitespace-nowrap">Réglages</span>
            )}
            {!expanded && (
              <span className="pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md bg-trail-card border border-trail-border text-trail-text text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                Réglages
              </span>
            )}
          </Link>

          {/* User card */}
          <Link
            href="/profile"
            onClick={handleNavClick}
            className={`flex items-center gap-3 rounded-lg py-2 transition-colors hover:bg-trail-border/40 ${
              expanded ? 'px-3' : 'justify-center px-0'
            }`}
          >
            <div className="w-8 h-8 shrink-0 rounded-full bg-trail-primary flex items-center justify-center text-white text-xs font-semibold">
              {initials}
            </div>
            {expanded && displayName && (
              <span className="text-[13px] font-medium text-trail-text truncate">{displayName}</span>
            )}
          </Link>
        </div>
      </nav>
    </>
  )
}
