# Export « Profil de course » (onglet du hub d'impression)

> **Status: Implémenté** · 2026-06-25 · Code: web/components/plan/ProfilePrintCard.tsx, web/app/(main)/plan/courses/[id]/print/page.tsx, web/lib/plan/{main-climbs,print-profile-info,profile-print-geometry,print-size}.ts, web/components/plan/ProfileInfoDialog.tsx
>
> Impression : le profil réutilise désormais `PRINT_SIZE_DEFS` du tableau (base 120 mm + `transform:scale`, iphone ×1 / a5 ×1.617 / a4 ×2.342) — voir Drift notes. Vérif Ctrl+P par Franck.

## Problème

La page `/plan/courses/[id]/print` exporte aujourd'hui **uniquement le tableau de
course** (carte de waypoints, PDF / Image / Partage, tailles iPhone / A5 / A4).
Franck veut un **export du profil altimétrique** de la course, dans le même
esprit : sortable en PDF / image / partage, à plusieurs tailles, avec les
informations clés **bien visibles** comme sur le tableau. Le profil écran actuel
(`ElevationProfileChart`, Recharts, interactif) n'est pas conçu pour
l'impression déterministe.

## Périmètre

Ajouter un **onglet « Profil »** au hub d'export existant (`/print`), à côté de
l'onglet « Tableau ». L'onglet Profil rend une carte autonome :

- **profil altimétrique** (trace dense GPX si présente, sinon escalier des
  waypoints) ;
- **4 couches d'information** activables : objectif horaire par point, montées
  principales, barrières horaires, ravitos (puces) — + altitudes ;
- export **PDF / Image / Partager** et tailles **iPhone / A5 / A4** réutilisant
  le module existant.

**Hors périmètre :**
- L'onglet « Tableau » et tout son code restent **strictement inchangés**.
- Pas d'export combiné tableau + profil sur une même sortie.
- Pas de nouvelle source de données : on consomme la trace dense et les
  waypoints déjà chargés par la page de course.

## Mise en page retenue

Maquette de référence : `Prompts/profil-course-export-mockups.html` (piste
**★ Retenu — B + bords ravito**). Validée au rendu headless.

Structure de la carte (fond blanc, charte du tableau : orange `#FF7900`, puces
`L/S/C/BV/A`, header `TRAIL COCKPIT.RUN`) :

1. **Header** identique à la carte tableau : nom de course · stats
   (`distance · D+ · n pts · Dép. · Arr. visée`) · marque centrale · objectif
   (orange, à droite).
2. **Profil** (haut) : courbe d'altitude épurée + grille + axes (km en X,
   altitude en Y). À chaque waypoint : un point coloré par type de ravito, une
   pastille d'altitude (bord de la couleur du ravito) et les puces ravito
   au-dessus du point. Badges `▲` des montées principales posés sur la pente.
3. **Frise des tronçons** (bas) : une colonne par waypoint, **alignée
   horizontalement sous son point** du profil (pointillés de liaison). Chaque
   colonne porte un **bandeau supérieur coloré par type de ravito** (orange
   départ/arrivée · bleu liquide · brun solide · vert base vie · gris si rien)
   et empile : nom · `km · alt` · tronçon (`dist · ▲D+ ▼D−` depuis le point
   précédent) · **objectif horaire** (orange) · **barrière** (boîte rouge si
   présente) · puces ravito.
4. **Légende** identique au tableau (signification des puces + `Obj` / `Barrière`).

Cette structure sépare *le tracé* (lisible) des *chiffres* (lisibles, façon
tableau) ; elle dégrade mieux que des étiquettes flottantes quand le format
rétrécit (iPhone) et reste cohérente avec la clarté du tableau de course.

## Couches d'information (réglage « Infos »)

Un dialogue **« Infos »** (calqué sur « Colonnes ») permet d'activer / couper
chaque couche — c'est le « pouvoir ajouter les informations » demandé. Cases :

| Couche              | Effet quand coché                                            |
|---------------------|--------------------------------------------------------------|
| Objectif horaire    | ligne objectif (orange) dans chaque colonne de la frise      |
| Montées principales | badges `▲ +D+ · %` sur les pentes du profil                  |
| Barrières           | boîte rouge `⛔ hh:mm` dans les colonnes concernées          |
| Ravitos             | puces `L/S/C/BV/A` (profil + frise) + couleur des bandeaux   |
| Altitudes           | pastilles d'altitude sur la courbe + `alt` dans la frise     |

