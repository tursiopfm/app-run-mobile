'use client'

import { SPORT_CONFIG, type SportKey } from '@/lib/design/sports'
import { sportLabel } from '@/lib/design/sports-i18n'
import { useT } from '@/lib/i18n/I18nProvider'

type Props = {
  sports: SportKey[]
  activeIdx: number
  onSelect: (i: number) => void
  /** Marge du conteneur. Défaut mt-[8px] ; une carte sans padding (ex. GoalsBlock) passe pb-2. */
  className?: string
}

/**
 * Indicateurs de page par sport sous un bloc cockpit : le point actif est
 * élargi et coloré à la couleur du sport courant, les autres restent discrets.
 */
export function SportDots({ sports, activeIdx, onSelect, className = 'mt-[8px]' }: Props) {
  const t = useT()
  if (sports.length <= 1) return null
  const activeColor = SPORT_CONFIG[sports[activeIdx]]?.color ?? 'rgba(255,255,255,0.6)'
  return (
    <div className={`flex justify-center gap-1.5 ${className}`}>
      {sports.map((sport, i) => (
        <button
          key={sport}
          onClick={() => onSelect(i)}
          className="rounded-full transition-all"
          style={{
            width:           i === activeIdx ? 16 : 6,
            height:          6,
            backgroundColor: i === activeIdx ? activeColor : 'rgba(255,255,255,0.25)',
          }}
          aria-label={sportLabel(sport, t)}
        />
      ))}
    </div>
  )
}
