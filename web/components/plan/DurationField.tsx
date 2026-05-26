'use client'

import { useEffect, useRef, useState } from 'react'
import { formatDurationColon, parseDurationToMinutes } from '@/lib/training/duration'
import { useT } from '@/lib/i18n/I18nProvider'

// Input texte ergonomique pour saisir une durée au format hh:mm / 1h30 / 90.
// Émet la durée en minutes (number) au blur (ou onChange si l'utilisateur efface
// complètement le champ). 0 = champ vide / pas de durée.
//
// Anti-bug : on NE commit PAS à chaque keystroke pour éviter la course suivante :
//   1. user tape '1' → onChange → parent value = 1 minute
//   2. useEffect → setText(format(1)) = '0:01'  ← écrase ce que l'user tapait
//   3. user voit '0:01' à la place de '1' → impossible de continuer à taper.
// Au blur, la valeur est commitée puis reformatée proprement.
type Props = {
  value: number
  onChange: (next: number) => void
}

export function DurationField({ value, onChange }: Props) {
  const L = useT().plan
  const [text, setText] = useState(() => value > 0 ? formatDurationColon(value) : '')
  const [error, setError] = useState(false)
  // Sert à distinguer "value changée parce qu'on vient de commit" vs "value
  // changée depuis l'extérieur (reset du draft, etc.)". Dans le 1er cas on ne
  // re-synchronise pas `text` car ce serait écraser la saisie en cours.
  const lastCommittedRef = useRef<number>(value)

  useEffect(() => {
    if (value !== lastCommittedRef.current) {
      setText(value > 0 ? formatDurationColon(value) : '')
      lastCommittedRef.current = value
    }
  }, [value])

  function commit() {
    const s = text.trim()
    if (s === '') {
      lastCommittedRef.current = 0
      onChange(0)
      setError(false)
      return
    }
    const parsed = parseDurationToMinutes(s)
    if (parsed == null) {
      setError(true)
      return
    }
    setError(false)
    lastCommittedRef.current = parsed
    onChange(parsed)
    // Reformater proprement (ex : '1h30' → '1:30')
    setText(formatDurationColon(parsed))
  }

  return (
    <div>
      <input
        type="text"
        inputMode="numeric"
        placeholder={L.durationFieldPh}
        value={text}
        onChange={e => { setText(e.target.value); if (error) setError(false) }}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
        className={`w-full px-3 py-2 rounded-[10px] bg-trail-surface border ${error ? 'border-trail-danger' : 'border-trail-border'} text-trail-text text-[14px] focus:outline-none focus:border-trail-primary`}
        aria-label={L.durationFieldAria}
      />
      {error && <p className="text-[10px] text-trail-danger mt-1">{L.durationFieldFormatErr}</p>}
    </div>
  )
}
