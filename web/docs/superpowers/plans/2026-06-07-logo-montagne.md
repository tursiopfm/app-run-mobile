# Logo « Montagne + Sentier » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le logo « trajectoire + drapeau » par le nouveau logo Trail Cockpit (montagne enneigée + sentier bleu nuit), reproduit fidèlement en SVG, partout (écran, favicon, PWA, OG), et aligner légèrement le design system.

**Architecture:** Géométrie unique (`logo-geometry.ts`) = path montagne figé + sentier généré par un ruban paramétrique → importée par le builder SVG (`logo-svg.ts`, export PNG) ET le composant React live (`LogoTrailCockpit.tsx`). Le script `gen-brand-assets.ts` régénère le pack ET promeut les assets live. Tokens : ajout `--brand-trail`, neutres legacy alignés navy.

**Tech Stack:** Next.js 14 / TypeScript / SVG / `sharp` (export PNG) / Jest / tsx.

**Spec:** `docs/superpowers/specs/2026-06-07-logo-montagne-design.md`

**Couleurs verrouillées :** orange `#FF7900` (= `--primary`, inchangé) · montagne `#FFFFFF` · sentier `#17284A` · deep bg `#0B0F14` · deep montagne `#EAF0F6`.

---

### Task 1: Géométrie + builder SVG + tests

**Files:**
- Modify (réécriture): `web/lib/brand/logo-geometry.ts`
- Modify (réécriture): `web/lib/brand/logo-svg.ts`
- Test: `web/__tests__/lib/brand/logo-svg.test.ts`

- [ ] **Step 1: Réécrire le test (rouge)** — `web/__tests__/lib/brand/logo-svg.test.ts`

```ts
import { renderLogoMarkSvg } from '@/lib/brand/logo-svg'
import { MOUNTAIN, TRAIL } from '@/lib/brand/logo-geometry'

describe('renderLogoMarkSvg', () => {
  it('émet un SVG valide en viewBox 48', () => {
    const svg = renderLogoMarkSvg()
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('viewBox="0 0 48 48"')
  })

  it('variante orange = squircle #FF7900 + montagne blanche + sentier navy', () => {
    const svg = renderLogoMarkSvg({ variant: 'orange' })
    expect(svg).toContain('rx="13"')
    expect(svg).toContain('fill="#FF7900"')
    expect(svg).toContain(`<path d="${MOUNTAIN}" fill="#FFFFFF"/>`)
    expect(svg).toContain(`<path d="${TRAIL}" fill="#17284A"/>`)
  })

  it('variante deep = fond #0B0F14 + montagne claire + sentier orange', () => {
    const svg = renderLogoMarkSvg({ variant: 'deep' })
    expect(svg).toContain('fill="#0B0F14"')
    expect(svg).toContain('fill="#EAF0F6"')
    expect(svg).toContain(`<path d="${TRAIL}" fill="#FF7900"/>`)
  })

  it('mono-white = aucun fond + montagne blanche + pas de sentier', () => {
    const svg = renderLogoMarkSvg({ variant: 'mono-white' })
    expect(svg).not.toContain('<rect')
    expect(svg).toContain(`<path d="${MOUNTAIN}" fill="#FFFFFF"/>`)
    expect(svg).not.toContain(TRAIL)
  })

  it('compact = montagne seule (pas de sentier)', () => {
    const svg = renderLogoMarkSvg({ tier: 'compact' })
    expect(svg).toContain(MOUNTAIN)
    expect(svg).not.toContain(TRAIL)
  })

  it('full orange = montagne + sentier', () => {
    const svg = renderLogoMarkSvg({ tier: 'full', variant: 'orange' })
    expect(svg).toContain(MOUNTAIN)
    expect(svg).toContain(TRAIL)
  })

  it('maskable = fond bord-à-bord + glyphe scalé dans la zone sûre', () => {
    const svg = renderLogoMarkSvg({ maskable: true })
    expect(svg).toContain('width="48"')
    expect(svg).toContain('scale(0.62)')
  })
})
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/brand/logo-svg.test.ts`
Expected: FAIL (`MOUNTAIN`/`TRAIL` introuvables, ancien builder).

- [ ] **Step 3: Réécrire la géométrie** — `web/lib/brand/logo-geometry.ts` (remplacer tout le fichier)

