'use client'

// Mirror of WeekTable composable from ui/components/WeekTable.kt
// Horizontally scrollable table: session names | day columns | total column.

import { useT } from '@/lib/i18n/I18nProvider'
import { weekTable as layout  } from '@/lib/design/layout'

export type DaySession = {
  day:        string   // day abbreviation (Mon, Tue…)
  label:      string   // session label (e.g. 'Endurance', 'VMA'…)
  volumeKm:   number
  dPlus:      number
}

type WeekTableProps = {
  sessions:  DaySession[]
  className?: string
}

function fmt(v: number): string {
  if (v === 0) return '0'
  if (v % 1 === 0) return v.toString()
  return v.toFixed(2)
}

export function WeekTable({ sessions, className = '' }: WeekTableProps) {
  const labels = useT().weekTable
  const totalKm   = sessions.reduce((s, r) => s + r.volumeKm, 0)
  const totalDPlus= sessions.reduce((s, r) => s + r.dPlus, 0)

  const sessionW = layout.sessionColWidth  // 90px
  const dayW     = layout.dayColWidth      // 92px
  const totalW   = layout.totalColWidth    // 70px
  const hH       = layout.headerHeight     // 28px
  const bH       = layout.bodyHeight       // 26px

  const headerCell = (text: string, w: number, bold = false) => (
    <div
      style={{ width: w, minWidth: w, height: hH }}
      className="flex items-center px-1.5 bg-trail-header border-[0.5px] border-trail-border shrink-0"
    >
      <span className={`text-[11px] text-trail-text leading-none ${bold ? 'font-semibold' : ''}`}>
        {text}
      </span>
    </div>
  )

  const bodyCell = (text: string, w: number, bold = false) => (
    <div
      style={{ width: w, minWidth: w, height: bH }}
      className="flex items-center px-1.5 bg-trail-surface border-[0.5px] border-trail-border shrink-0"
    >
      <span className={`text-[11px] text-trail-text leading-none ${bold ? 'font-semibold' : ''}`}>
        {text}
      </span>
    </div>
  )

  return (
    <div className={`rounded border border-trail-border overflow-x-auto ${className}`}>
      {/* Header row: session + day names + total */}
      <div className="flex">
        {headerCell(labels.headerSession, sessionW)}
        {sessions.map((s) => headerCell(s.day, dayW, true))}
        {headerCell(labels.headerTotal, totalW, true)}
      </div>

      {/* Label row */}
      <div className="flex">
        {headerCell(labels.headerLabel, sessionW)}
        {sessions.map((s) => bodyCell(s.label || '—', dayW))}
        {bodyCell('', totalW)}
      </div>

      {/* Volume row */}
      <div className="flex">
        {headerCell(labels.headerVolume, sessionW)}
        {sessions.map((s) => bodyCell(fmt(s.volumeKm), dayW))}
        {bodyCell(fmt(totalKm), totalW, true)}
      </div>

      {/* Elevation row */}
      <div className="flex">
        {headerCell(labels.headerElevation, sessionW)}
        {sessions.map((s) => bodyCell(s.dPlus.toString(), dayW))}
        {bodyCell(totalDPlus.toString(), totalW, true)}
      </div>
    </div>
  )
}
