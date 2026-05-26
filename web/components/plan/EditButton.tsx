'use client'

import type { ButtonHTMLAttributes } from 'react'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  label?: string
}

export function EditButton({ label, className = '', ...rest }: Props) {
  const fallback = useT().plan.editBtnLabel
  const displayLabel = label ?? fallback
  return (
    <button
      type="button"
      {...rest}
      className={`px-2 py-1 rounded-[8px] bg-trail-surface border border-trail-border text-trail-muted hover:text-trail-text text-[12px] font-semibold ${className}`}
    >
      {displayLabel}
    </button>
  )
}