```ts
// web/lib/brand/logo-geometry.ts
// Géométrie du logo de marque — montagne enneigée + sentier (viewBox 0 0 48 48).
// Source de vérité partagée par le builder SVG (écran + export PNG) ET le composant
// React live (LogoTrailCockpit.tsx). Aucune logique de rendu ici.

export const VIEWBOX = '0 0 48 48'

export type Tier = 'full' | 'compact'
export type Variant = 'orange' | 'deep' | 'mono-white' | 'mono-black'
export type Shape = 'squircle' | 'bleed' | 'none'

// Montagne (fill) — pic principal pointu (g.) + pic secondaire bas (dr.), stries « neige ».
export const MOUNTAIN =
  'M3,42 L9,31 L11,33.5 L14,26 L16,28.5 L18.5,9 L21.5,17 L23,14 L25.5,21 L29,16 L31,18.5 L33,15 L35.5,19 L45,42 Z'

// ── Sentier : ruban à largeur variable le long d'une médiane en S (route en perspective).
type Pt = { x: number; y: number }
const TRAIL_CTRL: readonly [Pt, Pt, Pt, Pt] = [
  { x: 23, y: 47 },
  { x: 30, y: 40 },
  { x: 17, y: 31 },
  { x: 24, y: 25.5 },
]
const TRAIL_W0 = 17 // largeur en bas (bouche de route)
const TRAIL_W1 = 1.0 // largeur en haut (pointe)
const TRAIL_TAPER = 2.2 // > 1 : corps slim, évasement concentré en bas
const TRAIL_SAMPLES = 56

function cubic(p: readonly Pt[], t: number): Pt {
  const u = 1 - t
  const a = u * u * u,
    b = 3 * u * u * t,
    c = 3 * u * t * t,
    d = t * t * t
  return {
    x: a * p[0].x + b * p[1].x + c * p[2].x + d * p[3].x,
    y: a * p[0].y + b * p[1].y + c * p[2].y + d * p[3].y,
  }
}
function cubicTangent(p: readonly Pt[], t: number): Pt {
  const u = 1 - t
  const x =
    3 * u * u * (p[1].x - p[0].x) + 6 * u * t * (p[2].x - p[1].x) + 3 * t * t * (p[3].x - p[2].x)
  const y =
    3 * u * u * (p[1].y - p[0].y) + 6 * u * t * (p[2].y - p[1].y) + 3 * t * t * (p[3].y - p[2].y)
  const m = Math.hypot(x, y) || 1
  return { x: x / m, y: y / m }
}
function buildTrail(): string {
  const left: Pt[] = [],
    right: Pt[] = []
  for (let i = 0; i <= TRAIL_SAMPLES; i++) {
    const t = i / TRAIL_SAMPLES
    const p = cubic(TRAIL_CTRL, t)
    const tan = cubicTangent(TRAIL_CTRL, t)
    const nx = -tan.y,
      ny = tan.x // normale
    const hw = (TRAIL_W1 + (TRAIL_W0 - TRAIL_W1) * Math.pow(1 - t, TRAIL_TAPER)) / 2
    left.push({ x: p.x + nx * hw, y: p.y + ny * hw })
    right.push({ x: p.x - nx * hw, y: p.y - ny * hw })
  }
  const pts = [...left, ...right.reverse()]
  return 'M' + pts.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' L') + ' Z'
}

export const TRAIL = buildTrail()

export const VARIANT: Record<
  Variant,
  { fill: string | null; mountain: string; trail: string | null }
> = {
  orange: { fill: '#FF7900', mountain: '#FFFFFF', trail: '#17284A' },
  deep: { fill: '#0B0F14', mountain: '#EAF0F6', trail: '#FF7900' },
  'mono-white': { fill: null, mountain: '#FFFFFF', trail: null },
  'mono-black': { fill: null, mountain: '#13201D', trail: null },
}

export const MASKABLE_SCALE = 0.62 // glyphe inscrit dans la zone sûre Android (~80%)
```

- [ ] **Step 4: Réécrire le builder** — `web/lib/brand/logo-svg.ts` (remplacer tout le fichier)

