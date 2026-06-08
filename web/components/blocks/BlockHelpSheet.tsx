'use client'

import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

type Props = { title: string; body: ReactNode; onClose: () => void }

export function BlockHelpSheet({ title, body, onClose }: Props) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-trail-card border border-trail-border rounded-t-[20px] w-full max-w-lg p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-trail-border mx-auto mb-4" />
        <h2 className="font-display text-[16px] font-semibold text-trail-text mb-3">{title}</h2>
        {typeof body === 'string' ? (
          <p className="text-[13px] text-trail-muted leading-[19px] whitespace-pre-line">{body}</p>
        ) : (
          <div className="text-[13px] text-trail-muted leading-[19px]">{body}</div>
        )}
        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-[10px] bg-trail-surface border border-trail-border text-[14px] font-semibold text-trail-text"
        >
          Fermer
        </button>
      </div>
    </div>,
    document.body,
  )
}
