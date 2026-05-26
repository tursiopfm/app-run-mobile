'use client'
import { useEffect, useState } from 'react'

export type Coords = { lat: number; lng: number; source: 'geo' | 'cache' | 'fallback' }

const STORAGE_KEY = 'morning_report_coords'
const TTL_MS = 7 * 24 * 60 * 60 * 1000
const FALLBACK_ANNECY: Coords = { lat: 45.9, lng: 6.1, source: 'fallback' }

type CacheEntry = { lat: number; lng: number; savedAt: number }

function readCache(): Coords | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as CacheEntry
    if (!v || typeof v.lat !== 'number' || typeof v.lng !== 'number') return null
    if (Date.now() - v.savedAt > TTL_MS) return null
    return { lat: v.lat, lng: v.lng, source: 'cache' }
  } catch { return null }
}

function writeCache(lat: number, lng: number): void {
  try {
    const v: CacheEntry = { lat, lng, savedAt: Date.now() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
  } catch {}
}

export function useUserLocation(): Coords | null {
  const [coords, setCoords] = useState<Coords | null>(null)

  useEffect(() => {
    const cached = readCache()
    if (cached) {
      setCoords(cached)
      return
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setCoords(FALLBACK_ANNECY)
      return
    }
    let done = false
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (done) return
        done = true
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        writeCache(lat, lng)
        setCoords({ lat, lng, source: 'geo' })
      },
      () => {
        if (done) return
        done = true
        setCoords(FALLBACK_ANNECY)
      },
      { timeout: 5000, maximumAge: 1000 * 60 * 60 },
    )
    return () => { done = true }
  }, [])

  return coords
}
