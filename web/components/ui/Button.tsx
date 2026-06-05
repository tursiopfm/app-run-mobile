import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

// Bouton du Design System « Deep Mission ».
// États gérés : default, hover, active, disabled, loading, focus-visible.
// Remplace progressivement les <button> stylés à la main éparpillés dans l'app.

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  loading?: boolean
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
}

const base =
  'inline-flex items-center justify-center gap-2 font-body font-semibold rounded-xl ' +
  'transition-[background-color,box-shadow,opacity,transform] duration-150 ' +
  'select-none whitespace-nowrap active:translate-y-px ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 ' +
  'disabled:pointer-events-none disabled:opacity-45'

// Le rouge « danger » translucide passe par color-mix (Tailwind abandonne `/n`
// sur une variable CSS nue — cf. Badge).
const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-dim shadow-[0_1px_2px_rgba(0,0,0,0.25)]',
  secondary:
    'bg-ink-700 text-trail-text border border-ink-600 hover:bg-ink-600',
  ghost:
    'bg-transparent text-trail-muted hover:bg-ink-700 hover:text-trail-text',
  danger:
    'bg-transparent text-data-run border border-[color-mix(in_srgb,var(--data-run)_42%,transparent)] ' +
    'hover:bg-[color-mix(in_srgb,var(--data-run)_14%,transparent)]',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-[14px]',
  lg: 'h-12 px-6 text-[15px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    loading = false,
    leadingIcon,
    trailingIcon,
    className,
    children,
    type = 'button',
    disabled,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...props}
    >
      {loading ? (
        <Loader2 size={16} className="shrink-0 animate-spin" aria-hidden />
      ) : (
        leadingIcon && <span className="shrink-0 -ml-0.5">{leadingIcon}</span>
      )}
      {children}
      {!loading && trailingIcon && <span className="shrink-0 -mr-0.5">{trailingIcon}</span>}
    </button>
  )
})
