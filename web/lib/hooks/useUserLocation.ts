'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

export type Coords = {
  lat: number
  lng: number
  source: 'geo' | 'cache' | 'fallback'
  city: string | null
}

export type LocationStatus = 'resolving' | 'idle' | 'ready'

export type UserLocation = {
  coords: Coords | null
  /** 'resolving' = cache/permission check en cours · 'idle' = en attente du clic utilisateur (bloc d'info) · 'ready' = coords dispo */
  status: LocationStatus
  /** Déclenche la demande de géoloc (et donc le pop-up natif). À appeler uniquement sur un geste utilisateur. */
  request: () => void
}

const STORAGE_KEY = 'morning_report_coords'
const TTL_MS = 7 * 24 * 60 * 60 * 1000
const FALLBACK_ANNECY: Coords = { lat: 45.9, lng: 6.1, source: 'fallback', city: 'Annecy' }

type CacheEntry = { lat: number; lng: number; city: string | null; savedAt: number }

function readCache(): { lat: number; lng: number; city: string | null } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as CacheEntry
    if (!v || typeof v.lat !== 'number' || typeof v.lng !== 'number') return null
    if (Date.now() - v.savedAt > TTL_MS) return null
    return { lat: v.lat, lng: v.lng, city: v.city ?? null }
  } catch { return null }
}

function writeCache(lat: number, lng: number, city: string | null): void {
  try {
    const v: CacheEntry = { lat, lng, city, savedAt: Date.now() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
  } catch {}
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=fr`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json() as {
      city?: string
      locality?: string
      principalSubdivision?: string
    }
    return data.city || data.locality || data.principalSubdivision || null
  } catch {
    return null
  }
}

export function useUserLocation(): UserLocation {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [status, setStatus] = useState<LocationStatus>('resolving')
  const cancelledRef = useRef(false)

  const request = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setCoords(FALLBACK_ANNECY)
      setStatus('ready')
      return
    }
    setStatus('resolving')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (cancelledRef.current) return
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        // Set coords first with null city, then resolve city async
        setCoords({ lat, lng, source: 'geo', city: null })
        setStatus('ready')
        const city = await reverseGeocode(lat, lng)
        if (cancelledRef.current) return
        writeCache(lat, lng, city)
        setCoords({ lat, lng, source: 'geo', city })
      },
      () => {
        if (cancelledRef.current) return
        // Refus / échec du pop-up natif → repli silencieux pour afficher quand même une météo
        setCoords(FALLBACK_ANNECY)
        setStatus('ready')
      },
      { timeout: 5000, maximumAge: 1000 * 60 * 60 },
    )
  }, [])

  useEffect(() => {
    cancelledRef.current = false

    const cached = readCache()
    if (cached) {
      setCoords({ lat: cached.lat, lng: cached.lng, source: 'cache', city: cached.city })
      setStatus('ready')
      // Refresh city in background if missing (older cache without city)
      if (!cached.city) {
        reverseGeocode(cached.lat, cached.lng).then(city => {
          if (cancelledRef.current || !city) return
          writeCache(cached.lat, cached.lng, city)
          setCoords({ lat: cached.lat, lng: cached.lng, source: 'cache', city })
        })
      }
      return () => { cancelledRef.current = true }
    }

    // Pas de cache frais : on ne déclenche JAMAIS le pop-up natif au montage.
    // Si la permission est déjà accordée, on charge en silence (pas de pop-up).
    // Sinon, on passe en 'idle' et on attend le clic dans le bloc d'info météo.
    const permissions = typeof navigator !== 'undefined' ? navigator.permissions : undefined
    if (permissions?.query) {
      permissions.query({ name: 'geolocation' })
        .then(res => {
          if (cancelledRef.current) return
          if (res.state === 'granted') request()
          else setStatus('idle')
        })
        .catch(() => { if (!cancelledRef.current) setStatus('idle') })
    } else {
      setStatus('idle')
    }

    return () => { cancelledRef.current = true }
  }, [request])

  return { coords, status, request }
}
