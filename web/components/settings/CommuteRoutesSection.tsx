'use client'

import { useEffect, useState } from 'react'
import {
  Footprints, Bike, Route, Trash2, Plus, ChevronDown, ChevronUp,
  Play, Check, AlertTriangle,
} from 'lucide-react'

type CommuteRoute = {
  id: string
  sportType: string
  label: string
  refDistanceM: number
  distanceTolPct: number
  homeLat: number | null
  homeLng: number | null
  officeLat: number | null
  officeLng: number | null
  geoTolM: number
  outboundTitle: string
  returnTitle: string
  hourSplit: number
  active: boolean
}

type CandidateActivity = {
  id: string
  name: string
  sport_type: string
  start_time: string
  distance_m: number
}

const RUN_SPORTS = ['Run', 'TrailRun', 'Walk', 'Hike']
const RIDE_SPORTS = ['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide']
const COMMUTE_SPORTS = [...RUN_SPORTS, ...RIDE_SPORTS]

// Préfixe d'exemple pour les aperçus de titres ("2026#21 …").
const PREVIEW_PREFIX = `${new Date().getFullYear()}#21 `
const CHIP_LABEL     = `${new Date().getFullYear()}#N`

function sportIcon(sportType: string) {
  if (RIDE_SPORTS.includes(sportType)) return Bike
  if (RUN_SPORTS.includes(sportType)) return Footprints
  return Route
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatKm(m: number): string {
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`
}

// ── Petit input réutilisable, cohérent avec IdentityCard ──
function TextInput({
  value, onChange, placeholder,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-[8px] bg-trail-surface border border-trail-border px-2 py-[6px] text-[14px] text-trail-text outline-none focus:border-trail-primary"
    />
  )
}

function NumberInput({
  value, onChange,
}: {
  value: number; onChange: (v: number) => void
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : ''}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full rounded-[8px] bg-trail-surface border border-trail-border px-2 py-[6px] text-[14px] text-trail-text outline-none focus:border-trail-primary"
    />
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-trail-muted mb-[4px]">
      {children}
    </p>
  )
}

export function CommuteRoutesSection() {
  const [routes, setRoutes] = useState<CommuteRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Apply-to-history state
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<{ matched: number; renamed: number } | null>(null)
  const [applyError, setApplyError] = useState(false)

  async function loadRoutes() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/commute-routes')
      if (!res.ok) throw new Error('load')
      const data = await res.json() as { routes: CommuteRoute[] }
      setRoutes(data.routes ?? [])
    } catch {
      setError('Impossible de charger les trajets configurés.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRoutes()
  }, [])

  async function handleDelete(id: string) {
    setRoutes(prev => prev.filter(r => r.id !== id))
    try {
      await fetch(`/api/commute-routes/${id}`, { method: 'DELETE' })
    } catch {
      // recharge en cas d'échec pour rétablir l'état réel
      loadRoutes()
    }
  }

  async function handlePatch(id: string, patch: Partial<CommuteRoute>) {
    setRoutes(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)))
    try {
      await fetch(`/api/commute-routes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
    } catch {
      loadRoutes()
    }
  }

  async function handleApply() {
    setApplying(true)
    setApplyError(false)
    setApplyResult(null)
    try {
      const res = await fetch('/api/commute-routes/apply', { method: 'POST' })
      if (!res.ok) throw new Error('apply')
      const data = await res.json() as { matched: number; renamed: number }
      setApplyResult(data)
    } catch {
      setApplyError(true)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="space-y-[12px]">
      <p className="text-[12px] text-trail-muted leading-[16px]">
        Configure tes trajets domicile-travail pour que les activités Runtaf / Vélotaf soient
        détectées et renommées automatiquement (aller et retour).
      </p>

      {/* ── Liste des trajets ── */}
      {loading && (
        <p className="text-[12px] text-trail-muted px-1">Chargement…</p>
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 px-3 py-[8px] rounded-[10px] bg-red-500/10 border border-red-500/25">
          <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
          <p className="text-[12px] text-red-400">{error}</p>
        </div>
      )}

      {!loading && !error && routes.length === 0 && (
        <div className="px-3 py-[10px] rounded-[10px] bg-trail-surface">
          <p className="text-[12px] text-trail-muted">
            Aucun trajet configuré pour l&apos;instant. Ajoute-en un ci-dessous.
          </p>
        </div>
      )}

      {!loading && !error && routes.length > 0 && (
        <div className="space-y-[8px]">
          {routes.map(route => (
            <RouteCard
              key={route.id}
              route={route}
              onDelete={() => handleDelete(route.id)}
              onPatch={patch => handlePatch(route.id, patch)}
            />
          ))}
        </div>
      )}

      {/* ── Formulaire d'ajout ── */}
      <AddRouteForm onCreated={loadRoutes} />

      {/* ── Appliquer à l'historique ── */}
      <div className="rounded-[12px] bg-trail-surface border border-trail-border p-[12px] space-y-[8px]">
        <p className="text-[13px] font-bold text-trail-text">Appliquer à l&apos;historique</p>
        <p className="text-[11px] text-trail-muted leading-[15px]">
          Détecte et renomme les activités déjà importées qui correspondent à tes trajets.
          <span className="text-amber-400"> Attention : les titres sont aussi réécrits sur Strava.</span>
        </p>
        <button
          type="button"
          onClick={handleApply}
          disabled={applying || routes.length === 0}
          className="flex items-center gap-[6px] px-3 py-[8px] rounded-[10px] bg-trail-primary/15 border border-trail-primary text-trail-primary text-[12px] font-semibold tracking-wide hover:bg-trail-primary/25 transition-colors disabled:opacity-50"
        >
          {applying
            ? <div className="w-3 h-3 border-2 border-trail-primary border-t-transparent rounded-full animate-spin" />
            : <Play size={13} />}
          {applying ? 'Analyse en cours…' : 'Appliquer maintenant'}
        </button>
        {applyResult && (
          <p className="text-[12px] text-trail-text">
            {applyResult.matched} activité{applyResult.matched > 1 ? 's' : ''} détectée
            {applyResult.matched > 1 ? 's' : ''}, {applyResult.renamed} renommée
            {applyResult.renamed > 1 ? 's' : ''}.
          </p>
        )}
        {applyError && (
          <p className="text-[12px] text-red-400">L&apos;application a échoué. Réessaie plus tard.</p>
        )}
      </div>
    </div>
  )
}

