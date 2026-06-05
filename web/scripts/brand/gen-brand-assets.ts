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
