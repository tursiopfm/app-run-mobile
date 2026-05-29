'use client'

import Link from 'next/link'
import { Route, ChevronRight } from 'lucide-react'

type Props = {
  routesCount: number
  activeCount: number
  labels: string[]
}

export function CommuteRoutesTeaser({ routesCount, activeCount, labels }: Props) {
  const isConfigured = routesCount > 0

  const subtitle = !isConfigured
    ? 'Non configuré · Runtaf, Vélotaf…'
    : labels.length > 0
      ? `${activeCount} actif${activeCount > 1 ? 's' : ''} · ${labels.join(', ')}`
      : `${activeCount} actif${activeCount > 1 ? 's' : ''}`

  return (
    <Link
      href="/settings/trajets"
      className="flex items-center gap-3 px-3 py-[12px] rounded-[10px] bg-trail-surface hover:bg-trail-border/30 transition-colors group"
    >
      <div className="w-10 h-10 rounded-[12px] bg-trail-card border border-trail-border flex items-center justify-center flex-shrink-0">
        <Route size={18} className="text-trail-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-trail-text">Trajets domicile-travail</p>
        <p className="text-[11px] text-trail-muted truncate mt-[2px]">{subtitle}</p>
      </div>
      <ChevronRight size={16} className="text-trail-muted flex-shrink-0 group-hover:text-trail-text transition-colors" />
    </Link>
  )
}
