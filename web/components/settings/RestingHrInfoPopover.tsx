'use client'

import { useEffect, useRef } from 'react'
import { colors } from '@/lib/design/colors'
import { useT } from '@/lib/i18n/I18nProvider'

export function RestingHrInfoPopover({ open, onClose }: { open: boolean; onClose: () => void }) {
  const L = useT().settings
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
      className="absolute z-40 mt-2 rounded-[10px] p-[12px] w-[300px] text-micro space-y-[8px]"
      style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.chargeOrange}`, color: colors.text }}
    >
      <p className="text-body-sm font-bold">{L.restingTitle}</p>

      <div>
        <p className="font-semibold" style={{ color: '#22c55e' }}>{L.restingManualTitle}</p>
        <p className="text-trail-text mt-1">{L.restingManualBody}</p>
      </div>

      <div>
        <p className="font-semibold" style={{ color: '#22c55e' }}>{L.restingWatchTitle}</p>
        <ul className="list-disc pl-5 mt-1 space-y-[2px] text-trail-text">
          <li><strong>{L.restingGarmin}</strong> — {L.restingGarminPath}</li>
          <li><strong>{L.restingApple}</strong> — {L.restingApplePath}</li>
          <li><strong>{L.restingCoros}</strong> — {L.restingCorosPath}</li>
          <li><strong>{L.restingOther}</strong> — {L.restingOtherPath}</li>
        </ul>
      </div>

      <div className="rounded-[6px] p-[6px] text-[10px]" style={{ backgroundColor: colors.surface, border: '1px solid #facc15', color: '#facc15' }}>
        {L.restingTip}
      </div>
    </div>
  )
}
