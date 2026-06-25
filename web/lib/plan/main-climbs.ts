// Détection des « montées principales » depuis une trace dense (km, altitude),
// pour les badges ▲ du profil exporté. Gain net creux→sommet, avec hystérésis
// sur les descentes (le bruit < descentNoise ne coupe pas une montée).

export interface MainClimb {
  startKm: number
  endKm: number
  dPlus: number        // gain net creux → sommet, en mètres
  distKm: number
  gradientPct: number  // dPlus / (distKm * 1000) * 100
  midKm: number        // milieu de la montée — position du badge
}

function makeClimb(d: number[], e: number[], i0: number, i1: number): MainClimb {
  const startKm = d[i0]
  const endKm = d[i1]
  const dPlus = Math.round(e[i1] - e[i0])
  const distKm = Math.max(0, endKm - startKm)
  const gradientPct = distKm > 0 ? (dPlus / (distKm * 1000)) * 100 : 0
  return { startKm, endKm, dPlus, distKm, gradientPct, midKm: (startKm + endKm) / 2 }
}

export function detectMainClimbs(
  profile: { d: number[]; e: number[] },
  opts: { minDplus?: number; descentNoise?: number; max?: number } = {},
): MainClimb[] {
  const { d, e } = profile
  const minDplus = opts.minDplus ?? 200
  const descentNoise = opts.descentNoise ?? 25
  const max = opts.max ?? 3
  if (!d || d.length < 2 || e.length !== d.length) return []

  const climbs: MainClimb[] = []
  let troughIdx = 0
  let peakIdx = 0
  for (let i = 1; i < e.length; i++) {
    if (e[i] > e[peakIdx]) peakIdx = i
    if (e[peakIdx] - e[i] > descentNoise) {
      // Descente franche depuis le sommet courant → on clôt la montée trough→peak.
      if (peakIdx > troughIdx && e[peakIdx] - e[troughIdx] >= minDplus) {
        climbs.push(makeClimb(d, e, troughIdx, peakIdx))
      }
      troughIdx = i
      peakIdx = i
    } else if (e[i] < e[troughIdx]) {
      // Toujours en train de descendre, avant toute montée → on abaisse le creux.
      troughIdx = i
      peakIdx = i
    }
  }
  // Montée finale éventuelle (la trace se termine en montant).
  if (peakIdx > troughIdx && e[peakIdx] - e[troughIdx] >= minDplus) {
    climbs.push(makeClimb(d, e, troughIdx, peakIdx))
  }

  return climbs
    .sort((a, b) => b.dPlus - a.dPlus)
    .slice(0, max)
    .sort((a, b) => a.startKm - b.startKm)
}
