// web/lib/analytics/charge-thresholds.ts
// Seuils numériques pour le moteur d'insights de la page Charge.
// Modifiables ici sans toucher au reste du code.

export const LOAD_BALANCE = {
  low:      0.75,
  balanced: 1.25,
  high:     1.5,
} as const

export const FRESHNESS = {
  veryFresh:     15,
  fresh:         5,
  normalFatigue: -10,
  highFatigue:   -25,
} as const

export const MONOTONY = {
  variedMax:    1.5,
  repetitiveMin: 2.0,
} as const

export const STRAIN = {
  high: 6000,
} as const

export const RAMP_RATE = {
  fastRise:       0.30,
  controlledRise: 0.10,
  decline:        -0.30,
} as const

export const WINDOWS = {
  short:  7,
  medium: 28,
  long:   70,
} as const
