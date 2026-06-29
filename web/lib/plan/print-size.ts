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
    hint: 'Petite carte à découper, à coller au dos de son téléphone.',
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

// Échelles pour la carte PROFIL (paysage-natif, largeur de design 280 mm = largeur
// de `.pcard` en impression), à la différence de la carte tableau (120 mm, tournée).
// Échelle ≈ largeur imprimable ÷ 280 mm (marges 8 mm). Valeurs indicatives — à
// affiner à l'aperçu Ctrl+P.
//   A5  : A4 portrait, (210 − 16) / 280 = 0.693
//   A4  : A4 paysage,  (297 − 16) / 280 = 1.004
//   iPhone : profil de poche réduit, ~150 / 280 = 0.536
export const PRINT_SIZE_DEFS_PROFILE: Record<PrintSize, PrintSizeDef> = {
  iphone: {
    key: 'iphone', label: 'Format iPhone',
    hint: 'Petit profil à découper, à glisser dans la poche.',
    pageRule: 'size:A4 portrait;margin:8mm;', scale: 0.536,
  },
  a5: {
    key: 'a5', label: 'Format A5',
    hint: 'Profil agrandi, en haut d\'une feuille A4 portrait.',
    pageRule: 'size:A4 portrait;margin:8mm;', scale: 0.693,
  },
  a4: {
    key: 'a4', label: 'Format A4',
    hint: 'Le profil remplit une feuille A4 en paysage.',
    pageRule: 'size:A4 landscape;margin:8mm;', scale: 1.004,
  },
}
