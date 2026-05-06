'use client'

import { useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet'
import polylineLib from '@mapbox/polyline'
import 'leaflet/dist/leaflet.css'

type LatLng = [number, number]

function FitBounds({ positions }: { positions: LatLng[] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(positions, { padding: [20, 20] })
    }
  }, [map, positions])
  return null
}

export function ActivityMap({ encodedPolyline }: { encodedPolyline: string }) {
  const positions = useMemo<LatLng[]>(
    () => (encodedPolyline ? polylineLib.decode(encodedPolyline) as LatLng[] : []),
    [encodedPolyline]
  )

  if (positions.length === 0) return <ActivityMapPlaceholder />

  const start = positions[0]
  const end = positions.length > 1 ? positions[positions.length - 1] : undefined

  return (
    <MapContainer
      center={start}
      zoom={13}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png" />
      {/* Outer diffuse glow */}
      <Polyline positions={positions} pathOptions={{ color: '#e8651a', weight: 28, opacity: 0.08 }} />
      {/* Middle glow */}
      <Polyline positions={positions} pathOptions={{ color: '#ff8c42', weight: 14, opacity: 0.22 }} />
      {/* Inner glow */}
      <Polyline positions={positions} pathOptions={{ color: '#e8651a', weight: 6, opacity: 0.55 }} />
      {/* Core route */}
      <Polyline positions={positions} pathOptions={{ color: '#e8651a', weight: 3, opacity: 1 }} />
      <CircleMarker center={start} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#4caf50', fillOpacity: 1 }} />
      {end && (
        <CircleMarker center={end} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#e8651a', fillOpacity: 1 }} />
      )}
      <FitBounds positions={positions} />
    </MapContainer>
  )
}

export function ActivityMapPlaceholder() {
  return (
    <div style={{ width: '100%', height: '100%', background: '#e8eaed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#9aa0ac', fontSize: '13px' }}>Carte non disponible</span>
    </div>
  )
}
