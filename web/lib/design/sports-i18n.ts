// Localized lookups for sport labels/short labels. SPORT_CONFIG only carries
// visual identity (color/emoji); user-facing strings come from the dictionary.

import type { Dict } from '@/lib/i18n/dictionaries/fr'
import type { SportKey } from './sports'

export function sportLabel(sport: SportKey, t: Dict): string {
  switch (sport) {
    case 'run':  return t.sports.run
    case 'ride': return t.sports.bike
    case 'swim': return t.sports.swim
    case 'all':  return t.sports.all
  }
}

export function sportShortLabel(sport: SportKey, t: Dict): string {
  switch (sport) {
    case 'run':  return t.sports.abbr.run
    case 'ride': return t.sports.abbr.bike
    case 'swim': return t.sports.abbr.swim
    case 'all':  return t.sports.abbr.all
  }
}
