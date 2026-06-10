// Persistance Plan : tente Supabase, fallback localStorage.
// Stratégie : si l'utilisateur n'est pas authentifié OU si la table est absente
// (erreur PostgreSQL 42P01 "undefined_table"), on retombe sur localStorage.
// Pas de sync Supabase ↔ localStorage : on utilise l'un ou l'autre.

import { getAuthedClient } from './supabase-auth-cache'
// Note : import regenerateWeeks retiré — le module mesocycle-weeks est supprimé.
import type {
  Phase,
  PhaseWeeklyTarget,
  PlannedSession,
  Race,
  SessionStatus,
  SessionTemplate,
  SessionType,
  SessionZone,
  TrainingPlan,
  TrainingZone,
} from '@/types/plan'
import { estimateCharge } from '@/lib/training/charge'

// Marqueur stocké dans PlannedSession.templateId pour distinguer un "miroir
// course" (créé automatiquement à partir d'une Race) d'une séance normale.
// Permet à l'UI de rediriger le clic vers /plan/courses/<id> au lieu d'ouvrir
// l'éditeur standard, et de bloquer le DnD sur ces sessions.
export const RACE_MIRROR_TEMPLATE_ID = 'race-mirror'

export function isRaceMirrorSession(s: { templateId?: string | null }): boolean {
  return s.templateId === RACE_MIRROR_TEMPLATE_ID
}

// Construit la PlannedSession miroir d'une course : même id que la Race
// (UUID), type 'course', intensité 5, durée estimée à 6 min/km running.
// L'id partagé permet de retrouver la session miroir directement via race.id
// lors d'un update/delete sans avoir à scanner.
function raceToMirrorSession(race: Race): PlannedSession {
  const duration = race.distance > 0 ? Math.round(race.distance * 6) : 0
  return {
    id: race.id,
    planId: '',
    date: race.date,
    type: 'course',
    title: race.name,
    duration,
    distance: race.distance,
    elevation: race.elevation,
    intensity: 5,
    estimatedCharge: estimateCharge(duration, 5, race.elevation),
    status: 'planned',
    templateId: RACE_MIRROR_TEMPLATE_ID,
  }
}

// ─── Clés localStorage (versionnées) ────────────────────────────────────────
const KEY_RACE = 'tc:plan:race:v1'
const KEY_PLAN = 'tc:plan:current_plan:v1'
const KEY_SESSIONS = 'tc:plan:planned_sessions:v1'
const KEY_TEMPLATES_CUSTOM = 'tc:plan:templates_custom:v1'
const KEY_HIDDEN_SYSTEM_TEMPLATES = 'tc:plan:hidden_system_templates:v1'

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
  // priority/status/focus/load_pattern : optionnels pour tolérer migration 022
  // non encore appliquée (fallbacks en lecture, miroir en écriture).
  priority?: Race['priority']
  notes: string | null
  // Migration 035 — optionnels pour tolérer DB non encore migrée (retry à l'écriture).
  start_time?: string | null
  target_duration_min?: number | null
  pacing_fade?: number | null
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
    // Fallback si la colonne `priority` est absente (migration 022 non appliquée) :
    // une race main devient prio A, sinon C.
    priority: r.priority ?? (r.is_main ? 'A' : 'C'),
    notes: r.notes ?? undefined,
    // Postgres `time` renvoie 'HH:MM:SS' → normaliser en 'HH:MM'.
    startTime: r.start_time ? r.start_time.slice(0, 5) : undefined,
    targetDurationMin: r.target_duration_min ?? undefined,
    pacingFade: r.pacing_fade ?? undefined,
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
    // is_main est écrit en miroir de priority='A' pour que ObjectifCourseBlock
    // (qui lit encore is_main) reste cohérent pendant la transition vers
    // l'usage de priority partout dans l'UI.
    is_main: race.priority === 'A',
    priority: race.priority,
    notes: race.notes ?? null,
    start_time: race.startTime ?? null,
    target_duration_min: race.targetDurationMin ?? null,
    pacing_fade: race.pacingFade ?? 0,
  }
}

