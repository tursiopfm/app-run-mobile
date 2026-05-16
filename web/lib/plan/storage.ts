// Persistance Plan : tente Supabase, fallback localStorage.
// Stratégie : si l'utilisateur n'est pas authentifié OU si la table est absente
// (erreur PostgreSQL 42P01 "undefined_table"), on retombe sur localStorage.
// Pas de sync Supabase ↔ localStorage : on utilise l'un ou l'autre.

import { createClient } from '@/lib/database/supabase-client'
import type {
  Phase,
  PlannedSession,
  Race,
  SessionStatus,
  SessionTemplate,
  SessionType,
  TrainingPlan,
  TrainingZone,
} from '@/types/plan'

// ─── Clés localStorage (versionnées) ────────────────────────────────────────
const KEY_RACE = 'tc:plan:race:v1'
const KEY_PLAN = 'tc:plan:current_plan:v1'
const KEY_SESSIONS = 'tc:plan:planned_sessions:v1'
const KEY_TEMPLATES_CUSTOM = 'tc:plan:templates_custom:v1'

// ─── Helpers localStorage (SSR-safe) ────────────────────────────────────────
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
    // quota dépassé / mode privé : on ignore silencieusement.
  }
}

// ─── Helpers Supabase ───────────────────────────────────────────────────────
type SupabaseLike = ReturnType<typeof createClient>

// Renvoie le client + l'athleteId si auth, sinon null (→ fallback LS).
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

// Détecte une erreur "table absente" (42P01) pour décider du fallback LS.
function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as { code?: string }).code
  return code === '42P01'
}

// Détecte une erreur "colonne absente" (42703) — utile quand on déploie le code
// JS avant d'appliquer manuellement la migration Supabase correspondante.
function isMissingColumnError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as { code?: string }).code
  return code === '42703'
}

// ─── Mappers Supabase row ↔ domain ──────────────────────────────────────────
type RaceRow = {
  id: string
  athlete_id: string
  name: string
  date: string
  distance_km: number
  elevation_m: number
  type: Race['type']
  location: string | null
  is_main: boolean
  notes: string | null
}

function raceFromRow(r: RaceRow): Race {
  return {
    id: r.id,
    name: r.name,
    date: r.date,
    distance: Number(r.distance_km),
    elevation: r.elevation_m ?? 0,
    type: r.type,
    location: r.location ?? undefined,
    isMain: !!r.is_main,
    notes: r.notes ?? undefined,
  }
}

function raceToRow(race: Race, athleteId: string): RaceRow {
  return {
    id: race.id,
    athlete_id: athleteId,
    name: race.name,
    date: race.date,
    distance_km: race.distance,
    elevation_m: race.elevation,
    type: race.type,
    location: race.location ?? null,
    is_main: race.isMain,
    notes: race.notes ?? null,
  }
}

type PlanRow = {
  id: string
  athlete_id: string
  name: string
  goal_race_id: string | null
  start_date: string
  end_date: string
  created_at: string
  updated_at: string
}

type PhaseRow = {
  id: string
  plan_id: string
  type: Phase['type']
  label: string
  start_date: string
  end_date: string
  weekly_charge_target: number
  weekly_distance_km_target?: number | null
  weekly_elevation_m_target?: number | null
  description: string | null
  position: number
}

function planFromRows(plan: PlanRow, phases: PhaseRow[]): TrainingPlan {
  return {
    id: plan.id,
    athleteId: plan.athlete_id,
    name: plan.name,
    goalRaceId: plan.goal_race_id,
    startDate: plan.start_date,
    endDate: plan.end_date,
    createdAt: plan.created_at,
    updatedAt: plan.updated_at,
    phases: [...phases]
      .sort((a, b) => a.position - b.position)
      .map(p => ({
        id: p.id,
        type: p.type,
        label: p.label,
        startDate: p.start_date,
        endDate: p.end_date,
        weeklyChargeTarget: p.weekly_charge_target,
        // Migration 015 pas encore appliquée → colonnes absentes côté DB → fallback 0.
        weeklyDistanceKmTarget: p.weekly_distance_km_target != null ? Number(p.weekly_distance_km_target) : 0,
        weeklyElevationMTarget: p.weekly_elevation_m_target ?? 0,
        description: p.description ?? undefined,
      })),
  }
}

function planToRow(plan: TrainingPlan, athleteId: string): PlanRow {
  return {
    id: plan.id,
    athlete_id: athleteId,
    name: plan.name,
    goal_race_id: plan.goalRaceId,
    start_date: plan.startDate,
    end_date: plan.endDate,
    created_at: plan.createdAt,
    updated_at: plan.updatedAt,
  }
}