```ts
// web/lib/brand/logo-svg.ts
// Builder SVG pur (aucune dépendance React) — source unique de rendu du logo,
// utilisée par le composant preview (BrandGlyph) ET le script d'export (sharp).
import {
  VIEWBOX,
  MOUNTAIN,
  TRAIL,
  VARIANT,
  MASKABLE_SCALE,
  type Tier,
  type Variant,
  type Shape,
} from './logo-geometry'

export type RenderOpts = {
  tier?: Tier
  variant?: Variant
  size?: number
  /** Fond : squircle arrondi (défaut) · bleed plein bord-à-bord · none (transparent). */
  shape?: Shape
  /** PWA maskable : force le bleed + inscrit le glyphe dans la zone sûre. */
  maskable?: boolean
}

export function renderLogoMarkSvg(opts: RenderOpts = {}): string {
  const { tier = 'full', variant = 'orange', size = 512, shape = 'squircle', maskable = false } = opts
  const v = VARIANT[variant]

  const effShape: Shape = maskable ? 'bleed' : shape
  let bg = ''
  if (v.fill && effShape === 'squircle') bg = `<rect x="3" y="3" width="42" height="42" rx="13" fill="${v.fill}"/>`
  else if (v.fill && effShape === 'bleed') bg = `<rect x="0" y="0" width="48" height="48" fill="${v.fill}"/>`

  // Sentier masqué en compact (illisible en petit) et en mono (2 couleurs indistinctes).
  const showTrail = tier === 'full' && v.trail
  const glyph =
    `<path d="${MOUNTAIN}" fill="${v.mountain}"/>` +
    (showTrail ? `<path d="${TRAIL}" fill="${v.trail}"/>` : '')

  let body = glyph
  if (maskable) {
    const s = MASKABLE_SCALE
    const tr = (24 * (1 - s)).toFixed(2)
    body = `<g transform="translate(${tr} ${tr}) scale(${s})">${glyph}</g>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${VIEWBOX}">${bg}${body}</svg>`
}
```

- [ ] **Step 5: Lancer le test (vert attendu)**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/brand/logo-svg.test.ts`
Expected: PASS (7 tests). Jest ne transpile que les modules importés (géométrie + builder), donc le test passe même si `LogoTrailCockpit.tsx` référence encore l'ancienne géométrie. Le `tsc` global est volontairement **différé** à Task 2 (après migration du composant), sinon il échoue ici.

- [ ] **Step 6: Commit**

```bash
git add web/lib/brand/logo-geometry.ts web/lib/brand/logo-svg.ts web/__tests__/lib/brand/logo-svg.test.ts
git commit -m "feat(brand): nouvelle géométrie logo montagne + sentier

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Composant React live (LogoMark)

**Files:**
- Modify: `web/components/brand/LogoTrailCockpit.tsx` (réécrire `LogoMark` + ses imports ; `Wordmark` et `LogoTrailCockpit` inchangés)

- [ ] **Step 1: Réécrire le haut du fichier + LogoMark** — remplacer les imports et la fonction `LogoMark` par :

```tsx
import { cn } from '@/lib/cn'
import { VIEWBOX, MOUNTAIN, TRAIL } from '@/lib/brand/logo-geometry'

// ─────────────────────────────────────────────────────────────────────────
// LogoTrailCockpit — identité de marque : montagne enneigée + sentier.
//
// Concept : un sommet à atteindre (montagne blanche) et le sentier qui y mène
// (ruban bleu nuit qui serpente) sur une pastille orange. → endurance, objectif, trail.
// 100 % SVG. Géométrie partagée avec le pack d'assets (logo-geometry.ts) →
// le logo écran est identique aux icônes exportées (favicon / PWA / OG).
//
// Variantes : icon · horizontal · stacked
// Tons      : brand (squircle orange + montagne blanche + sentier navy) · mono (currentColor)
// Petit (< 40px) ou mono : montagne seule (sentier masqué).
//
// Composant serveur (aucun hook).
// ─────────────────────────────────────────────────────────────────────────

type Variant = 'icon' | 'horizontal' | 'stacked'
type Tone = 'brand' | 'mono'

type Props = {
  variant?: Variant
  tone?: Tone
  /** Taille de la pastille (px). Le wordmark s'échelonne dessus. */
  size?: number
  className?: string
  title?: string
}

