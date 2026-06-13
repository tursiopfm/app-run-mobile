# Taille de la carte de course (PDF) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'utilisateur de choisir la taille d'impression de la carte de course (iPhone par défaut / A5 / A4), de sorte que le PDF sorte au bon format papier.

**Architecture:** Un réglage `PrintSize` (mémorisé en localStorage) pilote, au moment de l'impression uniquement, le `@page { size }` et un `transform: scale()` sur `.card`. L'image et le partage (rasters de pixels) restent inchangés. UI : la ligne « Personnaliser les colonnes » devient deux demi-boutons (Colonnes / Taille), le second ouvrant un bottom-sheet à 3 options.

**Tech Stack:** Next.js 14 (App Router, client component), TypeScript, Tailwind, lucide-react, `react-dom` createPortal, Jest (jsdom).

**Convention repo (override des règles du skill) :**
- **Pas de commits par tâche.** Règle CLAUDE.md : on commit uniquement quand Franck le demande. Implémenter + vérifier ; commit groupé en dernière tâche, **gated** sur l'accord de Franck, et **sur une branche** (on est sur `master`).
- Tests/jest : `cd` absolu vers `web/` (cwd Bash non fiable). Ne lancer que la suite concernée (~50 tests i18n échouent en pré-existant).

---

### Task 1: Lib `print-size` (type + specs + persistance)

**Files:**
- Create: `web/lib/plan/print-size.ts`
- Test: `web/__tests__/lib/plan/print-size.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/__tests__/lib/plan/print-size.test.ts`:

