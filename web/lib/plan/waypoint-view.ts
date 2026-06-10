// Dérivations pures pour l'affichage des waypoints (table + PDF). DRY.
// dPlus/dMoins stockés = CUMULÉS → le tronçon se dérive par différence.

export interface SegmentInput {
  km: number
  dPlus: number | null
  dMoins: number | null
}

export interface SegmentDerived {
  interKm: number | null  // distance du tronçon (km_i - km_{i-1})
  dPlusSeg: number | null // D+ du tronçon
  dMoinsSeg: number | null
}

export function deriveSegment(wps: SegmentInput[], i: number): SegmentDerived {
  if (i <= 0) return { interKm: null, dPlusSeg: null, dMoinsSeg: null }
  const prev = wps[i - 1]
  const cur = wps[i]
  const diff = (a: number | null, b: number | null): number | null =>
    a == null || b == null ? null : Math.max(0, a - b)
  return {
    interKm: Math.round((cur.km - prev.km) * 10) / 10,
    dPlusSeg: diff(cur.dPlus, prev.dPlus),
    dMoinsSeg: diff(cur.dMoins, prev.dMoins),
  }
}

export interface ClockResult {
  label: string   // 'HH:MM' ou 'Jx HH:MM' si jour > 1
  dayIndex: number
}

// startTime : 'HH:MM' (heure locale de départ). elapsedSec : s depuis le départ.
// Calcul purement arithmétique (pas de Date → robuste aux fuseaux).
export function formatElapsedToClock(
  startTime: string,
  elapsedSec: number,
): ClockResult | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(startTime.trim())
  if (!m) return null
  const startTod = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60
  const total = startTod + Math.round(elapsedSec)
  const dayIndex = Math.floor(total / 86400) + 1
  const tod = ((total % 86400) + 86400) % 86400
  const hh = Math.floor(tod / 3600)
  const mm = Math.floor((tod % 3600) / 60)
  const pad = (x: number) => String(x).padStart(2, '0')
  const hhmm = `${pad(hh)}:${pad(mm)}`
  return { label: dayIndex > 1 ? `J${dayIndex} ${hhmm}` : hhmm, dayIndex }
}

// Parse une saisie 'HH:MM' (heure d'horloge) en secondes écoulées depuis le
// départ, en tenant compte du passage de minuit (choisit le 1er jour où
// l'heure d'horloge dépasse l'écoulé minimal fourni). Retourne null si invalide.
export function parseClockToElapsed(
  startTime: string,
  input: string,
  minElapsedSec: number,
): number | null {
  const ms = /^(\d{1,2}):(\d{2})$/.exec(startTime.trim())
  const mi = /^(\d{1,2}):(\d{2})$/.exec(input.trim())
  if (!ms || !mi) return null
  const startTod = parseInt(ms[1], 10) * 3600 + parseInt(ms[2], 10) * 60
  const inTod = parseInt(mi[1], 10) * 3600 + parseInt(mi[2], 10) * 60
  // Cherche le plus petit nombre de jours tel que l'écoulé >= minElapsed.
  let elapsed = inTod - startTod
  while (elapsed < minElapsedSec - 1) elapsed += 86400
  return elapsed < 0 ? elapsed + 86400 : elapsed
}

// Temps écoulé (s) → 'XhYY' (ex : 7500 → '2h05', 133200 → '37h00').
export function formatElapsedShort(sec: number): string {
  const m = Math.max(0, Math.round(sec / 60))
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

// Saisie 'XhYY' / 'X:YY' / 'Xh' → secondes écoulées. null si invalide.
export function parseElapsedShort(input: string): number | null {
  const t = input.trim()
  const m = /^(\d{1,3})\s*[h:]\s*(\d{1,2})$/.exec(t)
  if (m) return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60
  const m2 = /^(\d{1,3})\s*h?$/.exec(t)
  if (m2) return parseInt(m2[1], 10) * 3600
  return null
}

export interface Margin { sec: number; level: 'ok' | 'warn' | 'bad' }

// Battement entre l'heure de passage visée (objElapsedSec) et la barrière.
// cutoffKind='elapsed' → barrière = temps écoulé ; sinon = heure d'horloge
// (convertie via le départ). Retourne null si barrière absente/illisible ou
// si une barrière horloge est demandée sans heure de départ.
export function marginToBarrier(
  startTime: string | undefined,
  objElapsedSec: number,
  cutoffRaw: string | null,
  cutoffKind: 'clock_time' | 'elapsed' | 'unknown' | null,
): Margin | null {
  if (!cutoffRaw) return null
  const m = /(\d{1,2})[:h](\d{2})/.exec(cutoffRaw)
  if (!m) return null
  let barrierElapsed: number | null
  if (cutoffKind === 'elapsed') {
    barrierElapsed = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60
  } else {
    if (!startTime) return null
    barrierElapsed = parseClockToElapsed(startTime, `${m[1]}:${m[2]}`, objElapsedSec)
  }
  if (barrierElapsed == null) return null
  const sec = barrierElapsed - objElapsedSec
  return { sec, level: sec >= 2700 ? 'ok' : sec >= 0 ? 'warn' : 'bad' }
}

// Marge (s) → '+25min' / '+1h30' / '-10min'.
export function formatMargin(sec: number): string {
  const sign = sec < 0 ? '-' : '+'
  const a = Math.abs(Math.round(sec / 60))
  const h = Math.floor(a / 60)
  const mm = a % 60
  return h === 0 ? `${sign}${mm}min` : `${sign}${h}h${mm > 0 ? String(mm).padStart(2, '0') : ''}`
}

// Barrière (cutoffRaw brut, ex '26-22:30') → heure d'horloge propre 'Jx HH:MM'
// via le départ + l'écoulé objectif au point (pour lever l'ambiguïté du jour).
// Retombe sur la chaîne brute si départ absent ou format illisible.
export function formatBarrierClock(
  startTime: string | undefined,
  cutoffRaw: string | null,
  cutoffKind: 'clock_time' | 'elapsed' | 'unknown' | null,
  minElapsedSec: number,
): string | null {
  if (!cutoffRaw) return null
  const m = /(\d{1,2})[:h](\d{2})/.exec(cutoffRaw)
  if (!m || !startTime) return cutoffRaw
  const barrierElapsed = cutoffKind === 'elapsed'
    ? parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60
    : parseClockToElapsed(startTime, `${m[1]}:${m[2]}`, minElapsedSec)
  if (barrierElapsed == null) return cutoffRaw
  return formatElapsedToClock(startTime, barrierElapsed)?.label ?? cutoffRaw
}
