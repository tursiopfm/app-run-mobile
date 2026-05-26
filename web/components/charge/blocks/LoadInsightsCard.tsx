'use client'

import { BlockCard } from '@/components/blocks/BlockCard'
import type { ChargeSportPayload, NoteItem } from '@/lib/analytics/charge-insights.types'
import { useT } from '@/lib/i18n/I18nProvider'

export function LoadInsightsCard({ payload }: { payload: ChargeSportPayload }) {
  const L = useT().charge
  const notes = payload.insights.notes

  function renderNote(item: NoteItem): string {
    if (item.code === 'no-ces') return L.notesNoCes(item.n ?? 0)
    return L.notes[item.code]
  }

  return (
    <BlockCard title={L.blocks.insights} helpTitle={L.blocks.insights} helpBody={L.help.insights}>
      {notes.length === 0 ? (
        <p className="text-[12px] text-trail-muted py-2">{L.insightsEmpty}</p>
      ) : (
        <ul className="space-y-2 mt-1">
          {notes.map((n, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] text-trail-text leading-[18px]">
              <span className="text-trail-muted">•</span>
              <span className="flex-1">{renderNote(n)}</span>
            </li>
          ))}
        </ul>
      )}
    </BlockCard>
  )
}
