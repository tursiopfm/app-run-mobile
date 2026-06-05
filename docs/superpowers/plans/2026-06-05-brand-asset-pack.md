# Brand Asset Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Décliner le LogoMark (TrajectoryLine miniature : départ → étapes → drapeau) en pack d'assets système (favicon, PWA, Apple, monochrome, Open Graph) **en preview** — sans toucher aux assets live ni aux écrans métier.

**Architecture :** Source unique = `lib/brand/logo-geometry.ts` (constantes) + `lib/brand/logo-svg.ts` (builder SVG pur). Le composant de preview React (`BrandGlyph`) et le script de rastérisation (`scripts/brand/gen-brand-assets.ts` via `tsx` + `sharp`) appellent **le même** builder → l'écran et les PNG exportés sont identiques. Sorties dans `public/brand-preview/`. Le LogoMark live (`LogoTrailCockpit.tsx`) n'est **pas** modifié.

**Tech Stack :** TypeScript, Next.js 14 (App Router), Jest + ts-jest, `sharp` (rastérisation SVG→PNG, devDep), `tsx` (exécution du script TS, devDep), encodeur ICO maison, Playwright MCP (capture OG + vérif visuelle).

**Spec :** `docs/superpowers/specs/2026-06-05-brand-asset-pack-design.md`