// ── Pastille (icon-only), pure SVG, viewBox 48 ──────────────────────────
export function LogoMark({
  tone = 'brand',
  size = 40,
  className,
  title = 'Trail Cockpit',
}: {
  tone?: Tone
  size?: number
  className?: string
  title?: string
}) {
  const brand = tone === 'brand'
  const mountain = brand ? '#FFFFFF' : 'currentColor'
  const showTrail = brand && size >= 40 // petit : montagne seule

  return (
    <svg
      viewBox={VIEWBOX}
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={cn('block shrink-0', className)}
    >
      <title>{title}</title>
      {brand && <rect x={3} y={3} width={42} height={42} rx={13} fill="var(--primary)" />}
      <path d={MOUNTAIN} fill={mountain} />
      {showTrail && <path d={TRAIL} fill="var(--brand-trail, #17284A)" />}
    </svg>
  )
}
```

> Le reste du fichier (`Wordmark`, `LogoTrailCockpit`) reste **inchangé**. Supprimer
> seulement les anciens imports de géométrie (`TRAJ`, `TIER`, `START`, `END`,
> `WAYPOINT_*`, `SOLID_FRACTION`) devenus inutiles.

- [ ] **Step 2: Vérifier types + lint**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit && npx eslint components/brand/LogoTrailCockpit.tsx`
Expected: aucune erreur.

- [ ] **Step 3: Sanity visuel (rendu navigateur)**

Run: `cd /c/Users/Franc/app-run-mobile/web && npm run dev` puis ouvrir `http://localhost:3000/design-system`.
Expected: les logos (icon/horizontal/stacked, brand/mono, 64/40/24/16) affichent la montagne ; sentier visible ≥ 40px, absent en 24/16. Arrêter le dev server ensuite.

- [ ] **Step 4: Commit**

