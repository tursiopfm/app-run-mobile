'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PlannedSession, SessionTemplate } from '@/types/plan'
import { getPlannedSessions, isRaceMirrorSession } from '@/lib/plan/storage'
import { resolveSessionMeta } from '@/lib/plan/session-meta'
import { useActivityTypes } from '@/lib/plan/use-activity-types'
import { SessionEditorModal } from './SessionEditorModal'
import { SessionAddSheet } from './SessionAddSheet'
import { formatDurationHHmm } from '@/lib/training/duration'
import { useT } from '@/lib/i18n/I18nProvider'

function formatLong(iso: string, months: readonly string[]): string {
  if (!iso || iso.length < 10) return iso
  const y = iso.slice(0, 4)
  const m = parseInt(iso.slice(5, 7), 10) - 1
  const d = parseInt(iso.slice(8, 10), 10)
  if (Number.isNaN(d) || m < 0 || m > 11) return iso
  return `${d} ${months[m]} ${y}`
}

type Props = {
  dateISO: string
  onClose: () => void
  reloadKey: number
  onSessionsChanged: () => void
}

export function DayDetailPanel({ dateISO, onClose, reloadKey, onSessionsChanged }: Props) {
  const router = useRouter()
  const L = useT().plan
  const [sessions, setSessions] = useState<PlannedSession[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<PlannedSession | null>(null)
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [prefillTemplate, setPrefillTemplate] = useState<SessionTemplate | null>(null)
  const { types } = useActivityTypes()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const all = await getPlannedSessions(dateISO, dateISO)
      if (!cancelled) { setSessions(all); setLoaded(true) }
    })()
    return () => { cancelled = true }
  }, [dateISO, reloadKey])

  function openEdit(s: PlannedSession) {
    // Miroir de course : la donnée vit dans races, on redirige vers le détail
    // course plutôt que d'ouvrir l'éditeur de séance standard.
    if (isRaceMirrorSession(s)) {
      router.push(`/plan/courses/${s.id}`)
      return
    }
    setEditingSession(s)
    setEditorOpen(true)
  }

  function openCreate() {
    setAddSheetOpen(true)
  }

  function handlePickTemplate(t: SessionTemplate) {
    setAddSheetOpen(false)
    setEditingSession(null)
    setPrefillTemplate(t)
    setEditorOpen(true)
  }

  function handleCreateBlank() {
    setAddSheetOpen(false)
    setEditingSession(null)
    setPrefillTemplate(null)
    setEditorOpen(true)
  }

  return (
    <div className="mt-3 rounded-[10px] bg-trail-surface border border-trail-border overflow-hidden animate-[slideDown_180ms_ease-out]">
      <div className="px-3 py-2 flex items-center justify-between border-b border-trail-border">
        <p className="text-body-sm font-semibold text-trail-text">{formatLong(dateISO, L.monthsFull)}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-trail-muted hover:text-trail-text text-body"
          aria-label={L.dayDetailCloseAria}
        >✕</button>
      </div>

      <div className="p-3 space-y-2">
        {sessions.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => openEdit(s)}
            className="block w-full text-left rounded-[8px] bg-trail-card border border-trail-border p-2 hover:border-trail-primary"
          >
            <div className="mb-1">
              {(() => {
                const meta = resolveSessionMeta(s.type, types)
                return (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: meta.color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{ color: meta.color, fontFamily: "var(--font-data)", letterSpacing: '0.3px' }}
                      className="text-caption truncate"
                    >
                      {meta.label}
                    </span>
                  </div>
                )
              })()}
            </div>
            <p className="text-body-sm text-trail-text">{s.title}</p>
            <p className="text-micro text-trail-muted mt-[2px]">
              {formatDurationHHmm(s.duration)}
              {s.distance ? ` · ${s.distance} ${L.weekKmShort}` : ''}
              {s.elevation ? ` · ${s.elevation} ${L.mDPlus}` : ''}
            </p>
          </button>
        ))}

        {loaded && (
          <button
            type="button"
            onClick={openCreate}
            className="w-full py-2 rounded-[8px] border border-dashed border-trail-border text-trail-muted text-body-sm font-semibold hover:border-trail-primary hover:text-trail-primary"
          >
            {sessions.length === 0 ? L.dayDetailCreate : L.dayDetailAdd}
          </button>
        )}

        <div className="rounded-[6px] border border-dashed border-trail-border bg-trail-card/30 px-2 py-2 text-micro text-trail-muted italic">
          {L.dayDetailCoachSoon}
        </div>
      </div>

      <SessionEditorModal
        session={editingSession}
        initialDate={dateISO}
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setPrefillTemplate(null) }}
        onSaved={() => { setEditorOpen(false); onSessionsChanged() }}
        prefillTemplate={prefillTemplate}
      />
      <SessionAddSheet
        open={addSheetOpen}
        dateISO={dateISO}
        onClose={() => setAddSheetOpen(false)}
        onPickTemplate={handlePickTemplate}
        onCreateBlank={handleCreateBlank}
      />
    </div>
  )
}
