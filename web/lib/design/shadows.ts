// The Android dark design uses borders (trail-border) instead of shadows for block separation.
// No box-shadow is used in the design system.
// This file documents the border pattern used everywhere.

// Theme-aware: pointe sur le token --trail-border (remappé Deep Mission), donc
// correct en sombre ET en clair. (Actuellement non importé — doc de référence.)
export const borders = {
  card:       '1px solid var(--trail-border)',   // border border-trail-border
  tableCell:  '0.5px solid var(--trail-border)', // border-[0.5px] border-trail-border
  gridLine:   'color-mix(in srgb, var(--trail-border) 70%, transparent)', // trail-border ~70% (chart grid)
} as const

// Tailwind class shorthands
export const tw = {
  card:      'border border-trail-border',
  tableCell: 'border-[0.5px] border-trail-border',
} as const
