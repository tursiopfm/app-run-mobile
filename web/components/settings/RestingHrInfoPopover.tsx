'use client'

import { useEffect, useRef } from 'react'
import { colors } from '@/lib/design/colors'

export function RestingHrInfoPopover({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={ref}
      className="absolute z-40 mt-2 rounded-[10px] p-[12px] w-[300px] text-[11px] space-y-[8px]"
      style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.chargeOrange}`, color: colors.text }}
    >
      <p className="text-[13px] font-bold">Comment mesurer ta FC repos ?</p>

      <div>
        <p className="font-semibold" style={{ color: '#22c55e' }}>🛏 Méthode manuelle</p>
        <p className="text-trail-text mt-1">
          Le matin, juste après le réveil, <strong>avant de te lever</strong>. Compte tes pulsations 60 secondes (poignet ou carotide). Refais sur 3 matins, garde la moyenne.
        </p>
      </div>

      <div>
        <p className="font-semibold" style={{ color: '#22c55e' }}>⌚ Sur ta montre / appli</p>
        <ul className="list-disc pl-5 mt-1 space-y-[2px] text-trail-text">
          <li><strong>Garmin Connect</strong> — Plus ... (en bas à droite) → Statistiques de santé → Fréquence cardiaque → 7j (en bas à gauche)</li>
          <li><strong>Apple Watch</strong> — Santé → Cœur → Fréquence cardiaque au repos</li>
          <li><strong>Coros</strong> — App → Santé → FC au repos (mesure nocturne)</li>
          <li><strong>Polar / Suunto / Fitbit</strong> — section « Repos / RHR » de l&apos;app</li>
        </ul>
      </div>

      <div className="rounded-[6px] p-[6px] text-[10px]" style={{ backgroundColor: colors.surface, border: '1px solid #facc15', color: '#facc15' }}>
        💡 La FC repos varie. Note plutôt la <strong>moyenne sur 7–14 jours</strong>, hors période de fatigue / malade.
      </div>
    </div>
  )
}
