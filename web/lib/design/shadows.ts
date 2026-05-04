// The Android dark design uses borders (trail-border) instead of shadows for block separation.
// No box-shadow is used in the design system.
// This file documents the border pattern used everywhere.

export const borders = {
  card:       '1px solid #1E3530',   // border border-trail-border
  tableCell:  '0.5px solid #1E3530', // border-[0.5px] border-trail-border
  gridLine:   '#1E3530b3',           // trail-border at 70% opacity (chart grid lines)
} as const

// Tailwind class shorthands
export const tw = {
  card:      'border border-trail-border',
  tableCell: 'border-[0.5px] border-trail-border',
} as const
