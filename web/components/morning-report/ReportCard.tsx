import type { ReactNode } from 'react'

type Props = {
  /** Libellé de section (affiché en CAPITALES espacées). */
  label:     string
  /** Couleur de la barre d'accent gauche (data-color du bloc). */
  accent?:   string
  /** Slot optionnel à droite du titre (badge, emoji météo…). */
  right?:    ReactNode
  className?: string
  children:  ReactNode
}

// Carte « rapport matinal » : identité visuelle propre, volontairement
// différente des cartes plates de l'app (bg-trail-card) pour qu'on sache
// qu'on est dans le rapport et non sur un onglet. Surface dégradée + barre
// d'accent à gauche + titre en capitales espacées.
export function ReportCard({ label, accent = 'var(--trail-primary)', right, className = '', children }: Props) {
  return (
    <section
      className={`relative overflow-hidden rounded-[14px] border border-trail-border ${className}`}
      style={{ background: 'linear-gradient(180deg,#1A2331 0%,#141B26 100%)' }}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: accent }} />
      <div className="pl-[13px] pr-[10px] py-[10px]">
        <div className="flex items-center justify-between mb-2 min-h-[16px]">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-trail-muted">{label}</h3>
          {right}
        </div>
        {children}
      </div>
    </section>
  )
}
