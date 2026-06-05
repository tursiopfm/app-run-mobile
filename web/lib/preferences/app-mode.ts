'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePreferences } from './PreferencesProvider'

// Mode applicatif : « mission » (allégé, novice) vs « expert » (cockpit complet).
// Stocké dans localStorage (clé synchronisée via PreferencesProvider →
// profiles.ui_preferences, multi-appareils). Valeur sérialisée en JSON pour
// rester cohérent avec le reste des SYNCED_KEYS (default branch).

export type AppMode = 'mission' | 'expert'
export const APP_MODE_KEY = 'app_mode'
const APP_MODE_EVENT = 'tc:app-mode-change'

export function readAppMode(): AppMode {
  if (typeof window === 'undefined') return 'expert'
  try {
    return JSON.parse(localStorage.getItem(APP_MODE_KEY) ?? '"expert"') === 'mission'
      ? 'mission'
      : 'expert'
  } catch {
    return 'expert'
  }
}

function writeAppMode(mode: AppMode) {
  try {
    localStorage.setItem(APP_MODE_KEY, JSON.stringify(mode))
  } catch { /* quota / private mode */ }
  // Notifie les autres consommateurs du même onglet (le storage event ne se
  // déclenche que cross-tab).
  window.dispatchEvent(new CustomEvent(APP_MODE_EVENT))
}

/**
 * Hook client : lit le mode, réagit aux changements (même onglet + cross-tab +
 * hydratation cloud), et expose un setter qui persiste + déclenche la sync.
 */
export function useAppMode(initial: AppMode = 'expert'): {
  mode: AppMode
  setMode: (m: AppMode) => void
  toggle: () => void
  mounted: boolean
} {
  const { notifyChange } = usePreferences()
  // Init = `initial` (valeur SSR venant du profil) pour éviter un mismatch
  // d'hydratation ; on relit le localStorage après montage.
  const [mode, setModeState] = useState<AppMode>(initial)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setModeState(readAppMode())
    const onChange = () => setModeState(readAppMode())
    window.addEventListener(APP_MODE_EVENT, onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(APP_MODE_EVENT, onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  const setMode = useCallback((m: AppMode) => {
    writeAppMode(m)
    setModeState(m)
    notifyChange()
  }, [notifyChange])

  const toggle = useCallback(() => {
    setMode(readAppMode() === 'mission' ? 'expert' : 'mission')
  }, [setMode])

  return { mode, setMode, toggle, mounted }
}
