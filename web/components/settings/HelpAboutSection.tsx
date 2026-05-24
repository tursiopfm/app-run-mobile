import Link from 'next/link'
import { Mail, Tag, LifeBuoy, ChevronRight } from 'lucide-react'

const APP_VERSION = '0.1.0'
const CONTACT_EMAIL = 'contact@trailcockpit.run'

export function HelpAboutSection() {
  return (
    <div className="space-y-[10px]">
      {/* Support — page dédiée (Strava Support URL) */}
      <div className="space-y-[6px]">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-trail-muted px-1">
          Support
        </p>
        <div className="rounded-[10px] bg-trail-surface divide-y divide-trail-border">
          <Link
            href="/support"
            className="flex items-center gap-3 px-3 py-[10px] hover:bg-trail-border/30 transition-colors"
          >
            <div className="w-7 h-7 rounded-[8px] bg-trail-card border border-trail-border flex items-center justify-center flex-shrink-0">
              <LifeBuoy size={13} className="text-trail-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-trail-text">Aide & Support</p>
              <p className="text-[11px] text-trail-muted">Contact, confidentialité, à propos</p>
            </div>
            <ChevronRight size={14} className="text-trail-muted flex-shrink-0" />
          </Link>
        </div>
      </div>

      {/* Contact + Version */}
      <div className="space-y-[6px]">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-trail-muted px-1">
          Contact & Version
        </p>
        <div className="rounded-[10px] bg-trail-surface divide-y divide-trail-border">
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Trail%20Cockpit%20%E2%80%94%20Contact`}
            className="flex items-center gap-3 px-3 py-[10px] hover:bg-trail-border/30 transition-colors"
          >
            <div className="w-7 h-7 rounded-[8px] bg-trail-card border border-trail-border flex items-center justify-center flex-shrink-0">
              <Mail size={13} className="text-trail-muted" />
            </div>
            <p className="flex-1 text-[13px] text-trail-text">Contact</p>
            <span className="text-[10px] text-trail-muted/70 flex-shrink-0">›</span>
          </a>

          <div className="flex items-center gap-3 px-3 py-[10px]">
            <div className="w-7 h-7 rounded-[8px] bg-trail-card border border-trail-border flex items-center justify-center flex-shrink-0">
              <Tag size={13} className="text-trail-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-trail-muted">Version</p>
              <p className="text-[13px] text-trail-text">v{APP_VERSION} · Build PWA</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 px-2 py-[2px] rounded-full border border-emerald-500/30 bg-emerald-500/10 flex-shrink-0">
              À jour
            </span>
          </div>

        </div>
      </div>
    </div>
  )
}
