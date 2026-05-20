'use client'

import { useEffect, useState } from 'react'
import type { Race } from '@/types/plan'
import { computeRaceMarkers, type RaceMarker } from '@/lib/training/race-stacking'

type Props = {
  races: Race[]
  macroStart: string
  macroEnd: string
}

const PRIORITY_COLOR: Record<Race['priority'], string> = {
  A: 'var(--trail-primary)',
  B: '#EAB308',
  C: 'var(--trail-muted)',
}

function formatShortDate(iso: string): string {
  if (!iso || iso.length < 10) return iso
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

export function RaceMarkers({ races, macroStart, macroEnd }: Props) {
  const markers = computeRaceMarkers(races, macroStart, macroEnd)
  const [openRaceId, setOpenRaceId] = useState<string | null>(null)

  if (markers.length === 0) return null

  const maxLane = markers.reduce((acc, m) => Math.max(acc, m.lane), 0)
  const rowHeight = 42 + maxLane * 28
  const openRace = openRaceId ? markers.find(m => m.race.id === openRaceId)?.race : null

  return (
    <>
      <div className="relative mt-3" style={{ height: 1, background: 'var(--trail-border)' }} aria-hidden />
      <div className="relative mt-2" style={{ height: rowHeight }}>
        {markers.map(m => (
          <RaceMarkerNode
            key={m.race.id}
            marker={m}
            onTap={() => setOpenRaceId(m.race.id)}
          />
        ))}
      </div>

      {openRace && (
        <RaceDetailDrawer race={openRace} onClose={() => setOpenRaceId(null)} />
      )}
    </>
  )
}

function RaceMarkerNode({ marker, onTap }: { marker: RaceMarker; onTap: () => void }) {
  const { race, leftPercent, lane } = marker
  const top = lane * 28
  const color = PRIORITY_COLOR[race.priority]

  if (race.priority === 'A') {
    return (
      <button
        type="button"
        onClick={onTap}
        className="absolute flex flex-col items-center"
        style={{ left: `${leftPercent}%`, top, transform: 'translateX(-50%)' }}
        aria-label={`Course ${race.name}, priorité A`}
      >
        <span className="text-[11px] font-bold text-[color:var(--trail-text)] mb-0.5 whitespace-nowrap">{race.name}</span>
        <span
          className="flex items-center justify-center w-7 h-7 rounded-md text-white"
          style={{ background: color, boxShadow: `0 0 0 2px var(--trail-card), 0 0 8px ${color}80` }}
        >🏁</span>
        <span className="text-[9px] font-bold mt-0.5 whitespace-nowrap" style={{ color }}>
          A · {formatShortDate(race.date)}
        </span>
      </button>
    )
  }

  if (race.priority === 'B') {
    return (
      <button
        type="button"
        onClick={onTap}
        className="absolute flex flex-col items-center"
        style={{ left: `${leftPercent}%`, top, transform: 'translateX(-50%)' }}
        aria-label={`Course ${race.name}, priorité B`}
      >
        <span className="text-[10px] font-semibold text-[color:var(--trail-text)] mb-0.5 whitespace-nowrap">{race.name}</span>
        <span
          className="flex items-center justify-center w-5 h-5 rounded-md"
          style={{ background: color, boxShadow: '0 0 0 2px var(--trail-card)' }}
        >
          <span className="text-[10px] text-black">⚑</span>
        </span>
        <span className="text-[9px] font-semibold mt-0.5 whitespace-nowrap" style={{ color }}>
          B · {formatShortDate(race.date)}
        </span>
      </button>
    )
  }

  // C
  return (
    <button
      type="button"
      onClick={onTap}
      className="absolute flex flex-col items-center"
      style={{ left: `${leftPercent}%`, top, transform: 'translateX(-50%)' }}
      aria-label={`Course ${race.name}, priorité C`}
    >
      <span className="text-[9px] text-[color:var(--trail-muted)] mb-0.5 whitespace-nowrap">{race.name}</span>
      <span
        className="flex items-center justify-center w-2.5 h-2.5 rounded-full"
        style={{ background: color, boxShadow: '0 0 0 2px var(--trail-card)' }}
        aria-hidden
      />
      <span className="text-[8px] mt-0.5 whitespace-nowrap" style={{ color }}>
        C · {formatShortDate(race.date)}
      </span>
    </button>
  )
}

function RaceDetailDrawer({ race, onClose }: { race: Race; onClose: () => void }) {
  // Pattern aligné avec RaceEditorModal / ConfirmDialog : Escape ferme le drawer.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Détail de la course ${race.name}`}
    >
      <div
        className="w-full sm:max-w-md bg-[color:var(--trail-card)] border border-[color:var(--trail-border)] rounded-t-[16px] sm:rounded-[16px] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[18px] font-bold text-[color:var(--trail-text)] mb-1">{race.name}</h3>
        <p className="text-[12px] text-[color:var(--trail-muted)] mb-3">
          {race.date} · {race.distance} km · {race.elevation} m D+ · priorité {race.priority}
        </p>
        {race.location && (
          <p className="text-[12px] text-[color:var(--trail-muted)] mb-2">📍 {race.location}</p>
        )}
        <div className="flex justify-between items-center mt-4">
          <a
            href={`/plan/courses/${race.id}`}
            className="text-[12px] text-[color:var(--trail-primary)] font-semibold"
          >
            Voir le détail →
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-[8px] bg-[color:var(--trail-surface)] text-[12px] text-[color:var(--trail-text)]"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
