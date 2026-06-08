'use client'

import Link from 'next/link'
import { BlockCard } from '@/components/blocks/BlockCard'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { useT } from '@/lib/i18n/I18nProvider'
import { colors } from '@/lib/design/colors'

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function TopLoadActivitiesCard({ payload }: { payload: ChargeSportPayload }) {
  const t = useT()
  const L = t.charge
  if (payload.top.length === 0) {
    return (
      <BlockCard title={L.blocks.topActivities} helpTitle={L.blocks.topActivities} helpBody={L.help.topActivities}>
        <p className="text-caption text-trail-muted text-center py-4">{L.notEnoughData}</p>
      </BlockCard>
    )
  }
  return (
    <BlockCard title={L.blocks.topActivities} helpTitle={L.blocks.topActivities} helpBody={L.help.topActivities}>
      <ul className="space-y-1.5 mt-1">
        {payload.top.map(a => (
          <li key={a.id}>
            <Link href={`/activities/${a.id}`} className="block rounded-[10px] bg-trail-surface px-3 py-2 hover:border-trail-primary border border-transparent transition-colors">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-caption font-semibold text-trail-text truncate">{a.name || `${t.sportLabel[a.sport] ?? a.sport} ${fmtDate(a.date)}`}</span>
                <span className="text-caption font-bold flex-shrink-0" style={{ color: colors.chargeOrange }}>{a.ces} CES</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-trail-muted mt-0.5">
                <span>{fmtDate(a.date)}</span>
                <span>·</span>
                <span>{t.sportLabel[a.sport] ?? a.sport}</span>
                <span>·</span>
                <span>{fmtDuration(a.durationSec)}</span>
                {a.intensityLabel && <><span>·</span><span>{L.intensityLabels[a.intensityLabel]}</span></>}
                {a.typeLabel && <><span>·</span><span>{a.typeLabel}</span></>}
                <span className="ml-auto font-semibold text-trail-text">{a.share7dPct}% / 7j</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </BlockCard>
  )
}
