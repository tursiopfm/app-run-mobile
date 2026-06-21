'use client'

import { type ReactNode, useRef, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { useT } from '@/lib/i18n/I18nProvider'

const THRESHOLD = 72 // px to pull before triggering
const SYNC_TIMEOUT_MS = 15000 // abort the sync if Strava hangs

// The page body is the scroll container (not <main>). Using `overflow-y-auto`
// on a `flex-1` child of a `min-h-screen` flex column produces inconsistent
// scroll containers across browsers (especially Android Chrome with the
// dynamic URL bar). Reading `window.scrollY` is reliable.
function isAtTop(): boolean {
  if (typeof window === 'undefined') return true
  return window.scrollY <= 0
}

type SyncMsg = { kind: 'ok' | 'error'; text: string }

export function PullToRefresh({ children }: { children: ReactNode }) {
  const router   = useRouter()
  const L        = useT().settings
  const startY   = useRef<number | null>(null)
  const armed    = useRef(false) // haptic fired once per gesture when threshold crossed
  const [pull, setPull]     = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg]       = useState<SyncMsg | null>(null)

  // Auto-dismiss the result toast a couple seconds after the sync settles.
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2600)
    return () => clearTimeout(t)
  }, [msg])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Ignore les touches qui démarrent sur une poignée de drag (dnd-kit).
    // Sans ça, le pull-to-refresh peut s'activer en parallèle du drag-and-drop
    // et déclencher un fetch + router.refresh() qui gèle le router.
    const target = e.target as HTMLElement | null
    if (target?.closest?.('[aria-roledescription="sortable"]')) {
      startY.current = null
      return
    }
    armed.current = false
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
      // Light haptic tick once the pull arms the refresh (mobile only, best-effort).
      if (delta >= THRESHOLD && !armed.current) {
        armed.current = true
        navigator.vibrate?.(10)
      } else if (delta < THRESHOLD && armed.current) {
        armed.current = false
      }
      setPull(Math.min(delta, THRESHOLD * 1.5))
    } else if (pull !== 0) {
      setPull(0)
    }
  }, [syncing, pull])

  const onTouchEnd = useCallback(async () => {
    if (pull >= THRESHOLD && !syncing) {
      setPull(0)
      startY.current = null
      // Don't even try the round-trip if the browser knows we're offline.
      if (navigator.onLine === false) {
        setMsg({ kind: 'error', text: L.syncErrorOffline })
        return
      }
      setSyncing(true)
      setMsg(null)
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS)
      try {
        const res = await fetch('/api/strava/sync', { method: 'POST', signal: controller.signal })
        const json = (await res.json().catch(() => ({}))) as { saved?: number; error?: string }
        if (res.ok) {
          setMsg({ kind: 'ok', text: L.syncImportedActivities(json.saved ?? 0) })
          router.refresh()
        } else {
          setMsg({ kind: 'error', text: L.syncErrorPrefix(json.error ?? L.syncErrorUnknown) })
        }
      } catch (err) {
        const timedOut = err instanceof DOMException && err.name === 'AbortError'
        setMsg({ kind: 'error', text: timedOut ? L.syncErrorTimeout : L.syncErrorNetwork })
      } finally {
        clearTimeout(timer)
        setSyncing(false)
      }
    } else {
      setPull(0)
      startY.current = null
    }
  }, [pull, syncing, router, L])

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
      {msg && !syncing && (
        <div
          className="pointer-events-none fixed left-0 right-0 flex justify-center z-30 transition-opacity duration-150"
          style={{ top: '56px' }}
        >
          <div
            className={
              'rounded-full px-3 py-1 shadow text-micro font-semibold ' +
              (msg.kind === 'error'
                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                : 'bg-trail-header text-trail-text border border-trail-border')
            }
          >
            {msg.text}
          </div>
        </div>
      )}
      {children}
    </main>
  )
}
