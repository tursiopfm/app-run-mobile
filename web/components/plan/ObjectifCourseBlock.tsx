'use client'

// Bloc Objectif Course : liste multi-races (1 principale + N secondaires).
// La principale s'affiche en grande carte (Bebas Neue + countdown J-XX) ; les
// autres en cartes compactes (1 ligne). CTA "+ Nouvelle course" en bas.
// La data vient de getRaces() (Supabase ou localStorage selon contexte).

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Race, RaceType } from '@/types/plan'
import { getRaces } from '@/lib/plan/storage'
import { colors } from '@/lib/design/colors'
import { BlockCard } from '@/components/blocks/BlockCard'
import { RaceEditorModal } from './RaceEditorModal'
import { RaceCardSkeleton } from './RaceCardSkeleton'

type Props = {
  onChange?: () => void
}

const RACE_TYPE_LABEL: Record<RaceType, string> = {
  trail:   'Trail',
  ultra:   'Ultra',
  route:   'Route',
  cross:   'Cross',
  skyrace: 'Skyrace',
}

function computeDaysLeft(isoDate: string): number {
  // Math.ceil pour qu'une course "aujourd'hui" affiche J-0 et pas J-(-1).
  const target = new Date(isoDate + 'T00:00:00').getTime()
  return Math.ceil((target - Date.now()) / 86_400_000)
}

function formatShortDate(iso: string): string {
  // YYYY-MM-DD → "25 oct."
  if (!iso || iso.length < 10) return iso
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
  const m = parseInt(iso.slice(5, 7), 10) - 1
  const d = parseInt(iso.slice(8, 10), 10)
  if (Number.isNaN(d) || m < 0 || m > 11) return iso
  return `${d} ${months[m]}`
}

