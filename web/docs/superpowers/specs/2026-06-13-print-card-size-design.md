# Personnaliser la taille de la carte de course

> Status: Spec · 2026-06-13

## Problème

La carte de course (`/plan/courses/[id]/print`) s'imprime toujours au même
format : petite carte paysage (~120 mm de large) calée en haut d'une feuille
A4 portrait, à découper et plastifier (« format iPhone »). L'utilisateur veut
pouvoir choisir une taille d'impression plus grande — A5 ou A4 pleine page —
pour un roadbook lisible.

## Périmètre

Ajouter un réglage **« Taille de la carte »** à côté de **« Colonnes »**, avec
3 choix : **iPhone** (défaut), **A5**, **A4**. Le choix change ce qui sort de
l'imprimante.

**Hors périmètre :** l'export Image et le Partage sont des rasters de pixels,
sans notion de format papier physique → **inchangés**. Le réglage de taille ne
pilote que le chemin **PDF / impression**.

## Comportement

La carte reste **en paysage** (plus large que haute). Le format choisit à la
fois la taille du papier (`@page size`), son orientation, et l'échelle de la
carte :

| Choix  | `@page`         | Échelle | Rendu                                                          |
|--------|-----------------|---------|----------------------------------------------------------------|
| iPhone | A4 portrait     | ×1      | petite carte (~120 mm) calée en haut, à découper (actuel)      |
| A5     | A4 portrait     | ×1.617  | carte agrandie (~194 mm de large) calée en haut d'une A4 portrait |
| A4     | A4 paysage      | ×2.342  | la carte remplit une feuille A4 paysage                        |

Échelle = largeur imprimable ÷ 120 mm, avec marges 8 mm :
- A5 : largeur imprimable d'une A4 portrait (210 − 16) / 120 = 1.617 — la carte
  remplit la largeur, calée en haut de la feuille portrait
- A4 paysage : (297 − 16) / 120 = 2.342

