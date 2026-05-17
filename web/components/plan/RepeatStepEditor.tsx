'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { DurationDistanceToggle } from './DurationDistanceToggle'
import { IntensityPaceToggle } from './IntensityPaceToggle'
import { PaceField } from './PaceField'
import type { RepeatStep, SessionType, IntensityLevel } from '@/types/plan'

type Props = {
  step: RepeatStep
  sessionType: SessionType
  onSave: (step: RepeatStep) => void
  onCancel: () => void
}

export function RepeatStepEditor({ step, sessionType: _sessionType, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<RepeatStep>(step)
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        className="bg-trail-card border border-trail-border rounded-t-[20px] sm:rounded-[16px] w-full max-w-md p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[16px] font-semibold text-trail-text mb-4">
          Modifier l'étape
        </h2>

        {/* Libellé */}
        <label className="block mb-3">
          <span className="text-[11px] font-semibold text-trail-muted mb-1 block">Libellé</span>
          <input
            type="text"
            value={draft.label ?? ''}
            onChange={(e) => setDraft({ ...draft, label: e.target.value || undefined })}
            placeholder={draft.stepKind === 'effort' ? 'Course à pied' : 'Récupération'}
            className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[14px] focus:outline-none focus:border-trail-primary"
          />
        </label>

        {/* Mode Durée / Distance */}
        <div className="mb-3 flex items-center gap-2">
          <DurationDistanceToggle
            size="md"
            value={draft.mode}
            onChange={(mode) => setDraft({ ...draft, mode })}
          />
          {draft.mode === 'duration' ? (
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={draft.durationMin ?? ''}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  durationMin: e.target.value === '' ? undefined : Number(e.target.value) || 0,
                })
              }
              placeholder="min"
              aria-label="Durée en minutes"
              className="w-24 px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[14px] focus:outline-none focus:border-trail-primary"
            />
          ) : (
            <div className="flex items-center gap-1">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={50}
                value={draft.distanceM ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    distanceM: e.target.value === '' ? undefined : Number(e.target.value) || 0,
                  })
                }
                placeholder="400"
                aria-label="Distance en mètres"
                className="w-24 px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[14px] focus:outline-none focus:border-trail-primary"
              />
              <span className="text-[11px] text-trail-muted">m</span>
            </div>
          )}
        </div>

        {/* Mode Intensité / Allure */}
        <div className="mb-5 flex items-center gap-2">
          <IntensityPaceToggle
            size="md"
            value={draft.intensityMode}
            onChange={(mode) => setDraft({ ...draft, intensityMode: mode })}
          />
          {draft.intensityMode === 'level' ? (
            <select
              value={draft.intensity ?? defaultLevelForStepKind(draft.stepKind)}
              onChange={(e) =>
                setDraft({ ...draft, intensity: Number(e.target.value) as IntensityLevel })
              }
              aria-label="Niveau d'intensité"
              className="px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-[14px] focus:outline-none focus:border-trail-primary"
            >
              <option value={1}>1 — Récup</option>
              <option value={2}>2 — Endurance</option>
              <option value={3}>3 — Tempo</option>
              <option value={4}>4 — Seuil</option>
              <option value={5}>5 — VMA</option>
            </select>
          ) : (
            <PaceField
              value={draft.paceSecPerKm ?? null}
              onChange={(p) => setDraft({ ...draft, paceSecPerKm: p ?? undefined })}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-[14px] font-semibold text-trail-text"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="px-3 py-2 rounded-[10px] bg-trail-primary text-black text-[14px] font-semibold"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function defaultLevelForStepKind(kind: 'effort' | 'recovery'): IntensityLevel {
  return kind === 'effort' ? 5 : 1
}
