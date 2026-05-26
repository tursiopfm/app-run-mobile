// DEPRECATED — read labels via the i18n system instead:
//   • Client components: const t = useT() ; t.charge.weeklyTitle
//   • Server components: const t = getServerT() ; t.charge.weeklyTitle
//
// This file is kept as a French-only fallback so any future accidental import
// still compiles, but it does NOT react to the language toggle.

import { fr } from '@/lib/i18n/dictionaries/fr'

export const tabs       = fr.tabs
export const sports     = fr.sports
export const sportLabel = fr.sportLabel
export const units      = fr.units
export const cockpit    = fr.cockpit
export const charge     = fr.charge
export const activities = fr.activities
export const settings   = fr.settings
export const profile    = fr.profile
export const intensity  = fr.intensity
export const weekTable  = fr.weekTable
export const plan       = fr.plan
export const courses    = fr.courses
export const common     = fr.common
export const hrZones    = fr.hrZones
