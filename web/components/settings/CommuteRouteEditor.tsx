'use client'

// Éditeur plein écran d'un trajet domicile-travail : titres, tolérance géo et
// points Home/Office en une seule page.
// Chargé via next/dynamic ssr:false (Leaflet exige le DOM).

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { X } from 'lucide-react'
import { searchAddress, type AddressHit } from '@/lib/geo/ban-geocode'

type LatLng = [number, number]
type PointKey = 'home' | 'office'

export type CommutePatch = {
  outboundTitle: string
  returnTitle: string
  geoTolM: number
  homeLat: number
  homeLng: number
  officeLat: number
  officeLng: number
}

export type CommuteRouteEditorRoute = {
  id: string
  label: string
  outboundTitle: string
  returnTitle: string
  geoTolM: number
  homeLat: number | null
  homeLng: number | null
  officeLat: number | null
  officeLng: number | null
}

const OSM_URL = 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png'
// Repli si un trajet hérité n'a pas de points (impossible via l'UI actuelle).
const FALLBACK_HOME: LatLng = [45.9, 6.1]
const FALLBACK_OFFICE: LatLng = [45.91, 6.13]

const CHIP_LABEL = `${new Date().getFullYear()}#N`

const POINT_META: Record<PointKey, { emoji: string; label: string }> = {
  home: { emoji: '🏠', label: 'Home' },
  office: { emoji: '🏢', label: 'Office' },
}

// divIcon emoji : évite les icônes par défaut de Leaflet (assets cassés en
// bundler). L'ombre portée est dessinée sur la carte, hors thème → valeur fixe.
// ⚠️ Icônes créées UNE seule fois (identité stable) : une icône recréée au
// render déclenche marker.setIcon(), qui réinitialise l'interaction Leaflet et
// tue un drag en cours.
function emojiIcon(emoji: string) {
  return L.divIcon({
    className: '',
    html: `<div style="font-size:28px;line-height:1;transform:translate(-50%,-50%);filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))">${emoji}</div>`,
    iconSize: [0, 0],
  })
}

const ICONS: Record<PointKey, L.DivIcon> = {
  home: emojiIcon(POINT_META.home.emoji),
  office: emojiIcon(POINT_META.office.emoji),
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-trail-muted mb-[4px]">
      {children}
    </p>
  )
}

// Cadre la carte sur les 2 points à l'ouverture (une seule fois) et corrige la
// taille après le montage dans le portal (Leaflet mesure avant le layout).
function FitOnce({ points }: { points: LatLng[] }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize()
      if (!done.current) {
        done.current = true
        map.fitBounds(points, { padding: [40, 40], maxZoom: 16 })
      }
    }, 120)
    return () => clearTimeout(t)
  }, [map, points])
  return null
}

function ClickToPlace({ onPlace }: { onPlace: (pos: LatLng) => void }) {
  useMapEvents({ click: e => onPlace([e.latlng.lat, e.latlng.lng]) })
  return null
}

function FlyTo({ target }: { target: LatLng | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.setView(target, Math.max(map.getZoom(), 15))
  }, [map, target])
  return null
}

