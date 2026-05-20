'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getActivityTypes,
  getUserActivityPrefs,
  upsertUserActivityPrefs,
  createCustomActivityType,
  deleteCustomActivityType,
  renameCustomActivityType,
} from '@/lib/plan/activity-types-storage'
import { applyActivityPrefs, type OrderedActivityType } from '@/lib/plan/apply-activity-prefs'
import type { ActivityType, UserActivityPref } from '@/types/activity-types'
import type { IntensityLevel } from '@/types/plan'

// Évènement custom broadcasté quand le catalogue change (create / delete /
// rename). Permet à toutes les instances de useActivityTypes (un par composant)
// de se resync — sinon TemplateEditorModal ne voit pas un type créé via
// ActivityTypesPrefsModal sans F5.
const TYPES_CHANGED_EVENT = 'tc:activity-types-changed'

function notifyTypesChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(TYPES_CHANGED_EVENT))
}

export interface UseActivityTypesResult {
  loading: boolean
  types: ActivityType[]                 // tous (système + custom user)
  visibleTypes: OrderedActivityType[]   // filtrés isVisible + ordonnés displayOrder
  prefs: UserActivityPref[]
  refresh: () => Promise<void>
  upsertPrefs: (next: UserActivityPref[]) => Promise<void>
  createCustom: (input: {
    slug: string
    label: string
    defaultIntensity: IntensityLevel
    category?: ActivityType['category']
  }) => Promise<ActivityType>
  deleteCustom: (id: string) => Promise<void>
  renameCustom: (id: string, newLabel: string) => Promise<void>
}

export function useActivityTypes(): UseActivityTypesResult {
  const [loading, setLoading] = useState(true)
  const [types, setTypes] = useState<ActivityType[]>([])
  const [prefs, setPrefs] = useState<UserActivityPref[]>([])

  const refresh = useCallback(async () => {
    setLoading(true)
    const [t, p] = await Promise.all([getActivityTypes(), getUserActivityPrefs()])
    setTypes(t)
    setPrefs(p)
    setLoading(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  // Resync sur évènement broadcast (autre instance du hook a muté le catalogue).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => { void refresh() }
    window.addEventListener(TYPES_CHANGED_EVENT, handler)
    return () => window.removeEventListener(TYPES_CHANGED_EVENT, handler)
  }, [refresh])

  const upsertPrefs = useCallback(async (next: UserActivityPref[]) => {
    await upsertUserActivityPrefs(next)
    setPrefs(next)
  }, [])

  const createCustom = useCallback(async (input: Parameters<UseActivityTypesResult['createCustom']>[0]) => {
    const created = await createCustomActivityType(input)
    setTypes(prev => [...prev, created])
    notifyTypesChanged()
    return created
  }, [])

  const deleteCustom = useCallback(async (id: string) => {
    await deleteCustomActivityType(id)
    setTypes(prev => prev.filter(t => t.id !== id))
    notifyTypesChanged()
  }, [])

  const renameCustom = useCallback(async (id: string, newLabel: string) => {
    await renameCustomActivityType(id, newLabel)
    setTypes(prev => prev.map(t => (t.id === id ? { ...t, label: newLabel.trim() } : t)))
    notifyTypesChanged()
  }, [])

  const visibleTypes = useMemo(() => applyActivityPrefs(types, prefs), [types, prefs])

  return { loading, types, visibleTypes, prefs, refresh, upsertPrefs, createCustom, deleteCustom, renameCustom }
}
