# Brand Asset Pack — App Icon / Favicon / PWA / Splash / Open Graph

> **Status: Implémenté** · 2026-06-05 · Branche: `feat/brand-asset-pack` · Code: web/lib/brand/{logo-geometry,logo-svg}.ts, web/components/brand/{BrandGlyph,OgCard}.tsx, web/scripts/brand/{ico,gen-brand-assets}.ts, web/public/brand-preview/, web/app/design-system/{page.tsx,og/page.tsx}
>
> Tout reste en **preview** (aucun asset live ni écran métier modifié).

## Contexte

Le LogoMark de marque (`web/components/brand/LogoTrailCockpit.tsx`) est dérivé de la `TrajectoryLine`. Objectif : décliner ce symbole en **identité système** (icônes app, favicon, PWA, Apple, splash, Open Graph), documentée et prête, **sans encore remplacer les assets live**.

État live aujourd'hui :
- `web/public/icons/icon-192.png`, `icon-512.png` (les deux marqués `"any maskable"` dans `manifest.json` — anti-pattern : un même fichier ne peut pas servir correctement `any` ET `maskable`).
- Pas de `favicon.ico`, pas d'`apple-touch-icon`, pas de méta Open Graph.
- `app/layout.tsx` déclare seulement `icon-192/512` + `appleWebApp`.
- Aucune dépendance de rastérisation (`sharp` absent).

## Décision de glyphe (issue de l'audit + itérations visuelles)

Le glyphe retenu est une **TrajectoryLine miniature** inscrite dans un carré (viewBox `0 0 48 48`) : départ (point) → portion **accomplie** pleine + halo → **étape atteinte** (point plein) → **étape à venir** (anneau creux) → **reste** en pointillé → **drapeau** d'arrivée. Il diffère du LogoMark live actuel (qui vise une cible concentrique) ; voir « Périmètre » pour la cohabitation.

