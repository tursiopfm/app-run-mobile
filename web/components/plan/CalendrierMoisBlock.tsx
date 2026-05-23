'use client'

// Bloc Calendrier mois : grille 6×7 (semaines complètes incluant débords mois
// précédent/suivant). Affiche jusqu'à 3 dots sur les jours avec PlannedSessions.
// État local indépendant : pas de wire vers ResumeSemaine (les blocs sont
// indépendants côté V3).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getPlannedSessions, peekSessions } from '@/lib/plan/storage'
import type { PlannedSession } from '@/types/plan'
import { colors } from '@/lib/design/colors'
import { BlockCard } from '@/components/blocks/BlockCard'
import { DayDetailPanel } from './DayDetailPanel'
import { resolveSessionMeta } from '@/lib/plan/session-meta'
import { useActivityTypes } from '@/lib/plan/use-activity-types'

// ─── Helpers date (UTC) ──────────────────────────────────────────────────────
function toISO(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

// Premier lundi affiché dans la grille mensuelle (peut appartenir au mois précédent).
function startOfCalendarGrid(visibleMonth: Date): Date {
  const firstOfMonth = new Date(Date.UTC(
    visibleMonth.getUTCFullYear(),
    visibleMonth.getUTCMonth(),
    1,
  ))
  const dow = firstOfMonth.getUTCDay() || 7   // dimanche=0 → 7
  return addDays(firstOfMonth, 1 - dow)
}

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

function formatMonthYearFR(d: Date): string {
  return `${MONTHS_FR[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

// ─── Props ───────────────────────────────────────────────────────────────────
type CalendrierMoisBlockProps = {
  reloadKey?: number
  onSessionsChanged?: () => void
}

// ─── Composant principal ─────────────────────────────────────────────────────
export function CalendrierMoisBlock({ reloadKey = 0, onSessionsChanged }: CalendrierMoisBlockProps = {}) {
  // Init = 1er du mois courant en UTC.
  const todayUTC = useMemo(() => {
    const n = new Date()
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()))
  }, [])
  const todayISO = useMemo(() => toISO(todayUTC), [todayUTC])

  const [visibleMonth, setVisibleMonth] = useState<Date>(
    () => new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), 1)),
  )
  const [selectedDateISO, setSelectedDateISO] = useState<string>(todayISO)
  const [openDayISO, setOpenDayISO] = useState<string | null>(null)
  const { types } = useActivityTypes()

  // Fenêtre de fetch : 1er jour de la grille - 7j → dernier + 7j (sécurité).
  const fetchRange = useMemo(() => {
    const gridStart = startOfCalendarGrid(visibleMonth)
    const from = toISO(addDays(gridStart, -7))
    const to = toISO(addDays(gridStart, 6 * 7 + 7))   // 6 rangées + buffer
    return { from, to }
  }, [visibleMonth])

  // Lazy-init depuis le snapshot LS (visite précédente) — supprime le flash.
  const initialSessions = peekSessions(fetchRange.from, fetchRange.to)
  const [sessions, setSessions] = useState<PlannedSession[]>(initialSessions ?? [])
  const [loaded, setLoaded] = useState(initialSessions !== null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const s = await getPlannedSessions(fetchRange.from, fetchRange.to)
      if (cancelled) return
      setSessions(s)
      setLoaded(true)
    })()
    return () => { cancelled = true }
  }, [fetchRange.from, fetchRange.to, reloadKey])

  // Index couleurs (par type d'activité) par date ISO.
  const sessionsByDay = useMemo<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {}
    for (const s of sessions) {
      if (!s.title) continue
      const color = resolveSessionMeta(s.type, types).color
      ;(map[s.date] ??= []).push(color)
    }
    return map
  }, [sessions, types])

  // Grille 6×7.
  const rows = useMemo(() => {
    const gridStart = startOfCalendarGrid(visibleMonth)
    return Array.from({ length: 6 }, (_, row) =>
      Array.from({ length: 7 }, (_, col) => {
        const date = addDays(gridStart, row * 7 + col)
        const iso = toISO(date)
        return {
          iso,
          dayNum: date.getUTCDate(),
          inMonth: date.getUTCMonth() === visibleMonth.getUTCMonth(),
          dotColors: sessionsByDay[iso] ?? [],
        }
      }),
    )
  }, [visibleMonth, sessionsByDay])

  const gotoMonth = useCallback((offset: number) => {
    setVisibleMonth(prev => new Date(Date.UTC(
      prev.getUTCFullYear(),
      prev.getUTCMonth() + offset,
      1,
    )))
  }, [])

  const handleSelectDate = useCallback((iso: string) => {
    setSelectedDateISO(iso)
    setOpenDayISO(prev => prev === iso ? null : iso)
  }, [])

  return (
    <BlockCard
      title={formatMonthYearFR(visibleMonth)}
      helpTitle="Calendrier mensuel"
      helpBody="Vue 6 semaines. Les dots indiquent les jours avec séances planifiées."
      rightSlot={
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => gotoMonth(-1)}
            aria-label="Mois précédent"
            className="w-7 h-7 rounded-[8px] bg-trail-surface border border-trail-border text-trail-text text-[14px] font-bold flex items-center justify-center"
          >‹</button>
          <button
            type="button"
            onClick={() => gotoMonth(1)}
            aria-label="Mois suivant"
            className="w-7 h-7 rounded-[8px] bg-trail-surface border border-trail-border text-trail-text text-[14px] font-bold flex items-center justify-center"
          >›</button>
        </div>
      }
    >
      {/* ── Day headers ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-7 gap-[5px] mb-[6px]">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <p
            key={i}
            className="text-[11px] font-bold text-trail-muted text-center"
          >
            {d}
          </p>
        ))}
      </div>

      {/* ── Day cells ────────────────────────────────────────────────── */}
      <div className="space-y-[5px]">
        {rows.map((row, ri) => (
          <div key={ri} className="grid grid-cols-7 gap-[5px]">
            {row.map(cell => (
              <CalendarDayCell
                key={cell.iso}
                iso={cell.iso}
                dayNum={cell.dayNum}
                inMonth={cell.inMonth}
                isToday={cell.iso === todayISO}
                isSelected={cell.iso === selectedDateISO}
                dotColors={cell.dotColors}
                onClick={() => handleSelectDate(cell.iso)}
              />
            ))}
          </div>
        ))}
      </div>

      {!loaded && (
        <div className="text-center text-trail-muted text-[12px] mt-2" role="status">Chargement…</div>
      )}

      {openDayISO && (
        <DayDetailPanel
          dateISO={openDayISO}
          onClose={() => setOpenDayISO(null)}
          reloadKey={reloadKey}
          onSessionsChanged={() => onSessionsChanged?.()}
        />
      )}
    </BlockCard>
  )
}

// ─── Sous-composants ─────────────────────────────────────────────────────────
function CalendarDayCell({
  iso, dayNum, inMonth, isToday, isSelected, dotColors, onClick,
}: {
  iso: string
  dayNum: number
  inMonth: boolean
  isToday: boolean
  isSelected: boolean
  dotColors: string[]
  onClick: () => void
}) {
  const plannedCount = dotColors.length
  const borderColor = isSelected
    ? colors.chargeOrange
    : isToday
      ? colors.seriesBlue
      : plannedCount > 0
        ? `${colors.seriesBlue}73`
        : colors.border
  const bg = isSelected ? `${colors.chargeOrange}33` : colors.surface
  const textColor = isSelected
    ? colors.chargeOrange
    : isToday
      ? colors.seriesBlue
      : colors.text
  const opacity = inMonth ? 1 : 0.4
  const ariaLabel = `${iso}${plannedCount > 0 ? ` — ${plannedCount} séance${plannedCount > 1 ? 's' : ''}` : ''}`

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      style={{
        height: 54,
        borderRadius: 9,
        backgroundColor: bg,
        border: `1px solid ${borderColor}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: 5,
        opacity,
        cursor: 'pointer',
        width: '100%',
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: textColor }}>{dayNum}</span>
      {plannedCount > 0 && (
        <div style={{ display: 'flex', gap: 3, marginTop: 4, alignItems: 'center' }}>
          {dotColors.slice(0, 3).map((c, i) => (
            <div
              key={i}
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                backgroundColor: c,
              }}
            />
          ))}
          {plannedCount > 3 && (
            <span style={{ fontSize: 8, color: colors.subtleText }}>
              +{plannedCount - 3}
            </span>
          )}
        </div>
      )}
    </button>
  )
}
