'use client'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import type { EnrichReport } from '@/lib/garmin-import/enrich-types'

export function EnrichmentStep({ report }: { report: EnrichReport }) {
  return (
    <>
      <div className="rounded-[10px] bg-trail-surface px-3 py-[10px] space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-trail-muted flex-shrink-0" />
          <p className="text-body-sm font-semibold text-trail-text">Enrichissement terminé</p>
        </div>
        <p className="text-body-sm text-trail-text">
          {report.enriched} activité{report.enriched !== 1 ? 's' : ''} enrichie{report.enriched !== 1 ? 's' : ''} (FC seconde par seconde, découplage, GAP)
        </p>
        {report.errors > 0 && (
          <p className="text-body-sm text-trail-muted">
            {report.errors} fichier{report.errors !== 1 ? 's' : ''} illisible{report.errors !== 1 ? 's' : ''}
          </p>
        )}
      </div>
      <Link
        href="/dashboard"
        className="flex items-center justify-center gap-[6px] w-full px-3 py-[7px] rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-caption font-semibold hover:bg-trail-border/40 transition-colors"
      >
        Voir mon Cockpit
      </Link>
    </>
  )
}
