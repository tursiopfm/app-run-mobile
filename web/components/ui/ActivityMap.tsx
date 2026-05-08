'use client'

import { useMemo, useEffect, useState } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import polylineLib from '@mapbox/polyline'
import 'leaflet/dist/leaflet.css'

type LatLng = [number, number]
type LayerType = 'osm' | 'satellite' | 'relief'

// Icône à afficher sur le bouton = vue vers laquelle on ira en cliquant
const CYCLE: Record<LayerType, LayerType> = { osm: 'satellite', satellite: 'relief', relief: 'osm' }

function IconSatellite() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 7 9 3 5 7l4 4"/><path d="m17 11 4 4-4 4-4-4"/>
      <path d="m8 12 4 4 6-6-4-4Z"/><path d="m16 8 3-3"/>
      <path d="M9 21a6 6 0 0 0-6-6"/>
    </svg>
  )
}

function IconLayers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/>
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>
    </svg>
  )
}

function IconMap() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
      <line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/>
    </svg>
  )
}

const NEXT_ICON: Record<LayerType, React.ReactNode> = {
  osm:       <IconSatellite />,
  satellite: <IconLayers />,
  relief:    <IconMap />,
}

const OSM_URL = 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png'
const ESRI_SAT_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const TOPO_URL = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'

function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371000
  const dLat = (b[0] - a[0]) * Math.PI / 180
  const dLon = (b[1] - a[1]) * Math.PI / 180
  const lat1 = a[0] * Math.PI / 180
  const lat2 = b[0] * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function computeKmMarkers(positions: LatLng[]): Array<{ km: number; pos: LatLng }> {
  const markers: Array<{ km: number; pos: LatLng }> = []
  let dist = 0
  let nextKm = 1
  for (let i = 1; i < positions.length; i++) {
    const segDist = haversineDistance(positions[i - 1], positions[i])
    const prevDist = dist
    dist += segDist
    while (dist >= nextKm * 1000) {
      const t = (nextKm * 1000 - prevDist) / segDist
      markers.push({
        km: nextKm,
        pos: [
          positions[i - 1][0] + t * (positions[i][0] - positions[i - 1][0]),
          positions[i - 1][1] + t * (positions[i][1] - positions[i - 1][1]),
        ],
      })
      nextKm++
    }
  }
  return markers
}

function KmMarkers({ positions }: { positions: LatLng[] }) {
  const markers = useMemo(() => computeKmMarkers(positions), [positions])
  return (
    <>
      {markers.map(({ km, pos }) => (
        <CircleMarker key={km} center={pos} radius={6}
          pathOptions={{ color: '#fff', weight: 2, fillColor: '#e8651a', fillOpacity: 1 }}>
          <Tooltip permanent direction="top" offset={[0, -9]} className="km-tooltip">{km}</Tooltip>
        </CircleMarker>
      ))}
    </>
  )
}

function FitBounds({ positions }: { positions: LatLng[] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length > 1) map.fitBounds(positions, { padding: [20, 20] })
  }, [map, positions])
  return null
}

function MapResizer({ expanded }: { expanded: boolean }) {
  const map = useMap()
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 310)
    return () => clearTimeout(timer)
  }, [map, expanded])
  return null
}

export function ActivityMap({ encodedPolyline, expanded = false }: { encodedPolyline: string; expanded?: boolean }) {
  const [layer, setLayer] = useState<LayerType>('osm')

  const positions = useMemo<LatLng[]>(
    () => (encodedPolyline ? polylineLib.decode(encodedPolyline) as LatLng[] : []),
    [encodedPolyline]
  )

  if (positions.length === 0) return <ActivityMapPlaceholder />

  const start = positions[0]
  const end = positions.length > 1 ? positions[positions.length - 1] : undefined

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        center={start}
        zoom={13}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        {/* Tuiles de fond selon la vue */}
        {layer === 'osm' && <TileLayer key="osm" url={OSM_URL} />}
        {layer === 'satellite' && (
          <>
            <TileLayer key="sat-base" url={ESRI_SAT_URL} />
            {/* Overlay OSM semi-transparent pour voir les chemins */}
            <TileLayer key="sat-overlay" url={OSM_URL} opacity={0.38} />
          </>
        )}
        {layer === 'relief' && <TileLayer key="relief" url={TOPO_URL} />}

        <Polyline positions={positions} pathOptions={{ color: '#e8651a', weight: 28, opacity: 0.08 }} />
        <Polyline positions={positions} pathOptions={{ color: '#ff8c42', weight: 14, opacity: 0.22 }} />
        <Polyline positions={positions} pathOptions={{ color: '#e8651a', weight: 6, opacity: 0.55 }} />
        <Polyline positions={positions} pathOptions={{ color: '#e8651a', weight: 3, opacity: 1 }} />
        <CircleMarker center={start} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#4caf50', fillOpacity: 1 }} />
        {end && (
          <CircleMarker center={end} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#e8651a', fillOpacity: 1 }} />
        )}
        {expanded && <KmMarkers positions={positions} />}
        <FitBounds positions={positions} />
        <MapResizer expanded={expanded} />
      </MapContainer>

      {/* Bouton de changement de vue — bas droite */}
      <button
        onClick={() => setLayer(cur => CYCLE[cur])}
        style={{
          position: 'absolute',
          bottom: 14,
          right: 10,
          zIndex: 1000,
          width: 38,
          height: 38,
          borderRadius: '50%',
          background: 'rgba(15,15,15,0.82)',
          border: '1.5px solid rgba(255,255,255,0.2)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          backdropFilter: 'blur(6px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.45)',
          padding: 0,
        }}
        title={`Passer en vue ${CYCLE[layer]}`}
      >
        {NEXT_ICON[layer]}
      </button>
    </div>
  )
}

export function ActivityMapPlaceholder() {
  return (
    <div style={{ width: '100%', height: '100%', background: '#e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#9aa0ac', fontSize: '13px' }}>Carte non disponible</span>
    </div>
  )
}
