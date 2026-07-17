'use client'

import Link from 'next/link'
import { Coffee } from 'lucide-react'
import { useMorningReportSeen } from '@/lib/hooks/useMorningReportSeen'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const MONTHS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

function dateLabel(d: Date): string {
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function MorningReportTile() {
  const today = todayISO()
  const { seen } = useMorningReportSeen(today)
  const now = new Date()

  if (seen) {
    return (
      <Link
        href="/rapport-matinal"
        className="block rounded-[12px] bg-trail-card border border-trail-border p-[10px] hover:brightness-110 transition"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 bg-trail-surface">
              <Coffee size={18} className="text-trail-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-body font-semibold leading-tight text-trail-text">Rapport matinal du jour</p>
              <p className="text-micro mt-0.5 text-trail-muted">{dateLabel(now)} · vu</p>
            </div>
          </div>
          <span className="text-h2 leading-none text-trail-muted">→</span>
        </div>
      </Link>
    )
  }

  return (
    <Link
      href="/rapport-matinal"
      className="block rounded-[12px] border p-[10px] hover:brightness-110 transition"
      style={{
        background:  'linear-gradient(135deg, rgba(255,107,53,0.10) 0%, var(--trail-card) 60%)',
        borderColor: 'rgba(255,107,53,0.40)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-[6px] h-[6px] rounded-full bg-trail-primary" />
          <span className="text-[15px] font-semibold text-trail-muted font-display">Rapport matinal</span>
        </div>
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ background: 'var(--trail-primary)', color: '#0A0F0E' }}
        >
          Nouveau
        </span>
      </div>
      <div className="flex items-end justify-between">
        <h2
          className="text-[24px] leading-none text-trail-text"
          style={{ fontFamily: "var(--font-data)", letterSpacing: '0.02em' }}
        >
          {dateLabel(now)}
        </h2>
        <p className="text-micro font-semibold text-trail-primary">Ouvrir →</p>
      </div>
    </Link>
  )
}
