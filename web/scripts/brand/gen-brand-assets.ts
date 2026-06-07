// web/scripts/brand/gen-brand-assets.ts
// Génère le pack d'assets de marque dans web/public/brand-preview/ (preview) ET web/public/ (live).
// Exécution : `npm run gen:brand-assets` (depuis web/). Idempotent.
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { renderLogoMarkSvg, type RenderOpts } from '../../lib/brand/logo-svg'
import { pngsToIco } from './ico'

const PREVIEW = join(process.cwd(), 'public', 'brand-preview')
const LIVE = join(process.cwd(), 'public')
const LIVE_ICONS = join(LIVE, 'icons')

async function png(opts: RenderOpts, size: number): Promise<Buffer> {
  const svg = renderLogoMarkSvg({ ...opts, size })
  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
}

const README = `# Brand preview assets

> Générés par \`npm run gen:brand-assets\` — pack de marque (preview + promu en **live** par ce script).
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
`

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

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
