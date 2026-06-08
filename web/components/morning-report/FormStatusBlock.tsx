'use client'

import { useState } from 'react'
import { BlockCard } from '@/components/blocks/BlockCard'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { useT } from '@/lib/i18n/I18nProvider'
import { colors } from '@/lib/design/colors'
import {
  kpiStatusFatigue,
  kpiStatusFitness,
  kpiStatusFreshness,
  type FatigueStatusId,
  type FitnessStatusId,
  type FreshnessStatusId,
} from '@/lib/analytics/charge-kpi-status'
import { FreshnessHelpSheet } from '@/components/ui/FreshnessHelpSheet'
import { FatigueHelpSheet } from '@/components/ui/FatigueHelpSheet'
import { FitnessHelpSheet } from '@/components/ui/FitnessHelpSheet'

type HelpKey = 'fatigue' | 'fitness' | 'freshness' | null

// Courtes explications affichées sous le mot-statut (mini-bloc du rapport matinal).
const FATIGUE_HINT: Record<FatigueStatusId, string> = {
  high:  'Pense à bien récupérer',
  usual: 'Dans tes habitudes',
  low:   'Charge allégée en ce moment',
}
const FITNESS_HINT: Record<FitnessStatusId, string> = {
  building:     'Base encore à bâtir',
  progressing:  'Ta base monte bien',
  solid:        "Bon socle d'endurance",
  'very-solid': 'Socle bien installé',
}
const FRESHNESS_HINT: Record<FreshnessStatusId, string> = {
  'very-fresh':     'Bien reposé, prêt à pousser',
  fresh:            'Plutôt reposé',
  balanced:         "Forme et fatigue à l'équilibre",
  'normal-fatigue': 'Normal en phase de charge',
  'high-fatigue':   'Lève un peu le pied',
}

export function FormStatusBlock({ payload }: { payload: ChargeSportPayload }) {
  const L = useT().charge
  const [openHelp, setOpenHelp] = useState<HelpKey>(null)

  const last = payload.dailyMetrics[payload.dailyMetrics.length - 1]
  const atl  = Math.round(last?.atl ?? 0)
  const ctl  = Math.round(last?.ctl ?? 0)
  const tsb  = Math.round(last?.tsb ?? 0)

  const verdict = L.verdict[payload.insights.status]

  const fatigueStatus   = kpiStatusFatigue(atl, ctl)
  const fitnessStatus   = kpiStatusFitness(ctl)
  const freshnessStatus = kpiStatusFreshness(tsb)

  return (
    <BlockCard title={L.blocks.status} helpTitle={L.blocks.status} helpBody={L.help.status}>
      <div className="mb-1">
        <p className="text-[14px] font-bold text-trail-text leading-[18px]">{verdict.action}</p>
        <p className="text-[12px] text-trail-muted mt-1 leading-[16px]">{verdict.reason}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <KpiCell
          label={L.recentFatigue}
          labelColor={colors.chargeOrange}
          statusLabel={L.kpiStatus.fatigue[fatigueStatus.id]}
          hint={FATIGUE_HINT[fatigueStatus.id]}
          onClick={() => setOpenHelp('fatigue')}
        />
        <KpiCell
          label={L.baseFitness}
          labelColor={colors.seriesBlue}
          statusLabel={L.kpiStatus.fitness[fitnessStatus.id]}
          hint={FITNESS_HINT[fitnessStatus.id]}
          onClick={() => setOpenHelp('fitness')}
        />
        <KpiCell
          label={L.freshness}
          labelColor={colors.seriesYellow}
          statusLabel={L.kpiStatus.freshness[freshnessStatus.id]}
          hint={FRESHNESS_HINT[freshnessStatus.id]}
          onClick={() => setOpenHelp('freshness')}
        />
      </div>
      {openHelp === 'fatigue' && (
        <FatigueHelpSheet currentId={fatigueStatus.id} onClose={() => setOpenHelp(null)} />
      )}
      {openHelp === 'fitness' && (
        <FitnessHelpSheet currentId={fitnessStatus.id} onClose={() => setOpenHelp(null)} />
      )}
      {openHelp === 'freshness' && (
        <FreshnessHelpSheet currentId={freshnessStatus.id} onClose={() => setOpenHelp(null)} />
      )}
    </BlockCard>
  )
}

type KpiCellProps = {
  label:       string
  labelColor:  string
  statusLabel: string
  hint:        string
  onClick:     () => void
}

function KpiCell({ label, labelColor, statusLabel, hint, onClick }: KpiCellProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} — voir les explications`}
      className="rounded-[10px] bg-trail-surface px-2 py-2.5 text-center hover:brightness-110 transition cursor-pointer w-full"
    >
      <p className="text-[11px] font-semibold" style={{ color: labelColor }}>{label}</p>
      <p className="text-[14px] font-display font-bold mt-1.5 leading-[17px] text-trail-text">
        {statusLabel}
      </p>
      <p className="text-[10px] font-medium mt-1 text-trail-muted leading-[13px]">
        {hint}
      </p>
    </button>
  )
}
