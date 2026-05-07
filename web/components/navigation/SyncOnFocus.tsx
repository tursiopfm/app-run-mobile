'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const MIN_INTERVAL_MS = 60_000 // throttle: au plus une sync/minute au retour foreground

export function SyncOnFocus() {
  const router = useRouter()

  useEffect(() => {
    let lastSync = 0

    async function syncIfStale() {
      const now = Date.now()
      if (now - lastSync < MIN_INTERVAL_MS) return
      lastSync = now
      console.log('[sync] foreground — déclenchement sync Strava')
      try {
        const res = await fetch('/api/strava/sync', { method: 'POST' })
        console.log('[sync] foreground done status=', res.status)
        router.refresh()
      } catch (err) {
        console.warn('[sync] foreground failed', err)
      }
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') syncIfStale()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [router])

  return null
}