// ── Carte d'un trajet existant (avec édition inline) ──
function RouteCard({
  route, onDelete, onPatch,
}: {
  route: CommuteRoute
  onDelete: () => void
  onPatch: (patch: Partial<CommuteRoute>) => void
}) {
  const Icon = sportIcon(route.sportType)
  const [editing, setEditing] = useState(false)

  // Champs d'édition locaux
  const [outbound, setOutbound] = useState(route.outboundTitle)
  const [ret, setRet] = useState(route.returnTitle)
  const [distTol, setDistTol] = useState(route.distanceTolPct)
  const [geoTol, setGeoTol] = useState(route.geoTolM)
  const [hourSplit, setHourSplit] = useState(route.hourSplit)

  function saveEdit() {
    onPatch({
      outboundTitle: outbound,
      returnTitle: ret,
      distanceTolPct: distTol,
      geoTolM: geoTol,
      hourSplit: hourSplit,
    })
    setEditing(false)
  }

  function cancelEdit() {
    setOutbound(route.outboundTitle)
    setRet(route.returnTitle)
    setDistTol(route.distanceTolPct)
    setGeoTol(route.geoTolM)
    setHourSplit(route.hourSplit)
    setEditing(false)
  }

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[12px] space-y-[10px]">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-[10px] bg-trail-surface border border-trail-border flex items-center justify-center flex-shrink-0">
          <Icon size={15} className="text-trail-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-trail-text truncate">{route.label}</p>
          <p className="text-[11px] text-trail-muted">
            {route.sportType} · réf {formatKm(route.refDistanceM)} · ±{route.distanceTolPct}%
          </p>
        </div>
        <button
          type="button"
          onClick={() => onPatch({ active: !route.active })}
          className={`flex items-center gap-[5px] px-[8px] py-[5px] rounded-full border text-[10px] font-semibold tracking-wide transition-colors ${
            route.active
              ? 'bg-trail-primary/15 border-trail-primary text-trail-primary'
              : 'bg-trail-surface border-trail-border text-trail-muted hover:text-trail-text'
          }`}
        >
          {route.active && <Check size={11} />}
          {route.active ? 'Actif' : 'Inactif'}
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Supprimer le trajet"
          className="w-7 h-7 rounded-[8px] border border-red-500/25 text-red-400 flex items-center justify-center hover:bg-red-500/10 transition-colors flex-shrink-0"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Aperçu des titres */}
      <div className="grid grid-cols-1 gap-[4px] text-[12px]">
        <div className="rounded-[8px] bg-trail-surface px-2 py-[6px]">
          <p className="text-[10px] uppercase tracking-wider text-trail-muted">Aller</p>
          <p className="text-[13px] text-trail-text truncate">{PREVIEW_PREFIX}{route.outboundTitle}</p>
        </div>
        <div className="rounded-[8px] bg-trail-surface px-2 py-[6px]">
          <p className="text-[10px] uppercase tracking-wider text-trail-muted">Retour</p>
          <p className="text-[13px] text-trail-text truncate">{PREVIEW_PREFIX}{route.returnTitle}</p>
        </div>
      </div>

      {/* Toggle édition */}
      {!editing && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[11px] text-trail-primary font-semibold underline underline-offset-2"
        >
          Modifier les titres & tolérances
        </button>
      )}

      {/* Édition inline */}
      {editing && (
        <div className="space-y-[10px] pt-[2px]">
          <div>
            <FieldLabel>Titre aller</FieldLabel>
            <TextInput value={outbound} onChange={setOutbound} />
          </div>
          <div>
            <FieldLabel>Titre retour</FieldLabel>
            <TextInput value={ret} onChange={setRet} />
          </div>
          <div className="grid grid-cols-3 gap-[8px]">
            <div>
              <FieldLabel>Tol. dist. %</FieldLabel>
              <NumberInput value={distTol} onChange={setDistTol} />
            </div>
            <div>
              <FieldLabel>Tol. géo m</FieldLabel>
              <NumberInput value={geoTol} onChange={setGeoTol} />
            </div>
            <div>
              <FieldLabel>Bascule h</FieldLabel>
              <NumberInput value={hourSplit} onChange={setHourSplit} />
            </div>
          </div>
          <div className="flex gap-[8px]">
            <button
              type="button"
              onClick={saveEdit}
              className="flex-1 rounded-[10px] py-[8px] text-[12px] font-bold text-trail-primary bg-trail-primary/15 border border-trail-primary hover:bg-trail-primary/25 transition-colors"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="flex-1 rounded-[10px] py-[8px] text-[12px] font-semibold text-trail-muted bg-trail-surface border border-trail-border hover:text-trail-text transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Formulaire d'ajout d'un trajet ──
function AddRouteForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // Activités candidates (référence aller)
  const [candidates, setCandidates] = useState<CandidateActivity[]>([])
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [candidatesError, setCandidatesError] = useState(false)

  // Champs du formulaire
  const [label, setLabel] = useState('')
  const [fromActivityId, setFromActivityId] = useState('')
  const [outboundTitle, setOutboundTitle] = useState('🏠 Home🏃‍♂️➡️🏃Office 🏢')
  const [returnTitle, setReturnTitle] = useState('🏢 Office🏃‍♂️➡️🏃Home 🏠')
  const [distanceTolPct, setDistanceTolPct] = useState(12)
  const [geoTolM, setGeoTolM] = useState(250)
  const [hourSplit, setHourSplit] = useState(14)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function loadCandidates() {
    setCandidatesLoading(true)
    setCandidatesError(false)
    try {
      const res = await fetch('/api/activities')
      if (!res.ok) throw new Error('load')
      const data = await res.json() as { activities: CandidateActivity[] }
      const filtered = (data.activities ?? []).filter(a => COMMUTE_SPORTS.includes(a.sport_type))
      setCandidates(filtered)
    } catch {
      setCandidatesError(true)
    } finally {
      setCandidatesLoading(false)
    }
  }

  function openForm() {
    setOpen(true)
    if (candidates.length === 0) loadCandidates()
  }

  function reset() {
    setLabel('')
    setFromActivityId('')
    setDistanceTolPct(12)
    setGeoTolM(250)
    setHourSplit(14)
    setSubmitError(null)
    setAdvancedOpen(false)
  }

  async function handleCreate() {
    if (!label.trim() || !fromActivityId) {
      setSubmitError('Renseigne un nom et choisis une activité de référence.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/commute-routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromActivityId,
          label: label.trim(),
          outboundTitle,
          returnTitle,
          distanceTolPct,
          geoTolM,
          hourSplit,
        }),
      })
      if (!res.ok) throw new Error('create')
      reset()
      setOpen(false)
      onCreated()
    } catch {
      setSubmitError('La création a échoué. Vérifie l\'activité choisie et réessaie.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openForm}
        className="w-full flex items-center justify-center gap-[6px] rounded-[12px] border border-dashed border-trail-border py-[10px] text-[13px] font-semibold text-trail-primary hover:bg-trail-surface transition-colors"
      >
        <Plus size={15} />
        Ajouter un trajet
      </button>
    )
  }

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[12px] space-y-[12px]">
      <p className="text-[13px] font-bold text-trail-text">Ajouter un trajet</p>

      {/* Nom */}
      <div>
        <FieldLabel>Nom du trajet</FieldLabel>
        <TextInput value={label} onChange={setLabel} placeholder="Ex. Runtaf" />
      </div>

      {/* Activité de référence */}
      <div>
        <FieldLabel>Activité de référence (un aller domicile → travail)</FieldLabel>
        {candidatesLoading ? (
          <p className="text-[12px] text-trail-muted">Chargement des activités…</p>
        ) : candidatesError ? (
          <p className="text-[12px] text-red-400">Impossible de charger tes activités.</p>
        ) : candidates.length === 0 ? (
          <p className="text-[12px] text-trail-muted">
            Aucune activité course / vélo trouvée. Importe d&apos;abord tes activités.
          </p>
        ) : (
          <select
            value={fromActivityId}
            onChange={e => setFromActivityId(e.target.value)}
            className="w-full rounded-[8px] bg-trail-surface border border-trail-border px-2 py-[6px] text-[14px] text-trail-text outline-none focus:border-trail-primary"
          >
            <option value="">— Choisir une activité —</option>
            {candidates.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} · {formatDate(a.start_time)} · {formatKm(a.distance_m)}
              </option>
            ))}
          </select>
        )}
        <p className="text-[10px] text-trail-muted/80 mt-[4px] leading-[14px]">
          C&apos;est l&apos;ALLER qui sert de référence : la distance et les points Home (départ) / Office
          (arrivée) en sont extraits. Le retour (trajet inverse) est détecté automatiquement.
        </p>
      </div>

      {/* Titres générés sur Strava — pastille N° auto + champ suffixe éditable */}
      <div className="space-y-[10px]">
        <FieldLabel>Titres générés sur Strava</FieldLabel>

        {/* Aller */}
        <div className="space-y-[6px]">
          <div className="flex items-center gap-[6px] text-[11px] text-trail-muted">
            <span className="w-[8px] h-[8px] rounded-full bg-trail-primary" aria-hidden />
            <span className="font-bold uppercase tracking-wider text-trail-text">Aller</span>
            <span className="text-[10px]">matin · départ Home</span>
          </div>
          <div className="flex items-stretch gap-[6px]">
            <div
              className="flex items-center px-[10px] rounded-[8px] bg-trail-surface border border-trail-border text-[12px] font-bold tracking-wide text-trail-muted whitespace-nowrap select-none"
              title="Numéro auto-incrémenté par jour"
            >
              {CHIP_LABEL}
            </div>
            <div className="flex-1">
              <TextInput value={outboundTitle} onChange={setOutboundTitle} />
            </div>
          </div>
        </div>

        {/* Retour */}
        <div className="space-y-[6px]">
          <div className="flex items-center gap-[6px] text-[11px] text-trail-muted">
            <span className="w-[8px] h-[8px] rounded-full bg-sky-400" aria-hidden />
            <span className="font-bold uppercase tracking-wider text-trail-text">Retour</span>
            <span className="text-[10px]">soir · départ Office</span>
          </div>
          <div className="flex items-stretch gap-[6px]">
            <div
              className="flex items-center px-[10px] rounded-[8px] bg-trail-surface border border-trail-border text-[12px] font-bold tracking-wide text-trail-muted whitespace-nowrap select-none"
              title="Numéro auto-incrémenté par jour"
            >
              {CHIP_LABEL}
            </div>
            <div className="flex-1">
              <TextInput value={returnTitle} onChange={setReturnTitle} />
            </div>
          </div>
        </div>

        <p className="text-[10px] text-trail-muted/80 leading-[14px]">
          Le préfixe <span className="text-trail-text">{CHIP_LABEL}</span> est ajouté automatiquement. Aller et retour du même jour partagent le même N.
        </p>
      </div>

      {/* Options avancées repliées */}
      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen(v => !v)}
          className="flex items-center gap-[4px] text-[11px] font-semibold text-trail-muted hover:text-trail-text transition-colors"
        >
          {advancedOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          Options avancées
        </button>
        {advancedOpen && (
          <div className="grid grid-cols-3 gap-[8px] mt-[8px]">
            <div>
              <FieldLabel>Tol. dist. %</FieldLabel>
              <NumberInput value={distanceTolPct} onChange={setDistanceTolPct} />
            </div>
            <div>
              <FieldLabel>Tol. géo m</FieldLabel>
              <NumberInput value={geoTolM} onChange={setGeoTolM} />
            </div>
            <div>
              <FieldLabel>Bascule h</FieldLabel>
              <NumberInput value={hourSplit} onChange={setHourSplit} />
            </div>
          </div>
        )}
      </div>

      {submitError && (
        <p className="text-[12px] text-red-400">{submitError}</p>
      )}

      {/* Actions */}
      <div className="flex gap-[8px]">
        <button
          type="button"
          onClick={handleCreate}
          disabled={submitting}
          className="flex-1 rounded-[10px] py-[9px] text-[13px] font-bold text-trail-primary bg-trail-primary/15 border border-trail-primary hover:bg-trail-primary/25 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Création…' : 'Créer'}
        </button>
        <button
          type="button"
          onClick={() => { reset(); setOpen(false) }}
          disabled={submitting}
          className="flex-1 rounded-[10px] py-[9px] text-[13px] font-semibold text-trail-muted bg-trail-surface border border-trail-border hover:text-trail-text transition-colors disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}