export function ObjectifCourseBlock({ onChange }: Props) {
  const [races, setRaces] = useState<Race[]>([])
  const [loaded, setLoaded] = useState(false)
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

  function openEdit(race: Race) {
    setEditing(race)
    setModalOpen(true)
  }

  // Tri : principale en premier, puis les autres par date asc.
  const { mainRace, otherRaces } = useMemo(() => {
    const main = races.find(r => r.isMain) ?? null
    const others = races.filter(r => r.id !== main?.id)
    return { mainRace: main, otherRaces: others }
  }, [races])

  // ── Skeleton anti-flash (chargement en cours) ──
  if (!loaded) {
    return (
      <BlockCard
        title="Objectif course"
        helpTitle="Ton objectif"
        helpBody="Définis la course principale qui structure ta prépa. Tu peux ajouter d'autres courses secondaires en saison."
      >
        <RaceCardSkeleton />
      </BlockCard>
    )
  }

  // ── État vide ──
  if (races.length === 0) {
    return (
      <BlockCard
        title="Objectif course"
        helpTitle="Ton objectif"
        helpBody="Définis la course principale qui structure ta prépa. Tu peux ajouter d'autres courses secondaires en saison."
      >
        <div className="flex flex-col items-center justify-center text-center py-6 px-4">
          <span className="text-[40px] leading-none mb-2" aria-hidden>🎯</span>
          <h3
            className="text-[20px] text-trail-text mb-1"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            Définis ton objectif
          </h3>
          <p className="text-[13px] text-trail-muted mb-4 max-w-xs">
            Ton objectif structure toute ta prépa.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-2 rounded-[10px] bg-trail-primary text-white text-[14px] font-semibold"
            aria-label="Définir mon premier objectif"
            disabled={!loaded}
          >
            + Définir mon premier objectif
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
      title="Objectif course"
      helpTitle="Ton objectif"
      helpBody="Définis la course principale qui structure ta prépa. Tu peux ajouter d'autres courses secondaires en saison."
    >
      {/* Course principale : grande carte */}
      {mainRace && (
        <MainRaceCard race={mainRace} onEdit={() => openEdit(mainRace)} />
      )}

      {/* Cartes compactes pour les autres courses */}
      {otherRaces.length > 0 && (
        <div className={`flex flex-col gap-2 ${mainRace ? 'mt-3' : ''}`}>
          {otherRaces.map(r => (
            <CompactRaceCard
              key={r.id}
              race={r}
              onEdit={() => openEdit(r)}
            />
          ))}
        </div>
      )}

      {/* CTA nouvelle course */}
      <button
        type="button"
        onClick={openCreate}
        className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-[10px] border border-dashed border-trail-border text-trail-muted hover:border-trail-primary hover:text-trail-primary transition-colors text-[13px] font-semibold"
        aria-label="Ajouter une nouvelle course"
      >
        <span className="text-[16px] leading-none">+</span>
        <span>Nouvelle course</span>
      </button>

      <RaceEditorModal
        race={editing}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </BlockCard>
  )
}

// ─── Carte principale (grand format) ───────────────────────────────────────
function MainRaceCard({ race, onEdit }: { race: Race; onEdit: () => void }) {
  const daysLeft = computeDaysLeft(race.date)
  const isPast = daysLeft < 0
  const typeLabel = RACE_TYPE_LABEL[race.type] ?? race.type

  return (
    <div className="relative">
      {/* Bouton Modifier en haut à droite */}
      <button
        type="button"
        onClick={onEdit}
        className="absolute top-0 right-0 px-2 py-1 rounded-[8px] bg-trail-surface border border-trail-border text-trail-muted hover:text-trail-text text-[12px] font-semibold flex items-center gap-1"
        aria-label={`Modifier la course ${race.name}`}
      >
        <span aria-hidden>✏️</span>
        <span>Modifier</span>
      </button>

      <div className="pt-2 pr-[88px]">
        <h3
          className="text-[24px] leading-tight text-trail-text"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          {race.name}
        </h3>
      </div>

      <div className="mt-3">
        {isPast ? (
          <p className="text-[14px] text-trail-muted">Course passée</p>
        ) : (
          <div className="flex items-baseline gap-2">
            <span
              className="text-[48px] leading-none text-trail-primary"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              aria-label={`J moins ${daysLeft} jours`}
            >
              J-{daysLeft}
            </span>
            <span className="text-[13px] text-trail-muted">
              {daysLeft === 0 ? "c'est aujourd'hui" : daysLeft === 1 ? 'demain' : 'jours restants'}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <Pill
          bg={`${colors.chargeOrange}26`}
          color={colors.chargeOrange}
          label={`${race.distance} km`}
        />
        <Pill
          bg={`${colors.seriesBlue}26`}
          color={colors.seriesBlue}
          label={`${race.elevation} m D+`}
        />
        <Pill bg="var(--trail-surface)" color="var(--trail-text)" label={typeLabel} />
        {race.location && (
          <Pill
            bg="var(--trail-surface)"
            color="var(--trail-muted)"
            label={`📍 ${race.location}`}
          />
        )}
        <span
          className="px-[10px] py-[4px] rounded-full text-[11px] font-bold whitespace-nowrap"
          style={{ backgroundColor: `${colors.chargeOrange}26`, color: colors.chargeOrange }}
        >
          Principal
        </span>
      </div>
    </div>
  )
}

// ─── Carte compacte (1 ligne, courses secondaires/archivées) ───────────────
function CompactRaceCard({ race, onEdit }: { race: Race; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          className="text-[13px] font-semibold text-trail-text truncate"
          title={race.name}
        >
          {race.name}
        </span>
        <span className="text-[11px] text-trail-muted flex-shrink-0">
          {formatShortDate(race.date)}
        </span>
        <span className="text-[11px] text-trail-muted flex-shrink-0">
          · {race.distance} km
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className="px-2 py-[2px] rounded-full text-[10px] font-bold whitespace-nowrap"
          style={{
            backgroundColor: 'var(--trail-card)',
            color: 'var(--trail-muted)',
          }}
        >
          Secondaire
        </span>
        <button
          type="button"
          onClick={onEdit}
          className="px-2 py-1 rounded-[8px] bg-trail-card border border-trail-border text-trail-muted hover:text-trail-text text-[11px] font-semibold flex items-center gap-1"
          aria-label={`Modifier la course ${race.name}`}
        >
          <span aria-hidden>✏️</span>
          <span className="hidden sm:inline">Modifier</span>
        </button>
      </div>
    </div>
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