```bash
git add web/components/brand/LogoTrailCockpit.tsx
git commit -m "feat(brand): LogoMark React rendu montagne + sentier

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Générateur d'assets → régénération + promotion live

**Files:**
- Modify: `web/scripts/brand/gen-brand-assets.ts` (factoriser les buffers + écrire preview ET live)
- Régénère (binaire): `web/public/brand-preview/*`, `web/public/favicon.ico`, `web/public/apple-touch-icon.png`, `web/public/icons/icon-192.png`, `web/public/icons/icon-512.png`, `web/public/icons/maskable-512.png`

- [ ] **Step 1: Réécrire `main()`** — remplacer la fonction `main()` (et l'ajout des chemins live) par :

```ts
const PREVIEW = join(process.cwd(), 'public', 'brand-preview')
const LIVE = join(process.cwd(), 'public')
const LIVE_ICONS = join(LIVE, 'icons')

async function main() {
  await mkdir(PREVIEW, { recursive: true })
  await mkdir(LIVE_ICONS, { recursive: true })

  // ── Calcul des buffers (une fois) ──────────────────────────────────────
  const fav16 = await png({ variant: 'orange', tier: 'compact', shape: 'squircle' }, 16)
  const fav32 = await png({ variant: 'orange', tier: 'compact', shape: 'squircle' }, 32)
  const fav48 = await png({ variant: 'orange', tier: 'full', shape: 'squircle' }, 48)
  const faviconIco = pngsToIco([
    { size: 16, png: fav16 },
    { size: 32, png: fav32 },
    { size: 48, png: fav48 },
  ])
  const icon192 = await png({ variant: 'orange', tier: 'full', shape: 'squircle' }, 192)
  const icon512 = await png({ variant: 'orange', tier: 'full', shape: 'squircle' }, 512)
  const maskable512 = await png({ variant: 'orange', tier: 'full', maskable: true }, 512)
  const apple = await png({ variant: 'orange', tier: 'full', shape: 'bleed' }, 180)
  const monoWhite = await png({ variant: 'mono-white', tier: 'full', shape: 'none' }, 512)
  const monoBlack = await png({ variant: 'mono-black', tier: 'full', shape: 'none' }, 512)

  // ── Preview (web/public/brand-preview/) ────────────────────────────────
  const writeP = (name: string, buf: Buffer) => writeFile(join(PREVIEW, name), buf)
  await writeP('favicon-16.png', fav16)
  await writeP('favicon-32.png', fav32)
  await writeP('favicon-48.png', fav48)
  await writeP('favicon.ico', faviconIco)
  await writeP('icon-192.png', icon192)
  await writeP('icon-512.png', icon512)
  await writeP('maskable-512.png', maskable512)
  await writeP('apple-touch-icon.png', apple)
  await writeP('icon-mono-white.png', monoWhite)
  await writeP('icon-mono-black.png', monoBlack)
  await writeP('README.md', Buffer.from(README, 'utf8'))

  // ── LIVE (web/public/) — le logo est final, preview = live ─────────────
  await writeFile(join(LIVE, 'favicon.ico'), faviconIco)
  await writeFile(join(LIVE, 'apple-touch-icon.png'), apple)
  await writeFile(join(LIVE_ICONS, 'icon-192.png'), icon192)
  await writeFile(join(LIVE_ICONS, 'icon-512.png'), icon512)
  await writeFile(join(LIVE_ICONS, 'maskable-512.png'), maskable512)

  console.log('✓ brand assets — preview:', PREVIEW, '· live:', LIVE)
}
```

> Conserver les imports/`png()`/`README` existants en tête de fichier. Mettre à jour
> la 1re ligne du `README` : remplacer « **preview uniquement** » par « pack de marque
> (preview + promu en live par ce script) ». Supprimer la ligne
> « Recommandation PWA : variante A (Orange). » si elle n'a plus de sens.

- [ ] **Step 2: Régénérer les assets**

Run: `cd /c/Users/Franc/app-run-mobile/web && npm run gen:brand-assets`
Expected: `✓ brand assets — preview: … · live: …`, sans erreur.

- [ ] **Step 3: Vérifier visuellement les assets live**

Run (rapide, ouvrir le PNG) : ouvrir `web/public/icons/icon-512.png` et `web/public/brand-preview/favicon-48.png`.
Expected: montagne + sentier (512), montagne seule (favicon compact). `favicon.ico` régénéré (mtime récent : `ls -l web/public/favicon.ico`).

- [ ] **Step 4: Commit**

```bash
git add web/scripts/brand/gen-brand-assets.ts web/public/favicon.ico web/public/apple-touch-icon.png web/public/icons/ web/public/brand-preview/
git commit -m "feat(brand): régénère + promeut les assets logo (favicon/PWA/apple)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Token couleur `--brand-trail` + alignement neutres legacy

**Files:**
- Modify: `web/app/globals.css` (ajouter `--brand-trail`)
- Modify: `web/lib/design/colors.ts` (ajouter `brandTrail` aux deux palettes + aligner les neutres legacy de `dark` sur l'ink navy)

- [ ] **Step 1: Ajouter le token CSS** — dans `web/app/globals.css`, ajouter `--brand-trail: #17284A;` à la fois dans `:root` (bloc sombre) et dans `.light`, à côté des autres tokens `--primary*`.

```css
/* dans :root ET .light, après --primary-glow */
  --brand-trail: #17284A;
```

- [ ] **Step 2: Mettre à jour `colors.ts`** — dans `export const dark`, remplacer les neutres vert-sapin legacy par l'ink navy et ajouter `brandTrail` :

```ts
  background:       '#0B0F14', // était #0A0F0E
  surface:          '#121821', // était #111A18
  cardBg:           '#18202B', // était #162420
  border:           '#25303E', // était #1E3530
  headerBg:         '#0F151D', // était #101917
```

Et ajouter, dans `dark` ET dans `light` (même clé, type `TrailPalette`) :

```ts
  brandTrail:       '#17284A',
