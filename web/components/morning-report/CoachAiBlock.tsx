'use client'

import { ReportCard } from './ReportCard'

export function CoachAiBlock() {
  return (
    <ReportCard
      label="Mot du coach"
      accent="var(--trail-pie-cotes)"
      className="h-full"
      right={
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ background: 'rgba(139,92,246,0.18)', color: 'var(--trail-pie-cotes)' }}
        >
          IA · bientôt
        </span>
      }
    >
      <p className="text-body-sm leading-relaxed text-trail-muted italic">
        Bientôt — un mot personnalisé chaque matin selon ta forme, ta séance et la météo.
      </p>
    </ReportCard>
  )
}
