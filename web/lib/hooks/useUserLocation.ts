'use client'
import { useEffect, useState } from 'react'

export type Coords = {
  lat: number
  lng: number
  source: 'geo' | 'cache' | 'fallback'
  city: string | null
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

export function useUserLocation(): Coords | null {
  const [coords, setCoords] = useState<Coords | null>(null)

  useEffect(() => {
    let cancelled = false

    const cached = readCache()
    if (cached) {
      setCoords({ lat: cached.lat, lng: cached.lng, source: 'cache', city: cached.city })
      // Refresh city in background if missing (older cache without city)
      if (!cached.city) {
        reverseGeocode(cached.lat, cached.lng).then(city => {
          if (cancelled || !city) return
          writeCache(cached.lat, cached.lng, city)
          setCoords({ lat: cached.lat, lng: cached.lng, source: 'cache', city })
        })
      }
      return () => { cancelled = true }
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setCoords(FALLBACK_ANNECY)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (cancelled) return
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        // Set coords first with null city, then resolve city async
        setCoords({ lat, lng, source: 'geo', city: null })
        const city = await reverseGeocode(lat, lng)
        if (cancelled) return
        writeCache(lat, lng, city)
        setCoords({ lat, lng, source: 'geo', city })
      },
      () => {
        if (cancelled) return
        setCoords(FALLBACK_ANNECY)
      },
      { timeout: 5000, maximumAge: 1000 * 60 * 60 },
    )

    return () => { cancelled = true }
  }, [])

  return coords
}