**Conventions d'exécution :**
- Lancer jest/tsc/lint **depuis `web/`** (cwd peu fiable : `cd c:\Users\Franc\app-run-mobile\web` d'abord).
- **Ne pas** lancer `next build` en local (incident `.next`) ; vérif autoritative = `tsc --noEmit` + `next lint` + `jest`.
- Toutes les valeurs géométriques viennent de la spec ; `TRAJ_LEN = 38.58` a été mesuré (`SVGPathElement.getTotalLength()`).

---

### Task 1: Branche de travail

**Files:** aucun (git).

- [ ] **Step 1: Créer la branche**

Run (depuis la racine repo) :
```bash
git checkout -b feat/brand-asset-pack
```
Expected: `Switched to a new branch 'feat/brand-asset-pack'`

---

### Task 2: Géométrie partagée (constantes)

**Files:**
- Create: `web/lib/brand/logo-geometry.ts`

- [ ] **Step 1: Créer le module de constantes**

```ts
// web/lib/brand/logo-geometry.ts
// Géométrie du glyphe de marque — TrajectoryLine miniature (viewBox 0 0 48 48).
// Source de vérité partagée par le builder SVG (écran + export PNG). Aucune logique.

export const VIEWBOX = '0 0 48 48'
export const TRAJ = 'M10,37 C 14,36 15,31 19,30.5 C 23,30 24,33 27.5,31.5 C 31,30 32,22 35,15'
// Longueur du tracé mesurée via SVGPathElement.getTotalLength() — sert aux dasharray
// en unités absolues (rendu déterministe navigateur + sharp/librsvg, sans pathLength).
export const TRAJ_LEN = 38.58
export const SOLID_FRACTION = 0.6 // part « accomplie » (plein) ; le reste est en pointillé

export type Tier = 'full' | 'compact'
export type Variant = 'orange' | 'deep' | 'mono-white' | 'mono-black'
export type Shape = 'squircle' | 'bleed' | 'none'

export const START = { x: 10, y: 37 } as const
export const END = { x: 35, y: 15 } as const // base du drapeau
export const WAYPOINT_REACHED = { x: 19, y: 30.5 } as const
export const WAYPOINT_UPCOMING = { x: 27.5, y: 31.5 } as const

export const TIER: Record<Tier, { stroke: number; start: number; node: number; mast: number; fan: number }> = {
  full: { stroke: 3, start: 2.2, node: 2.1, mast: 1.8, fan: 6.4 },
  compact: { stroke: 3.8, start: 2.7, node: 2.1, mast: 2.4, fan: 7.2 },
}

export const VARIANT: Record<Variant, { fill: string | null; glyph: string; surface: string }> = {
  orange: { fill: '#FF7900', glyph: '#FFFFFF', surface: '#FF7900' },
  deep: { fill: '#0B0F14', glyph: '#FF7900', surface: '#0B0F14' },
  'mono-white': { fill: null, glyph: '#FFFFFF', surface: 'none' },
  'mono-black': { fill: null, glyph: '#13201D', surface: 'none' },
}

export const MASKABLE_SCALE = 0.62 // glyphe inscrit dans la zone sûre Android (~80%)
```

- [ ] **Step 2: Vérifier la compilation des types**

Run: `cd c:\Users\Franc\app-run-mobile\web ; npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add web/lib/brand/logo-geometry.ts
git commit -m "feat(brand): géométrie partagée du glyphe (TrajectoryLine miniature)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Builder SVG (source unique de rendu) — TDD

**Files:**
- Create: `web/lib/brand/logo-svg.ts`
- Test: `web/__tests__/lib/brand/logo-svg.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// web/__tests__/lib/brand/logo-svg.test.ts
import { renderLogoMarkSvg } from '@/lib/brand/logo-svg'

describe('renderLogoMarkSvg', () => {
  it('émet un SVG valide en viewBox 48', () => {
    const svg = renderLogoMarkSvg()
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('viewBox="0 0 48 48"')
  })

  it('variante orange = squircle #FF7900 + glyphe blanc', () => {
    const svg = renderLogoMarkSvg({ variant: 'orange' })
    expect(svg).toContain('rx="13"')
    expect(svg).toContain('fill="#FF7900"')
    expect(svg).toContain('stroke="#FFFFFF"')
  })

  it('variante deep = fond #0B0F14 + glyphe orange', () => {
    const svg = renderLogoMarkSvg({ variant: 'deep' })
    expect(svg).toContain('fill="#0B0F14"')
    expect(svg).toContain('stroke="#FF7900"')
  })

  it('variante mono-white = aucun fond (pas de rect)', () => {
    const svg = renderLogoMarkSvg({ variant: 'mono-white' })
    expect(svg).not.toContain('<rect')
    expect(svg).toContain('stroke="#FFFFFF"')
  })

  it('compact = ni pointillé ni étape à venir', () => {
    const svg = renderLogoMarkSvg({ tier: 'compact' })
    expect(svg).not.toContain('stroke-dasharray')
    expect(svg).not.toContain('27.5') // coord de l'étape à venir, absente en compact
  })

  it('full = pointillé présent', () => {
    const svg = renderLogoMarkSvg({ tier: 'full' })
    expect(svg).toContain('stroke-dasharray')
  })

  it('maskable = fond bord-à-bord + glyphe scalé dans la zone sûre', () => {
    const svg = renderLogoMarkSvg({ maskable: true })
    expect(svg).toContain('width="48"') // rect plein bord-à-bord
    expect(svg).toContain('scale(0.62)')
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `cd c:\Users\Franc\app-run-mobile\web ; npx jest __tests__/lib/brand/logo-svg.test.ts`
Expected: FAIL — `Cannot find module '@/lib/brand/logo-svg'`.

- [ ] **Step 3: Implémenter le builder**

```ts
// web/lib/brand/logo-svg.ts
// Builder SVG pur (aucune dépendance React) — source unique de rendu du glyphe,
// utilisée par le composant preview (BrandGlyph) ET le script d'export (sharp).
import {
  VIEWBOX, TRAJ, TRAJ_LEN, SOLID_FRACTION,
  START, END, WAYPOINT_REACHED, WAYPOINT_UPCOMING,
  TIER, VARIANT, MASKABLE_SCALE,
  type Tier, type Variant, type Shape,
} from './logo-geometry'

export type RenderOpts = {
  tier?: Tier
  variant?: Variant
  size?: number
  /** Fond : squircle arrondi (défaut) · bleed plein bord-à-bord · none (transparent). */
  shape?: Shape
  /** PWA maskable : force le bleed + inscrit le glyphe dans la zone sûre. */
  maskable?: boolean
  /** Halo décoratif (off par défaut pour des icônes nettes). */
  glow?: boolean
}

function flag(glyph: string, mast: number, fan: number, node: number): string {
  const { x, y } = END
  const tip = y - 9
  return (
    `<line x1="${x}" y1="${y}" x2="${x}" y2="${tip}" stroke="${glyph}" stroke-width="${mast}" stroke-linecap="round"/>` +
    `<path d="M${x},${tip} L${x + fan},${(tip + fan * 0.27).toFixed(2)} L${x},${(tip + fan * 0.54).toFixed(2)} Z" fill="${glyph}"/>` +
    `<circle cx="${x}" cy="${y}" r="${node}" fill="${glyph}"/>`
  )
}

function fullGlyph(glyph: string, surface: string, glow: boolean): string {
  const t = TIER.full
  const solid = (TRAJ_LEN * SOLID_FRACTION).toFixed(2)
  const hole = surface && surface !== 'none' ? surface : 'none'
  const glowStyle = glow ? ` style="filter:drop-shadow(0 0 1.6px ${glyph})"` : ''
  return (
    // reste à parcourir — pointillé sur tout le tracé (dots via dash + linecap rond)
    `<path d="${TRAJ}" fill="none" stroke="${glyph}" stroke-opacity="0.5" stroke-width="${t.stroke}" stroke-linecap="round" stroke-dasharray="0.5 2.6"/>` +
    // accompli — plein sur les premiers SOLID_FRACTION (unités absolues)
    `<path d="${TRAJ}" fill="none" stroke="${glyph}" stroke-width="${t.stroke}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${solid} ${TRAJ_LEN}"${glowStyle}/>` +
    `<circle cx="${START.x}" cy="${START.y}" r="${t.start}" fill="${glyph}"/>` +
    // étape atteinte (pleine) + étape à venir (anneau creux, centre = surface)
    `<circle cx="${WAYPOINT_REACHED.x}" cy="${WAYPOINT_REACHED.y}" r="2" fill="${glyph}"/>` +
    `<circle cx="${WAYPOINT_UPCOMING.x}" cy="${WAYPOINT_UPCOMING.y}" r="2.1" fill="${hole}" stroke="${glyph}" stroke-width="1.5"/>` +
    flag(glyph, t.mast, t.fan, t.node)
  )
}

function compactGlyph(glyph: string): string {
  const t = TIER.compact
  return (
    `<path d="${TRAJ}" fill="none" stroke="${glyph}" stroke-width="${t.stroke}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="${START.x}" cy="${START.y}" r="${t.start}" fill="${glyph}"/>` +
    flag(glyph, t.mast, t.fan, t.node)
  )
}

export function renderLogoMarkSvg(opts: RenderOpts = {}): string {
  const { tier = 'full', variant = 'orange', size = 512, shape = 'squircle', maskable = false, glow = false } = opts
  const v = VARIANT[variant]
  const glyph = tier === 'compact' ? compactGlyph(v.glyph) : fullGlyph(v.glyph, v.surface, glow)

  const effShape: Shape = maskable ? 'bleed' : shape
  let bg = ''
  if (v.fill && effShape === 'squircle') bg = `<rect x="3" y="3" width="42" height="42" rx="13" fill="${v.fill}"/>`
  else if (v.fill && effShape === 'bleed') bg = `<rect x="0" y="0" width="48" height="48" fill="${v.fill}"/>`

  let body = glyph
  if (maskable) {
    const s = MASKABLE_SCALE
    const tr = (24 * (1 - s)).toFixed(2)
    body = `<g transform="translate(${tr} ${tr}) scale(${s})">${glyph}</g>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${VIEWBOX}">${bg}${body}</svg>`
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `cd c:\Users\Franc\app-run-mobile\web ; npx jest __tests__/lib/brand/logo-svg.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/brand/logo-svg.ts web/__tests__/lib/brand/logo-svg.test.ts
git commit -m "feat(brand): builder SVG du glyphe (source unique écran/export)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Composant de preview `BrandGlyph`

**Files:**
- Create: `web/components/brand/BrandGlyph.tsx`

- [ ] **Step 1: Créer le composant**

Le builder produit une chaîne SVG contrôlée (aucune entrée utilisateur) → injection sûre via `dangerouslySetInnerHTML`. Utilisé uniquement dans `/design-system`.

```tsx
// web/components/brand/BrandGlyph.tsx
// Aperçu du glyphe de marque rendu via le MÊME builder que les PNG exportés.
// (Le LogoMark live, LogoTrailCockpit.tsx, reste inchangé.)
import { renderLogoMarkSvg, type RenderOpts } from '@/lib/brand/logo-svg'

export function BrandGlyph({ className, ...opts }: RenderOpts & { className?: string }) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: renderLogoMarkSvg(opts) }}
    />
  )
}
```

- [ ] **Step 2: Vérifier les types**

Run: `cd c:\Users\Franc\app-run-mobile\web ; npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add web/components/brand/BrandGlyph.tsx
git commit -m "feat(brand): composant preview BrandGlyph (design-system)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Encodeur ICO maison — TDD

**Files:**
- Create: `web/scripts/brand/ico.ts`
- Test: `web/__tests__/scripts/brand/ico.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// web/__tests__/scripts/brand/ico.test.ts
import { pngsToIco } from '@/scripts/brand/ico'

describe('pngsToIco', () => {
  it('produit un conteneur ICO valide (en-tête + compte + offset)', () => {
    const fake = Buffer.from([0x89, 0x50, 0x4e, 0x47]) // stub
    const ico = pngsToIco([
      { size: 16, png: fake },
      { size: 32, png: fake },
    ])
    expect(ico.readUInt16LE(0)).toBe(0) // réservé
    expect(ico.readUInt16LE(2)).toBe(1) // type 1 = icône
    expect(ico.readUInt16LE(4)).toBe(2) // 2 images
    // premier offset de données = 6 (header) + 16*2 (dir) = 38
    expect(ico.readUInt32LE(6 + 12)).toBe(38)
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `cd c:\Users\Franc\app-run-mobile\web ; npx jest __tests__/scripts/brand/ico.test.ts`
Expected: FAIL — `Cannot find module '@/scripts/brand/ico'`.

- [ ] **Step 3: Implémenter l'encodeur**

```ts
// web/scripts/brand/ico.ts
// Assemble plusieurs PNG (16/32/48…) en un unique .ico (PNG embarqué — supporté
// par tous les navigateurs modernes). Format ICONDIR + ICONDIRENTRY + données PNG.
export function pngsToIco(images: { size: number; png: Buffer }[]): Buffer {
  const count = images.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // réservé
  header.writeUInt16LE(1, 2) // type 1 = icône
  header.writeUInt16LE(count, 4) // nombre d'images

  const dir = Buffer.alloc(16 * count)
  let offset = 6 + 16 * count
  images.forEach((img, i) => {
    const b = i * 16
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, b) // largeur (0 = 256)
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, b + 1) // hauteur
    dir.writeUInt8(0, b + 2) // palette
    dir.writeUInt8(0, b + 3) // réservé
    dir.writeUInt16LE(1, b + 4) // plans de couleur
    dir.writeUInt16LE(32, b + 6) // bits par pixel
    dir.writeUInt32LE(img.png.length, b + 8) // taille des données
    dir.writeUInt32LE(offset, b + 12) // offset des données
    offset += img.png.length
  })

  return Buffer.concat([header, dir, ...images.map((i) => i.png)])
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `cd c:\Users\Franc\app-run-mobile\web ; npx jest __tests__/scripts/brand/ico.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/scripts/brand/ico.ts web/__tests__/scripts/brand/ico.test.ts
git commit -m "feat(brand): encodeur ICO maison (PNG embarqué)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Script de génération + dépendances + sortie `brand-preview/`

**Files:**
- Modify: `web/package.json` (devDeps `sharp`, `tsx` + script `gen:brand-assets`)
- Create: `web/scripts/brand/gen-brand-assets.ts`
- Generated: `web/public/brand-preview/*` (PNG, ICO, README)

- [ ] **Step 1: Installer les dépendances dev**

Run (depuis `web/`) :
```bash
cd c:\Users\Franc\app-run-mobile\web ; npm install -D sharp tsx
```
Expected: `sharp` et `tsx` ajoutés à `devDependencies`.

- [ ] **Step 2: Ajouter le script npm**

Dans `web/package.json`, ajouter à `"scripts"` :
```json
    "gen:brand-assets": "tsx scripts/brand/gen-brand-assets.ts"
```
(à insérer après la ligne `"test:watch"`, en respectant les virgules JSON.)

- [ ] **Step 3: Écrire le script de génération**

```ts
// web/scripts/brand/gen-brand-assets.ts
// Génère le pack d'assets de marque dans web/public/brand-preview/ (PREVIEW).
// Exécution : `npm run gen:brand-assets` (depuis web/). Idempotent.
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { renderLogoMarkSvg, type RenderOpts } from '../../lib/brand/logo-svg'
import { pngsToIco } from './ico'

const OUT = join(process.cwd(), 'public', 'brand-preview')

async function png(opts: RenderOpts, size: number): Promise<Buffer> {
  const svg = renderLogoMarkSvg({ ...opts, size })
  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
}

const README = `# Brand preview assets

> Générés par \`npm run gen:brand-assets\` — **preview uniquement**, ne remplacent pas les assets live.
> Source : \`web/lib/brand/logo-svg.ts\`. Spec : \`docs/superpowers/specs/2026-06-05-brand-asset-pack-design.md\`.

| Fichier | Taille(s) | Variante / palier | Usage |
|---|---|---|---|
| favicon.ico | 16+32+48 | A (16/32 compact, 48 full) | Onglet navigateur |
| favicon-16.png | 16 | A compact | Fallback PNG |
| favicon-32.png | 32 | A compact | Fallback PNG |
| favicon-48.png | 48 | A full | Fallback PNG |
| icon-192.png | 192 | A full, \`any\` | PWA (manifest \`any\`) |
| icon-512.png | 512 | A full, \`any\` | PWA (manifest \`any\`) |
| maskable-512.png | 512 | A full, plein bord-à-bord | PWA (manifest \`maskable\`) |
| apple-touch-icon.png | 180 | A full, opaque | iOS écran d'accueil |
| icon-mono-white.png | 512 | C blanc, transparent | Android themed / iOS tinted |
| icon-mono-black.png | 512 | C noir, transparent | Docs / fonds clairs |
| og-default.png | 1200×630 | Deep Mission + TrajectoryLine | Open Graph (généré séparément, capture Playwright) |

**Recommandation PWA : variante A (Orange).**
`

async function main() {
  await mkdir(OUT, { recursive: true })
  const write = (name: string, buf: Buffer) => writeFile(join(OUT, name), buf)

  // Favicon (chip orange) — compact ≤32, full à 48 + .ico multi-image
  const fav16 = await png({ variant: 'orange', tier: 'compact', shape: 'squircle' }, 16)
  const fav32 = await png({ variant: 'orange', tier: 'compact', shape: 'squircle' }, 32)
  const fav48 = await png({ variant: 'orange', tier: 'full', shape: 'squircle' }, 48)
  await write('favicon-16.png', fav16)
  await write('favicon-32.png', fav32)
  await write('favicon-48.png', fav48)
  await write('favicon.ico', pngsToIco([
    { size: 16, png: fav16 },
    { size: 32, png: fav32 },
    { size: 48, png: fav48 },
  ]))

  // PWA any (squircle orange, coins transparents)
  await write('icon-192.png', await png({ variant: 'orange', tier: 'full', shape: 'squircle' }, 192))
  await write('icon-512.png', await png({ variant: 'orange', tier: 'full', shape: 'squircle' }, 512))

  // PWA maskable (plein bord-à-bord, zone sûre)
  await write('maskable-512.png', await png({ variant: 'orange', tier: 'full', maskable: true }, 512))

  // Apple (opaque, plein bord-à-bord, sans coins cuits)
  await write('apple-touch-icon.png', await png({ variant: 'orange', tier: 'full', shape: 'bleed' }, 180))

  // Monochrome (transparent)
  await write('icon-mono-white.png', await png({ variant: 'mono-white', tier: 'full', shape: 'none' }, 512))
  await write('icon-mono-black.png', await png({ variant: 'mono-black', tier: 'full', shape: 'none' }, 512))

  await write('README.md', Buffer.from(README, 'utf8'))
  console.log('✓ brand-preview généré dans', OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 4: Générer les assets**

Run: `cd c:\Users\Franc\app-run-mobile\web ; npm run gen:brand-assets`
Expected: `✓ brand-preview généré dans …\public\brand-preview`.

- [ ] **Step 5: Vérifier les fichiers produits**

Run: `cd c:\Users\Franc\app-run-mobile\web ; node -e "const fs=require('fs');const d='public/brand-preview';console.log(fs.readdirSync(d).map(f=>f+' '+fs.statSync(d+'/'+f).size+'o').join('\n'))"`
Expected: 11 fichiers listés (favicon.ico, favicon-16/32/48.png, icon-192/512.png, maskable-512.png, apple-touch-icon.png, icon-mono-white/black.png, README.md) avec des tailles > 0. (og-default.png viendra en Task 7.)

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/package-lock.json web/scripts/brand/gen-brand-assets.ts web/public/brand-preview
git commit -m "feat(brand): script gen:brand-assets (sharp) + pack favicon/PWA/apple/mono

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Concept Open Graph (composant + capture 1200×630)

**Files:**
- Create: `web/components/brand/OgCard.tsx`
- Modify: `web/app/design-system/page.tsx` (ajouter une section OG hébergeant `OgCard`)
- Generated: `web/public/brand-preview/og-default.png`

- [ ] **Step 1: Créer le composant OG**

Dimensions fixes 1200×630. Réutilise `TrajectoryLine` (avec drapeau) + `BrandGlyph` en coin. `overflow-visible` sur la trajectoire pour ne pas clipper le drapeau.

```tsx
// web/components/brand/OgCard.tsx
// Concept Open Graph 1200×630 (preview). Rendu à taille réelle pour capture Playwright.
import { TrajectoryLine } from '@/components/brand/TrajectoryLine'
import { BrandGlyph } from '@/components/brand/BrandGlyph'

export function OgCard() {
  return (
    <div
      id="og-card"
      style={{ width: 1200, height: 630, position: 'relative', overflow: 'hidden',
        background: 'radial-gradient(120% 120% at 78% 18%, #15202b 0%, #0B0F14 58%)' }}
    >
      <div style={{ position: 'absolute', right: 96, top: 150, width: 540, height: 250, overflow: 'visible', opacity: 0.95 }}>
        <TrajectoryLine orientation="horizontal" progress={0.62} />
      </div>
      <div style={{ position: 'absolute', inset: 0, padding: '64px 72px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ background: '#FF7900', width: 40, height: 40, borderRadius: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <BrandGlyph variant="orange" tier="full" shape="none" size={30} />
          </span>
          <span className="font-display" style={{ fontWeight: 700, fontSize: 18, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            <span style={{ color: '#FF7900' }}>Trail</span> <span style={{ color: '#E2ECE9' }}>Cockpit</span>
          </span>
        </div>
        <div>
          <h2 className="font-display" style={{ fontSize: 74, lineHeight: 0.98, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: '#fff' }}>
            Trail Cockpit
          </h2>
          <p className="font-display" style={{ fontSize: 25, fontWeight: 600, color: '#FF7900', margin: '18px 0 0' }}>
            Préparer. Piloter. Accomplir.
          </p>
          <p className="font-body" style={{ fontSize: 20, color: '#8BA8A3', margin: '14px 0 0', maxWidth: 680, lineHeight: 1.45 }}>
            Le centre de contrôle intelligent des sportifs d&apos;endurance.
          </p>
        </div>
        <div className="font-body" style={{ fontSize: 15, color: '#5f7771', letterSpacing: '0.04em' }}>trailcockpit.run</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Ajouter la section OG dans `/design-system`**

Dans `web/app/design-system/page.tsx`, ajouter l'import en tête :
```tsx
import { OgCard } from '@/components/brand/OgCard'
```
Puis, juste avant le `<footer …>` final, insérer :
```tsx
        {/* Open Graph */}
        <Section id="og" title="Open Graph — concept (1200×630)">
          <div className="overflow-auto rounded-xl border border-ink-600">
            <OgCard />
          </div>
        </Section>
