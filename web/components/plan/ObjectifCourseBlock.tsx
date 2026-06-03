'use client'

// Bloc Objectif Course : liste multi-races (1 principale + N secondaires).
// La principale s'affiche en grande carte (Bebas Neue + countdown J-XX) ; les
// autres en cartes compactes (1 ligne). CTA "+ Nouvelle course" en bas.
// La data vient de getRaces() (Supabase ou localStorage selon contexte).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Flag, SquarePen, Trophy } from 'lucide-react'
import type { Race, RaceType } from '@/types/plan'
import { getRaces, peekRaces } from '@/lib/plan/storage'
import { colors } from '@/lib/design/colors'
import { BlockCard } from '@/components/blocks/BlockCard'
import { RaceEditorModal } from './RaceEditorModal'
import { RaceCardSkeleton } from './RaceCardSkeleton'
import { useT } from '@/lib/i18n/I18nProvider'
import type { Dict } from '@/lib/i18n/dictionaries/fr'

// Couleurs priorité — identiques à RaceMarkers pour cohérence visuelle avec la timeline « Structure de prépa ».
const PRIORITY_COLOR: Record<Race['priority'], string> = {
  A: 'var(--trail-primary)',
  B: '#EAB308',
  C: 'var(--trail-muted)',
}

type Props = {
  onChange?: () => void
}

function computeDaysLeft(isoDate: string): number {
  const target = new Date(isoDate + 'T00:00:00').getTime()
  return Math.ceil((target - Date.now()) / 86_400_000)
}

function formatShortDate(iso: string, months: readonly string[]): string {
  if (!iso || iso.length < 10) return iso
  const m = parseInt(iso.slice(5, 7), 10) - 1
  const d = parseInt(iso.slice(8, 10), 10)
  if (Number.isNaN(d) || m < 0 || m > 11) return iso
  return `${d} ${months[m]}`
}

export function ObjectifCourseBlock({ onChange }: Props) {
  const L = useT().plan
  const initial = peekRaces()
  const [races, setRaces] = useState<Race[]>(initial ?? [])
  const [loaded, setLoaded] = useState(initial !== null)
  const [modalOpen, setModalOpen] = useState(false)
  // race en édition (null = création).
  const [editing, setEditing] = useState<Race | null>(null)

  const reload = useCallback(async () => {
    const list = await getRaces()
    setRaces(list)
    setLoaded(true)
  }, [])

  useEffect(() => { void reload() }, [reload])

  function handleSaved() {
    void reload()
    onChange?.()
  }

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  const router = useRouter()
  function openCourseDetail(race: Race) {
    router.push(`/plan/courses/${race.id}`)
  }

  // Tri : prochaine course principale mise en avant, puis les autres par date asc.
  // Les courses passées (date < aujourd'hui) sont exclues : une fois terminée,
  // une course disparaît du bloc Objectif.
  const { mainRace, otherRaces } = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10)
    const upcoming = races
      .filter(r => r.date >= todayISO)
      .sort((a, b) => a.date.localeCompare(b.date))
    const main = upcoming.find(r => r.isMain) ?? null
    const others = upcoming.filter(r => r.id !== main?.id)
    return { mainRace: main, otherRaces: others }
  }, [races])

  if (!loaded) {
    return (
      <BlockCard
        title={L.objectifTitle}
        helpTitle={L.objectifHelpTitle}
        helpBody={L.objectifHelp}
      >
        <RaceCardSkeleton />
      </BlockCard>
    )
  }

  // Aucune course à venir (liste vide OU uniquement des courses passées) → état vide.
  if (!mainRace && otherRaces.length === 0) {
    return (
      <BlockCard
        title={L.objectifTitle}
        helpTitle={L.objectifHelpTitle}
        helpBody={L.objectifHelp}
      >
        <div className="flex flex-col items-center justify-center text-center py-6 px-4">
          <span className="text-[40px] leading-none mb-2" aria-hidden>🎯</span>
          <h3
            className="text-[20px] text-trail-text mb-1"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            {L.objectifEmpty}
          </h3>
          <p className="text-[13px] text-trail-muted mb-4 max-w-xs">
            {L.objectifEmptyHint}
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-2 rounded-[10px] bg-trail-primary text-white text-[14px] font-semibold"
            aria-label={L.objectifFirstAria}
            disabled={!loaded}
          >
            {L.objectifFirstCTA}
          </button>
        </div>
        <RaceEditorModal
          race={editing}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      </BlockCard>
    )
  }

  return (
    <BlockCard
      title={L.objectifTitle}
      helpTitle={L.objectifHelpTitle}
      helpBody={L.objectifHelp}
      rightSlot={
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center w-7 h-7 rounded-[6px] text-[color:var(--trail-primary)] hover:bg-[color:var(--trail-surface)]"
          aria-label={L.objectifAddRaceAria}
        >
          <SquarePen size={16} aria-hidden />
        </button>
      }
    >
      {mainRace && (
        <MainRaceCard race={mainRace} L={L} onSelect={() => openCourseDetail(mainRace)} />
      )}

      {otherRaces.length > 0 && (
        <div className={`flex flex-col gap-2 ${mainRace ? 'mt-3' : ''}`}>
          {otherRaces.map(r => (
            <CompactRaceCard
              key={r.id}
              race={r}
              L={L}
              onSelect={() => openCourseDetail(r)}
            />
          ))}
        </div>
      )}

      <RaceEditorModal
        race={editing}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </BlockCard>
  )
}

