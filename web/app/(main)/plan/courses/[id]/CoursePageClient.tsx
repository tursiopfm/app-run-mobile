'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Race } from '@/types/plan'
import { getRaces, deleteRace, peekRaces } from '@/lib/plan/storage'
import { RaceEditorModal } from '@/components/plan/RaceEditorModal'
import { EditButton } from '@/components/plan/EditButton'
import { WaypointsTable } from '@/components/plan/WaypointsTable'
import { RaceImportSheet } from '@/components/plan/RaceImportSheet'
import type { RaceWaypoint } from '@/types/plan'
import { colors } from '@/lib/design/colors'

function formatLongDate(iso: string): string {
  if (!iso || iso.length < 10) return iso
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
  const y = iso.slice(0, 4)
  const m = parseInt(iso.slice(5, 7), 10) - 1
  const d = parseInt(iso.slice(8, 10), 10)
  if (Number.isNaN(d) || m < 0 || m > 11) return iso
  return `${d} ${months[m]} ${y}`
}

export function CoursePageClient({ raceId }: { raceId: string }) {
  const router = useRouter()
  // Lazy-init depuis le snapshot LS (visite précédente) — supprime le flash.
  const initial = peekRaces()
  const [race, setRace] = useState<Race | null>(
    initial ? initial.find(r => r.id === raceId) ?? null : null,
  )
  const [loaded, setLoaded] = useState(initial !== null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [waypoints, setWaypoints] = useState<RaceWaypoint[]>([])
  const [importOpen, setImportOpen] = useState(false)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleWaypointsChange = useCallback(
    (next: Array<Omit<RaceWaypoint, 'id' | 'raceId'>>) => {
      setWaypoints(next.map((w, i) => ({ ...w, id: waypoints[i]?.id ?? `tmp-${i}`, raceId })))
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        void fetch(`/api/races/${raceId}/waypoints`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ waypoints: next }),
        })
      }, 600)
    },
    [raceId, waypoints],
  )

  const reload = useCallback(async () => {
    const list = await getRaces()
    setRace(list.find(r => r.id === raceId) ?? null)
    setLoaded(true)
    const wpsRes = await fetch(`/api/races/${raceId}/waypoints`)
    if (wpsRes.ok) {
      const body = await wpsRes.json()
      setWaypoints(body.waypoints ?? [])
    }
  }, [raceId])

  useEffect(() => { void reload() }, [reload])

  async function handleDelete() {
    if (!race || deleting) return
    if (typeof window !== 'undefined' && !window.confirm(`Supprimer la course "${race.name}" ?`)) return
    setDeleting(true)
    try {
      await deleteRace(race.id)
      router.push('/plan')
    } finally {
      setDeleting(false)
    }
  }

  if (!loaded) {
    return (
      <div className="px-3 py-3 max-w-lg md:max-w-4xl mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="h-[28px] w-[60%] rounded bg-trail-surface" />
          <div className="h-[14px] w-[40%] rounded bg-trail-surface" />
          <div className="h-[120px] rounded-[12px] bg-trail-surface" />
        </div>
      </div>
    )
  }

  if (!race) {
    return (
      <div className="px-3 py-6 max-w-lg md:max-w-4xl mx-auto text-center">
        <p className="text-trail-muted text-body">Course introuvable.</p>
        <button
          type="button"
          onClick={() => router.push('/plan')}
          className="mt-3 text-trail-primary text-body-sm font-semibold underline"
        >
          Retour au plan
        </button>
      </div>
    )
  }

  return (
    <div className="px-3 py-3 max-w-lg md:max-w-4xl mx-auto space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-body-sm text-trail-muted hover:text-trail-text"
          aria-label="Retour"
        >
          ← Retour
        </button>
        <EditButton onClick={() => setEditorOpen(true)} />
      </div>

      <div className="rounded-[12px] bg-trail-card border border-trail-border p-4 space-y-2">
        <h1
          className="text-display leading-tight text-trail-text"
          style={{ fontFamily: "var(--font-data)" }}
        >
          {race.name}
        </h1>
        <p className="text-body-sm text-trail-muted">
          {formatLongDate(race.date)}{race.location ? ` — ${race.location}` : ''}
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <Pill bg={`${colors.chargeOrange}26`} color={colors.chargeOrange} label={`${race.distance} km`} />
          <Pill bg={`${colors.seriesBlue}26`} color={colors.seriesBlue} label={`${race.elevation} m D+`} />
          <Pill bg="var(--trail-surface)" color="var(--trail-text)" label={race.type} />
          {race.isMain && (
            <span
              className="px-[10px] py-[4px] rounded-full text-micro font-bold whitespace-nowrap"
              style={{ backgroundColor: `${colors.chargeOrange}26`, color: colors.chargeOrange }}
            >
              Principale
            </span>
          )}
        </div>
      </div>

      <Section title="Tableau de course">
        {waypoints.length === 0 ? (
          <button type="button" onClick={() => setImportOpen(true)}
            className="text-caption text-trail-primary underline">
            Importer le tableau (URL / PDF / Image / Texte)
          </button>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between gap-3 rounded-[10px] bg-trail-surface border border-trail-border px-3 py-2">
              <div className="text-caption min-w-0">
                {race.startTime && race.targetDurationMin != null ? (
                  <span className="text-trail-text">
                    ⏱ Objectif <b>{Math.floor(race.targetDurationMin / 60)}h{String(race.targetDurationMin % 60).padStart(2, '0')}</b>
                    <span className="text-trail-muted"> · Départ {race.startTime}</span>
                  </span>
                ) : (
                  <span className="text-trail-muted">Objectif non défini — renseigne départ + temps cible pour calculer les heures de passage.</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(true)}
                className="text-caption text-trail-primary font-semibold whitespace-nowrap underline"
              >
                {race.startTime && race.targetDurationMin != null ? 'Modifier' : "Définir l'objectif"}
              </button>
            </div>
            <WaypointsTable
              waypoints={waypoints.map(({ id: _id, raceId: _rid, ...rest }) => rest)}
              onChange={handleWaypointsChange}
              startTime={race.startTime}
              targetDurationMin={race.targetDurationMin}
              pacingFade={race.pacingFade}
            />
            <div className="mt-2 flex items-center gap-4">
              <a href={`/plan/courses/${raceId}/print`} target="_blank" rel="noopener noreferrer"
                className="text-caption text-trail-primary underline">
                Exporter en PDF
              </a>
              <button type="button" onClick={() => setImportOpen(true)}
                className="text-caption text-trail-muted underline">
                Ré-importer
              </button>
            </div>
          </>
        )}
      </Section>

      <Section title="Profil de la course">
        <div className="h-[120px] rounded-[8px] bg-trail-surface border border-dashed border-trail-border flex items-center justify-center">
          <p className="text-caption text-trail-muted">Profil dénivelé — bientôt</p>
        </div>
      </Section>

      <Section title="Site web">
        <p className="text-caption text-trail-muted">Bientôt — lien officiel de la course.</p>
      </Section>

      <Section title="Notes">
        {race.notes
          ? <p className="text-body-sm text-trail-text whitespace-pre-wrap">{race.notes}</p>
          : <p className="text-caption text-trail-muted italic">Aucune note.</p>}
      </Section>

      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="w-full mt-4 px-4 py-2 rounded-[10px] border border-trail-danger/40 text-trail-danger text-body-sm font-semibold disabled:opacity-50"
      >
        {deleting ? 'Suppression…' : 'Supprimer cette course'}
      </button>

      <RaceImportSheet
        raceId={race.id}
        race={{ name: race.name, date: race.date, distance: race.distance, elevation: race.elevation }}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSaved={(wps) => { setWaypoints(wps); setImportOpen(false) }}
      />
      <RaceEditorModal
        race={race}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={() => { setEditorOpen(false); void reload() }}
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-4">
      <h2 className="text-body font-semibold text-trail-muted mb-2 font-display">{title}</h2>
      {children}
    </div>
  )
}

function Pill({ bg, color, label }: { bg: string; color: string; label: string }) {
  return (
    <span
      className="px-[10px] py-[4px] rounded-full text-caption font-semibold whitespace-nowrap"
      style={{ backgroundColor: bg, color }}
    >
      {label}
    </span>
  )
}
