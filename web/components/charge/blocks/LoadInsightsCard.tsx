'use client'

import { BlockCard } from '../BlockCard'
import type { ChargeSportPayload } from '@/lib/analytics/charge-insights.types'
import { charge as L } from '@/lib/design/labels'

export function LoadInsightsCard({ payload }: { payload: ChargeSportPayload }) {
  const notes = payload.insights.notes
  return (
    <BlockCard title={L.blocks.insights} helpTitle={L.blocks.insights} helpBody={L.help.insights}>
      {notes.length === 0 ? (
        <p className="text-[12px] text-trail-muted py-2">Rien à signaler cette semaine.</p>
      ) : (
        <ul className="space-y-2 mt-1">
          {notes.map((n, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] text-trail-text leading-[18px]">
              <span className="text-trail-muted">•</span>
              <span className="flex-1">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </BlockCard>
  )
}
