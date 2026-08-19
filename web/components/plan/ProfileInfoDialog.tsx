'use client'

// Choix des couches d'info affichées sur le profil exporté. Persistance gérée
// par le parent. Même habillage que PrintSizeDialog (bottom-sheet portalisé).
import { createPortal } from 'react-dom'
import type { ProfileInfoConfig } from '@/lib/plan/print-profile-info'

type Props = {
  open: boolean
  config: ProfileInfoConfig
  onChange: (next: ProfileInfoConfig) => void
  onClose: () => void
}

// Les deux séries d'heures sont EXCLUSIVES (choix radio) : les afficher ensemble
// surchargeait le profil. Ravitos et altitudes restent des couches indépendantes.
type ClockChoice = 'barriers' | 'objectif' | 'none'

const CLOCKS: { key: ClockChoice; label: string; hint: string }[] = [
  { key: 'barriers', label: 'Barrières',        hint: 'Heures limites aux points concernés.' },
  { key: 'objectif', label: 'Objectif horaire', hint: 'Heure de passage visée à chaque point.' },
  { key: 'none',     label: 'Aucune heure',     hint: 'Profil sans heure de passage.' },
]

const ROWS: { key: 'supplies' | 'altitudes'; label: string; hint: string }[] = [
  { key: 'supplies',  label: 'Ravitos',   hint: 'Puces L/S/C/BV/A + couleur des bandeaux.' },
  { key: 'altitudes', label: 'Altitudes', hint: 'Altitude sur la courbe et dans la frise.' },
]

const clockOf = (c: ProfileInfoConfig): ClockChoice =>
  c.barriers ? 'barriers' : c.objectif ? 'objectif' : 'none'

export function ProfileInfoDialog({ open, config, onChange, onClose }: Props) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Choisir les informations du profil"
    >
      <div
        className="bg-trail-card border border-trail-border rounded-t-[20px] md:rounded-[16px] w-full max-w-md max-h-[90vh] overflow-y-auto p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-trail-border mx-auto mb-4 md:hidden" />
        <h2 className="font-display text-[16px] font-semibold text-trail-text mb-1">Informations du profil</h2>
        <p className="text-caption text-trail-muted mb-4">{"Active ou coupe chaque couche. Nom, km et tronçon (D+/D−) restent toujours affichés."}</p>

        <div className="space-y-2 mb-4">
          <p className="text-caption font-semibold text-trail-muted uppercase tracking-wide">Heures affichées — une seule</p>
          {CLOCKS.map((c) => {
            const active = clockOf(config) === c.key
            return (
              <label
                key={c.key}
                className={`flex items-start gap-3 px-3 py-3 rounded-[10px] border cursor-pointer select-none ${active ? 'border-trail-primary' : 'border-trail-border'} bg-trail-surface`}
              >
                <input
                  type="radio"
                  name="profile-info-clock"
                  aria-label={c.label}
                  checked={active}
                  onChange={() => onChange({ ...config, barriers: c.key === 'barriers', objectif: c.key === 'objectif' })}
                  className="w-4 h-4 mt-0.5"
                />
                <span className="flex-1">
                  <span className="block text-body font-semibold text-trail-text">{c.label}</span>
                  <span className="block text-caption text-trail-muted">{c.hint}</span>
                </span>
              </label>
            )
          })}
        </div>

        <div className="space-y-2">
          {ROWS.map((r) => {
            const active = config[r.key]
            return (
              <label
                key={r.key}
                className={`flex items-start gap-3 px-3 py-3 rounded-[10px] border cursor-pointer select-none ${active ? 'border-trail-primary' : 'border-trail-border'} bg-trail-surface`}
              >
                <input
                  type="checkbox"
                  aria-label={r.label}
                  checked={active}
                  onChange={() => onChange({ ...config, [r.key]: !active })}
                  className="w-4 h-4 mt-0.5"
                />
                <span className="flex-1">
                  <span className="block text-body font-semibold text-trail-text">{r.label}</span>
                  <span className="block text-caption text-trail-muted">{r.hint}</span>
                </span>
              </label>
            )
          })}
        </div>

        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[10px] bg-trail-primary text-white text-body font-semibold"
          >
            Terminé
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
