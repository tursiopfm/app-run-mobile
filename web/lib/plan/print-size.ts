// Config de la taille d'impression de la carte de course : iPhone (défaut) / A5 / A4.
// Pilote UNIQUEMENT le PDF / impression (l'image et le partage sont des rasters de
// pixels, sans format papier). Mémorisé en localStorage. Calqué sur print-columns.ts.

export type PrintSize = 'iphone' | 'a5' | 'a4'

export interface PrintSizeDef {
  key: PrintSize
  label: string      // libellé dans le dialogue
  hint: string       // courte explication sous le libellé
  pageRule: string   // contenu de @page (size + margin)
  scale: number      // facteur appliqué à .card en @media print (×1 = no-op)
}

// Échelle = largeur imprimable ÷ 120 mm (largeur de design de la carte), marges 8 mm :
//   A5 : carte agrandie en haut d'une A4 portrait — largeur (210 − 16) / 120 = 1.617
//   A4 paysage : (297 − 16) / 120 = 2.342
export const PRINT_SIZE_DEFS: Record<PrintSize, PrintSizeDef> = {
  iphone: {
    key: 'iphone', label: 'Format iPhone',
    hint: 'Ajustée au dos du téléphone (140 × 66 mm), à découper et coller.',
    // scale ignoré pour iPhone : l'échelle est CALCULÉE (cf. fitIphoneScale),
    // la hauteur de la carte dépendant du nombre de points de la course.
    pageRule: 'size:A4 portrait;margin:8mm;', scale: 1,
  },
  a5: {
    key: 'a5', label: 'Format A5',
    hint: 'Carte agrandie, en haut d\'une feuille A4 portrait.',
    pageRule: 'size:A4 portrait;margin:8mm;', scale: 1.617,
  },
  a4: {
    key: 'a4', label: 'Format A4',
    hint: 'La carte remplit une feuille A4 en paysage.',
    pageRule: 'size:A4 landscape;margin:8mm;', scale: 2.342,
  },
}

export const DEFAULT_PRINT_SIZE: PrintSize = 'iphone'

// Dos d'un iPhone 15/16/17 : 146,6 × 70,6 mm. On garde ~3 mm de marge tout autour
// pour que la carte se colle sans déborder ni gêner les bords arrondis.
export const IPHONE_CARD_MM = { w: 140, h: 66 }

// Échelle à appliquer à la carte pour qu'elle tienne PILE au dos du téléphone.
// La largeur est fixe (120 mm de design) mais la hauteur dépend du nombre de
// points : c'est elle qui commande dès qu'une course est longue, d'où le calcul
// à partir de la hauteur MESURÉE plutôt qu'un facteur en dur.
// Bornée à [0,8 ; 1,2] : au-delà, réduire encore rendrait le tableau illisible —
// mieux vaut déborder un peu et retirer des colonnes.
export function fitIphoneScale(cardWmm: number, cardHmm: number): number {
  if (!(cardWmm > 0) || !(cardHmm > 0)) return 1
  const s = Math.min(IPHONE_CARD_MM.w / cardWmm, IPHONE_CARD_MM.h / cardHmm)
  return Math.round(Math.min(Math.max(s, 0.8), 1.2) * 1000) / 1000
}

const LS_KEY = 'tc:plan:print-size:v1'

export function loadPrintSize(): PrintSize {
  if (typeof window === 'undefined') return DEFAULT_PRINT_SIZE
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (raw === 'iphone' || raw === 'a5' || raw === 'a4') return raw
    return DEFAULT_PRINT_SIZE
  } catch {
    return DEFAULT_PRINT_SIZE
  }
}

export function savePrintSize(size: PrintSize): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(LS_KEY, size) } catch { /* quota / navigation privée */ }
}
