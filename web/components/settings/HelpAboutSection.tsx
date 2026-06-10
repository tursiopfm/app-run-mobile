'use client'

import Link from 'next/link'
import { Mail, Tag, LifeBuoy, ChevronRight } from 'lucide-react'
import { useT } from '@/lib/i18n/I18nProvider'

const APP_VERSION = '0.1.0'
const CONTACT_EMAIL = 'contact@trailcockpit.run'

export function HelpAboutSection() {
  const L = useT().settings
  return (
    <div className="space-y-[10px]">
      {/* Support — page dédiée (Strava Support URL) */}
      <div className="space-y-[6px]">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-trail-muted px-1">
          {L.helpSupport}
        </p>
        <div className="rounded-[10px] bg-trail-surface divide-y divide-trail-border">
          <Link
            href="/support"
            className="flex items-center gap-3 px-3 py-[10px] hover:bg-trail-border/30 transition-colors"
          >
            <div className="w-10 h-10 rounded-[12px] bg-trail-card border border-trail-border flex items-center justify-center flex-shrink-0">
              <LifeBuoy size={18} className="text-trail-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body-sm text-trail-text">{L.helpAndSupport}</p>
              <p className="text-micro text-trail-muted">{L.helpAndSupportSub}</p>
            </div>
            <ChevronRight size={14} className="text-trail-muted flex-shrink-0" />
          </Link>
        </div>
      </div>

      {/* Contact + Version */}
      <div className="space-y-[6px]">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-trail-muted px-1">
          {L.helpContactVersion}
        </p>
        <div className="rounded-[10px] bg-trail-surface divide-y divide-trail-border">
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Trail%20Cockpit%20%E2%80%94%20Contact`}
            className="flex items-center gap-3 px-3 py-[10px] hover:bg-trail-border/30 transition-colors"
          >
            <div className="w-10 h-10 rounded-[12px] bg-trail-card border border-trail-border flex items-center justify-center flex-shrink-0">
              <Mail size={18} className="text-trail-muted" />
            </div>
            <p className="flex-1 text-body-sm text-trail-text">{L.contactLabel}</p>
            <span className="text-[10px] text-trail-muted/70 flex-shrink-0">›</span>
          </a>

          <div className="flex items-center gap-3 px-3 py-[10px]">
            <div className="w-10 h-10 rounded-[12px] bg-trail-card border border-trail-border flex items-center justify-center flex-shrink-0">
              <Tag size={18} className="text-trail-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-micro font-semibold uppercase tracking-wider text-trail-muted">{L.versionLabel}</p>
              <p className="text-body-sm text-trail-text">v{APP_VERSION} · {L.versionBuild}</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 px-2 py-[2px] rounded-full border border-emerald-500/30 bg-emerald-500/10 flex-shrink-0">
              {L.versionUpToDate}
            </span>
          </div>

        </div>
      </div>
    </div>
  )
}
