// Config des colonnes de l'export PDF (carte de course) : choix + ordre,
// personnalisables par l'utilisateur (cf. PrintColumnsDialog) et mémorisés en
// localStorage. Le rendu de la cellule vit dans la page print (switch sur key).

export type PrintColKey =
  | 'point' | 'km' | 'cum' | 'inter' | 'dplus' | 'dmoins' | 'rav' | 'obj' | 'objclock' | 'segt' | 'bh'

export interface PrintColDef {
  key: PrintColKey
  label: string      // libellé dans la fenêtre de personnalisation
  th: string         // en-tête dans la carte
  weight: number     // largeur relative (colgroup, table-layout fixed)
  align: 'l' | 'r' | 'c'
  fixed?: boolean    // non masquable (ex : Point)
}

// Poids harmonisés : Point ~2.4× une colonne data, toutes les colonnes data
// égales (1.0) — sauf Ravito (1.9) qui doit loger jusqu'à 5 badges (L S C BV A).
// Répartis sur les colonnes VISIBLES → même équilibre quel que soit le choix.
export const PRINT_COL_DEFS: Record<PrintColKey, PrintColDef> = {
  point:  { key: 'point',  label: 'Point',             th: 'Point',    weight: 2.4,  align: 'l', fixed: true },
  km:     { key: 'km',     label: 'Km (cumulé)',       th: 'Km',       weight: 1.0,  align: 'r' },
  cum:    { key: 'cum',    label: 'Σ D+ (cumulé)',     th: 'ΣD+',      weight: 1.0,  align: 'r' },
  inter:  { key: 'inter',  label: 'Inter (tronçon)',   th: 'Inter',    weight: 1.0,  align: 'r' },
  dplus:  { key: 'dplus',  label: '▲ D+ (tronçon)',    th: '▲D+',      weight: 1.0,  align: 'r' },
  dmoins: { key: 'dmoins', label: '▼ D− (tronçon)',    th: '▼D−',      weight: 1.0,  align: 'r' },
  rav:    { key: 'rav',    label: 'Ravito',            th: 'Ravito',   weight: 1.9,  align: 'c' },
  obj:      { key: 'obj',      label: 'Objectif',           th: 'Objectif', weight: 1.0,  align: 'r' },
  objclock: { key: 'objclock', label: 'Heure (à la montre)', th: 'Heure',   weight: 1.0,  align: 'r' },
  segt:     { key: 'segt',     label: 'Temps tronçon',      th: 'Tps',      weight: 1.0,  align: 'r' },
  bh:       { key: 'bh',       label: 'Barrière',           th: 'Barrière', weight: 1.0,  align: 'r' },
}

export const DEFAULT_PRINT_ORDER: PrintColKey[] =
  ['point', 'km', 'cum', 'inter', 'dplus', 'dmoins', 'rav', 'obj', 'objclock', 'segt', 'bh']

// Colonnes masquées par défaut (opt-in : l'utilisateur les active dans la fenêtre).
const DEFAULT_HIDDEN: PrintColKey[] = ['objclock']

export interface PrintColConfig {
  order: PrintColKey[]   // toutes les clés connues, réordonnées
  hidden: PrintColKey[]  // sous-ensemble masqué
}

export const DEFAULT_PRINT_CONFIG: PrintColConfig = { order: DEFAULT_PRINT_ORDER, hidden: [...DEFAULT_HIDDEN] }

const LS_KEY = 'tc:plan:print-cols:v1'

// Normalise : garantit que `order` contient exactement toutes les clés connues
// une seule fois (tolère un LS corrompu / une version de colonnes qui évolue).
function sanitize(cfg: Partial<PrintColConfig>): PrintColConfig {
  const known = new Set(DEFAULT_PRINT_ORDER)
  const order = (cfg.order ?? []).filter((k): k is PrintColKey => known.has(k as PrintColKey))
  const hidden = (cfg.hidden ?? [])
    .filter((k): k is PrintColKey => known.has(k as PrintColKey) && !PRINT_COL_DEFS[k].fixed)
  for (const k of DEFAULT_PRINT_ORDER) {
    if (!order.includes(k)) {
      order.push(k)
      // colonne nouvellement connue (config antérieure) : masquée par défaut si
      // opt-in, pour ne pas l'imposer aux utilisateurs existants.
      if (DEFAULT_HIDDEN.includes(k) && !hidden.includes(k)) hidden.push(k)
    }
  }
  return { order, hidden }
}

export function loadPrintColConfig(): PrintColConfig {
  if (typeof window === 'undefined') return DEFAULT_PRINT_CONFIG
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return DEFAULT_PRINT_CONFIG
    return sanitize(JSON.parse(raw) as Partial<PrintColConfig>)
  } catch {
    return DEFAULT_PRINT_CONFIG
  }
}

export function savePrintColConfig(cfg: PrintColConfig): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(cfg)) } catch { /* quota / privé */ }
}

// Colonnes visibles, dans l'ordre choisi.
export function visiblePrintCols(cfg: PrintColConfig): PrintColKey[] {
  return cfg.order.filter((k) => !cfg.hidden.includes(k))
}