Défaut : **tout coché**. Persisté en localStorage (`tc:plan:print-profile-info:v1`).
Le nom du point, le km et le tronçon (`dist · D+/D−`) sont **toujours** affichés
(socle non débrayable).

## Détection des montées principales

Seule logique métier nouvelle : `web/lib/plan/main-climbs.ts` (pur, testé).

- Entrée : la trace dense `{ d: number[]; e: number[] }` (km, altitude).
- Sortie : `MainClimb[] = { startKm, endKm, dPlus, distKm, gradientPct }`.
- Algo : parcours de la trace, accumulation des ascensions ; on segmente une
  montée dès qu'une descente cumulée dépasse un petit bruit (hystérésis, ex.
  −25 m) ; on ne **retient** que les montées dont le `dPlus ≥ seuil` (ex.
  `max(200, 0.12 × D+ total)`) et on plafonne à ~3 badges pour ne pas surcharger.
- `gradientPct = dPlus / (distKm × 1000) × 100`, position du badge au milieu de
  la montée.

Si pas de trace dense exploitable (mode escalier), pas de badges montées (couche
sans effet) — fail-soft.

## UI du hub `/print`

- **Bascule segmentée « Tableau | Profil »** en tête de la toolbar, persistée
  (`tc:plan:print-tab:v1`) et deep-linkable via `?tab=profil`. Par défaut
  `tableau` (comportement actuel inchangé).
- La rangée d'export **PDF / Image / Partager** est commune aux deux onglets
  (même mécanisme `cardRef` → `renderJpeg` → `toJpeg` / `window.print` /
  `navigator.share`). `cardRef` pointe sur la carte de l'onglet actif.
- Rangée de réglages dépendante de l'onglet :
  - Tableau : `⚙ Colonnes` · `📐 Taille` (inchangé).
  - Profil : `🧭 Infos` · `📐 Taille`.
- Légende de bas de toolbar adaptée à l'onglet.

## Tailles & impression

Réutilise le mécanisme `print-size.ts` (`@page` dynamique + `transform: scale`
sur la carte en `@media print`). Le profil étant **paysage-natif** (large, non
tourné contrairement à la carte tableau iPhone), on définit une table d'échelles
propre au profil :

- largeur de design de la carte profil : **~180 mm** (proportion paysage).
- iPhone : A4 portrait, carte réduite calée en haut (carte de poche à plastifier).
- A5 : A4 portrait, carte agrandie en haut.
- A4 : A4 paysage, la carte remplit la feuille.

⚠️ **Point de calibration** : les facteurs d'échelle exacts (≈ largeur
imprimable ÷ 180 mm) seront ajustés à l'aperçu Ctrl+P pendant l'implémentation —
c'est le seul point qui demande un aller-retour visuel. On introduit
`PRINT_SIZE_DEFS_PROFILE` plutôt que de réutiliser les facteurs du tableau
(calés sur 120 mm).

## Implémentation

- `web/lib/plan/main-climbs.ts` *(nouveau, pur + test)* — détection des montées
  principales (cf. section dédiée).
- `web/lib/plan/print-profile-info.ts` *(nouveau)* — `type ProfileInfoConfig`,
  `DEFAULT_PROFILE_INFO` (tout `true`), `loadProfileInfo()` / `saveProfileInfo()`
  (clé `tc:plan:print-profile-info:v1`), calqué sur `print-columns.ts` /
  `print-size.ts`.
- `web/lib/plan/print-size.ts` *(édité)* — ajouter `PRINT_SIZE_DEFS_PROFILE`
  (même forme `PrintSizeDef`, base 180 mm). `PrintSize` et le dialogue restent
  partagés.
- `web/components/plan/ProfileInfoDialog.tsx` *(nouveau)* — bottom-sheet de cases
  à cocher, props `{ open, config, onChange, onClose }`, habillage identique à
  `PrintSizeDialog` (`createPortal(document.body)`).
- `web/components/plan/ProfilePrintCard.tsx` *(nouveau)* — composant de
  présentation **pur** : header + profil en **SVG/HTML déterministe** (pas
  Recharts) + frise. Réutilise `buildProfileData` / `resolveAltitudes`,
  `elevationDomain`, `interpolateAlt` (déjà exportés par `ElevationProfileChart`),
  `deriveSegment`, `chartChips` / `SUPPLY_META`. Reçoit en props la course, les
  waypoints, la trace dense, les `elapsed` / objectifs / barrières déjà calculés,
  les montées, et la `ProfileInfoConfig`.
