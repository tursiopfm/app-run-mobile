// Persistance des types d'activité et préférences user.
// Pattern miroir de web/lib/plan/storage.ts : Supabase d'abord, fallback LS.

import { createClient } from '@/lib/database/supabase-client'
import type { IntensityLevel } from '@/types/plan'
import type { ActivityType, UserActivityPref } from '@/types/activity-types'

// ─── Clés localStorage (versionnées) ────────────────────────────────────────
const KEY_TYPES_CUSTOM = 'tc:plan:activity_types_custom:v1'
const KEY_PREFS = 'tc:plan:user_activity_prefs:v1'

// ─── Catalogue système (fallback LS — miroir des seeds migrations 018+019) ───────
const SYSTEM_TYPES: ActivityType[] = [
  { id: 'sys-sortie_longue', slug: 'sortie_longue', label: 'Sortie longue', defaultIntensity: 2, category: 'run',   isSystem: true },
  { id: 'sys-fractionne',    slug: 'fractionne',    label: 'Fractionné',    defaultIntensity: 5, category: 'run',   isSystem: true },
  { id: 'sys-seuil_tempo',   slug: 'seuil_tempo',   label: 'Seuil',         defaultIntensity: 4, category: 'run',   isSystem: true },
  { id: 'sys-cotes',         slug: 'cotes',         label: 'Côtes',         defaultIntensity: 3, category: 'run',   isSystem: true },
  { id: 'sys-footing',       slug: 'footing',       label: 'Footing',       defaultIntensity: 2, category: 'run',   isSystem: true },
  { id: 'sys-course',        slug: 'course',        label: 'Course',        defaultIntensity: 4, category: 'run',   isSystem: true },
  { id: 'sys-runtaf',        slug: 'runtaf',        label: 'Runtaf',        defaultIntensity: 2, category: 'run',   isSystem: true },
  { id: 'sys-velotaf',       slug: 'velotaf',       label: 'Velotaf',       defaultIntensity: 2, category: 'bike',  isSystem: true },
  { id: 'sys-velo',          slug: 'velo',          label: 'Vélo',          defaultIntensity: 2, category: 'bike',  isSystem: true },
  { id: 'sys-natation',      slug: 'natation',      label: 'Natation',      defaultIntensity: 2, category: 'swim',  isSystem: true },
  { id: 'sys-renfo',         slug: 'renfo',         label: 'Renfo',         defaultIntensity: 1, category: 'other', isSystem: true },
  { id: 'sys-musculation',   slug: 'musculation',   label: 'Musculation',   defaultIntensity: 1, category: 'other', isSystem: true },
]

// ─── Helpers LS (SSR-safe) ─────────────────────────────────────────────────
function readLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeLS<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota / mode privé : silencieux */
  }
}

// ─── Helpers Supabase ──────────────────────────────────────────────────────
type SupabaseLike = ReturnType<typeof createClient>

async function getAuthedClient(): Promise<{ supabase: SupabaseLike; athleteId: string } | null> {
  if (typeof window === 'undefined') return null
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    const athleteId = data.user?.id
    if (!athleteId) return null
    return { supabase, athleteId }
  } catch {
    return null
  }
}

function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  return (err as { code?: string }).code === '42P01'
}

// ─── Mappers row ↔ domain ──────────────────────────────────────────────────
type ActivityTypeRow = {
  id: string
  athlete_id: string | null
  slug: string
  label: string
  default_intensity: number
  category: string | null
  is_system: boolean
}

function activityTypeFromRow(r: ActivityTypeRow): ActivityType {
  return {
    id: r.id,
    slug: r.slug,
    label: r.label,
    defaultIntensity: r.default_intensity as IntensityLevel,
    category: (r.category ?? undefined) as ActivityType['category'],
    isSystem: r.is_system,
  }
}

type PrefRow = {
  athlete_id: string
  activity_slug: string
  is_visible: boolean
  display_order: number
}

function prefFromRow(r: PrefRow): UserActivityPref {
  return {
    activitySlug: r.activity_slug,
    isVisible: r.is_visible,
    displayOrder: r.display_order,
  }
}

// ─── API publique ──────────────────────────────────────────────────────────

