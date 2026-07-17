'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePreferences } from './PreferencesProvider'

// Auto-ouverture du rapport matinal au lancement (redirection /dashboard →
// /rapport-matinal). Stocké dans localStorage (clé synchronisée via
// PreferencesProvider → profiles.ui_preferences, multi-appareils). Défaut :
// activé (valeur absente = true).

export const MORNING_REPORT_AUTO_OPEN_KEY = 'morning_report_auto_open'
const MORNING_REPORT_AUTO_OPEN_EVENT = 'tc:morning-report-auto-open-change'

// Retourne null si la clé est absente/illisible (le défaut « activé » est
// décidé par le consommateur, éventuellement à partir d'une valeur SSR).
export function readMorningReportAutoOpen(): boolean | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(MORNING_REPORT_AUTO_OPEN_KEY)
    if (raw == null) return null
    const parsed = JSON.parse(raw)
    return typeof parsed === 'boolean' ? parsed : null
  } catch {
    return null
  }
}

export function writeMorningReportAutoOpen(enabled: boolean): void {
  try {
    localStorage.setItem(MORNING_REPORT_AUTO_OPEN_KEY, JSON.stringify(enabled))
  } catch { /* quota / private mode */ }
  // Notifie les consommateurs du même onglet (storage event = cross-tab only).
  window.dispatchEvent(new CustomEvent(MORNING_REPORT_AUTO_OPEN_EVENT))
}

/**
 * Hook client : lit la préférence, réagit aux changements (même onglet +
 * cross-tab), expose un setter qui persiste + déclenche la sync cloud.
 * `initial` = valeur de départ (SSR) utilisée avant montage / si localStorage vide.
 */
export function useMorningReportAutoOpen(initial = true): {
  enabled: boolean
  setEnabled: (v: boolean) => void
  mounted: boolean
} {
  const { notifyChange } = usePreferences()
  const [enabled, setEnabledState] = useState<boolean>(initial)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const sync = () => setEnabledState(readMorningReportAutoOpen() ?? initial)
    sync()
    window.addEventListener(MORNING_REPORT_AUTO_OPEN_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(MORNING_REPORT_AUTO_OPEN_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [initial])

  const setEnabled = useCallback((v: boolean) => {
    writeMorningReportAutoOpen(v)
    setEnabledState(v)
    notifyChange()
  }, [notifyChange])

  return { enabled, setEnabled, mounted }
}