- `web/app/(main)/plan/courses/[id]/print/page.tsx` *(édité)* :
  - état `tab` ('tableau' | 'profil') chargé du localStorage + `?tab=`.
  - bascule segmentée ; rangée de réglages conditionnelle ; légende conditionnelle.
  - rendu conditionnel : onglet Profil monte `ProfilePrintCard` (avec son
    `@page` / `transform: scale` issus de `PRINT_SIZE_DEFS_PROFILE`).
  - `cardRef` pointe sur la carte active pour PDF / Image / Partage.
  - le code de l'onglet Tableau est déplacé tel quel (aucune modif de logique).

## Limites connues

- **Beaucoup de waypoints** → colonnes de frise étroites (surtout iPhone). Comme
  le tableau, on documente la limite plutôt que d'ajouter un fit dynamique ; ces
  cartes visent la poche / un roadbook compact.
- L'échelle est calée sur la **largeur** imprimable : en A4 avec une frise très
  haute, dépassement possible en hauteur (idem tableau, accepté).
- Sans trace dense, le profil retombe sur l'escalier des waypoints et la couche
  « montées principales » est sans effet.

## Vérification

- Onglet **Tableau** : rendu et exports rigoureusement identiques à l'actuel
  (non-régression).
- Onglet **Profil** : profil + frise alignée, 4 couches visibles, bandeaux
  colorés par type de ravito.
- Le dialogue **Infos** coupe / active chaque couche ; choix persistant
  (localStorage).
- **Taille** iPhone / A5 / A4 : aperçu Ctrl+P → carte profil au bon format,
  paysage, calée en haut.
- **Image / Partage** : raster fidèle de la carte profil (clone à plat).
- `main-climbs.ts` couvert par tests unitaires (montée simple, faux-plats
  ignorés, plafond de badges, trace vide).

> Le rendu d'impression dépend du navigateur — calibration finale des échelles
> profil par Franck via l'aperçu Ctrl+P (Chromium).

## Drift notes

- **Débordement courses longues (UTMB ~17 pts) corrigé** : la frise utilisait des
  colonnes `1fr` (qui ne rétrécissent pas sous leur contenu) et l'onglet profil
  réutilisait le wrapper `.cut` du tableau (`width:max-content`) → la frise sortait
  du cadre à droite. Corrigé : `grid-template-columns: repeat(N, minmax(0,1fr))`,
  `.col{min-width:0;overflow:hidden}` + `overflow-wrap:anywhere` sur nom/km/tronçon ;
  l'onglet profil n'utilise plus `.cut`/`.scis` (un roadbook n'est pas une carte à
  découper), juste un `.pcardwrap` centré.
- **Largeur de design = 280 mm** (et non 180) : `.pcard` est `width:100%;max-width:280mm`
  à l'écran (tient toujours dans l'aperçu) ; figée à `280mm` à l'export image.
- **Impression alignée sur le mécanisme exact du tableau** (correctif « le PDF était
  toujours en A quelle que soit la taille choisie ») : le profil réutilise désormais
  `PRINT_SIZE_DEFS` (et non plus un `PRINT_SIZE_DEFS_PROFILE` dédié, supprimé) — base
  **120 mm** + `transform:scale` (iphone ×1 / a5 ×1.617 / a4 ×2.342) + `@page` issu de
  la même table. C'est possible parce que **tous les overlays sont maintenant dans le
  SVG** (cf. point suivant) : un ancêtre transformé ne détache donc plus rien. La règle
  d'impression cible `.pdfroot .profstage .pcard` (3 classes) pour **battre en spécificité**
  la règle d'aperçu écran `.profstage .pcard{width:680px}` (sinon le sélecteur de taille
  restait sans effet à l'impression). L'aperçu écran reste tourné 90° (étage `.profstage`),
  aplati en impression + export image.
- **Overlays du profil rendus en SVG (correctif définitif du décrochage à l'impression)** :
  les puces ravito, pastilles d'altitude et badges de montée étaient des `<div>`
  HTML en `position:absolute` superposés au SVG. À l'impression PDF, ces overlays
  se détachaient et tombaient sous le profil (voire sur une 2ᵉ page) — le retrait du
  `transform` n'a pas suffi. Ils sont désormais dessinés **dans le SVG** (`<rect>` /
  `<text>`, comme `ElevationProfileChart`), donc partie intégrante d'un élément
  atomique qui ne peut pas se fragmenter à l'impression. Le SVG passe en mise à
  l'échelle **uniforme** (`width:100%;height:auto`, sans `preserveAspectRatio="none"`)
  pour que le texte ne soit pas déformé ; viewBox `948×248` (bande haute `plotTop:46`
  réservée aux puces/altitudes posées au-dessus des points). Plus aucun overlay HTML
  absolu dans la carte profil.
