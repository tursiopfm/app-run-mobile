// VAP = Vitesse Ascensionnelle Pondérée (Grade Adjusted Pace).
// Coût énergétique de la course en fonction de la pente (Minetti et al., 2002),
// rapporté au coût plat (3.6 J/kg/m) pour obtenir un facteur d'ajustement.
export function gradeAdjustmentFactor(gradeDecimal: number): number {
  const g = gradeDecimal
  const cost = 155.4 * g ** 5 - 30.4 * g ** 4 - 43.3 * g ** 3 + 46.3 * g ** 2 + 19.5 * g + 3.6
  return cost / 3.6
}

// Allure moyenne ajustée à plat (sec/km) à partir de l'allure réelle, distance et D+.
// Pente moyenne ≈ D+ / distance (approximation: la moitié du parcours monte, l'autre descend).
export function vapPaceSec(
  avgPaceSec: number | null,
  distanceM: number | null,
  elevGainM: number | null,
): number | null {
  if (!avgPaceSec || !distanceM || distanceM <= 0) return null
  if (elevGainM == null || elevGainM <= 0) return avgPaceSec
  const grade = elevGainM / distanceM
  const factor = gradeAdjustmentFactor(grade)
  if (factor <= 0) return null
  return Math.round(avgPaceSec / factor)
}
