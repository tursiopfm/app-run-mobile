'use client'

import type { ButtonHTMLAttributes } from 'react'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  label?: string
}

export function EditButton({ label = 'Modifier', className = '', ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      className={`px-2 py-1 rounded-[8px] bg-trail-surface border border-trail-border text-trail-muted hover:text-trail-text text-[12px] font-semibold ${className}`}
    >
      {label}
    </button>
  )
}
