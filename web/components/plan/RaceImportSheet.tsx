'use client'

// Bottom-sheet d'import du tableau de course : 5 onglets (Auto / URL / PDF / Image / Texte).
// Pattern portal aligné sur RaceEditorModal / SessionAddSheet.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ExtractedRaceData, RaceWaypoint } from '@/types/plan'
import type { RaceCandidate } from '@/lib/race-import/find-race'
import { WaypointsTable } from './WaypointsTable'
import { computeFreshness } from '@/lib/race-import/freshness'

type Tab = 'auto' | 'url' | 'pdf' | 'image' | 'text'

type Props = {
  raceId: string
  race: { name: string; date: string; distance: number; elevation: number }
  autoSearch?: boolean
  open: boolean
  onClose: () => void
  onSaved: (waypoints: RaceWaypoint[]) => void
}

type Status = 'idle' | 'extracting' | 'preview' | 'saving' | 'error'

export function RaceImportSheet({ raceId, race, autoSearch, open, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<Tab>('auto')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [draft, setDraft] = useState<ExtractedRaceData['waypoints']>([])
  const [candidates, setCandidates] = useState<RaceCandidate[]>([])
  const [finding, setFinding] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [findError, setFindError] = useState<string | null>(null)
  const [detected, setDetected] = useState<{
    editionYear: number | null
    editionDate: string | null
    dateExplicit: boolean
    startDayOfMonth: number | null
    sourceUrl: string | null
  } | null>(null)

  useEffect(() => {
    if (!open) return
    setTab('auto'); setStatus('idle'); setError(null)
    setUrl(''); setText(''); setPdfFile(null); setImageFile(null); setDraft([])
    setCandidates([]); setFinding(false); setShowAll(false); setFindError(null)
    setDetected(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Ouverture en mode « auto » (depuis la création de course) : on lance la
  // recherche directement. L'effet de reset (défini plus haut, sur `open`) a déjà
  // remis l'onglet sur 'auto' et vidé les candidats. findRace est une fonction
  // déclarée (hoistée) → appelable ici bien que définie plus bas.
  useEffect(() => {
    if (open && autoSearch) void findRace()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoSearch])

  if (!open) return null

  async function findRace() {
    setFinding(true); setFindError(null); setShowAll(false)
    try {
      const res = await fetch('/api/race-import/find', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: race.name, date: race.date, distance: race.distance, elevation: race.elevation,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erreur recherche')
      if (!body.candidates || body.candidates.length === 0) {
        throw new Error('Course introuvable automatiquement — utilise URL / PDF / Image.')
      }
      setCandidates(body.candidates as RaceCandidate[])
    } catch (err) {
      setFindError((err as Error).message)
    } finally {
      setFinding(false)
    }
  }

  function importCandidate(c: RaceCandidate) {
    setDraft(c.waypoints)
    setDetected({
      editionYear: c.editionYear ?? null,
      editionDate: c.editionDate ?? null,
      dateExplicit: c.dateExplicit ?? false,
      startDayOfMonth: c.startDayOfMonth ?? null,
      sourceUrl: c.url,
    })
    setStatus('preview')
  }

  async function extract() {
    setStatus('extracting'); setError(null)
    try {
      let res: Response
      if (tab === 'pdf' || tab === 'image') {
        const file = tab === 'pdf' ? pdfFile : imageFile
        if (!file) throw new Error('Fichier requis')
        const form = new FormData()
        form.append('source', tab)
        form.append('file', file)
        res = await fetch('/api/race-import', { method: 'POST', body: form })
      } else {
        res = await fetch('/api/race-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: tab, url, text }),
        })
      }
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erreur extraction')
      const d = body.data as ExtractedRaceData
      setDraft(d.waypoints)
      setDetected({
        editionYear: d.editionYear,
        editionDate: d.editionDate,
        dateExplicit: d.dateExplicit,
        startDayOfMonth: d.startDayOfMonth,
        sourceUrl: tab === 'url' ? url : null,
      })
      setStatus('preview')
    } catch (err) {
      setError((err as Error).message)
      setStatus('error')
    }
  }

  async function save() {
    setStatus('saving'); setError(null)
    try {
      const res = await fetch(`/api/races/${raceId}/waypoints`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waypoints: draft,
          meta: detected ? {
            editionYear: detected.editionYear,
            editionDate: detected.editionDate,
            dateExplicit: detected.dateExplicit,
            startDayOfMonth: detected.startDayOfMonth,
            sourceUrl: detected.sourceUrl,
          } : undefined,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erreur sauvegarde')
      onSaved(body.waypoints)
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setStatus('error')
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
      aria-modal="true" role="dialog"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-[16px] bg-trail-card border-t border-trail-border p-4 space-y-3"
      >
        <div className="flex justify-between items-center">
          <h2 className="font-display text-[16px] font-semibold">Importer le tableau de course</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-trail-muted">×</button>
        </div>

        {status !== 'preview' && (
          <>
            <div className="flex gap-2 text-caption">
              {(['auto', 'url', 'pdf', 'image', 'text'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`px-3 py-1 rounded-full ${
                    tab === t
                      ? 'bg-trail-primary text-white'
                      : 'bg-trail-surface text-trail-muted'
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>

            {tab === 'auto' && (
              <div className="space-y-3">
                <div className="text-caption text-trail-muted">
                  Recherche d&apos;après ta fiche : <b className="text-trail-text">{race.name}</b>
                  {' · '}{race.distance} km · {race.elevation} D+ · {race.date.slice(0, 4)}
                </div>
                {candidates.length === 0 ? (
                  <button type="button" onClick={findRace} disabled={finding}
                    className="w-full py-2 rounded bg-trail-primary text-white text-body-sm font-semibold disabled:opacity-50">
                    {finding ? 'Recherche…' : 'Trouver ma course'}
                  </button>
                ) : (
                  <div className="space-y-2">
                    {(showAll ? candidates : candidates.slice(0, 1)).map((c) => (
                      <div key={c.url} className="rounded-[10px] border border-trail-border p-3 space-y-2">
                        <div className="font-display font-semibold text-body-sm">{c.raceName ?? race.name}</div>
                        <div className="text-caption text-trail-muted">
                          {c.totalKm.toFixed(1)} km · {c.totalDplus ?? '—'} D+ · {c.nbPoints} pts{' '}
                          <span style={{ color: c.confident ? '#16A34A' : '#B45309', fontWeight: 600 }}>
                            {c.confident ? '✓ correspond à tes chiffres' : 'à vérifier'}
                          </span>
                        </div>
                        <button type="button" onClick={() => importCandidate(c)}
                          className="w-full py-1.5 rounded bg-trail-primary text-white text-caption font-semibold">
                          Importer
                        </button>
                      </div>
                    ))}
                    {!showAll && candidates.length > 1 && (
                      <button type="button" onClick={() => setShowAll(true)}
                        className="text-caption text-trail-primary underline">
                        Voir les autres résultats ({candidates.length - 1})
                      </button>
                    )}
                    <button type="button" onClick={() => { setCandidates([]); setShowAll(false) }}
                      className="block text-caption text-trail-muted underline">
                      Relancer une recherche
                    </button>
                  </div>
                )}
                {findError && <div className="text-caption text-trail-danger">{findError}</div>}
              </div>
            )}
            {tab === 'url' && (
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full p-2 rounded bg-trail-surface text-body-sm"
              />
            )}
            {tab === 'text' && (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                placeholder="Colle le tableau ici..."
                className="w-full p-2 rounded bg-trail-surface text-body-sm"
              />
            )}
            {tab === 'pdf' && (
              <input
                type="file" accept="application/pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              />
            )}
            {tab === 'image' && (
              <input
                type="file" accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              />
            )}

            {tab !== 'auto' && (
              <button
                type="button"
                onClick={extract}
                disabled={status === 'extracting'}
                className="w-full py-2 rounded bg-trail-primary text-white text-body-sm font-semibold disabled:opacity-50"
              >
                {status === 'extracting' ? 'Extraction…' : 'Extraire'}
              </button>
            )}
          </>
        )}

        {status === 'preview' && (
          <>
            <p className="text-caption text-trail-muted">
              Vérifie les chiffres, corrige ce qui doit l&apos;être, puis sauvegarde.
            </p>
            {detected && draft.length > 0 && (() => {
              const fresh = computeFreshness(
                { editionYear: detected.editionYear, editionDate: detected.editionDate,
                  dateExplicit: detected.dateExplicit, startDayOfMonth: detected.startDayOfMonth },
                race.date,
              )
              const badge = fresh.freshnessStatus === 'confirmed'
                ? { icon: '✅', text: `Confirmé édition ${fresh.editionYear ?? '?'}` }
                : fresh.freshnessStatus === 'provisional_previous_edition'
                ? { icon: '⚠️', text: `Provisoire — édition ${fresh.editionYear ?? '?'}` }
                : { icon: '❔', text: 'Édition non identifiée — vérifiez' }
              return (
                <div className="flex items-center gap-2 mb-2 text-body-sm">
                  <span>{badge.icon} {badge.text}</span>
                  <label className="ml-auto flex items-center gap-1 text-caption text-trail-muted">
                    Année
                    <input
                      type="number" inputMode="numeric"
                      value={detected.editionYear ?? ''}
                      onChange={(e) => setDetected({ ...detected, editionYear: Number(e.target.value) || null, editionDate: null })}
                      className="w-16 px-2 py-1 rounded-[8px] bg-trail-surface border border-trail-border text-trail-text text-center"
                    />
                  </label>
                </div>
              )
            })()}
            <WaypointsTable
              waypoints={draft}
              onChange={(next) => setDraft(next)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setStatus('idle'); setDraft([]) }}
                className="flex-1 py-2 rounded border border-trail-border text-body-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={save}
                disabled={(status as string) === 'saving' || draft.length === 0}
                className="flex-1 py-2 rounded bg-trail-primary text-white text-body-sm font-semibold disabled:opacity-50"
              >
                {(status as string) === 'saving' ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
            </div>
          </>
        )}

        {error && (
          <div className="text-caption text-trail-danger">
            {error}
            <button
              type="button"
              onClick={() => { setError(null); setStatus('idle') }}
              className="ml-2 underline"
            >
              Réessayer
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