function phasesToRows(plan: TrainingPlan): PhaseRow[] {
  return plan.phases.map((p, i) => ({
    id: p.id,
    plan_id: plan.id,
    type: p.type,
    label: p.label,
    start_date: p.startDate,
    end_date: p.endDate,
    weekly_charge_target: p.weeklyChargeTarget,
    weekly_distance_km_target: p.weeklyDistanceKmTarget,
    weekly_elevation_m_target: p.weeklyElevationMTarget,
    description: p.description ?? null,
    position: i,
  }))
}

type SessionRow = {
  id: string
  plan_id: string | null
  athlete_id: string
  date: string
  type: SessionType
  title: string
  duration_min: number
  distance_km: number | null
  elevation_m: number | null
  intensity: PlannedSession['intensity']
  estimated_charge: number
  zones: TrainingZone[] | null
  notes: string | null
  status: SessionStatus
  linked_activity_id: string | null
  template_id: string | null
}

function sessionFromRow(r: SessionRow): PlannedSession {
  return {
    id: r.id,
    planId: r.plan_id ?? '',
    date: r.date,
    type: r.type,
    title: r.title,
    duration: r.duration_min,
    distance: r.distance_km ?? undefined,
    elevation: r.elevation_m ?? undefined,
    intensity: r.intensity,
    estimatedCharge: r.estimated_charge,
    zones: r.zones ?? undefined,
    notes: r.notes ?? undefined,
    status: r.status,
    linkedActivityId: r.linked_activity_id ?? undefined,
    templateId: r.template_id ?? undefined,
  }
}

function sessionToRow(s: PlannedSession, athleteId: string): SessionRow {
  return {
    id: s.id,
    plan_id: s.planId || null,
    athlete_id: athleteId,
    date: s.date,
    type: s.type,
    title: s.title,
    duration_min: s.duration,
    distance_km: s.distance ?? null,
    elevation_m: s.elevation ?? null,
    intensity: s.intensity,
    estimated_charge: s.estimatedCharge,
    zones: s.zones ?? null,
    notes: s.notes ?? null,
    status: s.status,
    linked_activity_id: s.linkedActivityId ?? null,
    template_id: s.templateId ?? null,
  }
}

type TemplateRow = {
  id: string
  athlete_id: string | null
  type: SessionType
  title: string
  default_duration_min: number
  default_distance_km: number | null
  default_elevation_m: number | null
  default_intensity: SessionTemplate['defaultIntensity']
  default_zones: TrainingZone[] | null
  description: string | null
  tags: string[] | null
}

function templateFromRow(r: TemplateRow): SessionTemplate {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    defaultDuration: r.default_duration_min,
    defaultDistance: r.default_distance_km ?? undefined,
    defaultElevation: r.default_elevation_m ?? undefined,
    defaultIntensity: r.default_intensity,
    defaultZones: r.default_zones ?? undefined,
    description: r.description ?? '',
    tags: r.tags ?? undefined,
  }
}

function templateToRow(t: SessionTemplate, athleteId: string): TemplateRow {
  return {
    id: t.id,
    athlete_id: athleteId,
    type: t.type,
    title: t.title,
    default_duration_min: t.defaultDuration,
    default_distance_km: t.defaultDistance ?? null,
    default_elevation_m: t.defaultElevation ?? null,
    default_intensity: t.defaultIntensity,
    default_zones: t.defaultZones ?? null,
    description: t.description || null,
    tags: t.tags ?? null,
  }
}

// ─── API publique : Race ────────────────────────────────────────────────────

// Liste TOUTES les races de l'athlète, triées par date asc.
// Fallback LS : on retourne un array contenant l'éventuelle race historique
// stockée en single-slot (KEY_RACE) + les races multiples (KEY_RACES).
export async function getRaces(): Promise<Race[]> {
  const ctx = await getAuthedClient()
  if (ctx) {
    const { data, error } = await ctx.supabase
      .from('races')
      .select('*')
      .eq('athlete_id', ctx.athleteId)
      .order('date', { ascending: true })
    if (!error && data) {
      return (data as RaceRow[]).map(raceFromRow)
    }
    if (error && !isMissingTableError(error)) {
      // Erreur réelle : on continue vers LS.
    }
  }
  return readRacesFromLS()
}

// La race principale : prochaine course principale par date (la plus proche dans le futur).
export async function getMainRace(): Promise<Race | null> {
  const all = await getRaces()
  if (all.length === 0) return null
  const todayISO = new Date().toISOString().slice(0, 10)
  // Prochaine course principale par date (la plus proche dans le futur).
  const upcomingMain = all.find(r => r.isMain && r.date >= todayISO)
  if (upcomingMain) return upcomingMain
  // Fallbacks : dernière principale passée, prochaine non-principale, ou la dernière.
  const lastMain = [...all].reverse().find(r => r.isMain)
  if (lastMain) return lastMain
  const upcoming = all.find(r => r.date >= todayISO)
  return upcoming ?? all[all.length - 1]
}