- **Refonte de mise en page « option B » (inspirée TraceDeTrail)** — remplace la
  frise/cartouche dense (jugée illisible) par : **bande haute** = pastilles ravito +
  objectif horaire (orange) + **barrière en drapeau rouge plein, texte blanc** (fini le
  rouge-sur-rouge) ; **noms de points à la verticale** sur la courbe (halo blanc) ;
  **bande basse** = **cotation par tronçon** (trait de cote ⟝──⟞, `distance` au-dessus,
  `▲ D+` orange + `▼ D−` gris en dessous), police agrandie. Déclutter glouton : sur les
  courses denses, le libellé d'un tronçon trop étroit est masqué (le trait reste).
  `info.altitudes` ne pilote plus de pastille par point (supprimée) mais l'axe Y des
  altitudes. Maquette de référence : `Prompts/profil-course-export-mockups-v2.html`.
  viewBox `1180×328`. Les montées principales restent disponibles (toggle Infos, badges
  sur la courbe).
- **Ajustements suivants** : ▲ D+ (orange) **empilé au-dessus** du ▼ D− (gris) ; puces
  ravito via **`chartChips`** (règle du tableau : C⊃S⊃L + BV + A) → moins larges, fini le
  chevauchement ; barrières proches **étalées sur 2 niveaux** (greedy). viewBox `1180×348`.
  Le SVG porte `width`/`height` + `preserveAspectRatio="xMidYMid meet"` (ratio intrinsèque
  fiable, pas de collapse de hauteur).
- **Aperçu écran tourné 90° horaire** (comme la carte tableau) : la carte profil est
  dessinée à plat puis pivotée **uniquement en visualisation** via un étage `.profstage`
  (boîte englobante) dans `print/page.tsx`. Impression (`@media print`) et export image
  (`.exporting`, clone hors `.profstage`) restent **à plat**.
- **Rééquilibrage des tailles de police (retour Franck : titre/légende trop gros, texte du profil trop petit)** :
  titre (`.race` 15→12, `.stats` 9.5→8, `.goal .val` 14→11) et légende (`.legend`/`.chip`/`.bar` ~8px)
  **réduits** ; tout le texte **dans le SVG agrandi ~1,4–1,5×** (noms 11.5→17, axe km 11→16, axe altitude
  10.5→15, cotation km 17 / D+/D− 18, objectif 17, barrière 15). Pour absorber les polices plus grosses sans
  chevauchement sur les courses denses, **les puces ravito s'étalent aussi sur 2 niveaux** (greedy `chipLevel`,
  comme barrières/objectif), et les drapeaux barrière/objectif sont un peu resserrés (BARW 66 / OBJW 54) pour
  tenir à 2 niveaux sur une grappe de 3 points. Géométrie : `plotTop` 128→150, `baseY` 300, `padL` 54, `svgH`
  dynamique 398/458. La carte devient plus haute → l'étage `.profstage` de l'aperçu écran tourné 90° passe de
  300 à 384 px de large (sinon la carte tournée dépasse). Vérifié headless (à plat + tourné 90°).
- **Correctifs lisibilité (retour Franck sur PDF dense type TDS)** : (1) en-tête en
  **grille `1fr auto 1fr`** → `TRAILCOCKPIT.RUN` vraiment centré et aligné en haut (même
  ligne que le nom de course), objectif calé à droite — fini le chevauchement marque ↔
  objectif. (2) **Cotation étalée sur 2 rangs** (greedy, chaque rang a son trait de cote)
  au lieu du déclutter qui masquait des tronçons → **toutes** les distances/D+/D−
  s'affichent (ex. Bourg-Saint-Maurice → Fort de la Platte). (3) **Heures objectif (orange)
  étalées sur 2 niveaux** comme les barrières. (4) Bug corrigé : `const y = interp(w.km)`
  → `yOf(g, interp(w.km))` (les pastilles de points étaient hors-cadre, altitude utilisée
  comme pixel ; désormais posées **sur la courbe**). Géométrie : `plotTop` 112→128,
  `baseY` 278, cotation `coteY0`/`coteY1` (rang 1 = `+46`), **`svgH` dynamique** (392 si
  le rang 1 sert, sinon 346 — pas de blanc inutile sur courses peu denses). viewBox `1180×svgH`.
