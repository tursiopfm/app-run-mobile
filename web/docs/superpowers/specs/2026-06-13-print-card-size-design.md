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

| Choix  | `@page`         | Échelle | Rendu                                                       |
|--------|-----------------|---------|-------------------------------------------------------------|
| iPhone | A4 portrait     | ×1      | petite carte (~120 mm) calée en haut, à découper (actuel)   |
| A5     | A5 paysage      | ×1.617  | la carte remplit une feuille A5 paysage                     |
| A4     | A4 paysage      | ×2.342  | la carte remplit une feuille A4 paysage                     |

Échelle = largeur imprimable ÷ 120 mm, avec marges 8 mm :
- A5 paysage : (210 − 16) / 120 = 1.617
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
