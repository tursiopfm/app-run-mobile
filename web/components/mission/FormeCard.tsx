'use client'

import { MissionCard, MissionCardLabel } from './cards'
import { computeFreshness } from '@/lib/analytics/charge-insights'
import { cursorPctFromTsb, formeVerdict } from '@/lib/mission/forme-verdict'
import type { ChargeSportPayload, FreshnessZone } from '@/lib/analytics/charge-insights.types'
import { useT } from '@/lib/i18n/I18nProvider'

const ZONE_BADGE_STYLE: Record<FreshnessZone, { bg: string; fg: string; bd: string }> = {
  'high-fatigue':   { bg: 'rgba(248,113,113,0.14)', fg: 'var(--status-danger)',  bd: 'rgba(248,113,113,0.35)' },
  'normal-fatigue': { bg: 'rgba(251,191,36,0.14)',  fg: 'var(--status-warning)', bd: 'rgba(251,191,36,0.35)'  },
  balanced:         { bg: 'rgba(74,222,128,0.14)',  fg: 'var(--status-success)', bd: 'rgba(74,222,128,0.35)'  },
  fresh:            { bg: 'rgba(56,189,248,0.14)',  fg: 'var(--status-info)',    bd: 'rgba(56,189,248,0.35)'  },
  'very-fresh':     { bg: 'rgba(56,189,248,0.14)',  fg: 'var(--status-info)',    bd: 'rgba(56,189,248,0.35)'  },
}

export function FormeCard({ payload }: { payload: ChargeSportPayload }) {
  const M = useT().mission
  const f = computeFreshness(payload.dailyMetrics)
  const verdict = formeVerdict(f.zone)
  const cursor = cursorPctFromTsb(f.tsb)
  const badge = ZONE_BADGE_STYLE[f.zone]

  return (
    <MissionCard>
      <div className="flex items-center justify-between mb-3">
        <MissionCardLabel>{M.formeTitle}</MissionCardLabel>
        <span
          className="text-[11px] font-bold px-2.5 py-[3px] rounded-full border"
          style={{ background: badge.bg, color: badge.fg, borderColor: badge.bd }}
        >
          {M.formeBadge[f.zone]}
        </span>
      </div>
      <div
        className="relative h-[10px] rounded-full mb-1.5"
        style={{ background: 'linear-gradient(90deg,#F87171 0%,#FBBF24 35%,#4ADE80 70%,#38BDF8 100%)' }}
      >
        <span
          className="absolute -top-[4px] w-[18px] h-[18px] rounded-full"
          style={{
            left: `calc(${cursor}% - 9px)`,
            background: badge.fg,
            border: '3px solid var(--trail-text)',
            boxShadow: '0 1px 5px rgba(0,0,0,0.55)',
          }}
        />
      </div>
      <div className="flex justify-between text-[9px] mb-3 text-trail-muted">
        <span>{M.formeScale.tired}</span><span>{M.formeScale.normal}</span>
        <span>{M.formeScale.fresh}</span><span>{M.formeScale.sharp}</span>
      </div>
      <p className="text-[12px] leading-relaxed text-trail-muted">
        <span className="font-bold" style={{ color: verdict.tone === 'adapt' ? 'var(--status-warning)' : 'var(--status-success)' }}>
          {M.formeVerdict[f.zone]}
        </span>
      </p>
    </MissionCard>
  )
}
