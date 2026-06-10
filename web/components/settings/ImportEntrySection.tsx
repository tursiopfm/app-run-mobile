import Link from 'next/link'
import { Download } from 'lucide-react'

/** Bloc d'entrée unique dans Réglages → page d'import (historique Garmin RGPD + fichier .gpx). */
export function ImportEntrySection() {
  return (
    <Link
      href="/import/garmin"
      className="flex items-center gap-3 rounded-[11px] bg-trail-surface border border-trail-border px-3 py-3 hover:bg-trail-border/20 transition-colors"
    >
      <div
        className="w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0 border"
        style={{ background: 'rgba(255,121,0,0.12)', borderColor: 'rgba(255,121,0,0.30)' }}
      >
        <Download size={17} className="text-trail-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-micro font-bold uppercase tracking-wider text-trail-muted font-display">Importer des activités</p>
        <p className="text-body-sm text-trail-text mt-[2px]">
          Tout ton historique <span className="text-trail-accent font-semibold">Garmin</span>, ou un fichier .gpx
        </p>
      </div>
      <span className="text-trail-muted text-xl leading-none flex-shrink-0">›</span>
    </Link>
  )
}
