'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Upload, CheckCircle2, AlertTriangle, Loader2, Sparkles } from 'lucide-react'
import { extractSummaries } from '@/lib/garmin-import/unzip'
import { garminSummaryToMapped } from '@/lib/garmin-import/mapper'
import { classifyActivities } from '@/lib/garmin-import/dedup'
import type {
  GarminMapped,
  ConflictItem,
  ExistingActivity,
  ImportReport,
  MapWarning,
} from '@/lib/garmin-import/types'
import { ConflictResolution } from './ConflictResolution'
import { forEachFit } from '@/lib/garmin-import/nested-unzip'
import { buildActivityIndex, matchFit } from '@/lib/garmin-import/fit-match'
import { createFitPool } from '@/lib/garmin-import/fit-pool'
import { packStreamsClient } from '@/lib/garmin-import/stream-pack'
import { streamsToPolyline, streamsToSplits } from '@/lib/garmin-import/fit-derive'
import { createClient as createSupabaseBrowser } from '@/lib/database/supabase-client'
import type { EnrichCandidate, StreamUpload, EnrichReport } from '@/lib/garmin-import/enrich-types'
import { EnrichmentStep } from './EnrichmentStep'

type State = 'intro' | 'parsing' | 'resolve' | 'committing' | 'done' | 'enriching' | 'enriched' | 'error'

