'use client'

// Éditeur plein écran des points Home/Office d'un trajet domicile-travail.
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

export type CommutePoints = {
  homeLat: number
  homeLng: number
  officeLat: number
  officeLng: number
}

export type CommutePointsEditorRoute = {
  id: string
  label: string
  homeLat: number | null
  homeLng: number | null
  officeLat: number | null
  officeLng: number | null
}

const OSM_URL = 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png'
// Repli si un trajet hérité n'a pas de points (impossible via l'UI actuelle).
const FALLBACK_HOME: LatLng = [45.9, 6.1]
const FALLBACK_OFFICE: LatLng = [45.91, 6.13]

const POINT_META: Record<PointKey, { emoji: string; label: string }> = {
  home: { emoji: '🏠', label: 'Home' },
  office: { emoji: '🏢', label: 'Office' },
}

// divIcon emoji : évite les icônes par défaut de Leaflet (assets cassés en
// bundler). L'ombre portée est dessinée sur la carte, hors thème → valeur fixe.
function emojiIcon(emoji: string, active: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="font-size:28px;line-height:1;transform:translate(-50%,-50%);filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));opacity:${active ? 1 : 0.7}">${emoji}</div>`,
    iconSize: [0, 0],
  })
}

// Cadre la carte sur les 2 points à l'ouverture (une seule fois) et corrige la
// taille après le montage dans le portal (Leaflet mesure avant le layout flex).
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

export function CommutePointsEditor({
  route, onClose, onSaved,
}: {
  route: CommutePointsEditorRoute
  onClose: () => void
  onSaved: (points: CommutePoints) => void
}) {
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
    try {
      const points: CommutePoints = {
        homeLat: home[0], homeLng: home[1],
        officeLat: office[0], officeLng: office[1],
      }
      const res = await fetch(`/api/commute-routes/${route.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(points),
      })
      if (!res.ok) throw new Error('patch')
      onSaved(points)
      onClose()
    } catch {
      setSaveError(true)
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-trail-bg flex flex-col">
      {/* En-tête */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-trail-border">
        <div className="flex-1 min-w-0">
          <p className="text-body font-bold text-trail-text truncate">Points du trajet</p>
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

      {/* Sélecteur du point actif */}
      <div className="flex gap-[8px] px-4 py-[10px]">
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
      <div className="relative px-4 pb-[10px]">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Adresse du point ${POINT_META[active].label}…`}
          className="w-full rounded-[10px] bg-trail-surface border border-trail-border px-3 py-[8px] text-body text-trail-text outline-none focus:border-trail-primary"
        />
        {(hits.length > 0 || searching || (searchError && !searching)) && (
          <div className="absolute left-4 right-4 top-full z-[1100] rounded-[10px] bg-trail-card border border-trail-border shadow-xl overflow-hidden">
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

      {/* Carte */}
      <div className="flex-1 min-h-0">
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
            icon={emojiIcon('🏠', active === 'home')}
            eventHandlers={{
              dragstart: () => setActive('home'),
              dragend: e => {
                const p = (e.target as L.Marker).getLatLng()
                setHome([p.lat, p.lng])
              },
            }}
          />
          <Marker
            position={office}
            draggable
            icon={emojiIcon('🏢', active === 'office')}
            eventHandlers={{
              dragstart: () => setActive('office'),
              dragend: e => {
                const p = (e.target as L.Marker).getLatLng()
                setOffice([p.lat, p.lng])
              },
            }}
          />
          <ClickToPlace onPlace={pos => setPoint(active, pos)} />
          <FitOnce points={[home, office]} />
          <FlyTo target={focus} />
        </MapContainer>
      </div>

      {/* Pied : rappel + actions */}
      <div className="px-4 py-3 border-t border-trail-border space-y-[8px]">
        <p className="text-[10px] text-trail-muted leading-[14px]">
          Tape sur la carte ou glisse un marqueur pour ajuster le point actif. Après
          modification, relance « Appliquer à l&apos;historique » pour re-détecter les
          trajets avec les nouveaux points.
        </p>
        {saveError && (
          <p className="text-caption text-red-400">L&apos;enregistrement a échoué. Réessaie.</p>
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
