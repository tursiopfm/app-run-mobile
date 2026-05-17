'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getActivityTypes,
  getUserActivityPrefs,
  upsertUserActivityPrefs,
  createCustomActivityType,
  deleteCustomActivityType,
} from '@/lib/plan/activity-types-storage'
import { applyActivityPrefs, type OrderedActivityType } from '@/lib/plan/apply-activity-prefs'
import type { ActivityType, UserActivityPref } from '@/types/activity-types'
import type { IntensityLevel } from '@/types/plan'

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

  const upsertPrefs = useCallback(async (next: UserActivityPref[]) => {
    await upsertUserActivityPrefs(next)
    setPrefs(next)
  }, [])

  const createCustom = useCallback(async (input: Parameters<UseActivityTypesResult['createCustom']>[0]) => {
    const created = await createCustomActivityType(input)
    setTypes(prev => [...prev, created])
    return created
  }, [])

  const deleteCustom = useCallback(async (id: string) => {
    await deleteCustomActivityType(id)
    setTypes(prev => prev.filter(t => t.id !== id))
  }, [])

  const visibleTypes = useMemo(() => applyActivityPrefs(types, prefs), [types, prefs])

  return { loading, types, visibleTypes, prefs, refresh, upsertPrefs, createCustom, deleteCustom }
}
