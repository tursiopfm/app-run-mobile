import Link from 'next/link'
import { Upload } from 'lucide-react'

export function FirstActivityBanner() {
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-4 flex items-start gap-3">
      <div className="w-8 h-8 rounded-[10px] bg-trail-border/40 border border-trail-border flex items-center justify-center flex-shrink-0 mt-[2px]">
        <Upload size={14} className="text-trail-muted" />
      </div>
      <div className="flex-1 min-w-0 space-y-[8px]">
        <div>
          <p className="text-body font-bold text-trail-text leading-tight">Ajoute ta première activité</p>
          <p className="text-body-sm text-trail-muted leading-[18px] mt-[3px]">
            Importe un fichier .gpx ou connecte Strava pour démarrer ton cockpit.
          </p>
        </div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-[6px] px-3 py-[7px] rounded-[8px] bg-trail-surface border border-trail-border text-trail-text text-caption font-semibold hover:bg-trail-border/40 transition-colors"
        >
          <Upload size={12} />
          Importer une activité
        </Link>
      </div>
    </div>
  )
}