```

- [ ] **Step 3: Vérifier types + tests touchant les couleurs**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit && npx jest __tests__/lib/analytics __tests__/lib/brand`
Expected: PASS. (Si un snapshot de `charge-kpi-status` lit un neutre changé et casse, mettre à jour la valeur attendue — c'est intentionnel.)

- [ ] **Step 4: Commit**

```bash
git add web/app/globals.css web/lib/design/colors.ts
git commit -m "feat(ds): token --brand-trail + neutres legacy alignés navy

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Texte de la page /design-system

**Files:**
- Modify: `web/app/design-system/page.tsx` (copie décrivant le concept de marque)

- [ ] **Step 1: Repérer le texte de l'ancien concept**

Run: `cd /c/Users/Franc/app-run-mobile/web && grep -niE "trajectoire|drapeau|trajectory|mission|étape|jalon|pointillé" app/design-system/page.tsx`
Expected: lignes décrivant le glyphe « trajectoire + drapeau ».

- [ ] **Step 2: Réécrire la copie** — remplacer chaque description de l'ancien concept par la nouvelle. Texte de référence à utiliser (adapter à la structure JSX existante, sans changer le balisage) :

> « Montagne enneigée + sentier — un sommet à atteindre et le chemin qui y mène.
> Pastille orange, montagne blanche, sentier bleu nuit. 100 % SVG, géométrie partagée
> avec les icônes exportées (favicon / PWA / OG). Petit format ou monochrome : montagne seule. »

- [ ] **Step 3: Vérifier types + rendu**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit`
Expected: aucune erreur. (Sanity visuel déjà fait Task 2 Step 3.)

- [ ] **Step 4: Commit**

```bash
git add web/app/design-system/page.tsx
git commit -m "docs(brand): MAJ copie /design-system (montagne + sentier)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Image Open Graph (best-effort, manuel)

**Files:**
- Régénère (binaire): `web/public/og-default.png` (1200×630)

> `OgCard` utilise `BrandGlyph` → la **page** `/design-system/og` est déjà à jour. Seul
> le PNG statique `og-default.png` doit être recapturé. Pas de script automatisé : capture
> navigateur. Étape **best-effort** — si non réalisable en exécution, laisser une note
> à Franck (la page OG est correcte, le PNG sera regénéré au besoin).

- [ ] **Step 1: Lancer le dev server**

Run: `cd /c/Users/Franc/app-run-mobile/web && npm run dev`

- [ ] **Step 2: Capturer la carte OG en 1200×630**

Via Playwright : `browser_navigate` → `http://localhost:3000/design-system/og`, `browser_resize` 1200×630, puis `browser_take_screenshot` (filename `og-default.png`). Recadrer/placer le fichier en `web/public/og-default.png` (écraser).
Expected: PNG 1200×630 montrant la nouvelle carte OG (logo montagne). Arrêter le dev server.

- [ ] **Step 3: Commit (si capturé)**

```bash
git add web/public/og-default.png
git commit -m "feat(brand): regénère l'image OG avec le logo montagne

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Nettoyage + vérification finale

**Files:**
- Delete: `web/scripts/_scratch-logo-preview.mjs`
- Delete: `web/.scratch-logo/` (dossier)

- [ ] **Step 1: Supprimer les artefacts jetables**

```bash
cd /c/Users/Franc/app-run-mobile/web && rm -f scripts/_scratch-logo-preview.mjs && rm -rf .scratch-logo
```

- [ ] **Step 2: Vérification finale (types + lint + tests ciblés)**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit && npx eslint lib/brand components/brand scripts/brand && npx jest __tests__/lib/brand __tests__/lib/analytics`
Expected: aucune erreur, jest vert. (Ne **pas** lancer `next build` local si un `next dev` tourne ; ne pas lancer toute la suite jest — ~50 tests i18n échouent en pré-existant, hors périmètre.)

- [ ] **Step 3: Vérifier qu'il ne reste aucune référence à l'ancien glyphe**

Run: `cd /c/Users/Franc/app-run-mobile/web && grep -rniE "TrajectoryLine|trajectoire|WAYPOINT|SOLID_FRACTION" lib components app | grep -v node_modules`
Expected: aucune occurrence dans le code (hors docs/archive et la spec/plan). Corriger si besoin.

- [ ] **Step 4: Commit**

```bash
git add -A web/ && git commit -m "chore(brand): nettoyage des artefacts de preview logo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notes d'exécution

- **Déploiement** : pousser la branche `feat/logo-montagne` ; Vercel auto-déploie. Ne pas `vercel --prod`.
- **Service Worker** : le bump de VERSION au build purge les anciens caches → favicon/PWA mis à jour côté clients. Ne pas éditer `public/sw.js`.
- **Supabase** : aucune migration dans ce plan.
- Commits fréquents (un par task). Branche déjà créée : `feat/logo-montagne`.