// Liste TOUS les types accessibles (système + customs de l'user).
export async function getActivityTypes(): Promise<ActivityType[]> {
  const ctx = await getAuthedClient()
  if (ctx) {
    const { data, error } = await ctx.supabase
      .from('activity_types')
      .select('*')
      .or(`athlete_id.is.null,athlete_id.eq.${ctx.athleteId}`)
      .order('is_system', { ascending: false })
      .order('label', { ascending: true })
    if (!error && data) return (data as ActivityTypeRow[]).map(activityTypeFromRow)
    if (error && !isMissingTableError(error)) {
      console.warn('[activity-types] supabase failed:', error.message)
    }
  }
  // Fallback LS : système + custom local
  const custom = readLS<ActivityType[]>(KEY_TYPES_CUSTOM, [])
  return [...SYSTEM_TYPES, ...custom]
}

export async function getUserActivityPrefs(): Promise<UserActivityPref[]> {
  const ctx = await getAuthedClient()
  if (ctx) {
    const { data, error } = await ctx.supabase
      .from('user_activity_prefs')
      .select('*')
      .eq('athlete_id', ctx.athleteId)
    if (!error && data) return (data as PrefRow[]).map(prefFromRow)
    if (error && !isMissingTableError(error)) {
      console.warn('[activity-types] supabase failed:', error.message)
    }
  }
  return readLS<UserActivityPref[]>(KEY_PREFS, [])
}

export async function upsertUserActivityPrefs(prefs: UserActivityPref[]): Promise<void> {
  const ctx = await getAuthedClient()
  if (ctx) {
    const rows = prefs.map(p => ({
      athlete_id: ctx.athleteId,
      activity_slug: p.activitySlug,
      is_visible: p.isVisible,
      display_order: p.displayOrder,
    }))
    const { error } = await ctx.supabase
      .from('user_activity_prefs')
      .upsert(rows, { onConflict: 'athlete_id,activity_slug' })
    if (!error) return
    if (!isMissingTableError(error)) {
      console.warn('[activity-types] supabase failed:', error.message)
    }
  }
  writeLS(KEY_PREFS, prefs)
}

export async function createCustomActivityType(input: {
  slug: string
  label: string
  defaultIntensity: IntensityLevel
  category?: ActivityType['category']
}): Promise<ActivityType> {
  const ctx = await getAuthedClient()
  if (ctx) {
    const row = {
      athlete_id: ctx.athleteId,
      slug: input.slug,
      label: input.label,
      default_intensity: input.defaultIntensity,
      category: input.category ?? null,
      is_system: false,
    }
    const { data, error } = await ctx.supabase
      .from('activity_types')
      .insert(row)
      .select()
      .single()
    if (!error && data) return activityTypeFromRow(data as ActivityTypeRow)
    if (!isMissingTableError(error)) {
      console.warn('[activity-types] supabase failed:', error?.message)
    }
  }
  // Fallback LS
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const created: ActivityType = { id, ...input, isSystem: false }
  const custom = readLS<ActivityType[]>(KEY_TYPES_CUSTOM, [])
  writeLS(KEY_TYPES_CUSTOM, [...custom, created])
  return created
}

// Renomme un type custom (label uniquement — le slug reste immuable pour
// préserver les références dans planned_sessions et session_templates).
export async function renameCustomActivityType(id: string, newLabel: string): Promise<void> {
  const label = newLabel.trim()
  if (!label) throw new Error('Label vide')
  const ctx = await getAuthedClient()
  if (ctx) {
    const { error } = await ctx.supabase
      .from('activity_types')
      .update({ label })
      .eq('id', id)
      .eq('athlete_id', ctx.athleteId)
    if (!error) return
    if (!isMissingTableError(error)) {
      console.warn('[activity-types] supabase failed:', error.message)
    }
  }
  // Fallback LS
  const custom = readLS<ActivityType[]>(KEY_TYPES_CUSTOM, [])
  writeLS(KEY_TYPES_CUSTOM, custom.map(t => (t.id === id ? { ...t, label } : t)))
}

export async function deleteCustomActivityType(id: string): Promise<void> {
  const ctx = await getAuthedClient()
  if (ctx) {
    const { error } = await ctx.supabase
      .from('activity_types')
      .delete()
      .eq('id', id)
    if (!error) return
    if (!isMissingTableError(error)) {
      console.warn('[activity-types] supabase failed:', error.message)
    }
  }
  // Fallback LS
  const custom = readLS<ActivityType[]>(KEY_TYPES_CUSTOM, [])
  writeLS(KEY_TYPES_CUSTOM, custom.filter(t => t.id !== id))
}
