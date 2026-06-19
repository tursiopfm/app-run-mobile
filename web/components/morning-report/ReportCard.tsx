import type { ReactNode } from 'react'

type Props = {
  /** Libellé de section (affiché en CAPITALES espacées, teinté de l'accent). */
  label:     string
  /** Couleur d'accent du bloc (data-color) : teinte le fond + le titre. */
  accent?:   string
  /** Slot optionnel à droite du titre (badge, emoji météo…). */
  right?:    ReactNode
  className?: string
  children:  ReactNode
}

// Carte « rapport matinal » : fond légèrement TEINTÉ dans la couleur du bloc
// (color-mix sur la base sombre) + titre assorti. Identité volontairement
// différente des cartes plates de l'app (bg-trail-card) pour qu'on sache
// qu'on est dans le rapport et non sur un onglet.
export function ReportCard({ label, accent = 'var(--trail-primary)', right, className = '', children }: Props) {
  return (
    <section
      className={`relative overflow-hidden rounded-[14px] border px-3 py-[10px] ${className}`}
      style={{
        background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 18%, #141B26) 0%, color-mix(in srgb, ${accent} 9%, #121821) 100%)`,
        borderColor: `color-mix(in srgb, ${accent} 38%, var(--trail-border))`,
      }}
    >
      <div className="flex items-center justify-between mb-2 min-h-[16px]">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>{label}</h3>
        {right}
      </div>
      {children}
    </section>
  )
}
