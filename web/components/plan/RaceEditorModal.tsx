'use client'

// Modal d'édition / création de la course objectif.
// Pattern portal : copie de AddBlockPanel dans BlockGrid.tsx (overlay click + stopPropagation).
// Persistance via lib/plan/storage.ts (Supabase si dispo, fallback localStorage).

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Race, RaceType } from '@/types/plan'
import { deleteRace, saveRace } from '@/lib/plan/storage'
import { parseElapsedShort } from '@/lib/plan/waypoint-view'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = {
  race: Race | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}

function emptyDraft(): Race {
  return {
    id: '',
    name: '',
    date: '',
    distance: 0,
    elevation: 0,
    type: 'trail',
    location: undefined,
    isMain: true,
    priority: 'A',
    notes: undefined,
    startTime: undefined,
    targetDurationMin: undefined,
    pacingFade: 0,
  }
}

export function RaceEditorModal({ race, open, onClose, onSaved }: Props) {
  const L = useT().plan
  const isEdit = race !== null
  const [draft, setDraft] = useState<Race>(() => race ?? emptyDraft())
  const [saving, setSaving] = useState(false)
  const fmtTarget = (min: number | undefined) =>
    min != null ? `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}` : ''
  const [rawTarget, setRawTarget] = useState<string>(() => fmtTarget((race ?? emptyDraft()).targetDurationMin))
  const TYPE_OPTIONS: { value: RaceType; label: string }[] = [
    { value: 'trail',    label: L.raceTypes.trail   },
    { value: 'ultra',    label: L.raceTypes.ultra   },
    { value: 'route',    label: L.raceTypes.route   },
    { value: 'cross',    label: L.raceTypes.cross   },
    { value: 'skyrace',  label: L.raceTypes.skyrace },
  ]

  // Re-sync le draft chaque fois que la modal s'ouvre avec une race différente
  // (création vs édition de la même course peut se chevaucher dans le parent).
  useEffect(() => {
    if (open) {
      setDraft(race ?? emptyDraft())
      setRawTarget(fmtTarget((race ?? emptyDraft()).targetDurationMin))
    }
  }, [open, race])

  // Échap ferme la modal — cohérent avec les autres portals UX du repo.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  if (typeof document === 'undefined') return null

  const canSave =
    draft.name.trim().length > 0 &&
    draft.date.length > 0 &&
    draft.distance > 0 &&
    !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    try {
      const toSave: Race = {
        ...draft,
        id: draft.id || (typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `race-${Date.now()}`),
        name: draft.name.trim(),
        location: draft.location?.trim() || undefined,
        notes: draft.notes?.trim() || undefined,
        // priority est miroir de isMain pour l'UI actuelle (checkbox unique).
        // 'A' = course principale, 'C' = secondaire. La granularité B viendra
        // quand l'UI exposera un select de priorité explicite.
        priority: draft.isMain ? 'A' : 'C',
      }
      await saveRace(toSave)
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!race || saving) return
    setSaving(true)
    try {
      await deleteRace(race.id)
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? L.raceEditAriaEdit : L.raceEditAriaCreate}
    >
      <div
        className="bg-trail-card border border-trail-border rounded-t-[20px] md:rounded-[16px] w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-trail-border mx-auto mb-4 md:hidden" />

        <h2 className="font-display text-[16px] font-semibold text-trail-text mb-4">
          {isEdit ? L.raceEditTitle : L.raceCreateTitle}
        </h2>

        <div className="space-y-3">
          <Field label={L.raceEditFieldName} required>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder={L.raceEditPhName}
              className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-body focus:outline-none focus:border-trail-primary"
            />
          </Field>

          <Field label={L.raceEditFieldDate} required>
            <input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-body focus:outline-none focus:border-trail-primary"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={L.raceEditFieldDistance} required>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
                value={draft.distance ? draft.distance : ''}
                placeholder="0"
                onChange={(e) => setDraft({ ...draft, distance: Number(e.target.value) || 0 })}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-body focus:outline-none focus:border-trail-primary"
              />
            </Field>

            <Field label={L.raceEditFieldDPlus}>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                min={0}
                value={draft.elevation ? draft.elevation : ''}
                placeholder="0"
                onChange={(e) => setDraft({ ...draft, elevation: Number(e.target.value) || 0 })}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-body focus:outline-none focus:border-trail-primary"
              />
            </Field>
          </div>

          <Field label={L.raceEditFieldType}>
            <select
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value as RaceType })}
              className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-body focus:outline-none focus:border-trail-primary"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={L.raceEditFieldStartTime}>
              <input
                type="time"
                value={draft.startTime ?? ''}
                onChange={(e) => setDraft({ ...draft, startTime: e.target.value || undefined })}
                className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-body focus:outline-none focus:border-trail-primary"
              />
            </Field>
            <Field label={L.raceEditFieldTargetTime}>
              <input
                type="text"
                inputMode="numeric"
                placeholder="37:00"
                value={rawTarget}
                onChange={(e) => setRawTarget(e.target.value)}
                onBlur={(e) => {
                  // Tolérant : accepte '37:00', '37h00', '37h', '37'.
                  const sec = parseElapsedShort(e.target.value)
                  setDraft({
                    ...draft,
                    targetDurationMin: sec != null ? Math.round(sec / 60) : undefined,
                  })
                }}
                className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-body focus:outline-none focus:border-trail-primary"
              />
            </Field>
          </div>

          <details className="rounded-[10px] bg-trail-surface border border-trail-border px-3 py-2">
            <summary className="text-caption font-semibold text-trail-muted cursor-pointer">
              {L.raceEditAdvanced}
            </summary>
            <div className="mt-2">
              <Field label={L.raceEditFieldFade}>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={0}
                  max={2}
                  value={draft.pacingFade ?? 0}
                  onChange={(e) => setDraft({ ...draft, pacingFade: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-body focus:outline-none focus:border-trail-primary"
                />
              </Field>
            </div>
          </details>

          <Field label={L.raceEditFieldLocation}>
            <input
              type="text"
              value={draft.location ?? ''}
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
              placeholder={L.raceEditPhLocation}
              className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-body focus:outline-none focus:border-trail-primary"
            />
          </Field>

          <Field label={L.raceEditFieldNotes}>
            <textarea
              rows={3}
              value={draft.notes ?? ''}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder={L.raceEditPhNotes}
              className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-body focus:outline-none focus:border-trail-primary resize-none"
            />
          </Field>

          <label className="flex items-center gap-3 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={draft.isMain}
              onChange={(e) => setDraft({ ...draft, isMain: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-body text-trail-text">{L.raceEditMainCheckbox}</span>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 mt-6">
          {isEdit ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="px-3 py-2 text-body font-semibold text-trail-danger hover:underline disabled:opacity-50"
              aria-label={L.raceEditDeleteAria}
            >
              {L.raceEditDelete}
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-[10px] text-body font-semibold text-trail-muted hover:text-trail-text disabled:opacity-50"
            >
              {L.raceEditCancel}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="px-4 py-2 rounded-[10px] bg-trail-primary text-white text-body font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {L.raceEditSave}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-caption font-semibold text-trail-muted mb-1 block">
        {label}
        {required && <span className="text-trail-danger ml-1">*</span>}
      </span>
      {children}
    </label>
  )
}