```ts
import {
  loadPrintSize, savePrintSize, PRINT_SIZE_DEFS, DEFAULT_PRINT_SIZE,
} from '@/lib/plan/print-size'

describe('print-size', () => {
  beforeEach(() => window.localStorage.clear())

  it('default is iphone when nothing stored', () => {
    expect(DEFAULT_PRINT_SIZE).toBe('iphone')
    expect(loadPrintSize()).toBe('iphone')
  })

  it('round-trips a saved size', () => {
    savePrintSize('a4')
    expect(loadPrintSize()).toBe('a4')
  })

  it('falls back to default on a corrupted value', () => {
    window.localStorage.setItem('tc:plan:print-size:v1', 'letter')
    expect(loadPrintSize()).toBe('iphone')
  })

  it('exposes coherent specs (scale ÷ 120mm width, 8mm margins)', () => {
    expect(PRINT_SIZE_DEFS.iphone.scale).toBe(1)
    expect(PRINT_SIZE_DEFS.iphone.pageRule).toContain('A4 portrait')
    expect(PRINT_SIZE_DEFS.a5.pageRule).toContain('A5 landscape')
    expect(PRINT_SIZE_DEFS.a4.pageRule).toContain('A4 landscape')
    expect(PRINT_SIZE_DEFS.a5.scale).toBeCloseTo(1.617, 2)
    expect(PRINT_SIZE_DEFS.a4.scale).toBeCloseTo(2.342, 2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (Bash): `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/plan/print-size.test.ts`
Expected: FAIL — `Cannot find module '@/lib/plan/print-size'`.

- [ ] **Step 3: Write the implementation**

Create `web/lib/plan/print-size.ts`:

```ts
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
//   A5 paysage : (210 − 16) / 120 = 1.617
//   A4 paysage : (297 − 16) / 120 = 2.342
export const PRINT_SIZE_DEFS: Record<PrintSize, PrintSizeDef> = {
  iphone: {
    key: 'iphone', label: 'Format iPhone',
    hint: 'Petite carte à découper, en haut d’une feuille A4 (poche de veste).',
    pageRule: 'size:A4 portrait;margin:8mm;', scale: 1,
  },
  a5: {
    key: 'a5', label: 'Format A5',
    hint: 'La carte remplit une feuille A5 en paysage.',
    pageRule: 'size:A5 landscape;margin:8mm;', scale: 1.617,
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
```

- [ ] **Step 4: Run test to verify it passes**

Run (Bash): `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/plan/print-size.test.ts`
Expected: PASS (4 tests).

---

### Task 2: Composant `PrintSizeDialog`

**Files:**
- Create: `web/components/plan/PrintSizeDialog.tsx`

Pattern : copie l'habillage de `web/components/plan/PrintColumnsDialog.tsx` (portal, overlay, bottom-sheet mobile / centré desktop) mais avec 3 radios au lieu du DnD.

- [ ] **Step 1: Write the component**

Create `web/components/plan/PrintSizeDialog.tsx`:

```tsx
'use client'

// Fenêtre de choix de la taille d'impression de la carte (iPhone / A5 / A4).
// Persistance gérée par le parent. Même habillage que PrintColumnsDialog.
import { createPortal } from 'react-dom'
import { PRINT_SIZE_DEFS, type PrintSize } from '@/lib/plan/print-size'

type Props = {
  open: boolean
  value: PrintSize
  onChange: (next: PrintSize) => void
  onClose: () => void
}

const ORDER: PrintSize[] = ['iphone', 'a5', 'a4']

export function PrintSizeDialog({ open, value, onChange, onClose }: Props) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Personnaliser la taille de la carte"
    >
      <div
        className="bg-trail-card border border-trail-border rounded-t-[20px] md:rounded-[16px] w-full max-w-md max-h-[90vh] overflow-y-auto p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-trail-border mx-auto mb-4 md:hidden" />
        <h2 className="font-display text-[16px] font-semibold text-trail-text mb-1">Taille de la carte</h2>
        <p className="text-caption text-trail-muted mb-4">Détermine le format d’impression du PDF (sans effet sur l’image / le partage).</p>

        <div className="space-y-2">
          {ORDER.map((k) => {
            const def = PRINT_SIZE_DEFS[k]
            const active = value === k
            return (
              <label
                key={k}
                className={`flex items-start gap-3 px-3 py-3 rounded-[10px] border cursor-pointer select-none ${active ? 'border-trail-primary' : 'border-trail-border'} bg-trail-surface`}
              >
                <input
                  type="radio"
                  name="print-size"
                  checked={active}
                  onChange={() => onChange(k)}
                  className="w-4 h-4 mt-0.5"
                />
                <span className="flex-1">
                  <span className="block text-body font-semibold text-trail-text">{def.label}</span>
                  <span className="block text-caption text-trail-muted">{def.hint}</span>
                </span>
              </label>
            )
          })}
        </div>

        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[10px] bg-trail-primary text-white text-body font-semibold"
          >
            Terminé
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
```

> Note : pas de teinte `bg-trail-primary/10` (l'opacité Tailwind sur une couleur CSS-var n'est pas garantie ici) — l'état actif se marque par `border-trail-primary`.

---

### Task 3: Intégration dans la page print

**Files:**
- Modify: `web/app/(main)/plan/courses/[id]/print/page.tsx`

- [ ] **Step 1: Imports**

Remplacer la ligne d'import lucide :
```tsx
import { FileText, Image as ImageIcon, Share2, Settings2 } from 'lucide-react'
```
par :
```tsx
import { FileText, Image as ImageIcon, Share2, Settings2, Ruler } from 'lucide-react'
import { loadPrintSize, savePrintSize, PRINT_SIZE_DEFS, DEFAULT_PRINT_SIZE, type PrintSize } from '@/lib/plan/print-size'
import { PrintSizeDialog } from '@/components/plan/PrintSizeDialog'
```

- [ ] **Step 2: État + chargement + sauvegarde**

Après la ligne :
```tsx
  const [dialogOpen, setDialogOpen] = useState(false)
```
ajouter :
```tsx
  const [size, setSize] = useState<PrintSize>(DEFAULT_PRINT_SIZE)
  const [sizeDialogOpen, setSizeDialogOpen] = useState(false)
```

Après le `useEffect` existant `useEffect(() => { setCfg(loadPrintColConfig()) }, [])` ajouter :
```tsx
  useEffect(() => { setSize(loadPrintSize()) }, [])
```

Après `const updateCfg = ...` ajouter :
```tsx
  const updateSize = (next: PrintSize) => { setSize(next); savePrintSize(next) }
```

- [ ] **Step 3: `@page` dynamique + scale d'impression**

Dans le bloc `<style>{`…`}</style>`, remplacer la ligne statique :
```css
        @page{size:A4 portrait;margin:8mm;}
```
par (interpolation — le `<style>` est déjà un template literal) :
```css
        @page{${PRINT_SIZE_DEFS[size].pageRule}}
```

Toujours dans `@media print`, remplacer la règle `.card` :
```css
          .pdfroot .card{position:static !important;transform:none !important;top:auto;left:auto;margin:0 auto;box-shadow:none;border:.5px solid var(--line);}
```
par (le `transform:none` devient un scale calé en haut-centre ; ×1 pour iPhone = no-op) :
```css
          .pdfroot .card{position:static !important;transform:scale(${PRINT_SIZE_DEFS[size].scale}) !important;transform-origin:top center !important;top:auto;left:auto;margin:0 auto;box-shadow:none;border:.5px solid var(--line);}
```

- [ ] **Step 4: Style de la grille 2 colonnes**

Dans la CSS de la toolbar, après la règle `.pdfroot .toolbar .actions{...}` ajouter :
```css
        .pdfroot .toolbar .actions2{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;}
```

- [ ] **Step 5: Split du bouton en deux demi-boutons**

Remplacer :
```tsx
        <button className="btn ghost" onClick={() => setDialogOpen(true)}><Settings2 size={16} /> Personnaliser les colonnes</button>
```
par :
```tsx
        <div className="actions2">
          <button className="btn ghost" onClick={() => setDialogOpen(true)}><Settings2 size={16} /> Colonnes</button>
          <button className="btn ghost" onClick={() => setSizeDialogOpen(true)}><Ruler size={16} /> Taille</button>
        </div>
```

- [ ] **Step 6: Caption générique (plus de « feuille A4 » en dur)**

Remplacer la `<p className="caption">…</p>` par :
```tsx
      <p className="caption">{"Les colonnes choisies s'appliquent aux trois formats (PDF, image, partage) ; la taille ne change que le PDF. Pince à deux doigts pour zoomer l'aperçu. À l'impression : carte à l'horizontale, calée en haut de la feuille. Découpe, plastifie."}</p>
```

- [ ] **Step 7: Monter le dialogue Taille**

Juste après :
```tsx
      <PrintColumnsDialog open={dialogOpen} config={cfg} onChange={updateCfg} onClose={() => setDialogOpen(false)} />
```
ajouter :
```tsx
      <PrintSizeDialog open={sizeDialogOpen} value={size} onChange={updateSize} onClose={() => setSizeDialogOpen(false)} />
```

---

### Task 4: Vérification + commit (gated)

**Files:** aucun nouveau.

- [ ] **Step 1: Jest (suite ciblée)**

Run (Bash): `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/plan/print-size.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 2: Types**

Run (Bash): `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur dans `print-size.ts`, `PrintSizeDialog.tsx`, `print/page.tsx`.

- [ ] **Step 3: Lint**

Run (Bash): `cd /c/Users/Franc/app-run-mobile/web && npx next lint --file app/\(main\)/plan/courses/\[id\]/print/page.tsx --file components/plan/PrintSizeDialog.tsx --file lib/plan/print-size.ts`
(ou `npm run lint` si la cible par fichier pose souci)
Expected: pas d'erreur.

- [ ] **Step 4: Vérification visuelle (Franck)**

Sur `npm run dev`, page `/plan/courses/<id>/print` :
- Le bouton « Colonnes » + « Taille » s'affichent côte à côte.
- « Taille » ouvre le bottom-sheet (3 options, iPhone coché par défaut).
- iPhone : aperçu Ctrl+P identique à l'actuel (A4 portrait, petite carte en haut).
- A5 / A4 : aperçu Ctrl+P → carte paysage remplissant une feuille A5 / A4, calée en haut.
- Image / Partager : identiques quel que soit le format.
- Le choix persiste après rechargement.

- [ ] **Step 5: Commit (UNIQUEMENT après accord de Franck)**

Sur `master` → créer d'abord une branche :
```bash
git checkout -b feat/print-card-size
git add web/lib/plan/print-size.ts web/components/plan/PrintSizeDialog.tsx "web/app/(main)/plan/courses/[id]/print/page.tsx" web/docs/superpowers/specs/2026-06-13-print-card-size-design.md web/docs/superpowers/plans/2026-06-13-print-card-size.md
git commit -m "feat(plan): taille d'impression de la carte (iPhone/A5/A4)"
```

---

## Self-review

- **Couverture spec :** 3 formats + scales (Task 1) ✓ ; UI 2 demi-boutons + dialogue 3 radios (Tasks 2,3) ✓ ; `@page` dynamique + scale print (Task 3) ✓ ; image/partage inchangés (rien touché côté `renderJpeg`) ✓ ; persistance localStorage (Task 1) ✓ ; iPhone = comportement actuel (scale 1, A4 portrait) ✓.
- **Placeholders :** aucun — tout le code est fourni.
- **Cohérence des types :** `PrintSize`, `PRINT_SIZE_DEFS`, `loadPrintSize/savePrintSize`, `DEFAULT_PRINT_SIZE` identiques entre lib, dialogue et page ; props `PrintSizeDialog { open, value, onChange, onClose }` cohérentes avec l'appel en Task 3 Step 7.
- **Limite connue (spec) :** échelle calée sur la largeur ; carte très longue → dépassement hauteur possible en A4. Documenté, non traité.
