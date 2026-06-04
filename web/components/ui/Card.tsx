import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

// Carte unifiée du Design System « Deep Mission ».
// Remplace progressivement les 3 langages de carte concurrents
// (KpiTile rounded-4px / ChartCard rounded-6px / BlockCard rounded-12px).
//
// Niveaux :
//   surface   — couche de fond, conteneur discret
//   card      — carte standard (défaut)
//   highlight — carte « mission » : liseré orange + halo

export type CardLevel = 'surface' | 'card' | 'highlight'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  level?: CardLevel
  interactive?: boolean
  children: ReactNode
}

const levels: Record<CardLevel, string> = {
  surface:   'bg-ink-800 border border-ink-600',
  card:      'bg-ink-700 border border-ink-600',
  highlight: 'bg-ink-700 border border-[color-mix(in_srgb,var(--primary)_45%,transparent)] shadow-[0_0_0_1px_var(--primary-glow),0_8px_24px_-12px_var(--primary-glow)]',
}

export function Card({
  level = 'card',
  interactive = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-3.5',
        levels[level],
        interactive &&
          'transition-[border-color,transform] duration-150 hover:border-ink-500 hover:-translate-y-0.5 cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-between gap-2 mb-2.5', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('font-display text-[15px] font-semibold text-trail-text tracking-tight', className)}
      {...props}
    >
      {children}
    </h3>
  )
}

export function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('font-body text-[13px] text-trail-muted leading-relaxed', className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center gap-2 mt-3 pt-3 border-t border-ink-600', className)} {...props}>
      {children}
    </div>
  )
}
