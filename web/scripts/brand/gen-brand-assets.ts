// web/scripts/brand/gen-brand-assets.ts
// Génère le pack d'icônes de marque à partir du logo source raster
// `public/brand-source/logo-master-v2.png` (montagne enneigée + sentier sur squircle orange).
// Écrit le pack en PREVIEW (public/brand-preview/) ET promeut les assets LIVE (public/).
// Exécution : `npm run gen:brand-assets` (depuis web/). Idempotent.
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { pngsToIco } from './ico'

const SRC = join(process.cwd(), 'public', 'brand-source', 'logo-master-v2.png')
const PREVIEW = join(process.cwd(), 'public', 'brand-preview')
const LIVE = join(process.cwd(), 'public')
const LIVE_ICONS = join(LIVE, 'icons')

const ORANGE = '#FF7900'
const ZOOM = 1.1 // recadre ~5%/bord pour passer sous le halo anti-aliasé du bord squircle
const RADIUS_FRAC = 0.16 // rayon d'arrondi des coins (≈ celui de la squircle source)
const HI = 1024 // master haute-déf rogné+arrondi, redimensionné ensuite par sortie

// Masque rounded-rect (blanc) pour découper les coins en transparent (blend dest-in).
function roundMask(size: number): Buffer {
  const r = Math.round(size * RADIUS_FRAC)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/></svg>`
  return Buffer.from(svg)
}

// Base carrée nette (squircle pleine) — zoom-crop pour retirer le halo blanc du bord.
async function buildBase(): Promise<Buffer> {
  const trimmed = await sharp(SRC).trim({ threshold: 60 }).toBuffer()
  const z = Math.round(HI * ZOOM)
  return sharp(trimmed)
    .resize(z, z, { fit: 'fill' })
    .extract({ left: Math.round((z - HI) / 2), top: Math.round((z - HI) / 2), width: HI, height: HI })
    .png()
    .toBuffer()
}

async function main() {
  await mkdir(PREVIEW, { recursive: true })
  await mkdir(LIVE_ICONS, { recursive: true })

  const base = await buildBase()
  // Icône « any » : squircle à coins transparents (propre sur tout fond).
  const mask = await sharp(roundMask(HI)).resize(HI, HI).png().toBuffer()
  const iconAnyHi = await sharp(base).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()

  const resize = (n: number) => sharp(iconAnyHi).resize(n, n).png().toBuffer()

  // Favicons (coins transparents)
  const fav16 = await resize(16)
  const fav32 = await resize(32)
  const fav48 = await resize(48)
  const faviconIco = pngsToIco([
    { size: 16, png: fav16 },
    { size: 32, png: fav32 },
    { size: 48, png: fav48 },
  ])
  // PWA « any »
  const icon192 = await resize(192)
  const icon512 = await resize(512)

  // PWA maskable : plein bord-à-bord orange, art inscrit dans la zone sûre (~82 %).
  const inner = Math.round(512 * 0.82)
  const off = Math.round((512 - inner) / 2)
  const maskable512 = await sharp({ create: { width: 512, height: 512, channels: 4, background: ORANGE } })
    .composite([{ input: await sharp(iconAnyHi).resize(inner, inner).png().toBuffer(), top: off, left: off }])
    .png()
    .toBuffer()

  // Apple touch : opaque, plein bord-à-bord orange (iOS arrondit lui-même).
  const apple = await sharp({ create: { width: 180, height: 180, channels: 4, background: ORANGE } })
    .composite([{ input: await sharp(iconAnyHi).resize(180, 180).png().toBuffer() }])
    .flatten({ background: ORANGE })
    .png()
    .toBuffer()

  // ── Preview (public/brand-preview/) ────────────────────────────────────
  const writeP = (name: string, buf: Buffer) => writeFile(join(PREVIEW, name), buf)
  await writeP('favicon-16.png', fav16)
  await writeP('favicon-32.png', fav32)
  await writeP('favicon-48.png', fav48)
  await writeP('favicon.ico', faviconIco)
  await writeP('icon-192.png', icon192)
  await writeP('icon-512.png', icon512)
  await writeP('maskable-512.png', maskable512)
  await writeP('apple-touch-icon.png', apple)
  await writeP('README.md', Buffer.from(README, 'utf8'))

  // ── LIVE (public/) ─────────────────────────────────────────────────────
  await writeFile(join(LIVE, 'favicon.ico'), faviconIco)
  await writeFile(join(LIVE, 'apple-touch-icon.png'), apple)
  await writeFile(join(LIVE_ICONS, 'icon-192.png'), icon192)
  await writeFile(join(LIVE_ICONS, 'icon-512.png'), icon512)
  await writeFile(join(LIVE_ICONS, 'maskable-512.png'), maskable512)

  console.log('✓ brand assets (depuis logo-master-v2.png) — preview:', PREVIEW, '· live:', LIVE)
}

const README = `# Brand assets

> Générés par \`npm run gen:brand-assets\` depuis \`public/brand-source/logo-master-v2.png\`.
> Pack de marque (preview + promu en **live** par ce script). Spec :
> \`docs/superpowers/specs/2026-06-07-logo-montagne-design.md\`.

| Fichier | Taille(s) | Fond | Usage |
|---|---|---|---|
| favicon.ico | 16+32+48 | coins transparents | Onglet navigateur |
| favicon-16/32/48.png | 16/32/48 | coins transparents | Fallback PNG |
| icon-192.png | 192 | coins transparents | PWA (manifest \`any\`) |
| icon-512.png | 512 | coins transparents | PWA (manifest \`any\`) + logo écran |
| maskable-512.png | 512 | orange plein bord-à-bord | PWA (manifest \`maskable\`) |
| apple-touch-icon.png | 180 | orange opaque bord-à-bord | iOS écran d'accueil |
| og-default.png | 1200×630 | — | Open Graph (capture de \`/design-system/og\`) |
`

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