// Rétrocompat : StructurePrepa et ChargePlanifiee appellent encore getRace().
// On l'aligne sur getMainRace() pour ne rien casser.
export async function getRace(): Promise<Race | null> {
  return getMainRace()
}

export async function saveRace(race: Race): Promise<void> {
  const ctx = await getAuthedClient()
  if (ctx) {
    const row = raceToRow(race, ctx.athleteId)
    const { error } = await ctx.supabase.from('races').upsert(row, { onConflict: 'id' })
    if (!error) return
    if (!isMissingTableError(error)) {
      console.warn('[plan storage] supabase failed, falling back to LS:', error.message)
    }
  }
  // Fallback LS.
  const all = readRacesFromLS()
  const next = mergeRace(all, race)
  writeRacesToLS(next)
}

export async function deleteRace(id: string): Promise<void> {
  const ctx = await getAuthedClient()
  if (ctx) {
    const { error } = await ctx.supabase.from('races').delete().eq('id', id)
    if (!error) {
      removeRaceFromLS(id)
      return
    }
    if (!isMissingTableError(error)) {
      console.warn('[plan storage] supabase failed, falling back to LS:', error.message)
    }
  }
  removeRaceFromLS(id)
}

// ─── Helpers LS pour la liste de races ──────────────────────────────────────
// On lit à la fois KEY_RACES (nouvelle clé, liste) et KEY_RACE (ancienne clé,
// race unique) pour ne pas perdre une course définie avant la migration multi.
const KEY_RACES = 'tc:plan:races:v1'

function readRacesFromLS(): Race[] {
  const list = readLS<Race[]>(KEY_RACES, [])
  if (list.length > 0) return [...list].sort((a, b) => a.date.localeCompare(b.date))
  // Pas de liste mais éventuelle race historique single-slot : migrate à la volée.
  const legacy = readLS<Race | null>(KEY_RACE, null)
  if (legacy) {
    writeRacesToLS([legacy])
    return [legacy]
  }
  return []
}

function writeRacesToLS(races: Race[]): void {
  const sorted = [...races].sort((a, b) => a.date.localeCompare(b.date))
  writeLS(KEY_RACES, sorted)
  // Miroir : prochaine course principale par date.
  const todayISO = new Date().toISOString().slice(0, 10)
  const upcomingMain = sorted.find(r => r.isMain && r.date >= todayISO)
  const mirror = upcomingMain
    ?? sorted.find(r => r.date >= todayISO)
    ?? sorted[sorted.length - 1]
    ?? null
  writeLS<Race | null>(KEY_RACE, mirror)
}

function removeRaceFromLS(id: string): void {
  const all = readRacesFromLS().filter(r => r.id !== id)
  writeRacesToLS(all)
}

function mergeRace(existing: Race[], incoming: Race): Race[] {
  const idx = existing.findIndex(r => r.id === incoming.id)
  if (idx < 0) return [...existing, incoming]
  const next = [...existing]
  next[idx] = incoming
  return next
}

// ─── API publique : TrainingPlan ────────────────────────────────────────────
export async function getCurrentPlan(): Promise<TrainingPlan | null> {
  const ctx = await getAuthedClient()
  if (ctx) {
    const { data: planRow, error: planErr } = await ctx.supabase
      .from('training_plans')
      .select('*')
      .eq('athlete_id', ctx.athleteId)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (planErr && !isMissingTableError(planErr)) {
      return readLS<TrainingPlan | null>(KEY_PLAN, null)
    }
    if (planRow) {
      const { data: phaseRows } = await ctx.supabase
        .from('phases')
        .select('*')
        .eq('plan_id', (planRow as PlanRow).id)
        .order('position', { ascending: true })
      return planFromRows(planRow as PlanRow, (phaseRows ?? []) as PhaseRow[])
    }
    if (!planErr) return null
  }
  return readLS<TrainingPlan | null>(KEY_PLAN, null)
}

