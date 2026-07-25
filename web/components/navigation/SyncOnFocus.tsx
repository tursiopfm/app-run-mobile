'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const MIN_INTERVAL_MS = 60_000 // throttle: au plus une sync Strava/minute

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

    // Le refresh n'est pas throttlé (un aller-retour RSC) : c'est lui qui
    // remplace à l'écran les données du rendu serveur. Seule la sync Strava,
    // qui tape une API externe, l'est.
    function revalidate() {
      router.refresh()
      syncIfStale()
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') revalidate()
    }

    // Lancement à froid : aucun visibilitychange n'est émis, le document initial
    // est déjà visible. Sans ce revalidate au montage, un document servi depuis
    // le cache du service worker reste affiché avec les données figées de son
    // payload RSC jusqu'au prochain pull-to-refresh (incident 2026-07-25).
    revalidate()

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [router])

  return null
}
