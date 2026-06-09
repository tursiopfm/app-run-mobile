import Link from 'next/link'
import { Mountain } from 'lucide-react'

export function GarminImportSection() {
  return (
    <Link
      href="/import/garmin"
      className="block rounded-[10px] bg-trail-surface px-3 py-[10px] hover:bg-trail-border/20 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-[10px] bg-trail-border/40 border border-trail-border flex items-center justify-center flex-shrink-0">
          <Mountain size={14} className="text-trail-muted" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-micro font-semibold uppercase tracking-wider text-trail-muted">Import Garmin</p>
          <p className="text-body-sm text-trail-text">Importe tout ton historique depuis l&apos;export RGPD Garmin (ZIP)</p>
        </div>
      </div>
    </Link>
  )
}