type PlanRow = {
  id: string
  athlete_id: string
  name: string
  goal_race_id: string | null
  start_date: string
  end_date: string
  // Colonnes ajoutées par migration 022 — optionnelles pour tolérer DB legacy
  // (le code fallback sur 'active' et undefined côté lecture).
  status?: TrainingPlan['status']
  color?: string | null
  template_id?: string | null
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
  // Format JSONB côté DB : [{ km: number, d_plus: number }, ...]
  weekly_targets?: Array<{ km: number; d_plus: number }> | null
  // Colonne migration 022 — optionnelle pour tolérer DB legacy.
  focus?: string | null
  description: string | null
  position: number
}

function weeklyTargetsFromJson(raw: unknown): PhaseWeeklyTarget[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: PhaseWeeklyTarget[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const km = Number((item as { km?: unknown }).km)
    const dPlus = Number((item as { d_plus?: unknown }).d_plus)
    out.push({
      km: Number.isFinite(km) ? km : 0,
      dPlus: Number.isFinite(dPlus) ? dPlus : 0,
    })
  }
  return out.length > 0 ? out : undefined
}

function weeklyTargetsToJson(targets: PhaseWeeklyTarget[] | undefined): Array<{ km: number; d_plus: number }> {
  if (!targets || targets.length === 0) return []
  return targets.map(t => ({ km: t.km, d_plus: t.dPlus }))
}

