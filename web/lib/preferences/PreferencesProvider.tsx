'use client'

import { createContext, useContext, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/database/supabase-client'

const SYNCED_KEYS = [
  'cockpit_block_order', 'cockpit_hidden_blocks', 'cockpit_block_widths',
  'charge_block_order', 'charge_hidden_blocks', 'charge_block_widths',
  'plan_block_order', 'plan_hidden_blocks', 'plan_block_widths',
  'courses_block_order', 'courses_hidden_blocks', 'courses_block_widths',
  'cockpit_goals_settings', 'cockpit_goals_targets',
  'charge_sport_filter',
]

type Listener = () => void

type PreferencesCtx = {
  notifyChange: () => void
  onHydrated: (fn: Listener) => () => void
}

const Ctx = createContext<PreferencesCtx>({
  notifyChange: () => {},
  onHydrated: () => () => {},
})

export function usePreferences() { return useContext(Ctx) }

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listeners = useRef<Set<Listener>>(new Set())

  const flushToSupabase = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const prefs: Record<string, unknown> = {}
      for (const key of SYNCED_KEYS) {
        try {
          const raw = localStorage.getItem(key)
          if (raw) prefs[key] = JSON.parse(raw)
        } catch { /* skip malformed */ }
      }
      await supabase
        .from('profiles')
        .update({ ui_preferences: prefs })
        .eq('id', user.id)
    } catch { /* silent — network error, will retry on next change */ }
  }, [])

  const notifyChange = useCallback(() => {
    if (flushTimer.current) clearTimeout(flushTimer.current)
    flushTimer.current = setTimeout(flushToSupabase, 2000)
  }, [flushToSupabase])

  const onHydrated = useCallback((fn: Listener) => {
    listeners.current.add(fn)
    return () => { listeners.current.delete(fn) }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        const { data } = await supabase
          .from('profiles')
          .select('ui_preferences')
          .eq('id', user.id)
          .single()
        if (!data?.ui_preferences || cancelled) return
        const prefs = data.ui_preferences as Record<string, unknown>
        let changed = false
        for (const key of SYNCED_KEYS) {
          if (prefs[key] != null && !localStorage.getItem(key)) {
            localStorage.setItem(key, JSON.stringify(prefs[key]))
            changed = true
          }
        }
        if (changed && !cancelled) {
          Array.from(listeners.current).forEach(fn => fn())
        }
      } catch { /* silent */ }
    }
    hydrate()
    return () => { cancelled = true }
  }, [])

  return <Ctx.Provider value={{ notifyChange, onHydrated }}>{children}</Ctx.Provider>
}
