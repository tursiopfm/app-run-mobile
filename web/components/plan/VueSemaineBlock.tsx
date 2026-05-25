'use client'

// Bloc Vue Semaine : calendrier 7 jours (lundi → dimanche) avec mini-cartes draggables.
// Lit PlannedSession[] et TrainingPlan via lib/plan/storage. La DnD inter-blocs
// passe par PlanSessionsDndProvider qui doit envelopper ce bloc + BibliothèqueSeancesBlock.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { PlannedSession, TrainingPlan } from '@/types/plan'
import {
  getPlannedSessions,
  savePlannedSession,
  getCurrentPlan,
  peekMacros,
  peekSessions,
  pickActiveMacrocycle,
  isRaceMirrorSession,
} from '@/lib/plan/storage'
import {
  matchSessionsToActivities,
  getUnlinkedPairs,
  addUnlinkedPair,
  type MatchableActivity,
} from '@/lib/plan/session-matching'
import { colors } from '@/lib/design/colors'
import { INTENSITY_LEVEL_COLORS } from '@/lib/activities/indicators'
import { formatDurationHHmm } from '@/lib/training/duration'
import { useActivityTypes } from '@/lib/plan/use-activity-types'
import { resolveSessionMeta } from '@/lib/plan/session-meta'
import { SessionEditorModal } from './SessionEditorModal'
import { BlockCard } from '@/components/blocks/BlockCard'

// ─── Helpers date (semaine ISO, lundi → dimanche, UTC) ───────────────────────
function toISO(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfISOWeek(d: Date): Date {
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = utc.getUTCDay() || 7
  if (dow !== 1) utc.setUTCDate(utc.getUTCDate() - (dow - 1))
  return utc
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d.getTime())
  next.setUTCDate(next.getUTCDate() + n)
  return next
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
}

