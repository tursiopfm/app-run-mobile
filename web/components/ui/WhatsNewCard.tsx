import { Sparkles } from 'lucide-react'
import type { Bullet } from '@/lib/admin/whats-new'

// Rendu pur de la carte « Quoi de neuf ». Source unique partagée par le modal
// (avec portail + overlay) et l'aperçu live de l'admin (onDismiss absent).
export function WhatsNewCard({
  title,
  bullets,
  onDismiss,
}: {
  title: string
  bullets: Bullet[]
  onDismiss?: () => void
}) {
  return (
    <div className="w-full rounded-[16px] bg-trail-card border border-trail-border p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-trail-primary/15 shrink-0">
          <Sparkles className="text-trail-primary" size={18} />
        </span>
        <h2 className="text-[17px] font-bold text-trail-text font-display">
          {title || 'Quoi de neuf'}
        </h2>
      </div>

      <ul className="space-y-2.5">
        {bullets.map(({ emoji, label }, i) => (
          <li key={i} className="flex gap-2.5 text-body-sm text-trail-text leading-relaxed">
            <span aria-hidden className="shrink-0">{emoji}</span>
            <span>{label}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onDismiss}
        className="mt-5 w-full rounded-[10px] bg-trail-primary py-2.5 text-body font-semibold text-white hover:bg-trail-primary-dim transition-colors"
      >
        Compris
      </button>
    </div>
  )
}
