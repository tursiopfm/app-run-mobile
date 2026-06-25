// Géométrie pure du profil exporté : mapping km/altitude → coordonnées SVG, et
// construction des paths (ligne + aire). Sans dépendance React → testable.

export interface ProfileGeom {
  W: number; H: number
  padL: number; padR: number
  plotTop: number; plotH: number
  yMin: number; yMax: number
  maxKm: number
}

export function xOf(g: ProfileGeom, km: number): number {
  const plotW = g.W - g.padL - g.padR
  return g.padL + (g.maxKm > 0 ? (km / g.maxKm) * plotW : 0)
}

export function yOf(g: ProfileGeom, alt: number): number {
  const span = g.yMax - g.yMin || 1
  return g.plotTop + (1 - (alt - g.yMin) / span) * g.plotH
}

export function buildLinePath(g: ProfileGeom, profile: { d: number[]; e: number[] }): string {
  let p = ''
  for (let i = 0; i < profile.d.length; i++) {
    p += `${i ? 'L' : 'M'}${xOf(g, profile.d[i]).toFixed(1)} ${yOf(g, profile.e[i]).toFixed(1)} `
  }
  return p.trimEnd()
}

export function buildAreaPath(g: ProfileGeom, profile: { d: number[]; e: number[] }): string {
  const n = profile.d.length
  if (n === 0) return ''
  const baseY = g.plotTop + g.plotH
  let p = `M${xOf(g, profile.d[0]).toFixed(1)} ${baseY.toFixed(1)} `
  for (let i = 0; i < n; i++) {
    p += `L${xOf(g, profile.d[i]).toFixed(1)} ${yOf(g, profile.e[i]).toFixed(1)} `
  }
  p += `L${xOf(g, profile.d[n - 1]).toFixed(1)} ${baseY.toFixed(1)} Z`
  return p
}
