'use client'

// Bottom-sheet d'import du tableau de course : 4 onglets (URL / PDF / Image / Texte).
// Pattern portal aligné sur RaceEditorModal / SessionAddSheet.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ExtractedRaceData, RaceWaypoint } from '@/types/plan'
import { WaypointsTable } from './WaypointsTable'

type Tab = 'url' | 'pdf' | 'image' | 'text'

type Props = {
  raceId: string
  open: boolean
  onClose: () => void
  onSaved: (waypoints: RaceWaypoint[]) => void
}

type Status = 'idle' | 'extracting' | 'preview' | 'saving' | 'error'

export function RaceImportSheet({ raceId, open, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<Tab>('url')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [draft, setDraft] = useState<ExtractedRaceData['waypoints']>([])

  useEffect(() => {
    if (!open) return
    setTab('url'); setStatus('idle'); setError(null)
    setUrl(''); setText(''); setPdfFile(null); setImageFile(null); setDraft([])
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

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
      setDraft(body.data.waypoints)
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
        body: JSON.stringify({ waypoints: draft }),
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
          <h2 className="text-[16px] font-semibold">Importer le tableau de course</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-trail-muted">×</button>
        </div>

        {status !== 'preview' && (
          <>
            <div className="flex gap-2 text-[12px]">
              {(['url', 'pdf', 'image', 'text'] as const).map((t) => (
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

            {tab === 'url' && (
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full p-2 rounded bg-trail-surface text-[13px]"
              />
            )}
            {tab === 'text' && (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                placeholder="Colle le tableau ici..."
                className="w-full p-2 rounded bg-trail-surface text-[13px]"
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

            <button
              type="button"
              onClick={extract}
              disabled={status === 'extracting'}
              className="w-full py-2 rounded bg-trail-primary text-white text-[13px] font-semibold disabled:opacity-50"
            >
              {status === 'extracting' ? 'Extraction…' : 'Extraire'}
            </button>
          </>
        )}

        {status === 'preview' && (
          <>
            <p className="text-[12px] text-trail-muted">
              Vérifie les chiffres, corrige ce qui doit l&apos;être, puis sauvegarde.
            </p>
            <WaypointsTable
              waypoints={draft}
              onChange={(next) => setDraft(next)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setStatus('idle'); setDraft([]) }}
                className="flex-1 py-2 rounded border border-trail-border text-[13px]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={save}
                disabled={(status as string) === 'saving' || draft.length === 0}
                className="flex-1 py-2 rounded bg-trail-primary text-white text-[13px] font-semibold disabled:opacity-50"
              >
                {(status as string) === 'saving' ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
            </div>
          </>
        )}

        {error && (
          <div className="text-[12px] text-trail-danger">
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
