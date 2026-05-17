'use client'

import { useEffect, useState } from 'react'
import { formatDurationColon, parseDurationToMinutes } from '@/lib/training/duration'

// Input texte ergonomique pour saisir une durée au format hh:mm / 1h30 / 90.
// Émet la durée en minutes (number). 0 = champ vide / pas de durée.
type Props = {
  value: number
  onChange: (next: number) => void
}

export function DurationField({ value, onChange }: Props) {
  const [text, setText] = useState(() => value > 0 ? formatDurationColon(value) : '')
  const [error, setError] = useState(false)

  useEffect(() => {
    setText(value > 0 ? formatDurationColon(value) : '')
  }, [value])

  function commit(s: string) {
    if (s.trim() === '') { onChange(0); setError(false); return }
    const parsed = parseDurationToMinutes(s)
    if (parsed == null) { setError(true); return }
    setError(false)
    onChange(parsed)
  }

  return (
    <div>
      <input
        type="text"
        inputMode="numeric"
        placeholder="ex : 1h30"
        value={text}
        onChange={e => { setText(e.target.value); commit(e.target.value) }}
        onBlur={() => { if (!error && value > 0) setText(formatDurationColon(value)) }}
        className={`w-full px-3 py-2 rounded-[10px] bg-trail-surface border ${error ? 'border-trail-danger' : 'border-trail-border'} text-trail-text text-[14px] focus:outline-none focus:border-trail-primary`}
        aria-label="Durée au format heures et minutes"
      />
      {error && <p className="text-[10px] text-trail-danger mt-1">Format : 1h30, 1:30 ou 90</p>}
    </div>
  )
}
