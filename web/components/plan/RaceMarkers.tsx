'use client'

import { useEffect, useState } from 'react'
import { Flag, Trophy } from 'lucide-react'
import type { Race } from '@/types/plan'
import { computeRaceMarkers, type RaceMarker } from '@/lib/training/race-stacking'
import { useT } from '@/lib/i18n/I18nProvider'
import type { Dict } from '@/lib/i18n/dictionaries/fr'

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

// Hauteur d'un "étage" vertical occupé par une bulle empilée (collisions).
// = hauteur d'une carte (42) + 4px de gap entre bulles superposées.
const LANE_STEP = 46

// Décalage vertical entre la barre et le haut de la zone bulle (= ticks mt-1 + ticks
// text height ≈ 4 + 15, sans gap supplémentaire car bubble row passe en mt-0).
const OVERLAP_TO_BAR = 19

// Partie visible du connecteur sous la zone ticks (lane 0). Plus c'est petit, plus la
// bulle colle à la barre. 4px = juste assez pour que le trait soit lisible.
const BASE_CONNECTOR = 4

function formatShortDate(iso: string): string {
  if (!iso || iso.length < 10) return iso
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

export function RaceMarkers({ races, macroStart, macroEnd }: Props) {
  const L = useT().plan
  const markers = computeRaceMarkers(races, macroStart, macroEnd)
  const [openRaceId, setOpenRaceId] = useState<string | null>(null)

  if (markers.length === 0) return null

  const maxLane = markers.reduce((acc, m) => Math.max(acc, m.lane), 0)
  // Hauteur du bas = connecteur le plus long (BASE + lane*step) + hauteur exacte de la carte la plus haute (≈ 42px).
  const bubbleRowHeight = BASE_CONNECTOR + maxLane * LANE_STEP + 42
  const openRace = openRaceId ? markers.find(m => m.race.id === openRaceId)?.race : null

  return (
    <>
      {/* === ZONE PIN (au-dessus de la barre) === */}
      {/* Positionnée absolument dans le pt-9 (36px) que StructurePrepaBlock ajoute au-dessus de la barre.
          Hauteur = chip 28 + petit connecteur 8px qui touche la barre. */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{ height: 36 }}>
        {markers.map(m => (
          <RacePinAbove
            key={`pin-${m.race.id}`}
            marker={m}
            L={L}
            onTap={() => setOpenRaceId(m.race.id)}
          />
        ))}
      </div>

      {/* === ZONE BULLE (en dessous de la barre + ticks) — mt-0 pour coller au max === */}
      <div className="relative" style={{ height: bubbleRowHeight }}>
        {markers.map(m => (
          <RaceBubbleBelow
            key={`bubble-${m.race.id}`}
            marker={m}
            L={L}
            onTap={() => setOpenRaceId(m.race.id)}
          />
        ))}
      </div>

      {openRace && (
        <RaceDetailDrawer race={openRace} L={L} onClose={() => setOpenRaceId(null)} />
      )}
    </>
  )
}

// === Pin au-dessus de la barre — chip 28×28 + petit trait connectant à la barre ===
function RacePinAbove({ marker, L, onTap }: { marker: RaceMarker; L: Dict['plan']; onTap: () => void }) {
  const { race, leftPercent } = marker
  const color = PRIORITY_COLOR[race.priority]
  const isA = race.priority === 'A'
  const isMainGoal = isA && race.isMain

  // Tous les chips sont à la même taille (28×28) avec icône size=14 — seule la couleur change.
  const textColor = isA ? 'text-white' : race.priority === 'B' ? 'text-black' : 'text-white'

  return (
    <button
      type="button"
      onClick={onTap}
      className="absolute pointer-events-auto flex flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--trail-primary)] rounded-[8px]"
      style={{ left: `${leftPercent}%`, bottom: 0, transform: 'translateX(-50%)' }}
      aria-label={L.raceMarkerAria(race.name, formatShortDate(race.date))}
      title={race.name}
    >
      {/* Chip uniforme 28×28 avec icône taille 14 */}
      <span
        className={`flex items-center justify-center w-7 h-7 rounded-[8px] ${textColor}`}
        style={{ background: color, boxShadow: `0 2px 6px rgba(0,0,0,0.4), 0 0 0 1.5px var(--trail-card)` }}
        aria-hidden
      >
        {isMainGoal ? <Trophy size={14} strokeWidth={2.5} /> : <Flag size={14} strokeWidth={2.5} />}
      </span>
      {/* Petit trait vertical entre le chip et la barre, même style que le connecteur des bulles */}
      <span
        className="block"
        style={{
          width: isA ? 1.5 : 1,
          height: 8,
          background: color,
          opacity: isA ? 0.75 : 0.5,
          borderRadius: 1,
        }}
        aria-hidden
      />
    </button>
  )
}

// === Bulle en dessous de la barre — connecteur depuis la barre + carte résumé ===
function RaceBubbleBelow({ marker, L, onTap }: { marker: RaceMarker; L: Dict['plan']; onTap: () => void }) {
  const { race, leftPercent, lane } = marker
  const color = PRIORITY_COLOR[race.priority]
  const isA = race.priority === 'A'
  const isB = race.priority === 'B'

  // Connecteur plus long si la bulle est sur une lane plus basse (évite la collision avec une bulle au-dessus).
  const connectorHeight = BASE_CONNECTOR + lane * LANE_STEP

  // Recadrage : leftPercent=0 → tx=0 (à gauche), leftPercent=100 → tx=-100 (à droite).
  // Garantit mathématiquement zéro débordement tant que bulle.width ≤ container.width.
  const cardTranslateXPct = -leftPercent

  // Variantes visuelles selon priorité (bordure + style du nom). Mêmes infos pour tous.
  const cardBorder = isA
    ? `1.5px solid ${color}`
    : isB
      ? `1px solid ${color}`
      : `1px solid var(--trail-border)`
  const cardBoxShadow = isA
    ? `0 2px 8px rgba(0,0,0,0.35), 0 0 0 1px ${color}33`
    : isB
      ? `0 1px 4px rgba(0,0,0,0.25)`
      : undefined
  const nameClass = isA
    ? 'font-bold text-[color:var(--trail-text)]'
    : isB
      ? 'font-semibold text-[color:var(--trail-text)]'
      : 'text-[color:var(--trail-muted)]'

  return (
    <>
      {/* Trait vertical solide qui PART DE LA BARRE (top négatif via OVERLAP_TO_BAR) jusqu'à la bulle */}
      <span
        className="absolute block pointer-events-none"
        style={{
          left: `${leftPercent}%`,
          top: -OVERLAP_TO_BAR,
          transform: 'translateX(-50%)',
          width: isA ? 1.5 : 1,
          height: connectorHeight + OVERLAP_TO_BAR,
          background: color,
          opacity: isA ? 0.75 : 0.5,
          borderRadius: 1,
        }}
        aria-hidden
      />

      {/* Carte cliquable — uniforme A/B/C, compact (text-[10/9/8]px + px-1.5 py-1) */}
      <button
        type="button"
        onClick={onTap}
        className="absolute focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--trail-primary)] rounded-[8px]"
        style={{
          left: `${leftPercent}%`,
          top: connectorHeight,
          transform: `translateX(${cardTranslateXPct}%)`,
        }}
        aria-label={L.raceMarkerAria(race.name, formatShortDate(race.date))}
      >
        <div
          className="flex flex-col items-start leading-tight px-1.5 py-1 rounded-[8px] bg-[color:var(--trail-card)]"
          style={{ border: cardBorder, boxShadow: cardBoxShadow }}
        >
          <span className={`text-[10px] ${nameClass} whitespace-nowrap`}>
            {race.name}
          </span>
          <span className="text-[9px] font-semibold tabular-nums whitespace-nowrap" style={{ color }}>
            {formatShortDate(race.date)}
          </span>
          {race.distance > 0 && (
            <span className="text-[8px] text-[color:var(--trail-muted)] tabular-nums whitespace-nowrap">
              {race.distance}km · {race.elevation}m D+
            </span>
          )}
        </div>
      </button>
    </>
  )
}

function RaceDetailDrawer({ race, L, onClose }: { race: Race; L: Dict['plan']; onClose: () => void }) {
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
      aria-label={L.raceDrawerAria(race.name)}
    >
      <div
        className="w-full sm:max-w-md bg-[color:var(--trail-card)] border border-[color:var(--trail-border)] rounded-t-[16px] sm:rounded-[16px] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[18px] font-bold text-[color:var(--trail-text)] mb-1">{race.name}</h3>
        <p className="text-[12px] text-[color:var(--trail-muted)] mb-3">
          {L.raceDrawerInfo(race.date, race.distance, race.elevation, race.priority)}
        </p>
        {race.location && (
          <p className="text-[12px] text-[color:var(--trail-muted)] mb-2">📍 {race.location}</p>
        )}
        <div className="flex justify-between items-center mt-4">
          <a
            href={`/plan/courses/${race.id}`}
            className="text-[12px] text-[color:var(--trail-primary)] font-semibold"
          >
            {L.raceDrawerSeeDetail}
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-[8px] bg-[color:var(--trail-surface)] text-[12px] text-[color:var(--trail-text)]"
          >
            {L.raceDrawerClose}
          </button>
        </div>
      </div>
    </div>
  )
}
