'use client'

// État de forme (design A) : cadran à aiguille + TsbBadge cliquable qui ouvre
// la fenêtre Expert « Fraîcheur — que faire ? » (FreshnessHelpSheet).

import { useState } from 'react'
import { MissionCard, MissionCardLabel } from './cards'
import { TsbBadge } from '@/components/ui/TsbBadge'
import { FreshnessHelpSheet } from '@/components/ui/FreshnessHelpSheet'
import { computeFreshness } from '@/lib/analytics/charge-insights'
import { kpiStatusFreshness } from '@/lib/analytics/charge-kpi-status'
import { cursorPctFromTsb, formeVerdict } from '@/lib/mission/forme-verdict'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { useT } from '@/lib/i18n/I18nProvider'

// Aiguille du cadran : pct 0..100 → angle 180..0° (demi-cercle gauche → droite).
function needleTip(pct: number, cx: number, cy: number, r: number): { x: number; y: number } {
  const a = Math.PI * (1 - pct / 100)
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) }
}

export function FormeCard({ payload }: { payload: ChargeSportPayload }) {
  const t = useT()
  const M = t.mission
  const C = t.charge
  const [showHelp, setShowHelp] = useState(false)
  const f = computeFreshness(payload.dailyMetrics)
  const verdict = formeVerdict(f.zone)
  const { id } = kpiStatusFreshness(Math.round(f.tsb))
  const tip = needleTip(cursorPctFromTsb(f.tsb), 70, 78, 48)

  const delta = Math.round(f.deltaVsWeekAgo)
  const qualifier = delta > 1 ? C.freshnessDeltaFresher : delta < -1 ? C.freshnessDeltaTired : C.freshnessDeltaStable

  return (
    <MissionCard>
      <div className="flex items-center justify-between">
        <MissionCardLabel>{M.formeTitle}</MissionCardLabel>
        <TsbBadge tsb={f.tsb} onClick={() => setShowHelp(true)} />
      </div>
      <div className="flex items-center gap-3.5 mt-2">
        <svg viewBox="0 0 140 86" width="146" aria-hidden>
          <path d="M14,76 A60 60 0 0 1 33.5,32" fill="none" stroke="var(--status-danger)" strokeWidth="7" strokeLinecap="round" opacity=".8" />
          <path d="M38,28 A60 60 0 0 1 70,16" fill="none" stroke="var(--status-warning)" strokeWidth="7" strokeLinecap="round" opacity=".85" />
          <path d="M76,16 A60 60 0 0 1 104,27" fill="none" stroke="var(--status-success)" strokeWidth="7" strokeLinecap="round" opacity=".9" />
          <path d="M109,31 A60 60 0 0 1 122,46" fill="none" stroke="var(--status-info)" strokeWidth="7" strokeLinecap="round" />
          <path d="M124.5,51 A60 60 0 0 1 126,76" fill="none" stroke="#7DD3FC" strokeWidth="7" strokeLinecap="round" />
          <line x1="70" y1="78" x2={tip.x} y2={tip.y} stroke="var(--trail-text)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="70" cy="78" r="5" fill="var(--ink-500)" stroke="var(--trail-text)" strokeWidth="1.5" />
        </svg>
        <div className="flex-1">
          <p className="font-display font-bold text-[34px] leading-none tabular-nums text-trail-text">{Math.round(f.tsb)}</p>
          <p className="text-[11px] mt-1.5 text-trail-muted">
            <b style={{ color: delta > 1 ? 'var(--status-success)' : delta < -1 ? 'var(--status-danger)' : 'var(--trail-muted)' }}>
              {delta > 0 ? '↗ +' : delta < 0 ? '↘ ' : '→ '}{delta !== 0 ? delta : ''}
            </b>{' '}{M.formeDeltaSuffix} · {qualifier}
          </p>
        </div>
      </div>
      <p className="text-[12px] leading-relaxed mt-2 text-trail-muted">
        <span className="font-bold" style={{ color: verdict.tone === 'adapt' ? 'var(--status-warning)' : 'var(--status-success)' }}>
          {M.formeVerdict[f.zone]}
        </span>
      </p>
      {showHelp && <FreshnessHelpSheet currentId={id} onClose={() => setShowHelp(false)} />}
    </MissionCard>
  )
}
