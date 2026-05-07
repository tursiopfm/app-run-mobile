'use client'

import { type ReactNode, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

const THRESHOLD = 72 // px to pull before triggering

// The page body is the scroll container (not <main>). Using `overflow-y-auto`
// on a `flex-1` child of a `min-h-screen` flex column produces inconsistent
// scroll containers across browsers (especially Android Chrome with the
// dynamic URL bar). Reading `window.scrollY` is reliable.
function isAtTop(): boolean {
  if (typeof window === 'undefined') return true
  return window.scrollY <= 0
}

export function PullToRefresh({ children }: { children: ReactNode }) {
  const router   = useRouter()
  const startY   = useRef<number | null>(null)
  const [pull, setPull]     = useState(0)
  const [syncing, setSyncing] = useState(false)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = isAtTop() ? e.touches[0].clientY : null
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === null || syncing) return
    if (!isAtTop()) {
      // We have scrolled away from the top — let the browser handle the scroll
      startY.current = null
      if (pull !== 0) setPull(0)
      return
    }
    const delta = e.touches[0].clientY - startY.current
    if (delta > 0) {
      setPull(Math.min(delta, THRESHOLD * 1.5))
    } else if (pull !== 0) {
      setPull(0)
    }
  }, [syncing, pull])

  const onTouchEnd = useCallback(async () => {
    if (pull >= THRESHOLD && !syncing) {
      setSyncing(true)
      setPull(0)
      startY.current = null
      try {
        await fetch('/api/strava/sync', { method: 'POST' })
      } finally {
        router.refresh()
        setSyncing(false)
      }
    } else {
      setPull(0)
      startY.current = null
    }
  }, [pull, syncing, router])

  const progress = Math.min(pull / THRESHOLD, 1)
  const showPull = pull > 8 || syncing
  // Position the indicator with `fixed` so it stays anchored under the header
  // regardless of whether the body or <main> scrolls.
  const iconY = syncing ? 60 : Math.max(56, 56 + pull * 0.5)

  return (
    <main
      className="flex-1 pb-24 relative"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {showPull && (
        <div
          className="pointer-events-none fixed left-0 right-0 flex justify-center z-30 transition-opacity duration-150"
          style={{ top: `${iconY}px`, opacity: syncing ? 1 : progress }}
        >
          <div className="bg-trail-header rounded-full p-2 shadow">
            <RefreshCw
              size={18}
              className={`text-trail-primary ${syncing ? 'animate-spin' : ''}`}
              style={syncing ? undefined : { transform: `rotate(${progress * 270}deg)` }}
            />
          </div>
        </div>
      )}
      {children}
    </main>
  )
}