function formatDM(iso: string): string {
  const d = parseISO(iso)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const DAY_LABELS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']

// ─── Composant principal ────────────────────────────────────────────────────
type VueSemaineBlockProps = {
  /**
   * Compteur incrémenté par le parent (PlanClient) après une opération DnD
   * (move / create depuis template). Inclus dans les deps du reload pour
   * forcer un re-fetch sans démonter le composant.
   */
  reloadKey?: number
}

export function VueSemaineBlock({ reloadKey = 0 }: VueSemaineBlockProps = {}) {
  const router = useRouter()
  // Init = lundi de la semaine courante (UTC).
  const [weekStartISO, setWeekStartISO] = useState<string>(() => toISO(startOfISOWeek(new Date())))

  // Lazy-init depuis le snapshot LS (visite précédente) — supprime le flash.
  // Range identique à celui calculé par weekDays[0] et weekEndISO ci-dessous,
  // mais on doit le construire ici avant les useState.
  const initialWeekEndISO = toISO(addDays(parseISO(weekStartISO), 6))
  const initialSessions = peekSessions(weekStartISO, initialWeekEndISO)
  const initialMacros = peekMacros()
  const [sessions, setSessions] = useState<PlannedSession[]>(initialSessions ?? [])
  const [plan, setPlan] = useState<TrainingPlan | null>(
    initialMacros ? pickActiveMacrocycle(initialMacros, weekStartISO) : null,
  )
  const [loaded, setLoaded] = useState(initialSessions !== null && initialMacros !== null)
  const [weekActivities, setWeekActivities] = useState<MatchableActivity[]>([])
  // Paires (sessionId|activityId) que l'user a explicitement déliées.
  // Lu depuis LS, mis à jour quand on délie depuis la modal.
  const [unlinkedTick, setUnlinkedTick] = useState(0)

  const { types } = useActivityTypes()

  // État modal édition / création de séance.
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<PlannedSession | null>(null)
  const [editorInitialDate, setEditorInitialDate] = useState<string | undefined>(undefined)

  const [duplicating, setDuplicating] = useState(false)

  const weekDays = useMemo<string[]>(() => {
    const monday = parseISO(weekStartISO)
    return Array.from({ length: 7 }, (_, i) => toISO(addDays(monday, i)))
  }, [weekStartISO])

  const weekEndISO = weekDays[6]
  const todayISO = useMemo(() => {
    const n = new Date()
    return toISO(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())))
  }, [])

  const reload = useCallback(async () => {
    const [s, p] = await Promise.all([
      getPlannedSessions(weekDays[0], weekEndISO),
      getCurrentPlan(),
    ])
    setSessions(s)
    setPlan(p)
    setLoaded(true)
  }, [weekDays, weekEndISO])

  // Reload avec garde anti-race : si l'user enchaîne prev/next vite, l'ancienne
  // promesse peut résoudre APRÈS la nouvelle et écraser le state. Le flag
  // `cancelled` côté effect ignore les résolutions obsolètes.
  // `reloadKey` permet au parent (PlanClient) de forcer un re-fetch après un
  // drop DnD (move ou création depuis template) sans démonter le composant.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [s, p] = await Promise.all([
        getPlannedSessions(weekDays[0], weekEndISO),
        getCurrentPlan(),
      ])
      if (cancelled) return
      setSessions(s)
      setPlan(p)
      setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [weekDays, weekEndISO, reloadKey])

  // Fetch des activités réalisées de la semaine pour le matching ↔ séances.
  // Indépendant du fetch sessions (sources différentes) : on l'isole dans son
  // propre effect pour qu'une erreur d'API n'empêche pas l'affichage des séances.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `/api/activities/for-period?from=${weekDays[0]}&to=${weekEndISO}`,
          { cache: 'no-store' },
        )
        if (!res.ok) {
          if (!cancelled) setWeekActivities([])
          return
        }
        const json = (await res.json()) as { activities: MatchableActivity[] }
        if (cancelled) return
        setWeekActivities(json.activities ?? [])
      } catch {
        if (!cancelled) setWeekActivities([])
      }
    })()
    return () => { cancelled = true }
  }, [weekDays, weekEndISO, reloadKey])

  // Map sessionId → activityIds réalisées (1 ou 2). Recalculé quand sessions,
  // activités, catalogue de types ou la liste des paires déliées changent.
  const matchMap = useMemo<Map<string, string[]>>(() => {
    const unlinked = getUnlinkedPairs()
    // unlinkedTick est dans les deps implicites via getUnlinkedPairs (LS) — on
    // référence la var pour que React relance le useMemo après un délier.
    void unlinkedTick
    return matchSessionsToActivities(sessions, weekActivities, types, unlinked)
  }, [sessions, weekActivities, types, unlinkedTick])

  const activitiesById = useMemo<Map<string, MatchableActivity>>(() => {
    const m = new Map<string, MatchableActivity>()
    for (const a of weekActivities) m.set(a.id, a)
    return m
  }, [weekActivities])

  // Sessions groupées par jour ISO.
  const sessionsByDay = useMemo<Record<string, PlannedSession[]>>(() => {
    const map: Record<string, PlannedSession[]> = {}
    for (const d of weekDays) map[d] = []
    for (const s of sessions) {
      if (map[s.date]) map[s.date].push(s)
    }
    return map
  }, [sessions, weekDays])

  // Totaux semaine — RUNNING UNIQUEMENT (course, footing, fractionné, côtes,
  // seuil, sortie longue, runtaf). Vélo / natation / renfo exclus des 3 bulles.
  // Durée : si non saisie, on extrapole depuis la distance (6 min/km running).
  const totals = useMemo(() => {
    let duration = 0
    let distance = 0
    let elevation = 0
    for (const s of sessions) {
      const meta = resolveSessionMeta(s.type, types)
      if (!meta.isRunning) continue
      let dur = s.duration && s.duration > 0 ? s.duration : 0
      if (dur === 0 && s.distance && s.distance > 0) {
        // Extrapolation : running 6 min/km (couvre tous les types catégorie 'run')
        dur = s.distance * 6
      }
      duration += dur
      distance += s.distance || 0
      elevation += s.elevation || 0
    }
    return { duration, distance, elevation }
  }, [sessions, types])

  // Lundi ISO de la semaine courante (recalculé à chaque render — pas couteux).
  const currentMondayISO = useMemo(() => toISO(startOfISOWeek(new Date())), [])
  const isCurrentWeek = weekStartISO === currentMondayISO

  // Numéro semaine X / Y dans le plan.
  const weekInPlan = useMemo<{ x: number; y: number } | null>(() => {
    if (!plan) return null
    const start = parseISO(plan.startDate).getTime()
    const end = parseISO(plan.endDate).getTime()
    const cur = parseISO(weekStartISO).getTime()
    const x = Math.floor((cur - start) / (7 * 86_400_000)) + 1
    const y = Math.floor((end - start) / (7 * 86_400_000)) + 1
    if (x < 1 || x > y) return null
    return { x, y }
  }, [plan, weekStartISO])

  function gotoOffsetWeeks(offset: number) {
    const next = toISO(addDays(parseISO(weekStartISO), offset * 7))
    setWeekStartISO(next)
  }

  function openCreate(dateISO: string) {
    setEditingSession(null)
    setEditorInitialDate(dateISO)
    setEditorOpen(true)
  }

  function openEdit(session: PlannedSession) {
    // Une session miroir de course n'est pas éditable ici : la donnée canonique
    // vit dans la table races, accessible via /plan/courses/<id>.
    if (isRaceMirrorSession(session)) {
      router.push(`/plan/courses/${session.id}`)
      return
    }
    setEditingSession(session)
    setEditorInitialDate(undefined)
    setEditorOpen(true)
  }

  async function handleDuplicateWeek() {
    if (duplicating) return
    if (sessions.length === 0) return
    setDuplicating(true)
    try {
      const targetMonday = toISO(addDays(parseISO(weekStartISO), 7))
      const delta = parseISO(targetMonday).getTime() - parseISO(weekStartISO).getTime()
      for (const s of sessions) {
        // Ne pas dupliquer les miroirs de course : ils sont créés par saveRace,
        // pas par l'utilisateur. Dupliquer créerait une fausse séance "course"
        // sur la semaine suivante sans Race associée.
        if (isRaceMirrorSession(s)) continue
        const newDate = toISO(new Date(parseISO(s.date).getTime() + delta))
        const copy: PlannedSession = {
          ...s,
          id: makeId(),
          date: newDate,
          status: 'planned',
          linkedActivityId: undefined,
        }
        await savePlannedSession(copy)
      }
      // On reste sur la semaine courante (l'utilisateur peut naviguer vers la suivante).
    } finally {
      setDuplicating(false)
    }
  }

  const titleLabel = weekInPlan ? `Semaine ${weekInPlan.x} / ${weekInPlan.y}` : 'Semaine'

  return (
    <BlockCard
      title={titleLabel}
      helpTitle="Semaine"
      helpBody="Calendrier de la semaine sélectionnée. Glisse-dépose des templates depuis la bibliothèque pour planifier une séance."
      rightSlot={
        <div className="flex items-center gap-1 flex-wrap">
          <Pill bg={`${colors.seriesOrange}26`} color={colors.seriesOrange} label={`${Math.round(totals.distance)} km`} />
          <Pill bg={`${colors.seriesBlue}26`}   color={colors.seriesBlue}   label={`${Math.round(totals.elevation)} m D+`} />
          <Pill bg={`${colors.greenOk}26`}      color={colors.greenOk}      label={formatDurationHHmm(totals.duration)} />
        </div>
      }
    >
      <div className="flex items-center gap-2 mb-3">
        <NavButton
          label="<"
          ariaLabel="Semaine précédente"
          onClick={() => gotoOffsetWeeks(-1)}
        />
        <span className="text-[12px] text-trail-muted flex-1 text-center">
          du {formatDM(weekDays[0])} au {formatDM(weekEndISO)}
        </span>
        <button
          type="button"
          onClick={() => setWeekStartISO(currentMondayISO)}
          aria-pressed={isCurrentWeek}
          aria-label="Revenir à la semaine en cours"
          className="rounded-full px-2 py-[3px] text-[11px] font-bold whitespace-nowrap transition-colors"
          style={
            isCurrentWeek
              ? {
                  backgroundColor: `${colors.chargeOrange}26`,
                  color: colors.chargeOrange,
                  border: `1px solid ${colors.chargeOrange}4D`,
                }
              : {
                  backgroundColor: 'transparent',
                  color: 'var(--trail-muted)',
                  border: '1px solid var(--trail-border)',
                }
          }
        >
          En cours
        </button>
        <NavButton
          label=">"
          ariaLabel="Semaine suivante"
          onClick={() => gotoOffsetWeeks(1)}
        />
      </div>

      {/* ── Body : 7 colonnes ───────────────────────────────────────────── */}
      {/* Grille 7 colonnes pleine largeur sur tous les viewports : pas de
          scroll horizontal. Sur mobile très étroit (< 360px), les colonnes
          font ~45px chacune ; les mini-cartes session se compactent en
          conséquence (gap réduit à 1, padding interne minimal). */}
      <div className="mt-3">
        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {weekDays.map((iso, i) => (
            <DayColumn
              key={iso}
              iso={iso}
              label={DAY_LABELS[i]}
              isToday={iso === todayISO}
              sessions={sessionsByDay[iso] ?? []}
              matchMap={matchMap}
              onSessionClick={openEdit}
              onAdd={() => openCreate(iso)}
            />
          ))}
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        {/* TODO: réintroduire 'Enregistrer comme semaine type' quand la feature bibliothèque-de-semaines-types sera développée. */}
        <button
          type="button"
          onClick={handleDuplicateWeek}
          disabled={duplicating || sessions.length === 0}
          className="px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:border-trail-primary"
        >
          {duplicating ? 'Duplication…' : 'Dupliquer la semaine'}
        </button>
      </div>

      {!loaded && (
        <div className="text-center text-trail-muted text-[12px] mt-2" role="status">Chargement…</div>
      )}

      <SessionEditorModal
        session={editingSession}
        initialDate={editorInitialDate}
        open={editorOpen}
        matchedActivities={editingSession ? (() => {
          const ids = matchMap.get(editingSession.id)
          if (!ids) return null
          const list: MatchableActivity[] = []
          for (const id of ids) {
            const a = activitiesById.get(id)
            if (a) list.push(a)
          }
          return list.length > 0 ? list : null
        })() : null}
        onUnlink={(sessionId, activityIds) => {
          for (const aid of activityIds) addUnlinkedPair(sessionId, aid)
          setUnlinkedTick(t => t + 1)
        }}
        onClose={() => setEditorOpen(false)}
        onSaved={() => { void reload() }}
      />
    </BlockCard>
  )
}