```

- [ ] **Step 3: Lancer le dev server**

Run (en arrière-plan, depuis `web/`): `cd c:\Users\Franc\app-run-mobile\web ; npm run dev`
Expected: `Local: http://localhost:3000`.

- [ ] **Step 4: Capturer l'OG via Playwright (MCP)**

- Naviguer : `http://localhost:3000/design-system`
- Capturer l'élément sélecteur `#og-card` en PNG vers `web/public/brand-preview/og-default.png` (taille native 1200×630, pas de fullPage).

Expected: `og-default.png` créé, ~1200×630.

- [ ] **Step 5: Arrêter le dev server**

Stopper la tâche `npm run dev` (TaskStop).

- [ ] **Step 6: Vérifier le PNG OG**

Run: `cd c:\Users\Franc\app-run-mobile\web ; node -e "const s=require('fs').statSync('public/brand-preview/og-default.png');console.log('og-default.png',s.size,'octets')"`
Expected: taille > 0.

- [ ] **Step 7: Commit**

```bash
git add web/components/brand/OgCard.tsx web/app/design-system/page.tsx web/public/brand-preview/og-default.png
git commit -m "feat(brand): concept Open Graph 1200x630 + capture

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Sections preview dans `/design-system`

**Files:**
- Modify: `web/app/design-system/page.tsx`

- [ ] **Step 1: Importer `BrandGlyph`**

En tête de `web/app/design-system/page.tsx`, ajouter :
```tsx
import { BrandGlyph } from '@/components/brand/BrandGlyph'
```

- [ ] **Step 2: Insérer les sections (après la `<Section id="logo">` existante)**

Ne **pas** modifier la section `logo` existante (LogoMark live). Insérer ce bloc juste après sa fermeture :

```tsx
        {/* Audit lisibilité — Full vs Micro */}
        <Section id="audit" title="App Icon — audit lisibilité (full vs micro)">
          <div className="grid gap-4 sm:grid-cols-2">
            {([['full', 'Mark complet'], ['compact', 'Mark micro']] as const).map(([tier, label]) => (
              <div key={tier} className="rounded-xl border border-ink-600 bg-ink-800 p-6">
                <p className="font-body text-[12px] text-trail-muted mb-4">{label}</p>
                <div className="flex flex-wrap items-end gap-5">
                  {[16, 24, 32, 64, 128].map((s) => (
                    <div key={s} className="flex flex-col items-center gap-1.5">
                      <BrandGlyph variant="orange" tier={tier} shape="squircle" size={s} />
                      <span className="font-body text-[11px] text-trail-muted">{s}px</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Variantes App Icon */}
        <Section id="appicon" title="App Icon — variantes A / B / C">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col items-center gap-2 rounded-xl border border-ink-600 bg-ink-700 p-6">
              <BrandGlyph variant="orange" tier="full" shape="squircle" size={104} />
              <p className="font-body text-[12px] font-semibold text-trail-text">A — Orange</p>
              <p className="font-body text-[11px] text-trail-muted">fond #FF7900 · glyphe blanc</p>
            </div>
            <div className="flex flex-col items-center gap-2 rounded-xl border border-ink-600 bg-ink-700 p-6">
              <BrandGlyph variant="deep" tier="full" shape="squircle" size={104} />
              <p className="font-body text-[12px] font-semibold text-trail-text">B — Deep Mission</p>
              <p className="font-body text-[11px] text-trail-muted">fond #0B0F14 · glyphe orange</p>
            </div>
            <div className="flex flex-col items-center gap-2 rounded-xl border border-ink-600 bg-ink-700 p-6">
              <div className="flex items-center gap-3 rounded-lg bg-ink-900 p-3">
                <BrandGlyph variant="mono-white" tier="full" shape="none" size={72} />
                <span className="rounded bg-[#F4F7F6] p-1.5"><BrandGlyph variant="mono-black" tier="full" shape="none" size={56} /></span>
              </div>
              <p className="font-body text-[12px] font-semibold text-trail-text">C — Monochrome</p>
              <p className="font-body text-[11px] text-trail-muted">blanc + noir · transparent</p>
            </div>
          </div>
        </Section>

        {/* Pack exporté (PNG réels depuis /brand-preview) */}
        <Section id="pack" title="Pack exporté — favicon · PWA · Apple">
          <div className="rounded-xl border border-ink-600 bg-ink-800 p-6 space-y-6">
            <div>
              <p className="font-body text-[12px] text-trail-muted mb-3">Favicon (tailles réelles)</p>
              <div className="flex items-end gap-6">
                {[16, 32, 48].map((s) => (
                  <div key={s} className="flex flex-col items-center gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/brand-preview/favicon-${s}.png`} width={s} height={s} alt={`favicon ${s}`} />
                    <span className="font-body text-[11px] text-trail-muted">{s}px</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-8">
              {[
                ['icon-192.png', 96, 'PWA any 192'],
                ['icon-512.png', 96, 'PWA any 512'],
                ['maskable-512.png', 96, 'PWA maskable'],
                ['apple-touch-icon.png', 90, 'Apple 180'],
              ].map(([file, w, label]) => (
                <div key={file as string} className="flex flex-col items-center gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/brand-preview/${file}`} width={w as number} height={w as number} alt={label as string} className="rounded-2xl" />
                  <span className="font-body text-[11px] text-trail-muted">{label}</span>
                </div>
              ))}
            </div>
            <p className="font-body text-[12px] text-trail-muted">
              Recommandé pour la PWA : <span className="text-primary font-semibold">variante A (Orange)</span>. Pack complet et tailles dans <code className="text-trail-text">/brand-preview/README.md</code>.
            </p>
          </div>
        </Section>

        {/* Splash — concept */}
        <Section id="splash" title="Splash — concept">
          <div className="rounded-xl border border-ink-600 bg-ink-800 p-6 flex justify-center">
            <div className="flex flex-col items-center justify-center rounded-[34px] border border-ink-600" style={{ width: 300, height: 540, background: '#0B0F14' }}>
              <span style={{ background: '#FF7900', width: 72, height: 72, borderRadius: 21, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <BrandGlyph variant="orange" tier="full" shape="none" size={56} />
              </span>
              <span className="wordmark font-display mt-3.5 text-[17px] font-bold uppercase tracking-[0.12em]">
                <span className="text-primary">Trail</span> Cockpit
              </span>
              <span className="font-display text-trail-muted text-[13px] mt-7">Préparer. Piloter. Accomplir.</span>
            </div>
          </div>
        </Section>
```

- [ ] **Step 3: Vérifier types + lint**

Run: `cd c:\Users\Franc\app-run-mobile\web ; npx tsc --noEmit ; npx next lint`
Expected: aucune erreur (les `img` ont le commentaire de désactivation eslint).

- [ ] **Step 4: Vérification visuelle (Playwright)**

- Lancer `npm run dev` (arrière-plan, depuis `web/`).
- Naviguer `http://localhost:3000/design-system`, capturer en `fullPage` → contrôler les sections Audit / App Icon / Pack / Splash / OG.
- Arrêter le dev server.

Expected: les nouvelles sections s'affichent, le pack exporté (PNG) et le glyphe écran sont visuellement identiques.

- [ ] **Step 5: Commit**

```bash
git add web/app/design-system/page.tsx
git commit -m "feat(brand): sections preview design-system (audit, variantes, pack, splash)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Finalisation — bandeau spec, nettoyage, vérification

**Files:**
- Modify: `docs/superpowers/specs/2026-06-05-brand-asset-pack-design.md` (Status + Drift notes)
- Delete: `.tmp-brand-mockup/`, `brand-mockup-*.png` (racine), captures `.playwright-mcp/` jetables

- [ ] **Step 1: Mettre à jour le bandeau de la spec**

Dans `docs/superpowers/specs/2026-06-05-brand-asset-pack-design.md`, remplacer la ligne `> **Status: Spec validée** …` par :
```markdown
> **Status: Implémenté** · 2026-06-05 · Branche: `feat/brand-asset-pack` · Code: web/lib/brand/{logo-geometry,logo-svg}.ts, web/components/brand/{BrandGlyph,OgCard}.tsx, web/scripts/brand/{ico,gen-brand-assets}.ts, web/public/brand-preview/, web/app/design-system/page.tsx
```
Et compléter la section `## Drift notes` :
```markdown
- Builder authored en TS (`logo-svg.ts`) ; script exécuté via `tsx` (devDep) en plus de `sharp` — pour une source unique TS partagée écran/export.
- `LogoMark` live (LogoTrailCockpit.tsx) **non** modifié : le glyphe trajectoire+drapeau vit dans `logo-svg.ts` / `BrandGlyph` (preview). Son adoption live reste un point à valider.
```

- [ ] **Step 2: Nettoyer les artefacts de brainstorming**

Run (depuis la racine repo) :
```bash
rm -rf .tmp-brand-mockup ; rm -f brand-mockup-*.png
```
(`.playwright-mcp/` est ignoré par git ; le laisser ou le vider, sans incidence.)

- [ ] **Step 3: Vérification finale**

Run: `cd c:\Users\Franc\app-run-mobile\web ; npx tsc --noEmit ; npm run lint ; npm test`
Expected: tsc OK, lint OK, tous les tests jest au vert (dont `logo-svg` 7 et `ico` 1).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-06-05-brand-asset-pack-design.md
git commit -m "docs(brand): bandeau Implémenté + drift notes ; cleanup mockup

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Rappels post-implémentation (NE PAS faire dans ce plan — points à valider avant prod)

Ces actions sortent du périmètre (« rien en live ») et figurent dans la spec :
1. Séparer `manifest.json` en entrées distinctes `any` (icon-192/512) et `maskable` (maskable-512).
2. Décider d'adopter le glyphe trajectoire+drapeau comme LogoMark live.
3. Déplacer les assets vers `public/` + brancher `<head>`/`metadata.openGraph`, `favicon.ico`, `apple-touch-icon`.
4. Splash iOS par device si nécessaire.
5. Valider le `compact` à 16px sur vrais onglets ; confirmer la teinte mono noir.
