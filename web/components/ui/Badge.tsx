import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

// Badge / pilule du Design System. Deux familles de tons :
//   - sémantiques d'état (neutral / primary / success / warning / danger / info)
//   - sport (data-*) pour étiqueter une discipline
// Pour un badge piloté par un seuil métier (TSB, monotonie…), passer `color`
// (hex/var) prioritaire sur `variant`.
//
// Note technique : les fonds/bordures translucides sont produits via color-mix
// sur les variables CSS (theme-aware) — Tailwind abandonne le modificateur
// d'opacité `/n` sur une variable CSS « nue », d'où l'usage de styles inline.

export type BadgeVariant =
  | 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  | 'run' | 'bike' | 'swim' | 'charge'

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant
  /** Override par couleur (hex/var) — prioritaire sur `variant`. */
  color?: string
  size?: 'sm' | 'md'
  dot?: boolean
  children: ReactNode
}

// Couleur source de chaque variante (CSS var → suit le thème clair/sombre).
const VARIANT_COLOR: Record<BadgeVariant, string> = {
  neutral: 'var(--trail-muted)',
  primary: 'var(--primary)',
  success: 'var(--trail-success)',
  warning: 'var(--trail-warning)',
  danger:  'var(--trail-danger)',
  info:    'var(--trail-accent)',
  run:     'var(--data-run)',
  bike:    'var(--data-bike)',
  swim:    'var(--data-swim)',
  charge:  'var(--data-charge)',
}

const sizes = {
  sm: 'text-[11px] px-2 py-[2px] gap-1',
  md: 'text-[13px] px-2.5 py-[4px] gap-1.5',
} as const

export function Badge({
  variant = 'neutral',
  color,
  size = 'md',
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  const c = color ?? VARIANT_COLOR[variant]
  // neutral garde un fond « surface » plus marqué pour rester lisible.
  const bg = variant === 'neutral' && !color
    ? 'var(--ink-700)'
    : `color-mix(in srgb, ${c} 13%, transparent)`

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-body font-semibold leading-none',
        sizes[size],
        className,
      )}
      style={{
        backgroundColor: bg,
        color: c,
        borderColor: `color-mix(in srgb, ${c} 38%, transparent)`,
      }}
      {...props}
    >
      {dot && (
        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c }} />
      )}
      {children}
    </span>
  )
}