function MainRaceCard({ race, L, onSelect }: { race: Race; L: Dict['plan']; onSelect: () => void }) {
  const daysLeft = computeDaysLeft(race.date)
  const isPast = daysLeft < 0
  const typeLabel = L.raceTypes[race.type as RaceType] ?? race.type
  return (
    <button
      type="button"
      onClick={onSelect}
      className="block w-full text-left rounded-[10px] hover:bg-trail-surface/30 transition-colors -mx-1 px-1"
      aria-label={L.raceOpenAria(race.name)}
    >
      <div className="flex items-start justify-between gap-3">
        <h3
          className="text-[22px] leading-tight text-trail-text min-w-0 flex-1 truncate"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          title={race.name}
        >
          {race.name}
        </h3>
        {isPast ? (
          <span className="text-[12px] text-trail-muted whitespace-nowrap flex-shrink-0 mt-1">{L.racePast}</span>
        ) : (
          <div className="flex flex-col items-end leading-none flex-shrink-0">
            <span
              className="text-[28px] leading-none text-trail-text"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              aria-label={L.raceJMinusAria(daysLeft)}
            >
              J-{daysLeft}
            </span>
            <span className="text-[10px] text-trail-muted mt-0.5 whitespace-nowrap">
              {daysLeft === 0 ? L.raceDayToday : daysLeft === 1 ? L.raceDayTomorrow : L.raceDayRemaining}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-2">
        <Pill bg={`${colors.chargeOrange}26`} color={colors.chargeOrange} label={`${race.distance} km`} />
        <Pill bg={`${colors.seriesBlue}26`} color={colors.seriesBlue} label={`${race.elevation} ${L.mDPlus}`} />
        <Pill bg="var(--trail-surface)" color="var(--trail-text)" label={typeLabel} />
        {race.location && (
          <Pill
            bg="var(--trail-surface)"
            color="var(--trail-muted)"
            label={`📍 ${race.location}`}
          />
        )}
      </div>
    </button>
  )
}

function CompactRaceCard({ race, L, onSelect }: { race: Race; L: Dict['plan']; onSelect: () => void }) {
  const daysLeft = computeDaysLeft(race.date)
  const isPast = daysLeft < 0
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border hover:border-trail-primary transition-colors text-left"
      aria-label={L.raceOpenAria(race.name)}
    >
      <RacePriorityChip race={race} L={L} size={24} />
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          className="text-[13px] font-semibold text-trail-text truncate"
          title={race.name}
        >
          {race.name}
        </span>
        {!isPast && (
          <span
            className="text-[14px] leading-none text-trail-text flex-shrink-0"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            aria-label={L.raceJMinusAria(daysLeft)}
          >
            J-{daysLeft}
          </span>
        )}
        <span className="text-[11px] text-trail-muted flex-shrink-0">
          {formatShortDate(race.date, L.monthsShort)}
        </span>
        <span className="text-[11px] text-trail-muted flex-shrink-0">
          · {race.distance} km
        </span>
      </div>
    </button>
  )
}

// Chip uniforme (Trophy pour la course objectif principale, Flag sinon) — mêmes couleurs
// et même style que les pins de RaceMarkers, pour que le bloc « Objectif course » soit
// visuellement cohérent avec le bloc « Structure de prépa ».
function RacePriorityChip({ race, L, size = 28 }: { race: Race; L: Dict['plan']; size?: number }) {
  const isMainGoal = race.priority === 'A' && race.isMain
  const color = PRIORITY_COLOR[race.priority]
  const isB = race.priority === 'B'
  const iconSize = Math.round(size * 0.5)
  return (
    <span
      className={`flex items-center justify-center rounded-[8px] flex-shrink-0 ${isB ? 'text-black' : 'text-white'}`}
      style={{
        width: size,
        height: size,
        background: color,
        boxShadow: '0 2px 6px rgba(0,0,0,0.4), 0 0 0 1.5px var(--trail-card)',
      }}
      aria-label={isMainGoal ? L.raceMainGoalAria : L.racePriorityAria(race.priority)}
    >
      {isMainGoal ? <Trophy size={iconSize} strokeWidth={2.5} /> : <Flag size={iconSize} strokeWidth={2.5} />}
    </span>
  )
}

function Pill({ bg, color, label }: { bg: string; color: string; label: string }) {
  return (
    <span
      className="px-[10px] py-[4px] rounded-full text-[12px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: bg, color }}
    >
      {label}
    </span>
  )
}
