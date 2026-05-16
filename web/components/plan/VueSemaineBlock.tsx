'use client'

// Bloc Vue Semaine : calendrier 7 jours (lundi → dimanche) avec mini-cartes draggables.
// Lit PlannedSession[] et TrainingPlan via lib/plan/storage. La DnD inter-blocs
// passe par PlanSessionsDndProvider qui doit envelopper ce bloc + BibliothèqueSeancesBlock.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { Phase, PlannedSession, TrainingPlan } from '@/types/plan'
import {
  getPlannedSessions,
  savePlannedSession,
  getCurrentPlan,
} from '@/lib/plan/storage'
import { PHASE_DEFINITIONS } from '@/lib/training/phases'
import { colors } from '@/lib/design/colors'
import { INTENSITY_LEVEL_COLORS } from '@/lib/activities/indicators'
import TypeIndicator from '@/components/activity/TypeIndicator'
import { SessionEditorModal } from './SessionEditorModal'

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

function findCurrentPhase(plan: TrainingPlan | null, nowISO: string): Phase | null {
  if (!plan) return null
  return plan.phases.find(p => p.startDate <= nowISO && nowISO <= p.endDate) ?? null
}

// ─── Composant principal ────────────────────────────────────────────────────
export function VueSemaineBlock() {
  // Init = lundi de la semaine courante (UTC).
  const [weekStartISO, setWeekStartISO] = useState<string>(() => toISO(startOfISOWeek(new Date())))
  const [sessions, setSessions] = useState<PlannedSession[]>([])
  const [plan, setPlan] = useState<TrainingPlan | null>(null)
  const [loaded, setLoaded] = useState(false)

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

  useEffect(() => { void reload() }, [reload])

  // Sessions groupées par jour ISO.
  const sessionsByDay = useMemo<Record<string, PlannedSession[]>>(() => {
    const map: Record<string, PlannedSession[]> = {}
    for (const d of weekDays) map[d] = []
    for (const s of sessions) {
      if (map[s.date]) map[s.date].push(s)
    }
    return map
  }, [sessions, weekDays])

  // Totaux semaine.
  const totals = useMemo(() => {
    let duration = 0
    let charge = 0
    let elevation = 0
    for (const s of sessions) {
      duration += s.duration || 0
      charge += s.estimatedCharge || 0
      elevation += s.elevation || 0
    }
    return { duration, charge, elevation }
  }, [sessions])

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

  const currentPhase = useMemo(
    () => findCurrentPhase(plan, weekStartISO),
    [plan, weekStartISO],
  )

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

  function handleSaveAsTemplate() {
    // Stub : Task 4 reporte cette feature.
    console.log('[plan] Enregistrer comme semaine type — bientôt')
    alert('Bientôt')
  }

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
      {/* ── Header : nav + titre + pill phase + totals ──────────────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => gotoOffsetWeeks(-1)}
            className="px-2 py-1 rounded-[8px] bg-trail-surface border border-trail-border text-trail-text text-[12px] hover:border-trail-primary"
            aria-label="Semaine précédente"
          >
            ←
          </button>
          <h3
            className="text-[18px] text-trail-text whitespace-nowrap"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em' }}
          >
            {weekInPlan
              ? `Semaine ${weekInPlan.x} / ${weekInPlan.y}`
              : 'Semaine'}
            <span className="text-trail-muted text-[13px] font-normal ml-2">
              du {formatDM(weekDays[0])} au {formatDM(weekEndISO)}
            </span>
          </h3>
          <button
            type="button"
            onClick={() => gotoOffsetWeeks(1)}
            className="px-2 py-1 rounded-[8px] bg-trail-surface border border-trail-border text-trail-text text-[12px] hover:border-trail-primary"
            aria-label="Semaine suivante"
          >
            →
          </button>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <Pill bg={`${colors.greenOk}26`}    color={colors.greenOk}    label={`${Math.round(totals.duration)} min`} />
          <Pill bg={`${colors.seriesRed}26`}  color={colors.seriesRed}  label={`${Math.round(totals.charge)} TSS`} />
          <Pill bg={`${colors.seriesBlue}26`} color={colors.seriesBlue} label={`${Math.round(totals.elevation)} m D+`} />
        </div>
      </div>

      {/* ── Sous-header : pill phase courante ──────────────────────────── */}
      {currentPhase && (
        <div className="mt-2">
          <span
            className="inline-block px-[10px] py-[3px] rounded-full text-[11px] font-semibold"
            style={{
              backgroundColor: `${PHASE_DEFINITIONS[currentPhase.type].color}26`,
              color: PHASE_DEFINITIONS[currentPhase.type].color,
            }}
          >
            {currentPhase.label}
          </span>
        </div>
      )}

      {/* ── Body : 7 colonnes ───────────────────────────────────────────── */}
      <div className="mt-3 overflow-x-auto md:overflow-visible">
        <div className="flex gap-2 md:grid md:grid-cols-7 md:gap-2">
          {weekDays.map((iso, i) => (
            <DayColumn
              key={iso}
              iso={iso}
              label={DAY_LABELS[i]}
              isToday={iso === todayISO}
              sessions={sessionsByDay[iso] ?? []}
              onSessionClick={openEdit}
              onAdd={() => openCreate(iso)}
            />
          ))}
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleDuplicateWeek}
          disabled={duplicating || sessions.length === 0}
          className="px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:border-trail-primary"
        >
          {duplicating ? 'Duplication…' : 'Dupliquer la semaine'}
        </button>
        <button
          type="button"
          onClick={handleSaveAsTemplate}
          className="px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-muted text-[13px] font-semibold hover:border-trail-primary hover:text-trail-text"
        >
          Enregistrer comme semaine type
        </button>
      </div>

      {!loaded && (
        <div className="text-center text-trail-muted text-[12px] mt-2" role="status">Chargement…</div>
      )}

      <SessionEditorModal
        session={editingSession}
        initialDate={editorInitialDate}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={() => { void reload() }}
      />
    </div>
  )
}