export function CommuteRouteEditor({
  route, onClose, onSaved,
}: {
  route: CommuteRouteEditorRoute
  onClose: () => void
  onSaved: (patch: CommutePatch) => void
}) {
  const [outboundTitle, setOutboundTitle] = useState(route.outboundTitle)
  const [returnTitle, setReturnTitle] = useState(route.returnTitle)
  const [geoTolM, setGeoTolM] = useState(route.geoTolM)

  const [home, setHome] = useState<LatLng>(
    route.homeLat != null && route.homeLng != null
      ? [route.homeLat, route.homeLng] : FALLBACK_HOME,
  )
  const [office, setOffice] = useState<LatLng>(
    route.officeLat != null && route.officeLng != null
      ? [route.officeLat, route.officeLng] : FALLBACK_OFFICE,
  )
  const [active, setActive] = useState<PointKey>('home')
  const [focus, setFocus] = useState<LatLng | null>(null)

  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<AddressHit[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  // Fermeture clavier + lock du scroll body tant que l'éditeur est ouvert
  // (aligné sur components/ui/Sheet.tsx).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  // Recherche BAN avec debounce (min 3 caractères).
  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setHits([])
      setSearching(false)
      setSearchError(false)
      return
    }
    let cancelled = false
    setSearching(true)
    setSearchError(false)
    const t = setTimeout(async () => {
      const res = await searchAddress(q)
      if (cancelled) return
      setHits(res ?? [])
      setSearchError(res == null)
      setSearching(false)
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  const setPoint = (key: PointKey, pos: LatLng) => {
    if (key === 'home') setHome(pos)
    else setOffice(pos)
  }

  function pickHit(hit: AddressHit) {
    setPoint(active, [hit.lat, hit.lng])
    setFocus([hit.lat, hit.lng])
    setQuery('')
    setHits([])
    setSearchError(false)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(false)
    if (!Number.isFinite(geoTolM) || geoTolM < 1) {
      setSaveError(true)
      setSaving(false)
      return
    }
    try {
      const patch: CommutePatch = {
        outboundTitle,
        returnTitle,
        geoTolM,
        homeLat: home[0], homeLng: home[1],
        officeLat: office[0], officeLng: office[1],
      }
      const res = await fetch(`/api/commute-routes/${route.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('patch')
      const data = await res.json().catch(() => null) as { route?: Partial<CommutePatch> } | null
      onSaved({ ...patch, ...(data?.route ?? {}) })
      onClose()
    } catch {
      setSaveError(true)
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-trail-bg flex flex-col" role="dialog" aria-modal="true">
      {/* En-tête */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-trail-border flex-shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-body font-bold text-trail-text truncate">Modifier le trajet</p>
          <p className="text-micro text-trail-muted truncate">{route.label}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="w-8 h-8 rounded-[10px] border border-trail-border text-trail-muted flex items-center justify-center hover:text-trail-text transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Corps scrollable */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-[12px] space-y-[14px]">
        {/* Titres */}
        <div>
          <FieldLabel>Titre aller</FieldLabel>
          <div className="flex items-stretch gap-[6px]">
            <div
              className="flex items-center px-[10px] rounded-[8px] bg-trail-surface border border-trail-border text-caption font-bold tracking-wide text-trail-muted whitespace-nowrap select-none"
              title="Numéro auto-incrémenté par jour"
            >
              {CHIP_LABEL}
            </div>
            <input
              type="text"
              value={outboundTitle}
              onChange={e => setOutboundTitle(e.target.value)}
              className="flex-1 min-w-0 rounded-[8px] bg-trail-surface border border-trail-border px-2 py-[6px] text-body text-trail-text outline-none focus:border-trail-primary"
            />
          </div>
        </div>

        <div>
          <FieldLabel>Titre retour</FieldLabel>
          <div className="flex items-stretch gap-[6px]">
            <div
              className="flex items-center px-[10px] rounded-[8px] bg-trail-surface border border-trail-border text-caption font-bold tracking-wide text-trail-muted whitespace-nowrap select-none"
              title="Numéro auto-incrémenté par jour"
            >
              {CHIP_LABEL}
            </div>
            <input
              type="text"
              value={returnTitle}
              onChange={e => setReturnTitle(e.target.value)}
              className="flex-1 min-w-0 rounded-[8px] bg-trail-surface border border-trail-border px-2 py-[6px] text-body text-trail-text outline-none focus:border-trail-primary"
            />
          </div>
        </div>

        {/* Tolérance géo */}
        <div>
          <FieldLabel>Tol. géo m</FieldLabel>
          <input
            type="number"
            min={10}
            value={Number.isFinite(geoTolM) ? geoTolM : ''}
            onChange={e => setGeoTolM(Number(e.target.value))}
            className="w-full rounded-[8px] bg-trail-surface border border-trail-border px-2 py-[6px] text-body text-trail-text outline-none focus:border-trail-primary"
          />
          <p className="text-[10px] text-trail-muted/80 mt-[4px] leading-[14px]">
            Rayon autour de chaque point : une activité compte comme trajet si elle part
            d&apos;un point et arrive à l&apos;autre dans ce rayon.
          </p>
        </div>

        {/* Sélecteur du point actif */}
        <div className="flex gap-[8px]">
          {(['home', 'office'] as PointKey[]).map(key => (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              className={`flex-1 px-3 py-[7px] rounded-full border text-caption font-semibold transition-colors ${
                active === key
                  ? 'bg-trail-primary/15 border-trail-primary text-trail-primary'
                  : 'bg-trail-surface border-trail-border text-trail-muted'
              }`}
            >
              {POINT_META[key].emoji} {POINT_META[key].label}
            </button>
          ))}
        </div>

        {/* Recherche d'adresse */}
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Adresse du point ${POINT_META[active].label}…`}
            className="w-full rounded-[10px] bg-trail-surface border border-trail-border px-3 py-[8px] text-body text-trail-text outline-none focus:border-trail-primary"
          />
          {(hits.length > 0 || searching || searchError) && (
            <div className="absolute left-0 right-0 top-full z-[1100] rounded-[10px] bg-trail-card border border-trail-border shadow-xl overflow-hidden">
              {searching && (
                <p className="px-3 py-[8px] text-caption text-trail-muted">Recherche…</p>
              )}
              {searchError && !searching && (
                <p className="px-3 py-[8px] text-caption text-trail-muted">Recherche d&apos;adresse indisponible. Place le point directement sur la carte.</p>
              )}
              {hits.map(hit => (
                <button
                  key={`${hit.lat},${hit.lng}`}
                  type="button"
                  onClick={() => pickHit(hit)}
                  className="block w-full text-left px-3 py-[8px] text-caption text-trail-text hover:bg-trail-surface transition-colors"
                >
                  {hit.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Carte — hauteur fixe dans une page scrollable */}
        <div className="h-[45vh] rounded-[12px] overflow-hidden border border-trail-border">
          <MapContainer
            center={home}
            zoom={13}
            style={{ width: '100%', height: '100%' }}
            attributionControl={false}
          >
            <TileLayer url={OSM_URL} />
            <Marker
              position={home}
              draggable
              icon={ICONS.home}
              eventHandlers={{
                click: () => setActive('home'),
                dragend: e => {
                  const p = (e.target as L.Marker).getLatLng()
                  setActive('home')
                  setHome([p.lat, p.lng])
                },
              }}
            />
            <Marker
              position={office}
              draggable
              icon={ICONS.office}
              eventHandlers={{
                click: () => setActive('office'),
                dragend: e => {
                  const p = (e.target as L.Marker).getLatLng()
                  setActive('office')
                  setOffice([p.lat, p.lng])
                },
              }}
            />
            <ClickToPlace onPlace={pos => setPoint(active, pos)} />
            <FitOnce points={[home, office]} />
            <FlyTo target={focus} />
          </MapContainer>
        </div>

        <p className="text-[10px] text-trail-muted leading-[14px]">
          Tape sur la carte ou glisse un marqueur pour ajuster le point actif.
        </p>
      </div>

      {/* Pied : rappel + actions */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-trail-border bg-trail-bg space-y-[8px]">
        <p className="text-[10px] text-trail-muted leading-[14px]">
          Après modification, relance « Appliquer à l&apos;historique » pour re-détecter les
          trajets avec les nouveaux points.
        </p>
        {saveError && (
          <p className="text-caption text-red-400">L&apos;enregistrement a échoué. Vérifie la tolérance (au moins 1 m) et réessaie.</p>
        )}
        <div className="flex gap-[8px]">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-[10px] py-[9px] text-body-sm font-bold text-trail-primary bg-trail-primary/15 border border-trail-primary hover:bg-trail-primary/25 transition-colors disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-[10px] py-[9px] text-body-sm font-semibold text-trail-muted bg-trail-surface border border-trail-border hover:text-trail-text transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