// ─── Sous-composants ────────────────────────────────────────────────────────
function NavButton({
  label, ariaLabel, onClick,
}: { label: string; ariaLabel: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        width: 40,
        height: 40,
        flexShrink: 0,
        borderRadius: 10,
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        color: colors.text,
        fontSize: 18,
        fontWeight: 900,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function Pill({ bg, color, label }: { bg: string; color: string; label: string }) {
  return (
    <span
      className="px-[8px] py-[3px] rounded-full text-[10px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: bg, color }}
    >
      {label}
    </span>
  )
}

function DayColumn({
  iso, label, isToday, sessions, matchMap, onSessionClick, onAdd,
}: {
  iso: string
  label: string
  isToday: boolean
  sessions: PlannedSession[]
  matchMap: Map<string, string[]>
  onSessionClick: (s: PlannedSession) => void
  onAdd: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${iso}` })
  const dayNum = parseISO(iso).getUTCDate()

  return (
    <div
      ref={setNodeRef}
      className={`min-w-0 rounded-[8px] border transition-colors ${
        isOver
          ? 'border-trail-primary bg-trail-primary/10'
          : 'border-trail-border bg-trail-surface'
      }`}
    >
      {/* Header colonne */}
      <div
        className={`px-2 py-[6px] border-b text-center ${
          isToday ? 'border-trail-primary' : 'border-trail-border'
        }`}
      >
        <div
          className={`text-[10px] font-semibold tracking-wider ${
            isToday ? 'text-trail-primary' : 'text-trail-muted'
          }`}
        >
          {label}
        </div>
        <div
          className={`text-[16px] leading-none ${
            isToday ? 'text-trail-primary' : 'text-trail-text'
          }`}
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          {dayNum}
        </div>
      </div>

      {/* Corps colonne */}
      <div className="p-1 flex flex-col gap-1 min-h-[120px]">
        {sessions.map(s => (
          <DraggableSessionCard
            key={s.id}
            session={s}
            done={matchMap.has(s.id)}
            isRaceMirror={isRaceMirrorSession(s)}
            onClick={() => onSessionClick(s)}
          />
        ))}
        <button
          type="button"
          onClick={onAdd}
          className="mt-auto w-full py-1 rounded-[6px] border border-dashed border-trail-border text-trail-muted text-[14px] hover:border-trail-primary hover:text-trail-primary leading-none"
          aria-label={`Ajouter une séance le ${iso}`}
        >
          +
        </button>
      </div>
    </div>
  )
}

function DraggableSessionCard({
  session, done, isRaceMirror, onClick,
}: {
  session: PlannedSession
  done: boolean
  isRaceMirror: boolean
  onClick: () => void
}) {
  // Miroir de course : non-draggable (la donnée canonique vit dans la table
  // races, modifier la date doit passer par /plan/courses/<id>). On instancie
  // quand même useDraggable pour respecter les règles des hooks, mais on
  // n'attache pas les listeners.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `session-${session.id}`,
    data: { type: 'planned-session', sessionId: session.id, title: session.title },
    disabled: isRaceMirror,
  })
  const intensityColor = INTENSITY_LEVEL_COLORS[session.intensity]
  // Surcharge visuelle pour le miroir : bordure orange primary + bg légèrement
  // teinté pour signaler "c'est ta course objectif".
  const cardBorderColor = isRaceMirror ? 'var(--trail-primary)' : intensityColor
  const cardBg = isRaceMirror ? 'color-mix(in oklab, var(--trail-primary) 10%, var(--trail-card))' : undefined

  return (
    <div
      ref={setNodeRef}
      {...(isRaceMirror ? {} : attributes)}
      {...(isRaceMirror ? {} : listeners)}
      // pan-y : laisse le scroll vertical natif passer sur la séance, sinon
      // toucher une carte = scroll bloqué. Le drag s'active quand même via le
      // long-press TouchSensor (250 ms immobile).
      style={{
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'pan-y',
        borderColor: cardBorderColor,
        background: cardBg,
      }}
      className="relative rounded-[6px] bg-trail-card border p-1 cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={isRaceMirror
        ? `Ouvrir le détail de la course ${session.title}`
        : `Éditer la séance ${session.title}${done ? ' (réalisée)' : ''} (intensité ${session.intensity} sur 5, glisser pour déplacer)`}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    >
      {isRaceMirror && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -left-1 flex items-center justify-center rounded-full leading-none"
          style={{
            backgroundColor: 'var(--trail-primary)',
            color: '#fff',
            width: 14,
            height: 14,
            fontSize: 9,
            boxShadow: '0 0 0 1.5px var(--trail-card)',
          }}
          title="Course objectif"
        >
          🏆
        </span>
      )}
      {done && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-[10px] font-bold leading-none"
          style={{
            backgroundColor: colors.greenOk,
            color: '#fff',
            width: 14,
            height: 14,
            boxShadow: '0 0 0 1.5px var(--trail-card)',
          }}
        >
          ✓
        </span>
      )}
      <div
        className="text-[11px] text-trail-text leading-tight"
        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {session.title}
      </div>
      {!!session.duration && session.duration > 0 && (
        <div className="mt-1 text-[10px] text-trail-muted leading-[13px]">
          {formatDurationHHmm(session.duration)}
        </div>
      )}
      {!!session.distance && session.distance > 0 && (
        <div
          className="text-[10px] leading-[13px] whitespace-nowrap"
          style={{ color: colors.seriesOrange }}
          aria-label={`Distance ${session.distance} kilomètres`}
        >
          {session.distance} km
        </div>
      )}
      {!!session.elevation && session.elevation > 0 && (
        <div
          className="text-[10px] leading-[13px] whitespace-nowrap"
          style={{ color: colors.seriesBlue }}
          aria-label={`D plus ${session.elevation} mètres`}
        >
          {session.elevation}m
        </div>
      )}
      {session.notes && (
        <p
          className="mt-1 text-[10px] text-trail-muted leading-[13px] overflow-hidden text-ellipsis whitespace-nowrap"
          title={session.notes}
        >
          {session.notes}
        </p>
      )}
    </div>
  )
}
