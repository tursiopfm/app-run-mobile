'use client'

import type { RaceWaypoint } from '@/types/plan'
import { SUPPLY_META, allChips } from '@/lib/plan/supply-chips'
import { colors } from '@/lib/design/colors'

const ORANGE = colors.chargeOrange // #FF7900

function Chip({ supply }: { supply: RaceWaypoint['supplies'][number] }) {
  const m = SUPPLY_META[supply]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 14, height: 14, padding: '0 3px', borderRadius: 4,
      background: m.color, color: '#fff', fontSize: 9, fontWeight: 700, lineHeight: 1,
    }}>{m.letter}</span>
  )
}

function fmtSigned(n: number): string {
  return `${n >= 0 ? '+' : '−'}${Math.abs(Math.round(n)).toLocaleString('fr-FR')}`
}

export interface WaypointDetailCardProps {
  waypoint: RaceWaypoint
  previous: RaceWaypoint | null
  altitude: number | null
  passageClock: string
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
}

export function WaypointDetailCard({
  waypoint, previous, altitude, passageClock, hasPrev, hasNext, onPrev, onNext,
}: WaypointDetailCardProps) {
  const chips = allChips(waypoint.supplies)
  const isBase = waypoint.supplies.includes('base_vie')
  const dPlusSeg = previous ? Math.max(0, (waypoint.dPlus ?? 0) - (previous.dPlus ?? 0)) : null
  const dMoinsSeg = previous ? Math.max(0, (waypoint.dMoins ?? 0) - (previous.dMoins ?? 0)) : null
  const ravito = chips.length ? chips.map((c) => SUPPLY_META[c].label).join(' · ') : '—'

  return (
    <div className="mt-3 rounded-[13px] border p-3"
      style={{ borderColor: '#FCE3C4', background: 'linear-gradient(180deg,#FFF4E6,var(--trail-card))' }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex gap-[3px]">{chips.map((c) => <Chip key={c} supply={c} />)}</div>
        <span className="text-[15px] font-bold text-trail-text">{waypoint.name}</span>
        {isBase && (
          <span className="text-[9.5px] font-bold uppercase tracking-wide text-white rounded px-[7px] py-[2px]"
            style={{ background: SUPPLY_META.base_vie.color }}>Base vie</span>
        )}
        <div className="ml-auto flex gap-[6px]">
          <button type="button" aria-label="Ravito précédent" disabled={!hasPrev}
            onClick={onPrev} className="w-[26px] h-[26px] rounded-[8px] border border-trail-border bg-trail-card text-trail-muted disabled:opacity-40">‹</button>
          <button type="button" aria-label="Ravito suivant" disabled={!hasNext}
            onClick={onNext} className="w-[26px] h-[26px] rounded-[8px] border border-trail-border bg-trail-card text-trail-muted disabled:opacity-40">›</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-y-[7px] gap-x-[14px]">
        <Cell k="Distance" v={`km ${waypoint.km.toFixed(1).replace('.', ',')}`} />
        <Cell k="Altitude" v={altitude != null ? `${Math.round(altitude).toLocaleString('fr-FR')} m` : '—'} />
        <Cell k={previous ? `Depuis ${previous.name}` : 'Depuis le départ'}
          v={dPlusSeg != null ? `${fmtSigned(dPlusSeg)} m · ${fmtSigned(-(dMoinsSeg ?? 0))} m` : '—'} />
        <Cell k="Passage estimé" v={passageClock || '—'} />
        <Cell k="Barrière horaire" v={waypoint.cutoffRaw ?? '—'} orange={!!waypoint.cutoffRaw} />
        <Cell k="Ravitaillement" v={ravito} />
      </div>
    </div>
  )
}

function Cell({ k, v, orange }: { k: string; v: string; orange?: boolean }) {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wide text-trail-muted">{k}</div>
      <div className="text-[13px] font-semibold mt-[1px]" style={orange ? { color: ORANGE } : undefined}>{v}</div>
    </div>
  )
}
