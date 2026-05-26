'use client'
import { useEffect, useState } from 'react'
import type { WeatherResponse } from '@/lib/weather/open-meteo'
import type { Coords } from './useUserLocation'

export type WeatherState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: WeatherResponse }
  | { status: 'error'; message: string }

export function useWeather(coords: Coords | null): WeatherState {
  const [state, setState] = useState<WeatherState>({ status: 'idle' })

  useEffect(() => {
    if (!coords) return
    setState({ status: 'loading' })
    let cancelled = false
    fetch(`/api/weather?lat=${coords.lat}&lng=${coords.lng}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<WeatherResponse>
      })
      .then(data => { if (!cancelled) setState({ status: 'ready', data }) })
      .catch(err => { if (!cancelled) setState({ status: 'error', message: String(err?.message ?? err) }) })
    return () => { cancelled = true }
  }, [coords?.lat, coords?.lng])

  return state
}