La mise à l'échelle se fait via `transform: scale(F)` + `transform-origin: top
center` sur `.card` en `@media print`. Conséquence : polices (px), paddings et
bordures grossissent **proportionnellement** — aucun recalibrage du design.
`transform-origin: top center` garde la carte centrée horizontalement et calée
en haut de la feuille. Pour iPhone, l'échelle vaut 1 (no-op) et le `@page`
reste A4 portrait — comportement actuel strictement préservé.

Le bloc `@page { size: … }` est **généré dynamiquement** dans le `<style>` de la
page selon le choix (les variables CSS ne cascadent pas dans `@page`).

## UI

La ligne pleine largeur « Personnaliser les colonnes » devient une grille 2
colonnes (même style que la rangée d'export à 3 boutons) :

- gauche : `⚙ Colonnes` → ouvre le `PrintColumnsDialog` existant
- droite : `📐 Taille` → ouvre le nouveau `PrintSizeDialog`

Libellés courts (« Colonnes » / « Taille ») car les libellés longs débordent
sur un demi-bouton. Icône `Ruler` (lucide) pour Taille.

`PrintSizeDialog` = bottom-sheet (même habillage que `PrintColumnsDialog` :
`createPortal(document.body)`, overlay, sheet bas mobile / centré desktop) avec
3 options radio : iPhone (par défaut) · A5 · A4 + une courte légende par option.
Choix mémorisé en localStorage.

## Implémentation

- `web/lib/plan/print-size.ts` *(nouveau)* — `type PrintSize = 'iphone' | 'a5'
  | 'a4'`, table des specs (`pageRule` string + `scale` number + `label` +
  `hint`), `loadPrintSize()` / `savePrintSize()` (clé `tc:plan:print-size:v1`,
  défaut `iphone`), calqué sur `print-columns.ts`.
- `web/components/plan/PrintSizeDialog.tsx` *(nouveau)* — bottom-sheet 3 radios,
  props `{ open, value, onChange, onClose }`.
- `web/app/(main)/plan/courses/[id]/print/page.tsx` *(édité)* :
  - état `size` (chargé/sauvé via le lib) + état `sizeDialogOpen`
  - split du bouton ghost en grille 2 colonnes
  - `@page` rendu conditionnel selon `size`
  - `transform: scale(...) ; transform-origin: top center` conditionnel sur
    `.card` en `@media print`

## Limite connue

L'échelle est calée sur la **largeur** imprimable. Une carte avec un très grand
nombre de points pourrait, en A4, dépasser la **hauteur** de la feuille (pas de
fit hauteur). Acceptable : ces cartes visent la poche / un roadbook compact ;
on documente la limite plutôt que d'ajouter une mesure DOM de la hauteur.

## Vérification

- iPhone : impression identique à l'actuel (A4 portrait, carte en haut).
- A5 / A4 : l'aperçu d'impression du navigateur (Ctrl+P) montre la carte
  remplissant une feuille du bon format, en paysage, calée en haut.
- Image / Partage : inchangés quel que soit le format choisi.
- Le choix persiste après rechargement (localStorage).

> Le rendu d'impression dépend du navigateur — vérification finale par Franck
> via l'aperçu Ctrl+P (Chromium).

## Drift notes

- **2026-08-15 — « format iPhone » devient vraiment la taille d'un iPhone**
  (retour Franck : « je voudrais que ça fasse la taille d'un iPhone, c'est pour
  coller au dos du téléphone »). Le format iPhone n'était pas une taille mais un
  **no-op** : `scale: 1` sur une carte dessinée en 120 mm, donc une carte de
  120 mm de large et de hauteur variable — plus étroite que le dos du téléphone
  sur une course courte, plus haute sur une course dense. Désormais l'échelle est
  **calculée à l'exécution** : `fitIphoneScale(120, hauteur mesurée)` =
  `min(140/120, 66/h)`, borné à `[0,8 ; 1,2]`, cible `IPHONE_CARD_MM = 140 × 66`
  (dos d'un iPhone 15/16/17 = 146,6 × 70,6 mm, ~3 mm de marge). La hauteur ne peut
  pas être connue statiquement — elle dépend du nombre de points — d'où la mesure
  DOM dans print/page.tsx (`offsetHeight`, insensible aux transforms d'aperçu ;
  les mm sont dérivés de la largeur mesurée, pas d'un DPI supposé), refaite quand
  les colonnes, l'onglet ou les données changent. **A5 et A4 gardent leurs échelles
  fixes** — seul iPhone est ajusté. Plancher à 0,8 : au-delà, on laisse la carte
  déborder plutôt que de la rendre illisible (le levier est alors de retirer des
  points, pas des colonnes — la hauteur vient des lignes).
- **Décision (2026-08-15) : le profil NE passe PAS au format iPhone.** Arithmétique
  à l'appui sur la TDS (150 km, 17 points) : sur une carte de 140 mm, le bandeau,
  la légende et les marges coûtent ~19 mm en valeur fixe (des px, ils ne rétrécissent
  pas avec la carte) et il ne reste que ~47 mm de dessin ; à cette largeur les points
  sont espacés de 8 mm, donc barrières, objectifs et cotation s'empilent sur 3 à 4
  rangs et consomment tout le budget vertical. Même en ne gardant **que** la cotation
  km/D+/D−, on retombe à ~6,1 pt. Le nombre de **couches** n'est pas le facteur
  limitant, le nombre de **points** l'est. Conclusion : la carte du dos de téléphone,
  c'est le **tableau** (dense par nature, et il porte km/D+/D−/barrières en colonnes) ;
  le **profil reste une fiche de 170 mm** à part. L'idée d'un garde-fou de lisibilité
  dans le dialogue « Infos » (choix des couches + budget calculé) a été écartée pour
  cette raison : sur une course longue il ne pourrait qu'annoncer l'échec. Si le sujet
  revient, le seul levier qui marche est d'afficher **moins de points** sur le profil
  (uniquement ceux avec barrière, ou uniquement les ravitos).