// ─── Sous-composants ────────────────────────────────────────────────────────
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
  iso, label, isToday, sessions, onSessionClick, onAdd,
}: {
  iso: string
  label: string
  isToday: boolean
  sessions: PlannedSession[]
  onSessionClick: (s: PlannedSession) => void
  onAdd: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${iso}` })
  const dayNum = parseISO(iso).getUTCDate()

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 min-w-[100px] md:min-w-0 rounded-[8px] border transition-colors ${
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
          <DraggableSessionCard key={s.id} session={s} onClick={() => onSessionClick(s)} />
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
  session, onClick,
}: {
  session: PlannedSession
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `session-${session.id}`,
    data: { type: 'planned-session', sessionId: session.id, title: session.title },
  })
  const intensityColor = INTENSITY_LEVEL_COLORS[session.intensity]

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging ? 0.4 : 1, touchAction: 'none' }}
      className="rounded-[6px] bg-trail-card border border-trail-border p-1 cursor-pointer hover:border-trail-primary"
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Éditer la séance ${session.title} (glisser pour déplacer)`}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    >
      <TypeIndicator type={session.type} />
      <div
        className="mt-1 text-[11px] text-trail-text leading-tight"
        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {session.title}
      </div>
      <div className="mt-1 flex items-center justify-between gap-1">
        <span className="text-[10px] text-trail-muted">{session.duration}′</span>
        <span
          className="px-[5px] py-[1px] rounded-full text-[9px] font-semibold leading-none"
          style={{ backgroundColor: `${intensityColor}26`, color: intensityColor }}
          aria-label={`Intensité ${session.intensity} sur 5`}
        >
          I{session.intensity}
        </span>
      </div>
    </div>
  )
}
