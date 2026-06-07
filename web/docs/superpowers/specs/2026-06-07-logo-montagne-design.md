# Logo « Montagne + Sentier » — refonte de l'identité de marque

> **Status: Implémenté (pivot raster)** · 2026-06-07 · Code: `web/scripts/brand/gen-brand-assets.ts`,
> `web/public/brand-source/logo-master.png`, `web/components/brand/LogoTrailCockpit.tsx`.
> Remplace le glyphe « trajectoire + drapeau » (spec `2026-06-05-brand-asset-pack-design.md`).

> ⚠️ **PIVOT (voir Drift notes).** Le plan d'origine reproduisait le logo en **SVG vectoriel**.
> Le rendu vectorisé divergeait trop du logo fourni → bascule sur le **master raster**
> `public/brand-source/logo-master.png` comme source unique. Les sections « Géométrie »,
> « Variantes SVG » et « builder » ci-dessous sont **caduques** ; voir Drift notes pour
> l'implémentation réelle.

## Contexte & décision

Franck a fourni un nouveau logo Trail Cockpit : **squircle orange · montagne enneigée
blanche · sentier bleu nuit qui serpente vers le sommet**. On le **reproduit fidèlement
en SVG vectoriel** (même couleurs, même forme) pour garder le pipeline existant
(géométrie unique → builder SVG + composant React + pack d'assets), au lieu d'un
raster (favicon net en 16px, variantes thème/mono, export déterministe).

Périmètre validé : **aligner l'identité sur le logo**.
- Les neutres « Deep Mission » sont déjà en bleu-nuit ardoise (`--ink-*`) — pas de
  refonte de tokens. Travail couleur = ajout d'un token sentier + nettoyage des valeurs
  vert-sapin *legacy* dans `colors.ts` (déjà écrasées par les CSS vars).
- L'orange marque `#FF7900` est **déjà** `--primary` → inchangé.

## Géométrie verrouillée (viewBox `0 0 48 48`)

Fond squircle : `rect x=3 y=3 w=42 h=42 rx=13`. Bleed (maskable/apple) :
`rect 0 0 48 48`.

**Montagne** (fill blanc) — pic principal pointu à gauche, pic secondaire plus bas à
droite, dentelures « neige » sur les flancs :

```
M3,42 L9,31 L11,33.5 L14,26 L16,28.5 L18.5,9 L21.5,17 L23,14 L25.5,21
L29,16 L31,18.5 L33,15 L35.5,19 L45,42 Z
```

**Sentier** (fill bleu nuit) — ruban à largeur variable le long d'une médiane en S,
évasé en bas (route en perspective), affiné en pointe vers le sommet. Généré par
`ribbon(ctrl, w0, w1, taper)` :
- médiane (Bézier cubique) : `(23,47) (30,40) (17,31) (24,25.5)`
- largeur bas `w0 = 17`, largeur haut `w1 = 1.0`, `taper = 2.2`, `n = 56`
- la base flue sous le viewBox (y≈53) et est clippée par le squircle → bord-à-bord.

> Le générateur `ribbon()` reste dans `logo-geometry.ts` (≈15 lignes, points nommés
> éditables). `TRAIL` = constante calculée une fois au chargement du module, importée
> par le builder SVG **et** le composant React → source unique, pas de divergence.

## Couleurs

| Rôle | Hex | Note |
|---|---|---|
| Orange marque (fond) | `#FF7900` | = `--primary` existant, inchangé |
| Montagne | `#FFFFFF` | |
| Sentier | `#17284A` | **nouveau token** `--brand-trail` / `colors.brandTrail` |
| Deep — fond | `#0B0F14` | = `--ink-900` |
| Deep — montagne | `#EAF0F6` | |
| Deep — sentier | `#FF7900` | orange ressort sur fond sombre |

## Variantes & paliers

`Variant = 'orange' | 'deep' | 'mono-white' | 'mono-black'`

```
VARIANT = {
  orange:     { fill:'#FF7900', mountain:'#FFFFFF', trail:'#17284A' },
  deep:       { fill:'#0B0F14', mountain:'#EAF0F6', trail:'#FF7900' },
  'mono-white':{ fill:null,     mountain:'#FFFFFF', trail:null },
  'mono-black':{ fill:null,     mountain:'#13201D', trail:null },
}
```

- **Compact** (≤ 32–40px, ex. favicon 16/32) : **montagne seule**, pas de sentier
  (illisible en petit) — palier équivalent au `tier:'compact'` actuel.
- **Mono** (themed Android / tinted iOS / docs) : **montagne seule** en une couleur,
  sentier omis (un fill 2-couleurs ne se distingue pas en monochrome). → *Drift assumé*
  vs l'illustration : voir Drift notes.
- **Maskable** : bleed + glyphe inscrit dans la zone sûre (`MASKABLE_SCALE = 0.62`).

## Composants & fichiers touchés

| Fichier | Action |
|---|---|
| `lib/brand/logo-geometry.ts` | Réécrit : `MOUNTAIN`, `ribbon()`, `TRAIL`, `VARIANT`, `MASKABLE_SCALE`, types. Supprime `TRAJ`/`WAYPOINT_*`/`SOLID_FRACTION`/`TIER`/`START`/`END`. |
| `lib/brand/logo-svg.ts` | `renderLogoMarkSvg` : bg rect + `MOUNTAIN` + (`TRAIL` si `variant.trail` && tier≠compact). |
| `components/brand/LogoTrailCockpit.tsx` | `LogoMark` réécrit (rect + 2 paths depuis géométrie partagée). Wordmark inchangé (« Trail » orange + « Cockpit » currentColor). |
| `components/brand/BrandGlyph.tsx` | Inchangé (wrappe `renderLogoMarkSvg`). |
| `components/brand/OgCard.tsx` | Inchangé (utilise `BrandGlyph`) → se met à jour seul. |
| `scripts/brand/gen-brand-assets.ts` | Régénère le pack ; **émet aussi les assets LIVE** (voir Rollout). MAJ README. |
| `__tests__/lib/brand/logo-svg.test.ts` | MAJ assertions (plus de `TRAJ`/waypoints ; présence `MOUNTAIN`/`TRAIL`, variantes). |
| `app/design-system/page.tsx` | MAJ du texte décrivant l'ancien concept « trajectoire » → montagne + sentier. |
| `app/globals.css` + `lib/design/colors.ts` | Ajout `--brand-trail`/`brandTrail` ; corrige les neutres vert-sapin *legacy* de `colors.dark` → valeurs ink navy. |
| `public/manifest.json` | Vérifier `theme_color:#FF7900` / `background_color:#0B0F14` (déjà OK, sans doute aucun changement). |

## Rollout des assets (preview → live)

Aujourd'hui `gen-brand-assets` n'écrit QUE dans `public/brand-preview/` (preview). Le
logo étant désormais **final**, on aligne preview et live :
- Le script écrit le pack dans `brand-preview/` **et** aux chemins **live** :
  `public/favicon.ico`, `public/apple-touch-icon.png`, `public/icons/icon-192.png`,
  `public/icons/icon-512.png`, `public/icons/maskable-512.png`.
- **OG image** (`public/og-default.png`, 1200×630) : générée séparément par capture
  Playwright de `/design-system/og` (`OgCard`). Étape manuelle/scriptée post-déploiement
  preview ; `OgCard` se met à jour seul via `BrandGlyph`.

## Tests & vérification

- `npx jest __tests__/lib/brand/logo-svg.test.ts` — assertions MAJ (vert).
- `tsc --noEmit` + `eslint` (build autoritatif sur Vercel ; pas de `next build` local
  si un `next dev` tourne).
- Sanity visuel : rendu PNG via le script de gen (orange 512 / deep / favicon 48/16).

## Nettoyage

- Supprimer le script jetable `scripts/_scratch-logo-preview.mjs` et le dossier
  `.scratch-logo/` une fois le pipeline réel en place.

## Drift notes

- **PIVOT SVG → raster (2026-06-07).** La reproduction SVG (montagne + sentier tracés à la
  main) ne convergeait pas vers le logo fourni (style trop géométrique/dentelé vs
  illustration lisse). Décision validée avec Franck : utiliser son **fichier raster** comme
  master. Implémentation réelle :
  - Master : `public/brand-source/logo-master.png` (1254×1254, squircle orange + montagne
    enneigée + sentier).
  - `scripts/brand/gen-brand-assets.ts` génère tout le pack depuis ce master : trim →
    zoom-crop 1.10 (retire le halo anti-aliasé du bord) → masque rounded-rect (coins
    transparents, `RADIUS_FRAC=0.16`). Sorties : favicon.ico (16/32/48), icon-192/512
    (coins transparents), maskable-512 (orange plein bord-à-bord, art à 82 % = zone sûre),
    apple-touch (180, orange opaque), og-default (1200×630). Preview + live.
  - Logo écran (`LogoMark`), `OgCard`, `/design-system` : `<img src="/icons/icon-512.png">`.
  - Modules SVG supprimés : `lib/brand/logo-geometry.ts`, `lib/brand/logo-svg.ts`,
    `components/brand/BrandGlyph.tsx`, `__tests__/lib/brand/logo-svg.test.ts`.
  - Conséquence : **plus de variantes SVG** (deep/mono/tier compact) — un seul logo raster.
    Le token `--brand-trail` (#17284A) reste défini (couleur de marque documentée) mais
    n'est plus consommé par le logo.
  - `og-default.png` régénéré via sharp (icône + texte) faute de capture Playwright dispo.
- Sections « Géométrie verrouillée », « Variantes & paliers » (SVG), « builder » plus haut :
  **caduques** (relèvent de l'approche SVG abandonnée).
- Ancien concept « trajectoire + drapeau » (mission/progression) abandonné ; la métaphore
  portée par le logo devient « sommet à atteindre + sentier qui y mène ».
