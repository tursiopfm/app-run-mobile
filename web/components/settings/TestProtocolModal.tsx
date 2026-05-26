'use client'

import { useEffect } from 'react'
import { colors } from '@/lib/design/colors'
import { useT } from '@/lib/i18n/I18nProvider'

export function TestProtocolModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const L = useT().settings
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="rounded-[12px] p-[14px] max-w-md w-full max-h-[90vh] overflow-y-auto space-y-[10px]"
        style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.border}` }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[14px] font-bold text-trail-text">{L.protocolTitle}</p>
            <p className="text-[11px] text-trail-muted">{L.protocolSubtitle}</p>
          </div>
          <button onClick={onClose} className="text-trail-muted text-[20px] leading-none" aria-label={L.protocolCloseAria}>×</button>
        </div>

        <section>
          <p className="text-[12px] font-semibold" style={{ color: '#22c55e' }}>{L.protocolSection1Title}</p>
          <ul className="text-[12px] text-trail-text pl-5 mt-1 list-disc space-y-[2px]">
            <li>{L.protocolSection1Item1}</li>
            <li>{L.protocolSection1Item2}</li>
            <li>{L.protocolSection1Item3}</li>
          </ul>
        </section>

        <section>
          <p className="text-[12px] font-semibold" style={{ color: '#fb923c' }}>{L.protocolSection2Title}</p>
          <ul className="text-[12px] text-trail-text pl-5 mt-1 list-disc space-y-[2px]">
            <li>{L.protocolSection2Item1}</li>
            <li>{L.protocolSection2Item2}</li>
            <li>{L.protocolSection2Item3}</li>
            <li>{L.protocolSection2Item4}</li>
          </ul>
        </section>

        <section>
          <p className="text-[12px] font-semibold" style={{ color: '#facc15' }}>{L.protocolSection3Title}</p>
          <div className="rounded-[8px] p-[8px] mt-1" style={{ backgroundColor: colors.surface }}>
            <p className="text-[13px] font-bold text-trail-text">{L.protocolResult}</p>
            <p className="text-[11px] text-trail-muted mt-1">{L.protocolResultHint}</p>
          </div>
        </section>

        <div className="rounded-[6px] p-[8px] text-[11px]" style={{ backgroundColor: '#1f2419', border: '1px solid #facc15', color: '#facc15' }}>
          {L.protocolFooter}
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-[8px] py-[10px] text-[13px] font-bold text-white"
          style={{ backgroundColor: colors.chargeOrange }}
        >
          {L.protocolGotIt}
        </button>
      </div>
    </div>
  )
}
