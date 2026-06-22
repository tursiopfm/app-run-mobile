import type { WaypointSupply } from '@/types/plan'
import { light } from '@/lib/design/colors'

// Ordre canonique d'affichage (identique au tableau de course).
export const SUPPLY_ORDER: readonly WaypointSupply[] = [
  'liquid', 'solid', 'hot', 'base_vie', 'assistance',
]

// Lettre + libellé + couleur de chaque catégorie. Couleurs = valeurs LIGHT de
// colors.ts (identiques aux puces du tableau, texte blanc lisible sur fond clair) ;
// violet en dur pour l'assistance, comme le tableau (WaypointsTable .chip.ass).
export const SUPPLY_META: Record<WaypointSupply, { letter: string; label: string; color: string }> = {
  liquid:     { letter: 'L',  label: 'Liquide',    color: light.seriesBlue },   // #1D8FC6
  solid:      { letter: 'S',  label: 'Solide',     color: light.seriesYellow }, // #CC9200
  hot:        { letter: 'C',  label: 'Chaud',      color: light.seriesRed },    // #D94F45
  base_vie:   { letter: 'BV', label: 'Base vie',   color: light.greenOk },      // #138A52
  assistance: { letter: 'A',  label: 'Assistance', color: '#7C5CFC' },
}

// Vue graphe : une seule puce « nourriture » (chaud ⊃ solide ⊃ liquide), puis
// base vie, puis assistance.
export function chartChips(supplies: WaypointSupply[]): WaypointSupply[] {
  const out: WaypointSupply[] = []
  if (supplies.includes('hot')) out.push('hot')
  else if (supplies.includes('solid')) out.push('solid')
  else if (supplies.includes('liquid')) out.push('liquid')
  if (supplies.includes('base_vie')) out.push('base_vie')
  if (supplies.includes('assistance')) out.push('assistance')
  return out
}

// Vue fiche : toutes les puces présentes, ordre canonique.
export function allChips(supplies: WaypointSupply[]): WaypointSupply[] {
  return SUPPLY_ORDER.filter((s) => supplies.includes(s))
}