**Deux paliers** (l'audit montre que le mark complet devient illisible ≤32px : pointillé/étapes/anneau disparaissent) :
- **`full`** (≥48px) : tracé + étapes + pointillé + drapeau. Usage : app-icons, favicon-48, PWA, apple, splash, coin OG.
- **`compact`/micro** (≤32px) : trait plein épaissi + drapeau, **sans** pointillé ni étapes (sous-pixel). Usage : favicon-16/32.

### Géométrie (source de vérité)

ViewBox `0 0 48 48`. Tracé partagé :

```
TRAJ = "M10,37 C 14,36 15,31 19,30.5 C 23,30 24,33 27.5,31.5 C 31,30 32,22 35,15"
```

| Élément | full | compact |
|---|---|---|
| Tracé « accompli » (plein) | `stroke-width 3`, `dasharray "0.6 1"`, `pathLength 1`, halo `drop-shadow(0 0 1.6px glyph)` | `stroke-width 3.8`, plein continu (pas de dasharray) |
| Tracé « reste » (pointillé) | `stroke-width 3`, `opacity .5`, `dasharray "0.004 0.03"`, `pathLength 1` | — (omis) |
| Départ | `circle (10,37) r2.2` plein | `circle (10,37) r2.7` plein |
| Étape atteinte | `circle (19,30.5) r2` plein | — |
| Étape à venir | `circle (27.5,31.5) r2.1` `fill=surface` `stroke=glyph` `sw1.5` (anneau creux) | — |
| Nœud d'arrivée | `circle (35,15) r2.1` plein | `circle (35,15) r2.1` plein |
| Mât | `(35,15)→(35,6)` `sw1.8` | `sw2.4` |
| Fanion | `M35,6 L41.4,7.73 L35,9.46 Z` | `M35,6 L42.2,7.94 L35,9.89 Z` |

`surface` = couleur de fond derrière le glyphe (sert à « creuser » le centre de l'étape à venir) : `#FF7900` pour la variante A, `#0B0F14` pour B, `none` (transparent) pour C.

## Variantes App Icon

| Variante | Fond | Glyphe | `surface` (étape creuse) | Usage principal |
|---|---|---|---|---|
| **A — Orange** | `#FF7900` (squircle rx13) | `#FFFFFF` | `#FF7900` | **Icône PWA / favicon / apple (recommandée)** |
| **B — Deep Mission** | `#0B0F14` | `#FF7900` | `#0B0F14` | Réserve dark / contextes sombres |
| **C — Monochrome** | aucun (transparent) | blanc **et** noir | `none` | Couche themed-icon Android, iOS tinted, docs |

## Périmètre

**Dans le périmètre (tout additif, tout en preview) :**
1. Géométrie partagée + builder SVG framework-agnostique (source unique → composant preview **et** rastérisation identiques).
2. Composant React de **preview** pour `/design-system` (n'apparaît que dans la page de validation).
3. Script `npm run gen:brand-assets` (sharp + encodeur ICO maison) → `web/public/brand-preview/`.
4. Nouvelles sections preview dans `/design-system` (App Icon, Audit, Favicon/PWA/Apple, Splash, OG) + tableau fichiers/usages.
5. Concept Open Graph 1200×630 (TrajectoryLine + wordmark + taglines).
6. Test Jest léger sur le builder SVG.

**Hors périmètre (→ « Points à valider avant prod ») :**
- Remplacer les assets live (`public/icons/*`), le `manifest.json`, le `<head>`/metadata.
- Adopter le nouveau glyphe (trajectoire+drapeau) comme **LogoMark live** (utilisé dans `MissionSetupFlow`, `CockpitMissionPreview`). Le LogoMark live actuel reste **inchangé**.
- Splash iOS par device (images de démarrage natives).

## Architecture

```
web/
  lib/brand/
    logo-geometry.ts   → constantes pures : VIEWBOX, TRAJ, START, WAYPOINTS,
                          END, FLAG (full/compact), stroke widths, types Tier/Variant.
    logo-svg.ts        → renderLogoMarkSvg({ tier, variant, glyph, surface,
                          squircle, maskable, size }) : string  (SVG autonome, xmlns,
                          aucune dépendance React). SEULE source de rendu du glyphe.
  components/brand/
    BrandGlyph.tsx     → wrapper preview : appelle renderLogoMarkSvg et l'injecte
                          (dangerouslySetInnerHTML). Utilisé UNIQUEMENT dans /design-system.
                          (LogoTrailCockpit.tsx live : NON modifié.)
  scripts/brand/
    gen-brand-assets.mjs → pipeline sharp : SVG (via logo-svg) → PNG multi-tailles ;
                           compose favicon.ico ; écrit le README. Idempotent.
    ico.mjs              → encodeur ICO maison (header + entrées PNG 16/32/48).
  public/brand-preview/  → sortie générée (voir tableau livrables) + README.md
  __tests__/lib/brand/
    logo-svg.test.ts     → SVG valide, fills corrects par variante, scale maskable.
  app/design-system/page.tsx → + sections preview (additives).
```

**Anti-drift** : `BrandGlyph` (écran) et `gen-brand-assets` (PNG) appellent **le même** `renderLogoMarkSvg`. Ce que tu vois dans `/design-system` est pixel-identique aux fichiers exportés.

**package.json** : ajout `"sharp"` en `devDependencies` (utilisé seulement par le script local, aucun impact runtime/build Vercel) + script `"gen:brand-assets": "node scripts/brand/gen-brand-assets.mjs"`.

## Règles de rendu par cible

- **Favicon** : chip orange (A). `favicon-16/32` = `compact` ; `favicon-48` = `full`. `favicon.ico` embarque les 3 PNG.
- **PWA `any`** (`icon-192`, `icon-512`) : squircle orange (A) `full`, marges internes (le glyphe respire dans le cadre), coins transparents.
- **PWA `maskable`** (`maskable-512`) : **fond `#FF7900` plein bord-à-bord** (aucun squircle dessiné — l'OS découpe), glyphe blanc `full` centré dans la **zone sûre 80 %** (cercle Ø ≈ 410px) ; concrètement le glyphe occupe une boîte centrale ≈ 320px (~62 %).
- **Apple** (`apple-touch-icon`, 180×180) : **opaque**, fond orange plein bord-à-bord, glyphe blanc `full`, **sans coins arrondis cuits** (iOS arrondit).
- **Monochrome** (`icon-mono-white`, `icon-mono-black`, 512) : glyphe seul (pas de squircle) sur transparent, `surface='none'`.

## Open Graph (1200×630)

Fond Deep Mission (`#0B0F14` + dégradé radial discret + grille masquée), **TrajectoryLine horizontale** en héro (tracé plein + halo → pointillé → **drapeau** en haut-droite ; `overflow: visible` pour ne pas clipper le mât/fanion), wordmark « **Trail** Cockpit » (Space Grotesk, *Trail* orange), tagline « Préparer. Piloter. Accomplir. » (orange), sous-titre « Le centre de contrôle intelligent des sportifs d'endurance. », LogoMark `full` en coin haut-gauche, `trailcockpit.run` en pied.

**Rendu** : composant React `OgCard` (rendu dans `/design-system`) → capture **Playwright** 1200×630 → `og-default.png` (garantit les web-fonts). Fallback si besoin : SVG avec police embarquée rastérisée par sharp. La capture OG est une **étape documentée** du process de génération (Playwright n'est pas une dépendance committée).

## Splash — concept (preview only)

Tuile `/design-system` : fond `#0B0F14`, logo stacked centré (mark `full` orange + wordmark), tagline « Préparer. Piloter. Accomplir. ». Note : splash Android auto-généré depuis `manifest` (bg + icône + nom) ; splash iOS = images par device (hors scope).

## Livrables — `web/public/brand-preview/`

| Fichier | Taille(s) | Variante / palier | Usage |
|---|---|---|---|
| `favicon.ico` | 16+32+48 | A (16/32 compact, 48 full) | Onglet navigateur |
| `favicon-16.png` | 16 | A compact | Fallback PNG |
| `favicon-32.png` | 32 | A compact | Fallback PNG |
| `favicon-48.png` | 48 | A full | Fallback PNG |
| `icon-192.png` | 192 | A full, `any` | PWA (manifest `any`) |
| `icon-512.png` | 512 | A full, `any` | PWA (manifest `any`) |
| `maskable-512.png` | 512 | A full, plein bord-à-bord | PWA (manifest `maskable`) |
| `apple-touch-icon.png` | 180 | A full, opaque | iOS écran d'accueil |
| `icon-mono-white.png` | 512 | C blanc, transparent | Android themed / iOS tinted |
| `icon-mono-black.png` | 512 | C noir, transparent | Docs / fonds clairs |
| `og-default.png` | 1200×630 | Deep Mission + TrajectoryLine | Open Graph / partages |
| `README.md` | — | — | Tableau tailles + usages |

**Recommandation PWA : variante A (Orange)** pour `any` et `maskable` (reconnaissance maximale, contraste sur thèmes clairs/sombres) ; B en réserve dark ; C pour la couche themed-icon.

## Tests

`__tests__/lib/brand/logo-svg.test.ts` :
- `renderLogoMarkSvg` produit un SVG bien formé (`<svg…xmlns…>`, viewBox `0 0 48 48`).
- Variante A → squircle `#FF7900` + glyphe `#FFFFFF` ; B → `#0B0F14` + `#FF7900` ; C → pas de squircle.
- `compact` n'émet ni pointillé ni étapes ; `full` les émet.
- `maskable` → pas de squircle, glyphe scalé dans la zone sûre (boîte centrale ≈ 62 %).

## Points à valider avant mise en production

1. **Manifest** : séparer en deux entrées distinctes — `icon-192/512` en `purpose: "any"` et `maskable-512` en `purpose: "maskable"` (corrige le `"any maskable"` partagé actuel).
2. **Adoption du glyphe live** : décider si le nouveau glyphe (trajectoire + drapeau) remplace le LogoMark live (cible concentrique) dans `MissionSetupFlow` / `CockpitMissionPreview`. Non fait ici.
3. **Intégration `<head>`/metadata** : déplacer les assets de `brand-preview/` vers `public/`, ajouter `favicon.ico`, `apple-touch-icon`, et `metadata.openGraph` (image `og-default.png`).
4. **Splash iOS** : générer les images de démarrage par device si besoin (sinon Android-only via manifest).
5. **Lisibilité 16px** : valider le `compact` sur vrais onglets navigateurs (clair + sombre).
6. **Monochrome noir** : confirmer la teinte exacte (`#13201D` charbon vs `#0B0F14` ink-900).

## Drift notes

- **Outillage** : builder écrit en TS (`logo-svg.ts`), script exécuté via **`tsx`** (devDep) en plus de `sharp` — pour conserver une source unique TS partagée écran/export (cf. décision Q1 « Node + sharp »).
- **`LogoMark` live non modifié** : le glyphe trajectoire+drapeau vit dans `logo-svg.ts` / `BrandGlyph` (preview). `LogoTrailCockpit.tsx` (cible concentrique) reste tel quel → la section « Logo » de `/design-system` montre l'ancien mark, les nouvelles sections le nouveau. Adoption live = point à valider (#2).
- **Route de capture OG** : ajout de `web/app/design-system/og/page.tsx` (carte 1200×630 pleine largeur) car la section OG dans la page `max-w-3xl` clippe la carte. Le PNG `og-default.png` est capturé via Playwright sur cette route (prompt PWA `position:fixed` masqué avant capture).
- **Dasharray en unités absolues** : `TRAJ_LEN = 38.58` (mesuré) au lieu de `pathLength=1`, pour un rendu identique navigateur ↔ sharp/librsvg. Halo (`glow`) désactivé à l'export (filtres CSS non garantis sous librsvg).
