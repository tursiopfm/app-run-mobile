'use client'
import { createPortal } from 'react-dom'
import type { PendingDiff, RaceWaypoint, WaypointFieldChange } from '@/types/plan'
import { diffWaypoints } from '@/lib/race-import/waypoint-diff'

type WP = Omit<RaceWaypoint, 'id' | 'raceId'>

const SUPPLY_LABEL: Record<string, string> = { liquid: 'liquide', solid: 'solide', hot: 'chaud', base_vie: 'base vie', assistance: 'assistance' }
function fmt(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (field === 'supplies' && Array.isArray(v)) return v.length ? v.map((s) => SUPPLY_LABEL[s] ?? s).join(', ') : 'aucun'
  return String(v)
}
const FIELD_LABEL: Record<WaypointFieldChange['field'], string> = { km: 'km', dPlus: 'D+', dMoins: 'D−', cutoffRaw: 'barrière', supplies: 'ravito' }

export function TableauDiffModal({
  currentWaypoints, pendingDiff, busy, onApply, onDismiss, onClose,
}: {
  currentWaypoints: WP[]
  pendingDiff: PendingDiff
  busy: boolean
  onApply: () => void
  onDismiss: () => void
  onClose: () => void
}) {
  if (typeof document === 'undefined') return null
  const diff = diffWaypoints(currentWaypoints, pendingDiff.newWaypoints)
  const title = pendingDiff.kind === 'new_edition'
    ? `Nouvelle édition ${pendingDiff.newMeta.editionYear ?? ''} disponible`
    : 'Le tableau de course a été mis à jour'

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-trail-card border border-trail-border rounded-t-[20px] md:rounded-[16px] w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-[16px] font-semibold text-trail-text mb-1">{title}</h2>
        <p className="text-body-sm text-trail-muted mb-4">
          {diff.added.length} ajout(s) · {diff.removed.length} retrait(s) · {diff.modified.length} modif(s)
        </p>

        <div className="space-y-3 text-body-sm">
          {diff.modified.length > 0 && (
            <div>
              <div className="text-caption font-semibold text-trail-muted mb-1">Modifié</div>
              {diff.modified.map((m, i) => (
                <div key={`m-${i}`} className="mb-1">
                  <span className="text-trail-text font-semibold">{m.name}</span>
                  <ul className="ml-3 text-trail-muted">
                    {m.changes.map((c, j) => (
                      <li key={j}>{FIELD_LABEL[c.field]} : {fmt(c.field, c.from)} → {fmt(c.field, c.to)}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {diff.added.length > 0 && (
            <div>
              <div className="text-caption font-semibold text-trail-muted mb-1">Ajouté</div>
              {diff.added.map((w, i) => <div key={`a-${i}`} className="text-trail-text">+ {w.name} <span className="text-trail-muted">@ {w.km} km</span></div>)}
            </div>
          )}
          {diff.removed.length > 0 && (
            <div>
              <div className="text-caption font-semibold text-trail-muted mb-1">Retiré</div>
              {diff.removed.map((w, i) => <div key={`r-${i}`} className="text-trail-text">− {w.name} <span className="text-trail-muted">@ {w.km} km</span></div>)}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 mt-6">
          <button type="button" disabled={busy} onClick={onApply}
            className="w-full py-2 rounded-[10px] bg-trail-primary text-white text-body-sm font-semibold disabled:opacity-50">
            Appliquer le nouveau tableau
          </button>
          <button type="button" disabled={busy} onClick={onDismiss}
            className="w-full py-2 rounded-[10px] border border-trail-border text-trail-text text-body-sm disabled:opacity-50">
            Garder l&apos;actuel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