export async function saveCurrentPlan(plan: TrainingPlan): Promise<void> {
  const ctx = await getAuthedClient()
  if (ctx) {
    const planRow = planToRow(plan, ctx.athleteId)
    const { error: upErr } = await ctx.supabase
      .from('training_plans')
      .upsert(planRow, { onConflict: 'id' })
    if (!upErr) {
      // Reset des phases puis insert : plus simple que de réconcilier diff.
      await ctx.supabase.from('phases').delete().eq('plan_id', plan.id)
      const rows = phasesToRows(plan)
      if (rows.length > 0) {
        const { error: phaseErr } = await ctx.supabase.from('phases').insert(rows)
        if (phaseErr && isMissingColumnError(phaseErr)) {
          // Migration 015 pas encore appliquée : retry sans les colonnes km/D+.
          const legacyRows = rows.map(({
            weekly_distance_km_target: _km,
            weekly_elevation_m_target: _dplus,
            ...rest
          }) => rest)
          await ctx.supabase.from('phases').insert(legacyRows)
        }
      }
      return
    }
    if (!isMissingTableError(upErr)) {
      console.warn('[plan storage] supabase failed, falling back to LS:', upErr.message)
    }
  }
  writeLS(KEY_PLAN, plan)
}

// ─── API publique : PlannedSession ──────────────────────────────────────────
export async function getPlannedSessions(
  fromDate: string,
  toDate: string,
): Promise<PlannedSession[]> {
  const ctx = await getAuthedClient()
  if (ctx) {
    const { data, error } = await ctx.supabase
      .from('planned_sessions')
      .select('*')
      .eq('athlete_id', ctx.athleteId)
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: true })
    if (!error && data) {
      return (data as SessionRow[]).map(sessionFromRow)
    }
    if (error && !isMissingTableError(error)) {
      // Erreur réelle : on continue vers LS.
    }
  }
  const all = readLS<PlannedSession[]>(KEY_SESSIONS, [])
  return all.filter(s => s.date >= fromDate && s.date <= toDate)
}

export async function savePlannedSession(session: PlannedSession): Promise<void> {
  const ctx = await getAuthedClient()
  if (ctx) {
    const row = sessionToRow(session, ctx.athleteId)
    const { error } = await ctx.supabase
      .from('planned_sessions')
      .upsert(row, { onConflict: 'id' })
    if (!error) return
    if (!isMissingTableError(error)) {
      console.warn('[plan storage] supabase failed, falling back to LS:', error.message)
    }
  }
  const all = readLS<PlannedSession[]>(KEY_SESSIONS, [])
  const idx = all.findIndex(s => s.id === session.id)
  if (idx >= 0) all[idx] = session
  else all.push(session)
  writeLS(KEY_SESSIONS, all)
}

export async function deletePlannedSession(id: string): Promise<void> {
  const ctx = await getAuthedClient()
  if (ctx) {
    const { error } = await ctx.supabase.from('planned_sessions').delete().eq('id', id)
    if (!error) return
    if (!isMissingTableError(error)) {
      console.warn('[plan storage] supabase failed, falling back to LS:', error.message)
    }
  }
  const all = readLS<PlannedSession[]>(KEY_SESSIONS, [])
  writeLS(KEY_SESSIONS, all.filter(s => s.id !== id))
}

// ─── API publique : SessionTemplate (custom) ────────────────────────────────
export async function getCustomTemplates(): Promise<SessionTemplate[]> {
  const ctx = await getAuthedClient()
  if (ctx) {
    const { data, error } = await ctx.supabase
      .from('session_templates')
      .select('*')
      .eq('athlete_id', ctx.athleteId)
      .order('title', { ascending: true })
    if (!error && data) {
      return (data as TemplateRow[]).map(templateFromRow)
    }
  }
  return readLS<SessionTemplate[]>(KEY_TEMPLATES_CUSTOM, [])
}

export async function saveCustomTemplate(template: SessionTemplate): Promise<void> {
  const ctx = await getAuthedClient()
  if (ctx) {
    const row = templateToRow(template, ctx.athleteId)
    const { error } = await ctx.supabase
      .from('session_templates')
      .upsert(row, { onConflict: 'id' })
    if (!error) return
    if (!isMissingTableError(error)) {
      console.warn('[plan storage] supabase failed, falling back to LS:', error.message)
    }
  }
  const all = readLS<SessionTemplate[]>(KEY_TEMPLATES_CUSTOM, [])
  const idx = all.findIndex(t => t.id === template.id)
  if (idx >= 0) all[idx] = template
  else all.push(template)
  writeLS(KEY_TEMPLATES_CUSTOM, all)
}

export async function deleteCustomTemplate(id: string): Promise<void> {
  const ctx = await getAuthedClient()
  if (ctx) {
    const { error } = await ctx.supabase.from('session_templates').delete().eq('id', id)
    if (!error) return
    if (!isMissingTableError(error)) {
      console.warn('[plan storage] supabase failed, falling back to LS:', error.message)
    }
  }
  const all = readLS<SessionTemplate[]>(KEY_TEMPLATES_CUSTOM, [])
  writeLS(KEY_TEMPLATES_CUSTOM, all.filter(t => t.id !== id))
}
