import Link from 'next/link'
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bike,
  ChevronRight,
  FileText,
  Footprints,
  Info,
  LineChart,
  LifeBuoy,
  Scale,
  ShieldCheck,
} from 'lucide-react'
import { ContactCard } from '@/components/support/ContactCard'
import type { Metadata } from 'next'
import { getServerT } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const S = getServerT().support
  return {
    title:       `${S.title} — Trail Cockpit`,
    description: S.description,
  }
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Activity
  title: string
  subtitle: string
}) {
  return (
    <div className="flex items-center gap-[10px] px-1 mb-[10px]">
      <div className="w-7 h-7 rounded-[8px] bg-trail-surface border border-trail-border flex items-center justify-center flex-shrink-0">
        <Icon size={14} className="text-trail-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-body font-bold text-trail-text leading-tight">{title}</p>
        <p className="text-micro text-trail-muted leading-tight mt-[1px]">{subtitle}</p>
      </div>
    </div>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] bg-trail-card border border-trail-border p-[10px] space-y-[10px]">
      {children}
    </div>
  )
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 px-3 py-[10px] rounded-[10px] bg-trail-surface">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-trail-muted">
          {label}
        </p>
        <p className="text-body-sm text-trail-text mt-[2px]">{value}</p>
      </div>
    </div>
  )
}

