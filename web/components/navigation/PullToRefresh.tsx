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
    if (ref.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY
    }
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === null || syncing) return
    if ((ref.current?.scrollTop ?? 0) > 0) { startY.current = null; return }
    const delta = e.touches[0].clientY - startY.current
    if (delta > 0) setPull(Math.min(delta, THRESHOLD * 1.5))
  }, [syncing])

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

  const progress  = Math.min(pull / THRESHOLD, 1)
  const showPull  = pull > 8 || syncing
  const iconY     = syncing ? 12 : Math.max(pull - 44, -32)

  return (
    <main
      ref={ref}
      className="flex-1 pb-24 overflow-y-auto relative"
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
