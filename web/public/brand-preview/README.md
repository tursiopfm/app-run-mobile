# Brand preview assets

> Générés par `npm run gen:brand-assets` — pack de marque (preview + promu en **live** par ce script).
> Source : `web/lib/brand/logo-svg.ts`. Spec : `docs/superpowers/specs/2026-06-05-brand-asset-pack-design.md`.

| Fichier | Taille(s) | Variante / palier | Usage |
|---|---|---|---|
| favicon.ico | 16+32+48 | A (16/32 compact, 48 full) | Onglet navigateur |
| favicon-16.png | 16 | A compact | Fallback PNG |
| favicon-32.png | 32 | A compact | Fallback PNG |
| favicon-48.png | 48 | A full | Fallback PNG |
| icon-192.png | 192 | A full, `any` | PWA (manifest `any`) |
| icon-512.png | 512 | A full, `any` | PWA (manifest `any`) |
| maskable-512.png | 512 | A full, plein bord-à-bord | PWA (manifest `maskable`) |
| apple-touch-icon.png | 180 | A full, opaque | iOS écran d'accueil |
| icon-mono-white.png | 512 | C blanc, transparent | Android themed / iOS tinted |
| icon-mono-black.png | 512 | C noir, transparent | Docs / fonds clairs |
| og-default.png | 1200×630 | Deep Mission + TrajectoryLine | Open Graph (généré séparément, capture Playwright) |
