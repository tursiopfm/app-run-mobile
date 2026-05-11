'use client'

import { useEffect } from 'react'
import { colors } from '@/lib/design/colors'

export function TestProtocolModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
            <p className="text-[14px] font-bold text-trail-text">Protocole — Test terrain 30 min</p>
            <p className="text-[11px] text-trail-muted">Méthode Coggan / Friel — détermine ta LTHR</p>
          </div>
          <button onClick={onClose} className="text-trail-muted text-[20px] leading-none" aria-label="Fermer">×</button>
        </div>

        <section>
          <p className="text-[12px] font-semibold" style={{ color: '#22c55e' }}>✓ À faire avant</p>
          <ul className="text-[12px] text-trail-text pl-5 mt-1 list-disc space-y-[2px]">
            <li>Repos complet 24h, hydratation, pas d&apos;alcool la veille</li>
            <li>Choisir un parcours plat ou piste, par temps tempéré</li>
            <li>Échauffement 15 min progressif (Z1 → Z3)</li>
          </ul>
        </section>

        <section>
          <p className="text-[12px] font-semibold" style={{ color: '#fb923c' }}>⏱ Pendant le test</p>
          <ul className="text-[12px] text-trail-text pl-5 mt-1 list-disc space-y-[2px]">
            <li>Cours <strong>30 minutes en continu à allure maximale soutenable</strong></li>
            <li>Démarre à un rythme que tu sais tenir 30 min — pas un sprint</li>
            <li>Démarre le lap <strong>après 10 min</strong> de test (clé du protocole)</li>
            <li>Garde un effort très régulier sur les 20 dernières minutes</li>
            <li>Ta <strong>FC moyenne des minutes 10 à 30 = ta FC seuil course à pied</strong></li>
          </ul>
        </section>

        <section>
          <p className="text-[12px] font-semibold" style={{ color: '#facc15' }}>📊 Lecture du résultat</p>
          <div className="rounded-[8px] p-[8px] mt-1" style={{ backgroundColor: colors.surface }}>
            <p className="text-[13px] font-bold text-trail-text">FC moyenne des 20 dernières minutes = ta LTHR</p>
            <p className="text-[11px] text-trail-muted mt-1">C&apos;est cette valeur que tu reportes dans « FC seuil test 30 min ».</p>
          </div>
        </section>

        <div className="rounded-[6px] p-[8px] text-[11px]" style={{ backgroundColor: '#1f2419', border: '1px solid #facc15', color: '#facc15' }}>
          💡 À refaire tous les 3–6 mois ou après un bloc d&apos;entraînement structurant. La LTHR évolue avec ta forme.
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-[8px] py-[10px] text-[13px] font-bold text-white"
          style={{ backgroundColor: colors.chargeOrange }}
        >
          J&apos;ai compris, fermer
        </button>
      </div>
    </div>
  )
}