export default function SupportPage() {
  const S = getServerT().support
  const features = [
    { icon: Activity,   label: S.featStravaSync },
    { icon: BarChart3,  label: S.featDashboards },
    { icon: LineChart,  label: S.featAnalysis },
    { icon: Footprints, label: S.featTracking },
  ]
  return (
    <div className="min-h-screen bg-trail-bg">
      <div className="px-3 py-3 pb-10 space-y-4 max-w-lg mx-auto">

        <div className="pt-[2px]">
          <Link
            href="/settings"
            className="inline-flex items-center gap-[6px] text-caption text-trail-muted hover:text-trail-text transition-colors"
          >
            <ArrowLeft size={14} />
            {S.backToSettings}
          </Link>
        </div>

        <header className="px-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-trail-primary">
            {S.eyebrow}
          </p>
          <h1 className="text-h1 font-display font-bold text-trail-text leading-tight mt-[2px]">
            {S.title}
          </h1>
          <p className="text-caption text-trail-muted leading-[16px] mt-[6px] max-w-[400px]">
            {S.description}
          </p>
        </header>

        <section>
          <SectionHeader
            icon={LifeBuoy}
            title={S.contactTitle}
            subtitle={S.contactSubtitle}
          />
          <SectionCard>
            <ContactCard />
            <p className="text-micro text-trail-muted leading-[16px] px-1">
              {S.contactNote}
            </p>
          </SectionCard>
        </section>

        <section>
          <SectionHeader
            icon={BarChart3}
            title={S.featuresTitle}
            subtitle={S.featuresSubtitle}
          />
          <SectionCard>
            <ul className="space-y-[6px]">
              {features.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-3 px-3 py-[10px] rounded-[10px] bg-trail-surface"
                >
                  <div className="w-7 h-7 rounded-[8px] bg-trail-card border border-trail-border flex items-center justify-center flex-shrink-0">
                    <Icon size={13} className="text-trail-primary" />
                  </div>
                  <p className="flex-1 text-body-sm text-trail-text">{label}</p>
                </li>
              ))}
            </ul>
          </SectionCard>
        </section>

        <section>
          <SectionHeader
            icon={Bike}
            title={S.stravaTitle}
            subtitle={S.stravaSubtitle}
          />
          <SectionCard>
            <div className="rounded-[10px] bg-trail-surface px-3 py-[12px] space-y-[10px]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[10px] bg-[#FC4C02]/15 border border-[#FC4C02]/30 flex items-center justify-center flex-shrink-0">
                  <Activity size={14} className="text-[#FC4C02]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-micro font-semibold uppercase tracking-wider text-trail-muted">
                    {S.stravaAuthLabel}
                  </p>
                  <p className="text-body-sm text-trail-text">{S.stravaAuthValue}</p>
                </div>
              </div>
              <p className="text-caption text-trail-text leading-[18px] px-1">
                {S.stravaBody}
              </p>
              <Link
                href="/settings"
                className="flex items-center gap-3 px-3 py-[10px] rounded-[10px] bg-trail-card border border-trail-border hover:bg-trail-border/30 transition-colors"
              >
                <p className="flex-1 text-caption font-semibold text-trail-text">
                  {S.stravaManage}
                </p>
                <ChevronRight size={14} className="text-trail-muted flex-shrink-0" />
              </Link>
            </div>
          </SectionCard>
        </section>

        <section>
          <SectionHeader
            icon={Scale}
            title={S.legalTitle}
            subtitle={S.legalSubtitle}
          />
          <SectionCard>
            <div className="rounded-[10px] bg-trail-surface divide-y divide-trail-border">
              <Link
                href="/legal/mentions-legales"
                className="flex items-center gap-3 px-3 py-[10px] hover:bg-trail-border/30 transition-colors"
              >
                <div className="w-7 h-7 rounded-[8px] bg-trail-card border border-trail-border flex items-center justify-center flex-shrink-0">
                  <FileText size={13} className="text-trail-primary" />
                </div>
                <p className="flex-1 text-body-sm text-trail-text">{S.legalMentions}</p>
                <ChevronRight size={14} className="text-trail-muted flex-shrink-0" />
              </Link>
              <Link
                href="/legal/confidentialite"
                className="flex items-center gap-3 px-3 py-[10px] hover:bg-trail-border/30 transition-colors"
              >
                <div className="w-7 h-7 rounded-[8px] bg-trail-card border border-trail-border flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={13} className="text-trail-primary" />
                </div>
                <p className="flex-1 text-body-sm text-trail-text">{S.legalPrivacy}</p>
                <ChevronRight size={14} className="text-trail-muted flex-shrink-0" />
              </Link>
              <Link
                href="/legal/conditions-utilisation"
                className="flex items-center gap-3 px-3 py-[10px] hover:bg-trail-border/30 transition-colors"
              >
                <div className="w-7 h-7 rounded-[8px] bg-trail-card border border-trail-border flex items-center justify-center flex-shrink-0">
                  <Scale size={13} className="text-trail-primary" />
                </div>
                <p className="flex-1 text-body-sm text-trail-text">{S.legalTerms}</p>
                <ChevronRight size={14} className="text-trail-muted flex-shrink-0" />
              </Link>
            </div>
            <p className="text-micro text-trail-muted leading-[16px] px-1">
              {S.legalNote}
            </p>
          </SectionCard>
        </section>

        <section>
          <SectionHeader
            icon={Info}
            title={S.aboutTitle}
            subtitle={S.aboutSubtitle}
          />
          <SectionCard>
            <div className="space-y-[6px]">
              <AboutRow label={S.aboutNameLabel}        value={S.aboutNameValue} />
              <AboutRow label={S.aboutTypeLabel}        value={S.aboutTypeValue} />
              <AboutRow label={S.aboutPlatformsLabel}   value={S.aboutPlatformsValue} />
              <AboutRow label={S.aboutIntegrationLabel} value={S.aboutIntegrationValue} />
            </div>
          </SectionCard>
        </section>

        <section className="px-1 pt-2">
          <div className="rounded-[10px] bg-trail-surface border border-trail-border px-3 py-[12px] space-y-[6px]">
            <div className="flex items-center gap-2">
              <Activity size={12} className="text-[#FC4C02] flex-shrink-0" />
              <p className="text-micro font-bold uppercase tracking-wider text-trail-text">
                {S.poweredByStrava}
              </p>
            </div>
            <p className="text-micro text-trail-muted leading-[16px]">
              {S.stravaCompliance}
            </p>
          </div>
        </section>

        <p className="text-center text-[10px] text-trail-muted/70 tracking-wider uppercase pt-2">
          {S.footerSignature}
        </p>

      </div>
    </div>
  )
}
