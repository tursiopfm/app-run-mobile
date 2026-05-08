'use client'

import { useMemo, useEffect, useState } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import polylineLib from '@mapbox/polyline'
import 'leaflet/dist/leaflet.css'

type LatLng = [number, number]
type LayerType = 'osm' | 'satellite' | 'relief'

const LAYERS: Record<LayerType, { url: string; label: string }> = {
  osm:       { url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', label: 'Plan' },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', label: 'Sat' },
  relief:    { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', label: 'Relief' },
}

const LAYER_ORDER: LayerType[] = ['osm', 'satellite', 'relief']

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
        <CircleMarker
          key={km}
          center={pos}
          radius={6}
          pathOptions={{ color: '#fff', weight: 2, fillColor: '#e8651a', fillOpacity: 1 }}
        >
          <Tooltip permanent direction="top" offset={[0, -9]} className="km-tooltip">
            {km}
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  )
}

function FitBounds({ positions }: { positions: LatLng[] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(positions, { padding: [20, 20] })
    }
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
        <TileLayer key={layer} url={LAYERS[layer].url} />
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

      <div style={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        pointerEvents: 'all',
      }}>
        {LAYER_ORDER.map(l => (
          <button
            key={l}
            onClick={() => setLayer(l)}
            style={{
              background: layer === l ? '#e8651a' : 'rgba(15,15,15,0.78)',
              color: '#fff',
              border: layer === l ? '1.5px solid #ff8c42' : '1.5px solid rgba(255,255,255,0.15)',
              borderRadius: 5,
              padding: '5px 9px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.03em',
              backdropFilter: 'blur(4px)',
              lineHeight: 1,
            }}
          >
            {LAYERS[l].label}
          </button>
        ))}
      </div>
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
