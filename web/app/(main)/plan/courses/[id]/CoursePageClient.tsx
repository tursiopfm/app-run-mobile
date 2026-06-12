'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Race, RaceTableauMeta, RaceWaypoint } from '@/types/plan'
import { getRaces, deleteRace, peekRaces, saveRace } from '@/lib/plan/storage'
import { RaceEditorModal } from '@/components/plan/RaceEditorModal'
import { WaypointsTable } from '@/components/plan/WaypointsTable'
import { TableActionsMenu } from '@/components/plan/TableActionsMenu'
import { PacingStrategyCard } from '@/components/plan/PacingStrategyCard'
import { RaceImportSheet } from '@/components/plan/RaceImportSheet'
import { TableauDiffModal } from '@/components/plan/TableauDiffModal'
import { TimeEditModal } from '@/components/plan/TimeEditModal'
import { colors } from '@/lib/design/colors'

const pad2 = (n: number) => String(n).padStart(2, '0')

// Heure de départ « HH:MM » → [heures, minutes] (défaut 08:00 si absent).
function parseStartClock(s?: string): [number, number] {
  const m = /^(\d{1,2}):(\d{2})/.exec(s ?? '')
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : [8, 0]
}

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
  const [meta, setMeta] = useState<RaceTableauMeta | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [autoSearch, setAutoSearch] = useState(false)
  const [diffOpen, setDiffOpen] = useState(false)
  const [diffBusy, setDiffBusy] = useState(false)
  const [editLines, setEditLines] = useState(false)
  const [editField, setEditField] = useState<null | 'objective' | 'start'>(null)

  // Arrivée depuis « Oui, chercher » à la création (RaceEditorModal) :
  // ?import=auto → on ouvre la feuille sur l'onglet Auto et on lance la recherche.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('import') === 'auto') {
      setImportOpen(true)
      setAutoSearch(true)
      router.replace(`/plan/courses/${raceId}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const pacingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handlePacingChange = useCallback(
    (fade: number) => {
      if (!race) return
      const next = { ...race, pacingFade: fade }
      setRace(next)
      if (pacingTimer.current) clearTimeout(pacingTimer.current)
      pacingTimer.current = setTimeout(() => { void saveRace(next) }, 600)
    },
    [race],
  )

  // Export du tableau : ouvre la page /print (hub d'export) où l'utilisateur
  // personnalise les colonnes puis choisit PDF / Image / Partager.
  const handleExport = useCallback(() => {
    window.open(`/plan/courses/${raceId}/print`, '_blank', 'noopener,noreferrer')
  }, [raceId])

  const reload = useCallback(async () => {
    const list = await getRaces()
    setRace(list.find(r => r.id === raceId) ?? null)
    setLoaded(true)
    const wpsRes = await fetch(`/api/races/${raceId}/waypoints`)
    if (wpsRes.ok) {
      const body = await wpsRes.json()
      setWaypoints(body.waypoints ?? [])
      setMeta(body.meta ?? null)
    }
  }, [raceId])

  useEffect(() => { void reload() }, [reload])

  async function resolveDiff(action: 'apply' | 'dismiss') {
    setDiffBusy(true)
    try {
      await fetch(`/api/races/${raceId}/tableau-recheck`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
      })
      setDiffOpen(false)
      await reload()
    } finally {
      setDiffBusy(false)
    }
  }

  // Heure de départ éditée depuis la cellule BH du départ : maj optimiste + save Race.
  const handleStartTimeChange = useCallback(async (hhmm: string | null) => {
    if (!race) return
    const next = { ...race, startTime: hhmm ?? undefined }
    setRace(next)
    await saveRace(next)
  }, [race])

  // Pop-ups indépendantes : objectif (temps visé) et heure de départ.
  const saveObjective = useCallback(async (h: number, m: number) => {
    const min = h * 60 + m
    if (min <= 0 || !race) return
    const next = { ...race, targetDurationMin: min }
    setRace(next)
    await saveRace(next)
  }, [race])

  const saveStart = useCallback(async (h: number, m: number) => {
    if (!race) return
    const next = { ...race, startTime: `${pad2(h)}:${pad2(m)}` }
    setRace(next)
    await saveRace(next)
  }, [race])

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
      </div>

      <div className="rounded-[12px] bg-trail-card border border-trail-border p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h1
            className="text-display leading-tight text-trail-text"
            style={{ fontFamily: "var(--font-data)" }}
          >
            {race.name}
          </h1>
          <TableActionsMenu
            hasTableau={waypoints.length > 0}
            onEditRace={() => setEditorOpen(true)}
            onEditLines={() => setEditLines((v) => !v)}
            onReimport={() => setImportOpen(true)}
            onExport={handleExport}
          />
        </div>
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

      <Section
        title="Tableau de course"
        titleClassName="text-h2 font-semibold text-trail-text font-display"
        action={waypoints.length > 0 ? (
          <TableActionsMenu
            showEditRace={false}
            label="Actions du tableau"
            onEditLines={() => setEditLines((v) => !v)}
            onReimport={() => setImportOpen(true)}
            onExport={handleExport}
          />
        ) : undefined}
      >
        {waypoints.length === 0 ? (
          <button type="button" onClick={() => setImportOpen(true)}
            className="text-caption text-trail-primary underline">
            Importer le tableau (URL / PDF / Image / Texte)
          </button>
        ) : (
          <>
            {meta?.pendingDiff && (
              <button type="button" onClick={() => setDiffOpen(true)}
                className="w-full text-left mb-2 rounded-[10px] border px-3 py-2 text-body-sm"
                style={{ borderColor: '#EAB308', background: '#EAB30815', color: '#EAB308' }}>
                {meta.pendingDiff.kind === 'new_edition'
                  ? `✨ Nouvelle édition ${meta.pendingDiff.newMeta.editionYear ?? ''} disponible`
                  : `⚠️ Le tableau a changé — ${meta.pendingDiff.summary.added} ajout(s) · ${meta.pendingDiff.summary.removed} retrait(s) · ${meta.pendingDiff.summary.modified} modif(s)`}
                <span className="block text-caption text-trail-muted">Touche pour vérifier et valider.</span>
              </button>
            )}
            {race.targetDurationMin != null ? (
              <PacingStrategyCard
                waypoints={waypoints.map(({ km, dPlus, targetOverrideSec }) => ({ km, dPlus, targetOverrideSec }))}
                targetDurationMin={race.targetDurationMin}
                startTime={race.startTime}
                pacingFade={race.pacingFade ?? 0}
                onChange={handlePacingChange}
                onEditObjective={() => setEditField('objective')}
                onEditStart={() => setEditField('start')}
              />
            ) : (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-[10px] bg-trail-surface border border-trail-border px-3 py-2">
                <span className="text-caption text-trail-muted min-w-0">Objectif non défini — règle ton temps cible pour calculer les heures de passage.</span>
                <button
                  type="button"
                  onClick={() => setEditField('objective')}
                  className="text-caption text-trail-primary font-semibold whitespace-nowrap underline"
                >
                  Définir l&apos;objectif
                </button>
              </div>
            )}
            <WaypointsTable
              waypoints={waypoints.map(({ id: _id, raceId: _rid, ...rest }) => rest)}
              onChange={handleWaypointsChange}
              startTime={race.startTime}
              targetDurationMin={race.targetDurationMin}
              pacingFade={race.pacingFade}
              onStartTimeChange={handleStartTimeChange}
              editLines={editLines}
              onEditLinesChange={setEditLines}
            />
          </>
        )}
      </Section>

      <Section title="Profil de la course">
        <div className="h-[120px] rounded-[8px] bg-trail-surface border border-dashed border-trail-border flex items-center justify-center">
          <p className="text-caption text-trail-muted">Profil dénivelé — bientôt</p>
        </div>
      </Section>

      <Section title="Site web">
        <WebsiteBlock race={race} onChange={setRace} />
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
        autoSearch={autoSearch}
        open={importOpen}
        onClose={() => { setImportOpen(false); setAutoSearch(false) }}
        onSaved={(wps) => { setWaypoints(wps); setImportOpen(false) }}
      />
      <RaceEditorModal
        race={race}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={() => { setEditorOpen(false); void reload() }}
        onDeleted={() => router.push('/plan')}
      />
      {meta?.pendingDiff && diffOpen && (
        <TableauDiffModal
          currentWaypoints={waypoints.map(({ id: _i, raceId: _r, ...rest }) => rest)}
          pendingDiff={meta.pendingDiff}
          busy={diffBusy}
          onApply={() => resolveDiff('apply')}
          onDismiss={() => resolveDiff('dismiss')}
          onClose={() => setDiffOpen(false)}
        />
      )}
      <TimeEditModal
        open={editField === 'objective'}
        title="Objectif (temps visé)"
        hours={race.targetDurationMin != null ? Math.floor(race.targetDurationMin / 60) : 0}
        minutes={race.targetDurationMin != null ? race.targetDurationMin % 60 : 0}
        maxHours={99}
        hint="Heures : minutes (ex. 35 : 00)"
        onSave={saveObjective}
        onClose={() => setEditField(null)}
      />
      <TimeEditModal
        open={editField === 'start'}
        title="Heure de départ"
        hours={parseStartClock(race.startTime)[0]}
        minutes={parseStartClock(race.startTime)[1]}
        maxHours={23}
        hint="Heure de départ (ex. 19 : 00)"
        onSave={saveStart}
        onClose={() => setEditField(null)}
      />
    </div>
  )
}

function Section({ title, titleClassName, action, children }: { title: string; titleClassName?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className={titleClassName ?? 'text-body font-semibold text-trail-muted font-display'}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function WebsiteBlock({ race, onChange }: { race: Race; onChange: (r: Race) => void }) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState(race.websiteUrl ?? '')
  const [searching, setSearching] = useState(false)

  // Re-sync si l'URL change en fond (fire-and-forget post-création → reload parent).
  useEffect(() => { setInput(race.websiteUrl ?? '') }, [race.websiteUrl])

  function normalize(raw: string): string {
    const v = raw.trim()
    if (!v) return ''
    return /^https?:\/\//i.test(v) ? v : `https://${v}`
  }

  async function persist(url: string) {
    const next = { ...race, websiteUrl: url || undefined }
    onChange(next)
    await saveRace(next)
  }

  async function handleSaveInput() {
    const url = normalize(input)
    setInput(url)
    setEditing(false)
    await persist(url)
  }

  async function handleSearch() {
    setSearching(true)
    try {
      const res = await fetch('/api/race-import/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: race.name, date: race.date }),
      })
      if (res.ok) {
        const { url } = (await res.json()) as { url: string | null }
        if (url) await persist(url)
      }
    } finally {
      setSearching(false)
    }
  }

  if (race.websiteUrl && !editing) {
    return (
      <div className="flex items-center justify-between gap-2">
        <a
          href={race.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-body-sm text-trail-primary underline truncate"
        >
          {race.websiteUrl.replace(/^https?:\/\//, '')}
        </a>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-caption text-trail-muted hover:text-trail-text shrink-0"
        >
          Modifier
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <input
        type="url"
        inputMode="url"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="https://…"
        className="w-full px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-body focus:outline-none focus:border-trail-primary"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSaveInput}
          className="px-3 py-1.5 rounded-[10px] bg-trail-primary text-white text-caption font-semibold"
        >
          Enregistrer
        </button>
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          className="px-3 py-1.5 rounded-[10px] border border-trail-border text-trail-text text-caption font-semibold disabled:opacity-50"
        >
          {searching ? 'Recherche…' : 'Rechercher le site'}
        </button>
      </div>
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