export function GarminImportFlow() {
  const router = useRouter()
  const [state, setState] = useState<State>('intro')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [commitProgress, setCommitProgress] = useState({ done: 0, total: 0 })
  const [nouvelles, setNouvelles] = useState<GarminMapped[]>([])
  const [conflits, setConflits] = useState<ConflictItem[]>([])
  const [report, setReport] = useState<ImportReport | null>(null)
  const [warnings, setWarnings] = useState<MapWarning[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const enrichInputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<File | null>(null)
  const [enrichProgress, setEnrichProgress] = useState({ matched: 0, total: 0, scanned: 0 })
  const [enrichReport, setEnrichReport] = useState<EnrichReport | null>(null)

  useEffect(() => {
    const busy = state === 'parsing' || state === 'committing' || state === 'enriching'
    if (!busy) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [state])

  async function onFile(file: File) {
    fileRef.current = file
    setState('parsing')
    setErrorMsg('')
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      const summaries = extractSummaries(buf)
      setProgress({ done: 0, total: summaries.length })
      const mapped: GarminMapped[] = []
      const warns: MapWarning[] = []
      for (let i = 0; i < summaries.length; i++) {
        const out = garminSummaryToMapped('me', summaries[i])
        if (out.result) mapped.push(out.result)
        if (out.warning) warns.push(out.warning)
        if (i % 200 === 0) setProgress({ done: i, total: summaries.length })
      }
      setProgress({ done: summaries.length, total: summaries.length })
      setWarnings(warns)
      const dates = mapped.map(m => m.normalized.startTime).sort()
      const params = new URLSearchParams()
      if (dates[0]) params.set('from', dates[0])
      if (dates[dates.length - 1]) params.set('to', dates[dates.length - 1])
      const exRes = await fetch(`/api/garmin-import/existing?${params}`)
      if (!exRes.ok) {
        throw new Error(exRes.status === 401
          ? 'Session expirée — reconnecte-toi sur le site puis relance l’import'
          : `Chargement des activités existantes échoué (${exRes.status})`)
      }
      const existing = (await exRes.json()) as ExistingActivity[]
      const cls = classifyActivities(mapped, existing)
      setNouvelles(cls.nouvelles)
      setConflits(cls.conflits)
      if (cls.conflits.length === 0) await commit(cls.nouvelles, [])
      else setState('resolve')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Échec du parsing')
      setState('error')
    }
  }

  async function commit(nv: GarminMapped[], cf: ConflictItem[]) {
    setState('committing')
    // « Garder Strava » ne produit AUCUNE écriture → on ne les envoie pas au serveur
    // (en ré-import, ce sont des milliers de conflits → 413/500 inutiles). On ne POSTe
    // que ce qui s'écrit : les nouvelles + les « remplacer par Garmin ».
    const replacements = cf.filter(c => c.decision === 'replace_garmin')
    const keptStrava = cf.length - replacements.length
    const total = nv.length + cf.length
    let done = keptStrava
    setCommitProgress({ done, total })

    // Chunk par TAILLE de payload : les résumés Garmin sont gros, et la limite de corps
    // de requête Vercel renvoie 413 "Payload Too Large" si on envoie trop d'un coup.
    const MAX_REQ_BYTES = 200_000
    const requests: { nouvelles: GarminMapped[]; conflits: ConflictItem[] }[] = []
    let curN: GarminMapped[] = []
    let curC: ConflictItem[] = []
    let curBytes = 0
    const pushReq = () => {
      if (curN.length || curC.length) {
        requests.push({ nouvelles: curN, conflits: curC })
        curN = []; curC = []; curBytes = 0
      }
    }
    for (const m of nv) {
      const b = JSON.stringify(m).length
      if (curBytes + b > MAX_REQ_BYTES) pushReq()
      curN.push(m); curBytes += b
    }
    for (const c of replacements) {
      const b = JSON.stringify(c).length
      if (curBytes + b > MAX_REQ_BYTES) pushReq()
      curC.push(c); curBytes += b
    }
    pushReq()

    const agg: ImportReport = {
      totalParsed: 0, imported: 0, conflictsKeptStrava: keptStrava, conflictsReplaced: 0,
      errors: 0, warnings: [], periodStart: null, periodEnd: null,
    }
    try {
      for (const reqBody of requests) {
        const res = await fetch('/api/garmin-import/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody),
        })
        if (!res.ok) {
          const txt = await res.text().catch(() => '')
          throw new Error(res.status === 413
            ? 'Lot trop volumineux (413) — réessaie, la taille des lots a été réduite'
            : (txt.slice(0, 140) || `Commit échoué (${res.status})`))
        }
        const json = (await res.json()) as ImportReport & { error?: string }
        agg.totalParsed += json.totalParsed
        agg.imported += json.imported
        agg.conflictsReplaced += json.conflictsReplaced
        agg.errors += json.errors
        if (json.periodStart && (!agg.periodStart || json.periodStart < agg.periodStart)) agg.periodStart = json.periodStart
        if (json.periodEnd && (!agg.periodEnd || json.periodEnd > agg.periodEnd)) agg.periodEnd = json.periodEnd
        done += reqBody.nouvelles.length + reqBody.conflits.length
        setCommitProgress({ done, total })
      }
      setReport({ ...agg, warnings })
      setState('done')
      router.refresh()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Échec du commit')
      setState('error')
    }
  }

  async function enrich() {
    const file = fileRef.current
    if (!file) return
    setState('enriching')
    setErrorMsg('')
    setEnrichProgress({ matched: 0, total: 0, scanned: 0 })
    try {
      const params = new URLSearchParams()
      if (report?.periodStart) params.set('from', report.periodStart)
      if (report?.periodEnd) params.set('to', report.periodEnd)
      const nsRes = await fetch(`/api/garmin-import/needs-streams?${params}`)
      if (!nsRes.ok) {
        throw new Error(nsRes.status === 401
          ? 'Session expirée — reconnecte-toi sur le site puis relance l’enrichissement'
          : `Chargement des activités à enrichir échoué (${nsRes.status})`)
      }
      const cands = (await nsRes.json()) as EnrichCandidate[]
      if (!cands.length) {
        setEnrichReport({ enriched: 0, matched: 0, skipped: 0, errors: 0 })
        setState('enriched')
        return
      }
      const index = buildActivityIndex(cands)
      const outer = new Uint8Array(await file.arrayBuffer())
      const pool = createFitPool()

      // Écriture directe navigateur → Supabase (RLS : activity_streams "own streams",
      // activities update own). Évite la limite de taille de corps des routes API
      // ("Request Entity Too Large") : les streams gzippés peuvent être volumineux.
      const sb = createSupabaseBrowser()
      const { data: { user } } = await sb.auth.getUser()
      const userId = user?.id
      if (!userId) throw new Error('Session expirée — reconnecte-toi')

      let uploads: StreamUpload[] = []
      let pendingBytes = 0
      let matched = 0
      let scanned = 0
      let errors = 0
      let nextId = 0
      const inflight = new Set<Promise<void>>()
      const MAX_INFLIGHT = 4
      const MAX_BATCH_BYTES = 800_000

      const flush = async () => {
        const batch = uploads
        uploads = []
        pendingBytes = 0
        if (batch.length === 0) return
        // Dédupe par activity_id (deux .fit peuvent matcher la même activité) → évite
        // l'erreur Postgres "ON CONFLICT DO UPDATE ... a second time".
        const byAct = new Map<string, StreamUpload>()
        for (const u of batch) {
          const prev = byAct.get(u.activityId)
          if (!prev || u.pointCount > prev.pointCount) byAct.set(u.activityId, u)
        }
        const items = Array.from(byAct.values())

        // 1) Streams (volumineux) → directement dans activity_streams.
        const streamRows = items.map(u => ({
          activity_id: u.activityId, user_id: userId, downsample_s: 5,
          point_count: u.pointCount, streams_gz: u.streamsGz, source: 'garmin',
        }))
        const { error: sErr } = await sb.from('activity_streams').upsert(streamRows, { onConflict: 'activity_id' })
        if (sErr) throw new Error(`Streams: ${sErr.message}`)

        // 2) Carte (polyline) + splits → raw_payload (fetch + merge + update).
        const withMap = items.filter(u => u.summaryPolyline || (u.splits && u.splits.length))
        if (withMap.length) {
          const ids = withMap.map(u => u.activityId)
          const { data: rows } = await sb.from('activities').select('id, raw_payload').in('id', ids)
          const rawById = new Map<string, Record<string, unknown>>(
            (rows ?? []).map(r => [String((r as { id: string }).id), ((r as { raw_payload?: Record<string, unknown> }).raw_payload ?? {})]),
          )
          await Promise.all(withMap.map(async u => {
            const raw = { ...(rawById.get(u.activityId) ?? {}) } as Record<string, unknown>
            if (u.summaryPolyline) raw.map = { ...((raw.map as Record<string, unknown>) ?? {}), summary_polyline: u.summaryPolyline }
            if (u.splits && u.splits.length) raw.splits_metric = u.splits
            await sb.from('activities').update({ raw_payload: raw }).eq('id', u.activityId)
          }))
        }
      }

      await forEachFit(outer, async (_name, bytes) => {
        const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
        const id = String(nextId++)
        const p: Promise<void> = pool.decode(id, ab).then(res => {
          scanned++
          // Ne matcher QUE les vrais fichiers d'activité : les fichiers de monitoring
          // (très nombreux, sans GPS) provoqueraient de faux matches qui écraseraient
          // streams + carte des activités.
          if (res.error) {
            errors++
          } else if (res.isActivity && res.streams) {
            const m = matchFit({ activityId: null, startTimeMs: res.startTimeMs ?? null }, index)
            if (m) {
              const splits = streamsToSplits(res.streams)
              const streamsGz = packStreamsClient(res.streams)
              const summaryPolyline = streamsToPolyline(res.streams) ?? undefined
              uploads.push({
                activityId: m.id,
                streamsGz,
                pointCount: res.pointCount ?? 0,
                summaryPolyline,
                splits: splits.length ? splits : undefined,
              })
              pendingBytes += streamsGz.length + (summaryPolyline?.length ?? 0)
              matched++
            }
          }
          // Throttle : un export peut contenir des dizaines de milliers de fichiers ;
          // mettre à jour l'état React à chaque fichier fige l'UI.
          if (scanned % 250 === 0) setEnrichProgress({ matched, total: cands.length, scanned })
        })
        const wrapped = p.finally(() => { inflight.delete(wrapped) })
        inflight.add(wrapped)
        if (inflight.size >= MAX_INFLIGHT) await Promise.race(inflight)
        if (uploads.length >= 40 || pendingBytes >= MAX_BATCH_BYTES) await flush()
      })
      await Promise.all(inflight)
      pool.terminate()
      // eslint-disable-next-line no-console
      console.log('[garmin-enrich] candidats:', cands.length, '| fichiers scannés:', scanned, '| matchés:', matched, '| erreurs:', errors)
      setEnrichProgress({ matched, total: cands.length, scanned })
      await flush()
      // Recalcul CES unique (best-effort) : sur un gros historique il peut timeouter/OOM
      // côté serveur — maps/splits/streams sont déjà écrits, on ne fait pas échouer
      // l'enrichissement pour ça. Le CES reste sur sa valeur Phase 1 si le recalc rate.
      try {
        await fetch('/api/garmin-import/streams?recalc=1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploads: [] }),
        })
      } catch { /* recalc best-effort */ }
      setEnrichReport({ enriched: matched, matched, skipped: cands.length - matched, errors })
      setState('enriched')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Échec de l'enrichissement")
      setState('error')
    }
  }

  // Enrichissement direct (sans Phase 1) : pour des activités DÉJÀ importées, on saute
  // le commit des résumés et on va droit aux streams/carte/splits. enrich() interroge
  // needs-streams sans période (report null) → toutes les activités sans carte.
  async function enrichOnly(file: File) {
    fileRef.current = file
    await enrich()
  }

  if (state === 'parsing') {
    return (
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <h1 className="text-lg font-semibold text-trail-text">Importer l&apos;historique Garmin</h1>
        <ProgressBar done={progress.done} total={progress.total} label="Analyse des activités…" />
      </div>
    )
  }

  if (state === 'committing') {
    return (
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <h1 className="text-lg font-semibold text-trail-text">Importer l&apos;historique Garmin</h1>
        <ProgressBar done={commitProgress.done} total={commitProgress.total} label="Import en cours…" />
      </div>
    )
  }

  if (state === 'resolve') {
    return (
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <h1 className="text-lg font-semibold text-trail-text">Importer l&apos;historique Garmin</h1>
        <ConflictResolution
          conflits={conflits}
          onResolve={resolved => commit(nouvelles, resolved)}
          onCancel={() => setState('intro')}
        />
      </div>
    )
  }

  if (state === 'done' && report) {
    return (
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <h1 className="text-lg font-semibold text-trail-text">Importer l&apos;historique Garmin</h1>
        <div className="rounded-[10px] bg-trail-surface px-3 py-[10px] space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-trail-muted flex-shrink-0" />
            <p className="text-body-sm font-semibold text-trail-text">Import terminé</p>
          </div>
          <p className="text-body-sm text-trail-text">
            {report.imported} activité{report.imported !== 1 ? 's' : ''} importée{report.imported !== 1 ? 's' : ''}
          </p>
          <p className="text-body-sm text-trail-muted">
            {report.conflictsReplaced} remplacée{report.conflictsReplaced !== 1 ? 's' : ''} par Garmin
          </p>
          <p className="text-body-sm text-trail-muted">
            {report.conflictsKeptStrava} conservée{report.conflictsKeptStrava !== 1 ? 's' : ''} (Strava)
          </p>
          <p className="text-body-sm text-trail-muted">
            {report.warnings.length} avertissement{report.warnings.length !== 1 ? 's' : ''}
          </p>
          {report.periodStart && report.periodEnd && (
            <p className="text-caption text-trail-muted">
              {report.periodStart.slice(0, 10)} → {report.periodEnd.slice(0, 10)}
            </p>
          )}
        </div>
        {fileRef.current && (
          <button
            type="button"
            onClick={enrich}
            className="flex items-center justify-center gap-[6px] w-full px-3 py-[7px] rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-caption font-semibold hover:bg-trail-border/40 transition-colors"
          >
            <Sparkles size={12} />
            Enrichir avec les données détaillées (FC, découplage…)
          </button>
        )}
        <Link
          href="/dashboard"
          className="flex items-center justify-center gap-[6px] w-full px-3 py-[7px] rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-caption font-semibold hover:bg-trail-border/40 transition-colors"
        >
          Voir mon Cockpit
        </Link>
      </div>
    )
  }

  if (state === 'enriching') {
    return (
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <h1 className="text-lg font-semibold text-trail-text">Importer l&apos;historique Garmin</h1>
        <ProgressBar done={enrichProgress.matched} total={enrichProgress.total} label="Enrichissement détaillé…" />
        <p className="text-caption text-trail-muted text-center tabular-nums">
          {enrichProgress.scanned} fichier{enrichProgress.scanned !== 1 ? 's' : ''} analysé{enrichProgress.scanned !== 1 ? 's' : ''}
        </p>
      </div>
    )
  }

  if (state === 'enriched' && enrichReport) {
    return (
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <h1 className="text-lg font-semibold text-trail-text">Importer l&apos;historique Garmin</h1>
        <EnrichmentStep report={enrichReport} />
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <h1 className="text-lg font-semibold text-trail-text">Importer l&apos;historique Garmin</h1>
        <div className="rounded-[10px] bg-trail-surface px-3 py-[10px] space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={18} className="text-trail-muted flex-shrink-0 mt-0.5" />
            <p className="text-body-sm text-trail-text">{errorMsg}</p>
          </div>
          <button
            type="button"
            onClick={() => setState('intro')}
            className="flex items-center justify-center gap-[6px] w-full px-3 py-[7px] rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-caption font-semibold hover:bg-trail-border/40 transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  // intro (default)
  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-4">
      <h1 className="text-lg font-semibold text-trail-text">Importer l&apos;historique Garmin</h1>

      <div className="rounded-[10px] bg-trail-surface px-3 py-[10px] space-y-3">
        <p className="text-body-sm text-trail-text">
          Garmin fournit un export complet de tes données (RGPD). Demande-le, puis dépose le ZIP ici
          — tout est traité sur ton téléphone, rien n&apos;est envoyé à nos serveurs sauf tes
          activités normalisées.
        </p>
        <p className="text-body-sm text-trail-muted">
          <a
            href="https://www.garmin.com/fr-FR/account/datamanagement/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-trail-text underline"
          >
            Demander mon export Garmin
          </a>
        </p>
        <p className="text-caption text-trail-muted">Délai Garmin : 24–48 h.</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setIsDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) onFile(file)
        }}
        className={[
          'rounded-[10px] border-2 border-dashed px-3 py-8 flex flex-col items-center gap-3 transition-colors',
          isDragging
            ? 'border-trail-text bg-trail-card/60'
            : 'border-trail-border bg-trail-surface',
        ].join(' ')}
      >
        <Upload size={24} className="text-trail-muted" />
        <p className="text-body-sm text-trail-text text-center">
          Glisse ton fichier ZIP ici
        </p>
        <p className="text-caption text-trail-muted">ou</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center justify-center gap-[6px] px-3 py-[7px] rounded-[8px] bg-trail-card border border-trail-border text-trail-text text-caption font-semibold hover:bg-trail-border/40 transition-colors"
        >
          <Upload size={12} />
          Choisir un fichier .zip
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />

      {/* Raccourci : activités déjà importées → enrichir directement (carte + splits) */}
      <input
        ref={enrichInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) enrichOnly(file)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => enrichInputRef.current?.click()}
        className="flex items-center justify-center gap-[6px] w-full px-3 py-[7px] rounded-[8px] bg-trail-card border border-trail-border text-trail-muted text-caption font-semibold hover:bg-trail-border/40 transition-colors"
      >
        <Sparkles size={12} />
        Déjà importé — ajouter seulement carte + splits
      </button>
    </div>
  )
}

function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
  return (
    <div className="rounded-[10px] bg-trail-surface px-3 py-[10px] space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Loader2 size={16} className="text-trail-muted animate-spin flex-shrink-0" />
          <p className="text-body-sm text-trail-text truncate">{label}</p>
        </div>
        <p className="text-caption text-trail-muted tabular-nums flex-shrink-0">{pct}%</p>
      </div>
      <div className="h-2 w-full rounded-full bg-trail-border/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-trail-text transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-caption text-trail-muted tabular-nums">{done} / {total}</p>
    </div>
  )
}
