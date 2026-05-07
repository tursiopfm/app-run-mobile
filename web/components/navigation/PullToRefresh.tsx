'use client'

import { type ReactNode, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

const THRESHOLD = 72 // px to pull before triggering

export function PullToRefresh({ children }: { children: ReactNode }) {
  const router   = useRouter()
  const ref      = useRef<HTMLElement>(null)
  const startY   = useRef<number | null>(null)
  const [pull, setPull]     = useState(0)
  const [syncing, setSyncing] = useState(false)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if ((ref.current?.scrollTop ?? 0) <= 0) {
      startY.current = e.touches[0].clientY
      console.log('[PTR] touchStart captured at y=', startY.current)
    }
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === null || syncing) return
    if ((ref.current?.scrollTop ?? 0) > 0) { startY.current = null; return }
    const delta = e.touches[0].clientY - startY.current
    if (delta > 0) setPull(Math.min(delta, THRESHOLD * 1.5))
  }, [syncing])

  const onTouchEnd = useCallback(async () => {
    console.log('[PTR] touchEnd pull=', Math.round(pull), 'threshold=', THRESHOLD)
    if (pull >= THRESHOLD && !syncing) {
      console.log('[PTR] syncing...')
      setSyncing(true)
      setPull(0)
      startY.current = null
      try {
        const res = await fetch('/api/strava/sync', { method: 'POST' })
        console.log('[PTR] sync done status=', res.status)
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
  // Keep icon within the visible area (top: 4px when just starting to show, up to 36px at threshold)
  const iconY    = syncing ? 12 : Math.max(4, pull * 0.5)

  return (
    <main
      ref={ref}
      // overscroll-y-contain prevents Chrome/Safari from intercepting the pull gesture with their native PTR
      className="flex-1 pb-24 overflow-y-auto relative overscroll-y-contain"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {showPull && (
        <div
          className="pointer-events-none absolute left-0 right-0 flex justify-center z-10 transition-opacity duration-150"
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
