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
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
      {/* Glow layer */}
      <Polyline positions={positions} pathOptions={{ color: '#e8651a', weight: 12, opacity: 0.15 }} />
      {/* Main route */}
      <Polyline positions={positions} pathOptions={{ color: '#e8651a', weight: 3, opacity: 0.95 }} />
      <CircleMarker center={start} radius={6} pathOptions={{ color: '#4caf50', fillColor: '#4caf50', fillOpacity: 1 }} />
      {end && (
        <CircleMarker center={end} radius={6} pathOptions={{ color: '#e8651a', fillColor: '#e8651a', fillOpacity: 1 }} />
      )}
      <FitBounds positions={positions} />
    </MapContainer>
  )
}

export function ActivityMapPlaceholder() {
  return (
    <div
      style={{
        width: '100%', height: '100%',
        background: '#141824',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <span style={{ color: '#4a5568', fontSize: '13px' }}>Carte non disponible</span>
    </div>
  )
}
