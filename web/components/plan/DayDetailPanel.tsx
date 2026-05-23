'use client'

import { useEffect, useState } from 'react'
import type { PlannedSession } from '@/types/plan'
import { getPlannedSessions } from '@/lib/plan/storage'
import { resolveSessionMeta } from '@/lib/plan/session-meta'
import { useActivityTypes } from '@/lib/plan/use-activity-types'
import { SessionEditorModal } from './SessionEditorModal'
import { formatDurationHHmm } from '@/lib/training/duration'

function formatLongFR(iso: string): string {
  if (!iso || iso.length < 10) return iso
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
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
  const [sessions, setSessions] = useState<PlannedSession[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingSession, setEditingSession] = useState<PlannedSession | null>(null)
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
    setEditingSession(s)
    setEditorOpen(true)
  }

  function openCreate() {
    setEditingSession(null)
    setEditorOpen(true)
  }

  return (
    <div className="mt-3 rounded-[10px] bg-trail-surface border border-trail-border overflow-hidden animate-[slideDown_180ms_ease-out]">
      <div className="px-3 py-2 flex items-center justify-between border-b border-trail-border">
        <p className="text-[13px] font-semibold text-trail-text">{formatLongFR(dateISO)}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-trail-muted hover:text-trail-text text-[14px]"
          aria-label="Fermer"
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
                      style={{ color: meta.color, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.3px' }}
                      className="text-[12px] truncate"
                    >
                      {meta.label}
                    </span>
                  </div>
                )
              })()}
            </div>
            <p className="text-[13px] text-trail-text">{s.title}</p>
            <p className="text-[11px] text-trail-muted mt-[2px]">
              {formatDurationHHmm(s.duration)}
              {s.distance ? ` · ${s.distance} km` : ''}
              {s.elevation ? ` · ${s.elevation} m D+` : ''}
            </p>
          </button>
        ))}

        {loaded && (
          <button
            type="button"
            onClick={openCreate}
            className="w-full py-2 rounded-[8px] border border-dashed border-trail-border text-trail-muted text-[13px] font-semibold hover:border-trail-primary hover:text-trail-primary"
          >
            {sessions.length === 0 ? '+ Créer une séance' : '+ Ajouter une séance'}
          </button>
        )}

        {/* TODO: emplacement validation Coach IA */}
        <div className="rounded-[6px] border border-dashed border-trail-border bg-trail-card/30 px-2 py-2 text-[11px] text-trail-muted italic">
          Suggestions Coach IA — bientôt
        </div>
      </div>

      <SessionEditorModal
        session={editingSession}
        initialDate={dateISO}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={() => { setEditorOpen(false); onSessionsChanged() }}
      />
    </div>
  )
}
