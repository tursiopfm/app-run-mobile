import polyline from '@mapbox/polyline'
import type { StreamSet } from '@/lib/activities/stream-metrics'
import type { StravaSplit } from '@/lib/activities/detail'

/**
 * Polyline encodée (precision 5, compatible @mapbox/polyline / ActivityMap) depuis le
 * canal latlng du stream FIT. null si pas de GPS exploitable. Sert à alimenter
 * raw_payload.map.summary_polyline pour que la carte de la page détail s'affiche.
 */
export function streamsToPolyline(s: StreamSet): string | null {
  const ll = s.latlng
  if (!ll) return null
  const pts = ll.filter(([la, lo]) => Number.isFinite(la) && Number.isFinite(lo))
  if (pts.length < 2) return null
  return polyline.encode(pts)
}

/**
 * Splits par km (forme StravaSplit attendue par ActivitySplits) calculés depuis les
 * canaux distance/temps/altitude. Un split est fermé dès que la distance cumulée depuis
 * le début du split atteint 1000 m ; le reliquat final forme un dernier split partiel.
 */
export function streamsToSplits(s: StreamSet): StravaSplit[] {
  const dist = s.distance, time = s.time, alt = s.altitude
  if (!dist || !time || dist.length < 2) return []
  const n = Math.min(dist.length, time.length)
  const splits: StravaSplit[] = []
  let kmIdx = 1
  let startI = 0
  const push = (endI: number) => {
    const d = dist[endI] - dist[startI]
    if (d <= 0) return
    const t = time[endI] - time[startI]
    const elev = alt ? Math.round((alt[endI] ?? 0) - (alt[startI] ?? 0)) : 0
    splits.push({
      split: kmIdx++,
      distance: Math.round(d),
      elapsed_time: t,
      moving_time: t,
      elevation_difference: elev,
      average_speed: t > 0 ? d / t : 0,
      pace_zone: 0,
    })
    startI = endI
  }
  for (let i = 1; i < n; i++) if (dist[i] - dist[startI] >= 1000) push(i)
  if (startI < n - 1) push(n - 1)
  return splits
}
