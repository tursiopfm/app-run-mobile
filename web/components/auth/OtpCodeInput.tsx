'use client'

import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'

type Props = {
  value: string
  onChange: (code: string) => void
  onComplete?: (code: string) => void
  length?: number
  disabled?: boolean
}

export function OtpCodeInput({ value, onChange, onComplete, length = 6, disabled = false }: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const digits = value.slice(0, length).split('')

  function commit(next: string) {
    const clean = next.replace(/\D/g, '').slice(0, length)
    onChange(clean)
    if (clean.length === length) onComplete?.(clean)
    return clean
  }

  function handleInput(i: number, raw: string) {
    const typed = raw.replace(/\D/g, '')
    if (!typed) return
    const clean = commit(value.slice(0, i) + typed)
    refs.current[Math.min(clean.length, length - 1)]?.focus()
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const clean = commit(value.slice(0, -1))
      refs.current[Math.min(clean.length, length - 1)]?.focus()
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    e.preventDefault()
    const clean = commit(e.clipboardData.getData('text'))
    refs.current[Math.min(clean.length, length - 1)]?.focus()
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          disabled={disabled}
          value={digits[i] ?? ''}
          onChange={e => handleInput(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          aria-label={`Chiffre ${i + 1}`}
          className="w-11 h-14 text-center text-xl font-semibold bg-trail-surface border border-trail-border rounded-xl text-trail-text outline-none focus:border-trail-accent disabled:opacity-50"
        />
      ))}
    </div>
  )
}
