'use client'

// Sélecteur du macrocycle actif. Carte compacte avec accès à un bottom sheet
// listant tous les macrocycles groupés par statut (active / planned / completed
// / archived). Le sheet permet aussi de créer un nouveau macrocycle.
//
// Note : on n'utilise pas BlockCard ici (qui exige un title string + helpTitle
// + helpBody) car la maquette demande une carte minimaliste sans header ni
// bouton aide. On reprend le styling de base (rounded-[12px] bg-trail-card
// border border-trail-border) en s'alignant sur les autres cards Plan.

import { useEffect, useState } from 'react'
import { ChevronDown, Plus, Check } from 'lucide-react'
import type { TrainingPlan, MacrocycleStatus } from '@/types/plan'

type Props = {
  macros: TrainingPlan[]
  activeMacroId: string | null
  onSelect: (macroId: string) => void
  onCreate: () => void
}

const STATUS_LABEL: Record<MacrocycleStatus, string> = {
  planned: 'planifié',
  active: 'actif',
  completed: 'terminé',
  archived: 'archivé',
}

// Hex literals (pas `var(--…)`) car on les concatène avec `22` (suffixe d'alpha
// hex 8 chiffres) pour les fonds de badges. `var(--…) + '22'` produit du CSS
// invalide → fond absent au rendu.
const STATUS_COLOR: Record<MacrocycleStatus, string> = {
  planned: '#3B82F6',
  active: '#10B981',
  completed: '#94A3B8',
  archived: '#64748B',
}

const STATUS_ORDER: MacrocycleStatus[] = ['active', 'planned', 'completed', 'archived']

function formatShortDate(iso: string): string {
  if (!iso || iso.length < 10) return iso
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
  const m = parseInt(iso.slice(5, 7), 10) - 1
  const d = parseInt(iso.slice(8, 10), 10)
  if (Number.isNaN(d) || m < 0 || m > 11) return iso
  return `${d} ${months[m]}`
}

function weekCount(plan: TrainingPlan): number {
  const start = new Date(plan.startDate + 'T00:00:00Z').getTime()
  const end = new Date(plan.endDate + 'T00:00:00Z').getTime()
  return Math.max(1, Math.ceil((end - start) / (7 * 86_400_000)))
}

export function MacrocycleSelectorCard({ macros, activeMacroId, onSelect, onCreate }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const active = macros.find(m => m.id === activeMacroId) ?? null

  // État vide : aucun macrocycle
  if (macros.length === 0) {
    return (
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] text-[color:var(--trail-muted)]">
            Aucun macrocycle pour l&apos;instant.
          </p>
          <button
            type="button"
            onClick={onCreate}
            className="px-3 py-1.5 rounded-[8px] bg-[color:var(--trail-primary)] text-white text-[12px] font-semibold flex items-center gap-1"
          >
            <Plus size={14} aria-hidden /> Nouveau
          </button>
        </div>
      </div>
    )
  }

  // État nominal
  return (
    <>
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] uppercase tracking-wider text-[color:var(--trail-muted)]">
              Macrocycle actif
            </p>
            {active ? (
              <>
                <p className="text-[18px] leading-none mt-0.5 font-bold text-[color:var(--trail-text)] truncate" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  {active.name}
                </p>
                <p className="text-[11px] text-[color:var(--trail-muted)] mt-1">
                  {formatShortDate(active.startDate)} → {formatShortDate(active.endDate)} · {weekCount(active)} sem
                </p>
              </>
            ) : (
              <p className="text-[12px] text-[color:var(--trail-muted)] mt-1">Aucun actif</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="shrink-0 flex items-center gap-1 px-2 py-1 text-[12px] text-[color:var(--trail-primary)] font-semibold rounded-[6px] hover:bg-[color:var(--trail-surface)]"
            aria-label={`${macros.length} macrocycles`}
          >
            {macros.length} {macros.length > 1 ? 'macros' : 'macro'}
            <ChevronDown size={14} aria-hidden />
          </button>
        </div>
      </div>

      {sheetOpen && (
        <MacrocycleSheet
          macros={macros}
          activeMacroId={activeMacroId}
          onSelect={(id) => { onSelect(id); setSheetOpen(false) }}
          onCreate={() => { onCreate(); setSheetOpen(false) }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  )
}

function MacrocycleSheet({
  macros, activeMacroId, onSelect, onCreate, onClose,
}: {
  macros: TrainingPlan[]
  activeMacroId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onClose: () => void
}) {
  // Pattern aligné avec RaceEditorModal / ConfirmDialog : Escape ferme le sheet.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Tri par statut puis par start_date desc.
  const grouped = STATUS_ORDER.map(status => ({
    status,
    items: macros
      .filter(m => m.status === status)
      .sort((a, b) => (a.startDate < b.startDate ? 1 : -1)),
  })).filter(g => g.items.length > 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Choisir un macrocycle"
    >
      <div
        className="w-full sm:max-w-md bg-[color:var(--trail-card)] border border-[color:var(--trail-border)] rounded-t-[16px] sm:rounded-[16px] p-3 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[14px] font-bold text-[color:var(--trail-text)] mb-2 px-1">Macrocycles</h3>

        {grouped.map(({ status, items }) => (
          <div key={status} className="mb-3">
            <p className="text-[10px] uppercase tracking-wider text-[color:var(--trail-muted)] mb-1 px-1">
              {STATUS_LABEL[status]}
            </p>
            <div className="flex flex-col gap-1">
              {items.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelect(m.id)}
                  className="flex items-center justify-between gap-2 px-2 py-2 rounded-[8px] hover:bg-[color:var(--trail-surface)] text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[color:var(--trail-text)] truncate">{m.name}</p>
                    <p className="text-[10px] text-[color:var(--trail-muted)]">
                      {formatShortDate(m.startDate)} → {formatShortDate(m.endDate)}
                    </p>
                  </div>
                  <span
                    className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: `${STATUS_COLOR[status]}22`, color: STATUS_COLOR[status] }}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                  {m.id === activeMacroId && (
                    <Check size={14} className="shrink-0 text-[color:var(--trail-primary)]" aria-hidden />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={onCreate}
          className="w-full flex items-center justify-center gap-2 mt-2 py-2.5 rounded-[10px] border border-dashed border-[color:var(--trail-border)] text-[color:var(--trail-primary)] font-semibold text-[13px] hover:border-[color:var(--trail-primary)]"
        >
          <Plus size={14} aria-hidden /> Nouveau macrocycle
        </button>
      </div>
    </div>
  )
}