function planFromRows(plan: PlanRow, phases: PhaseRow[]): TrainingPlan {
  return {
    id: plan.id,
    athleteId: plan.athlete_id,
    name: plan.name,
    goalRaceId: plan.goal_race_id,
    startDate: plan.start_date,
    endDate: plan.end_date,
    status: plan.status ?? 'active',
    color: plan.color ?? undefined,
    templateId: plan.template_id ?? undefined,
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
        // Migration 021 pas encore appliquée → colonne absente → undefined.
        weeklyTargets: weeklyTargetsFromJson(p.weekly_targets),
        focus: p.focus ?? undefined,
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
    status: plan.status,
    color: plan.color ?? null,
    template_id: plan.templateId ?? null,
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
    weekly_targets: weeklyTargetsToJson(p.weeklyTargets),
    focus: p.focus ?? null,
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
  zones: SessionZone[] | null
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
  default_zones: SessionZone[] | null
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

// ─── Cache module-level + persistance LS (SWR) ─────────────────────────────
// Mutualise les lectures concurrentes (React StrictMode, blocs parallèles) ET
// hydrate depuis localStorage au load du module pour que les blocs puissent
// rendre synchronement avec les data de la visite précédente — sans flash.
//
// TTL côté mémoire (10 s) reste court pour la cohérence intra-session.
// TTL côté LS (5 min) sert d'optimisation cross-mount : on accepte du stale
// transitoire qui sera revalidé en background par les useEffect des blocs.

const READ_TTL_MS = 10_000
const PERSIST_TTL_MS = 5 * 60_000

const KEY_CACHE_RACES = 'tc:plan:cache:races:v1'
const KEY_CACHE_MACROS = 'tc:plan:cache:macros:v1'
const KEY_CACHE_SESSIONS = 'tc:plan:cache:sessions:v1'

// Snapshot synchrone exposé aux blocs via peekRaces/peekMacros/peekSessions.
// Hydraté depuis localStorage au load du module, mis à jour à chaque fetch
// réussi. C'est ce qui permet le 1er render synchrone avec data.
let snapshotRaces: Race[] | null = null
let snapshotMacros: TrainingPlan[] | null = null
const snapshotSessions = new Map<string, PlannedSession[]>()

let cachedRaces: { promise: Promise<Race[]>; expiresAt: number } | null = null
let cachedMacros: { promise: Promise<TrainingPlan[]>; expiresAt: number } | null = null
const cachedSessions = new Map<string, { promise: Promise<PlannedSession[]>; expiresAt: number }>()

type PersistedCache<T> = { data: T; savedAt: number }

function persistLS<T>(key: string, data: T): void {
  writeLS<PersistedCache<T>>(key, { data, savedAt: Date.now() })
}

function hydrateLS<T>(key: string): T | null {
  const raw = readLS<PersistedCache<T> | null>(key, null)
  if (!raw || typeof raw !== 'object') return null
  if (Date.now() - raw.savedAt > PERSIST_TTL_MS) return null
  return raw.data
}

// Hydratation initiale (sync) — exécutée au load du module côté client.
// Doit tourner avant le 1er render des blocs pour que peekX() retourne data.
if (typeof window !== 'undefined') {
  snapshotRaces = hydrateLS<Race[]>(KEY_CACHE_RACES)
  snapshotMacros = hydrateLS<TrainingPlan[]>(KEY_CACHE_MACROS)
  const sess = hydrateLS<Record<string, PlannedSession[]>>(KEY_CACHE_SESSIONS)
  if (sess) {
    for (const [k, v] of Object.entries(sess)) snapshotSessions.set(k, v)
  }
}

function persistSessionsSnapshot(): void {
  // Sérialisation du Map en plain object pour LS.
  const obj: Record<string, PlannedSession[]> = {}
  snapshotSessions.forEach((v, k) => { obj[k] = v })
  persistLS(KEY_CACHE_SESSIONS, obj)
}

// Helpers sync pour les blocs : retournent la dernière valeur connue ou null.
export function peekRaces(): Race[] | null { return snapshotRaces }
export function peekMacros(): TrainingPlan[] | null { return snapshotMacros }
export function peekSessions(from: string, to: string): PlannedSession[] | null {
  return snapshotSessions.get(`${from}|${to}`) ?? null
}

function invalidateRacesCache(): void {
  cachedRaces = null
  snapshotRaces = null
  writeLS<PersistedCache<Race[]> | null>(KEY_CACHE_RACES, null)
}
function invalidateMacrosCache(): void {
  cachedMacros = null
  snapshotMacros = null
  writeLS<PersistedCache<TrainingPlan[]> | null>(KEY_CACHE_MACROS, null)
}
function invalidateSessionsCache(): void {
  cachedSessions.clear()
  snapshotSessions.clear()
  writeLS<PersistedCache<Record<string, PlannedSession[]>> | null>(KEY_CACHE_SESSIONS, null)
}

// ─── API publique : Race ────────────────────────────────────────────────────

// Liste TOUTES les races de l'athlète, triées par date asc.
// Fallback LS : on retourne un array contenant l'éventuelle race historique
// stockée en single-slot (KEY_RACE) + les races multiples (KEY_RACES).
export async function getRaces(): Promise<Race[]> {
  const now = Date.now()
  if (cachedRaces && cachedRaces.expiresAt > now) return cachedRaces.promise
  const promise = (async (): Promise<Race[]> => {
    const ctx = await getAuthedClient()
    if (ctx) {
      const { data, error } = await ctx.supabase
        .from('races')
        .select('*')
        .eq('athlete_id', ctx.athleteId)
        .order('date', { ascending: true })
      if (!error && data) {
        const list = (data as RaceRow[]).map(raceFromRow)
        snapshotRaces = list
        persistLS(KEY_CACHE_RACES, list)
        return list
      }
      if (error && !isMissingTableError(error)) {
        // Erreur réelle : on continue vers LS.
      }
    }
    const list = readRacesFromLS()
    snapshotRaces = list
    persistLS(KEY_CACHE_RACES, list)
    return list
  })()
  cachedRaces = { promise, expiresAt: now + READ_TTL_MS }
  return promise
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
  invalidateRacesCache()
  const ctx = await getAuthedClient()
  let saved = false
  if (ctx) {
    const row = raceToRow(race, ctx.athleteId)
    const { error } = await ctx.supabase.from('races').upsert(row, { onConflict: 'id' })
    if (!error) {
      saved = true
    } else if (isMissingColumnError(error)) {
      // Colonne absente (migration 022 et/ou 035 non appliquée) : retry sans les
      // colonnes optionnelles plutôt que fallback LS (qui ferait disparaître la
      // race côté serveur).
      const {
        priority: _priority,
        start_time: _st,
        target_duration_min: _td,
        pacing_fade: _pf,
        ...legacyRow
      } = row
      const { error: retryErr } = await ctx.supabase
        .from('races')
        .upsert(legacyRow, { onConflict: 'id' })
      if (!retryErr) {
        saved = true
      } else {
        console.warn('[plan storage] supabase retry failed, falling back to LS:', retryErr.message)
      }
    } else if (!isMissingTableError(error)) {
      console.warn('[plan storage] supabase failed, falling back to LS:', error.message)
    }
  }
  if (!saved) {
    // Fallback LS.
    const all = readRacesFromLS()
    const next = mergeRace(all, race)
    writeRacesToLS(next)
  }
  // Miroir PlannedSession (type 'course') : la course apparaît automatiquement
  // dans VueSemaine + CalendrierMois. id partagé avec la Race pour retrouver
  // facilement le miroir lors d'un update/delete.
  await savePlannedSession(raceToMirrorSession(race))
}

/**
 * Backfill : crée un PlannedSession miroir pour chaque Race qui n'en a pas
 * encore (cas des courses créées avant l'introduction de la mirror-sync).
 * Retourne le nombre de miroirs créés (utile pour décider d'un reload).
 * Idempotent : à appeler une seule fois par mount.
 */
export async function ensureRaceMirrors(): Promise<number> {
  const races = await getRaces()
  if (races.length === 0) return 0
  const ids = races.map(r => r.id)
  const existingIds = new Set<string>()
  const ctx = await getAuthedClient()
  if (ctx) {
    const { data, error } = await ctx.supabase
      .from('planned_sessions')
      .select('id')
      .in('id', ids)
    if (!error && data) {
      for (const r of data as { id: string }[]) existingIds.add(r.id)
    } else {
      const all = readLS<PlannedSession[]>(KEY_SESSIONS, [])
      for (const s of all) if (ids.includes(s.id)) existingIds.add(s.id)
    }
  } else {
    const all = readLS<PlannedSession[]>(KEY_SESSIONS, [])
    for (const s of all) if (ids.includes(s.id)) existingIds.add(s.id)
  }
  let added = 0
  for (const race of races) {
    if (existingIds.has(race.id)) continue
    await savePlannedSession(raceToMirrorSession(race))
    added++
  }
  return added
}

export async function deleteRace(id: string): Promise<void> {
  invalidateRacesCache()
  const ctx = await getAuthedClient()
  if (ctx) {
    const { error } = await ctx.supabase.from('races').delete().eq('id', id)
    if (!error) {
      removeRaceFromLS(id)
      await deletePlannedSession(id)
      return
    }
    if (!isMissingTableError(error)) {
      console.warn('[plan storage] supabase failed, falling back to LS:', error.message)
    }
  }
  removeRaceFromLS(id)
  await deletePlannedSession(id)
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

/**
 * Helper PUR (sans I/O). Choisit le macrocycle « actif » selon la date du jour.
 *
 * Règles, dans l'ordre :
 *   1. Macrocycle non-archived avec start <= today <= end (en cours).
 *      Si plusieurs candidats (ex : saison annuelle + prépa imbriquée), on prend
 *      celui avec le start_date le plus récent (le plus spécifique).
 *   2. Sinon, macrocycle non-archived futur le plus proche (start > today).
 *   3. Sinon, macrocycle non-archived passé le plus récent (end < today).
 *   4. Sinon, fallback ultime sur l'archived avec end_date le plus récent.
 *   5. Sinon, null.
 */
export function pickActiveMacrocycle(
  macros: TrainingPlan[],
  todayISO: string,
): TrainingPlan | null {
  if (macros.length === 0) return null
  const today = todayISO
  const live = macros.filter(m => m.status !== 'archived')

  // 1. En cours
  const inWindow = live.filter(m => m.startDate <= today && today <= m.endDate)
  if (inWindow.length > 0) {
    return [...inWindow].sort((a, b) => (a.startDate < b.startDate ? 1 : -1))[0]
  }

  // 2. Futur le plus proche
  const future = live.filter(m => m.startDate > today)
  if (future.length > 0) {
    return [...future].sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0]
  }

  // 3. Passé le plus récent
  const past = live.filter(m => m.endDate < today)
  if (past.length > 0) {
    return [...past].sort((a, b) => (a.endDate < b.endDate ? 1 : -1))[0]
  }

  // 4. Fallback archived (end_date le plus récent)
  const archived = macros.filter(m => m.status === 'archived')
  if (archived.length > 0) {
    return [...archived].sort((a, b) => (a.endDate < b.endDate ? 1 : -1))[0]
  }

  return null
}

/**
 * Retourne tous les macrocycles de l'athlète, triés par start_date desc.
 * Inclut tous les statuts (planned / active / completed / archived).
 * Fallback LS si Supabase indisponible.
 */
export async function getAllMacrocycles(): Promise<TrainingPlan[]> {
  const now = Date.now()
  if (cachedMacros && cachedMacros.expiresAt > now) return cachedMacros.promise
  const promise = (async (): Promise<TrainingPlan[]> => {
    const persist = (list: TrainingPlan[]): TrainingPlan[] => {
      snapshotMacros = list
      persistLS(KEY_CACHE_MACROS, list)
      return list
    }
    const ctx = await getAuthedClient()
    if (ctx) {
      const { data: planRows, error: plansErr } = await ctx.supabase
        .from('training_plans')
        .select('*')
        .eq('athlete_id', ctx.athleteId)
        .order('start_date', { ascending: false })
      if (plansErr && !isMissingTableError(plansErr)) {
        const ls = readLS<TrainingPlan | null>(KEY_PLAN, null)
        return persist(ls ? [ls] : [])
      }
      if (planRows && planRows.length > 0) {
        const planIds = (planRows as PlanRow[]).map(p => p.id)
        const { data: phaseRows } = await ctx.supabase
          .from('phases')
          .select('*')
          .in('plan_id', planIds)
          .order('position', { ascending: true })
        const phasesByPlan = new Map<string, PhaseRow[]>()
        for (const pr of (phaseRows ?? []) as PhaseRow[]) {
          if (!phasesByPlan.has(pr.plan_id)) phasesByPlan.set(pr.plan_id, [])
          phasesByPlan.get(pr.plan_id)!.push(pr)
        }
        return persist((planRows as PlanRow[]).map(p => planFromRows(p, phasesByPlan.get(p.id) ?? [])))
      }
      if (!plansErr) return persist([])
    }
    // Fallback LS : on a au mieux 1 plan stocké.
    const lsPlan = readLS<TrainingPlan | null>(KEY_PLAN, null)
    return persist(lsPlan ? [lsPlan] : [])
  })()
  cachedMacros = { promise, expiresAt: now + READ_TTL_MS }
  return promise
}

/**
 * Macrocycle actif (le plus pertinent par rapport à today). Maintenu pour
 * compat avec les consommateurs existants (ChargePlanifieeBlock, VueSemaineBlock,
 * ResumeSemaineBlock, CalendrierMoisBlock). Sub-project B utilise
 * getAllMacrocycles + pickActiveMacrocycle directement dans PlanClient.
 */
export async function getCurrentPlan(): Promise<TrainingPlan | null> {
  const macros = await getAllMacrocycles()
  const today = new Date().toISOString().slice(0, 10)
  return pickActiveMacrocycle(macros, today)
}

export async function saveCurrentPlan(plan: TrainingPlan): Promise<void> {
  invalidateMacrosCache()
  const ctx = await getAuthedClient()
  if (ctx) {
    const planRow = planToRow(plan, ctx.athleteId)
    let { error: upErr } = await ctx.supabase
      .from('training_plans')
      .upsert(planRow, { onConflict: 'id' })
    if (upErr && isMissingColumnError(upErr)) {
      // Migration 022 pas encore appliquée → status / color / template_id absents.
      // Retry sans elles plutôt que de fallback LS.
      const { status: _s, color: _c, template_id: _t, ...legacyPlanRow } = planRow
      const retry = await ctx.supabase
        .from('training_plans')
        .upsert(legacyPlanRow, { onConflict: 'id' })
      upErr = retry.error
    }
    if (!upErr) {
      // Reset des phases puis insert : plus simple que de réconcilier diff.
      await ctx.supabase.from('phases').delete().eq('plan_id', plan.id)
      const rows = phasesToRows(plan)
      if (rows.length > 0) {
        const { error: phaseErr } = await ctx.supabase.from('phases').insert(rows)
        if (phaseErr && isMissingColumnError(phaseErr)) {
          // Migration 015/021/022 pas encore appliquée : retry sans les colonnes
          // km/D+ uniformes (015), overrides hebdo (021), focus (022).
          const legacyRows = rows.map(({
            weekly_distance_km_target: _km,
            weekly_elevation_m_target: _dplus,
            weekly_targets: _wt,
            focus: _focus,
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

/**
 * Alias explicite de saveCurrentPlan pour la création/update d'un macrocycle.
 */
export async function saveMacrocycle(plan: TrainingPlan): Promise<void> {
  return saveCurrentPlan(plan)
}

// ─── API publique : PlannedSession ──────────────────────────────────────────
export async function getPlannedSessions(
  fromDate: string,
  toDate: string,
): Promise<PlannedSession[]> {
  const key = `${fromDate}|${toDate}`
  const now = Date.now()
  const hit = cachedSessions.get(key)
  if (hit && hit.expiresAt > now) return hit.promise
  const promise = (async (): Promise<PlannedSession[]> => {
    const persist = (list: PlannedSession[]): PlannedSession[] => {
      snapshotSessions.set(key, list)
      persistSessionsSnapshot()
      return list
    }
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
        return persist((data as SessionRow[]).map(sessionFromRow))
      }
      if (error && !isMissingTableError(error)) {
        // Erreur réelle : on continue vers LS.
      }
    }
    const all = readLS<PlannedSession[]>(KEY_SESSIONS, [])
    return persist(all.filter(s => s.date >= fromDate && s.date <= toDate))
  })()
  cachedSessions.set(key, { promise, expiresAt: now + READ_TTL_MS })
  return promise
}

export async function savePlannedSession(session: PlannedSession): Promise<void> {
  invalidateSessionsCache()
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
  invalidateSessionsCache()
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

// Compte le nombre de séances planifiées qui utilisent un type donné (slug).
// Sert au flux "supprimer un type custom" : on prévient l'user que N séances
// seront aussi supprimées.
export async function countPlannedSessionsByType(typeSlug: string): Promise<number> {
  const ctx = await getAuthedClient()
  if (ctx) {
    const { count, error } = await ctx.supabase
      .from('planned_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('athlete_id', ctx.athleteId)
      .eq('type', typeSlug)
    if (!error && count != null) return count
    if (error && !isMissingTableError(error)) {
      console.warn('[plan storage] supabase failed, falling back to LS:', error.message)
    }
  }
  const all = readLS<PlannedSession[]>(KEY_SESSIONS, [])
  return all.filter(s => s.type === typeSlug).length
}

// Supprime toutes les séances planifiées d'un type donné. Utilisé par le flux
// "supprimer un type custom" après confirmation explicite de l'user.
export async function deletePlannedSessionsByType(typeSlug: string): Promise<void> {
  invalidateSessionsCache()
  const ctx = await getAuthedClient()
  if (ctx) {
    const { error } = await ctx.supabase
      .from('planned_sessions')
      .delete()
      .eq('athlete_id', ctx.athleteId)
      .eq('type', typeSlug)
    if (!error) return
    if (!isMissingTableError(error)) {
      console.warn('[plan storage] supabase failed, falling back to LS:', error.message)
    }
  }
  const all = readLS<PlannedSession[]>(KEY_SESSIONS, [])
  writeLS(KEY_SESSIONS, all.filter(s => s.type !== typeSlug))
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

// Compte les templates custom (bibliothèque) qui utilisent un type donné.
export async function countCustomTemplatesByType(typeSlug: string): Promise<number> {
  const ctx = await getAuthedClient()
  if (ctx) {
    const { count, error } = await ctx.supabase
      .from('session_templates')
      .select('id', { count: 'exact', head: true })
      .eq('athlete_id', ctx.athleteId)
      .eq('type', typeSlug)
    if (!error && count != null) return count
    if (error && !isMissingTableError(error)) {
      console.warn('[plan storage] supabase failed, falling back to LS:', error.message)
    }
  }
  const all = readLS<SessionTemplate[]>(KEY_TEMPLATES_CUSTOM, [])
  return all.filter(t => t.type === typeSlug).length
}

// Supprime tous les templates custom d'un type donné. Utilisé par le flux
// "supprimer un type custom" après confirmation explicite de l'user.
// Broadcast un event 'tc:templates-changed' pour que la bibliothèque resync.
export async function deleteCustomTemplatesByType(typeSlug: string): Promise<void> {
  const ctx = await getAuthedClient()
  if (ctx) {
    const { error } = await ctx.supabase
      .from('session_templates')
      .delete()
      .eq('athlete_id', ctx.athleteId)
      .eq('type', typeSlug)
    if (!error) {
      notifyTemplatesChanged()
      return
    }
    if (!isMissingTableError(error)) {
      console.warn('[plan storage] supabase failed, falling back to LS:', error.message)
    }
  }
  const all = readLS<SessionTemplate[]>(KEY_TEMPLATES_CUSTOM, [])
  writeLS(KEY_TEMPLATES_CUSTOM, all.filter(t => t.type !== typeSlug))
  notifyTemplatesChanged()
}

// Broadcast inter-composants : la bibliothèque doit recharger sa liste après
// une suppression en cascade (modale prefs supprime des templates en masse).
const TEMPLATES_CHANGED_EVENT = 'tc:templates-changed'
function notifyTemplatesChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(TEMPLATES_CHANGED_EVENT))
}
export const TEMPLATES_CHANGED = TEMPLATES_CHANGED_EVENT

// ─── Masquage des templates système (LS-only) ──────────────────────────────
// Les templates système sont définis en dur dans `web/lib/training/session-templates.ts`.
// Pour permettre à l'utilisateur de les "supprimer" de son point de vue (sans
// les retirer de la source globale), on stocke les ids masqués en LS.
// Le bouton "Réinitialiser les séances par défaut" vide cette liste.

export function getHiddenSystemTemplateIds(): string[] {
  return readLS<string[]>(KEY_HIDDEN_SYSTEM_TEMPLATES, [])
}

export function hideSystemTemplate(id: string): void {
  const current = readLS<string[]>(KEY_HIDDEN_SYSTEM_TEMPLATES, [])
  if (current.includes(id)) return
  writeLS(KEY_HIDDEN_SYSTEM_TEMPLATES, [...current, id])
}

export function unhideAllSystemTemplates(): void {
  writeLS<string[]>(KEY_HIDDEN_SYSTEM_TEMPLATES, [])
}
