'use client'

import { BlockHelpSheet } from '@/components/blocks/BlockHelpSheet'

export type KpiHelpRow = {
  id:       string
  label:    string
  range:    string
  meaning:  string
  advice:   string
  color:    string
}

type Props = {
  title:     string
  intro:     string
  rows:      KpiHelpRow[]
  currentId: string
  onClose:   () => void
}

function Row({ row, isActive }: { row: KpiHelpRow; isActive: boolean }) {
  return (
    <div
      className="rounded-[10px] p-3 border"
      style={{
        backgroundColor: isActive ? `${row.color}1F` : 'transparent',
        borderColor:     isActive ? `${row.color}59` : 'var(--trail-border)',
      }}
    >
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[14px] font-semibold" style={{ color: row.color }}>
          {row.label}
        </span>
        <span className="text-[11px] font-medium text-trail-muted">{row.range}</span>
      </div>
      <p className="text-[12px] text-trail-text leading-[17px] mb-1">{row.meaning}</p>
      <p className="text-[12px] text-trail-muted leading-[17px]">{row.advice}</p>
    </div>
  )
}

export function KpiHelpSheet({ title, intro, rows, currentId, onClose }: Props) {
  const body = (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] text-trail-muted leading-[18px] mb-1">{intro}</p>
      {rows.map((row) => (
        <Row key={row.id} row={row} isActive={row.id === currentId} />
      ))}
    </div>
  )
  return <BlockHelpSheet title={title} body={body} onClose={onClose} />
}
