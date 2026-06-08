import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { getServerT } from '@/lib/i18n/server'

type LegalPageShellProps = {
  eyebrow: string
  title: string
  description?: string
  updatedAt: string
  children: ReactNode
}

export function LegalPageShell({
  eyebrow,
  title,
  description,
  updatedAt,
  children,
}: LegalPageShellProps) {
  const L = getServerT().legal
  return (
    <div className="min-h-screen bg-trail-bg">
      <div className="px-3 py-3 pb-10 space-y-4 max-w-lg mx-auto">

        <div className="pt-[2px]">
          <Link
            href="/support"
            className="inline-flex items-center gap-[6px] text-[12px] text-trail-muted hover:text-trail-text transition-colors"
          >
            <ArrowLeft size={14} />
            {L.backToSupport}
          </Link>
        </div>

        <header className="px-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-trail-primary">
            {eyebrow}
          </p>
          <h1 className="text-[22px] font-display font-bold text-trail-text leading-tight mt-[2px]">
            {title}
          </h1>
          {description ? (
            <p className="text-[12px] text-trail-muted leading-[16px] mt-[6px] max-w-[400px]">
              {description}
            </p>
          ) : null}
          <p className="text-[10px] font-semibold uppercase tracking-wider text-trail-muted/70 mt-[8px]">
            {L.updatedAt} : {updatedAt}
          </p>
        </header>

        <div className="space-y-3">{children}</div>

        <p className="text-center text-[10px] text-trail-muted/70 tracking-wider uppercase pt-2">
          {L.documentFooter}
        </p>
      </div>
    </div>
  )
}

export function LegalSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[14px] bg-trail-card border border-trail-border p-[14px] space-y-[10px]">
      <h2 className="text-[14px] font-bold text-trail-text leading-tight">
        {title}
      </h2>
      <div className="space-y-[8px] text-[13px] leading-[19px] text-trail-text/90">
        {children}
      </div>
    </section>
  )
}

export function LegalParagraph({ children }: { children: ReactNode }) {
  return <p className="text-[13px] leading-[19px] text-trail-text/90">{children}</p>
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-[6px] pl-4 list-disc marker:text-trail-muted">
      {items.map((item, index) => (
        <li key={index} className="text-[13px] leading-[19px] text-trail-text/90">
          {item}
        </li>
      ))}
    </ul>
  )
}

export function LegalTodo({ children }: { children: ReactNode }) {
  return (
    <p className="text-[12px] leading-[18px] text-trail-muted italic px-2 py-[6px] rounded-[8px] bg-trail-surface border border-dashed border-trail-border">
      {children}
    </p>
  )
}
