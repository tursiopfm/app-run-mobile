'use client'

// Bloc Objectif Course : affiche la course principale (Bebas Neue + countdown J-XX)
// ou un CTA "Définis ton objectif" si rien n'est défini.
// La data vient de getRace() (Supabase ou localStorage selon contexte).

import { useCallback, useEffect, useState } from 'react'
import type { Race, RaceType } from '@/types/plan'
import { getRace } from '@/lib/plan/storage'
import { colors } from '@/lib/design/colors'
import { RaceEditorModal } from './RaceEditorModal'

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

export function ObjectifCourseBlock({ onChange }: Props) {
  const [race, setRace] = useState<Race | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const reload = useCallback(async () => {
    const r = await getRace()
    setRace(r)
    setLoaded(true)
  }, [])

  useEffect(() => { void reload() }, [reload])

  function handleSaved() {
    void reload()
    onChange?.()
  }

  // État vide ou en cours de chargement (on rend le CTA même pendant le load
  // pour éviter un flash visuel ; getRace est généralement rapide).
  if (!race) {
    return (
      <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]">
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
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 rounded-[10px] bg-trail-primary text-white text-[14px] font-semibold"
            aria-label="Définir mon objectif"
            disabled={!loaded /* évite un double-click avant que la modal ait sa race=null */}
          >
            Définir mon objectif
          </button>
        </div>
        <RaceEditorModal
          race={null}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      </div>
    )
  }

  const daysLeft = computeDaysLeft(race.date)
  const isPast   = daysLeft < 0
  const typeLabel = RACE_TYPE_LABEL[race.type] ?? race.type

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[10px] relative">
      {/* Bouton Modifier en haut à droite */}
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="absolute top-2 right-2 px-2 py-1 rounded-[8px] bg-trail-surface border border-trail-border text-trail-muted hover:text-trail-text text-[12px] font-semibold flex items-center gap-1"
        aria-label="Modifier la course"
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
      </div>

      <RaceEditorModal
        race={race}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
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
