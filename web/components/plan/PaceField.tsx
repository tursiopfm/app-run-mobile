'use client'

import { useEffect, useState } from 'react'
import { parsePace, formatPace } from '@/lib/plan/pace-format'

type Props = {
  value: number | null | undefined  // secondes par km
  onChange: (secPerKm: number | null) => void
  placeholder?: string
}

export function PaceField({ value, onChange, placeholder = '5:30' }: Props) {
  const [text, setText] = useState<string>(formatPace(value))

  useEffect(() => {
    setText(formatPace(value))
  }, [value])

  const commit = () => {
    const parsed = parsePace(text)
    onChange(parsed)
    setText(formatPace(parsed))
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9:]*"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        placeholder={placeholder}
        aria-label="Allure (mm:ss par km)"
        className="w-20 px-2 py-1 rounded-[8px] bg-trail-surface border border-trail-border text-trail-text text-[13px] focus:outline-none focus:border-trail-primary"
      />
      <span className="text-[11px] text-trail-muted">/km</span>
    </div>
  )
}
