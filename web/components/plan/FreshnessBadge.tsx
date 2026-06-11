import type { RaceTableauMeta } from '@/types/plan'

export function FreshnessBadge({ meta }: { meta: RaceTableauMeta | null }) {
  if (!meta) return null
  const map = {
    confirmed: { icon: '✅', text: `Confirmé édition ${meta.editionYear ?? '?'}`, cls: 'text-trail-primary' },
    provisional_previous_edition: { icon: '⚠️', text: `Provisoire — basé sur l'édition ${meta.editionYear ?? '?'}`, cls: 'text-[#EAB308]' },
    unknown: { icon: '❔', text: 'Édition non identifiée — vérifiez la source', cls: 'text-trail-muted' },
  }[meta.freshnessStatus]
  return (
    <div className={`flex items-center gap-2 text-body-sm mb-2 ${map.cls}`}>
      <span aria-hidden>{map.icon}</span><span>{map.text}</span>
    </div>
  )
}
