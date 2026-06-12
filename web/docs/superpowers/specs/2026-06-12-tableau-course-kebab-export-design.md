# Tableau de course — menu kebab, export enrichi (JPEG/Partage), undo suppression

> **Status: Spec** · 2026-06-12 · Code cible : `web/components/plan/WaypointsTable.tsx`,
> `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx`,
> `web/app/(main)/plan/courses/[id]/print/page.tsx`.

## Contexte

Dans l'onglet « Plan pour une course », le bloc **Tableau de course** affiche aujourd'hui :
un bouton « ✎ Modifier les lignes » (coin haut-droit, dans `WaypointsTable`), une légende
**en haut** du tableau, puis le tableau, et en bas deux liens « Exporter en PDF » /
« Ré-importer ». La suppression d'une ligne en mode édition est **irréversible** (seul
« Terminé » existe).

Demande de Franck : déplacer la légende en bas, remplacer le bouton « Modifier les lignes »
par un **menu ⋮ (3 points verticaux)** regroupant les actions, enrichir l'export
(**PDF / JPEG / Partager**), et permettre d'**annuler** une suppression de ligne.

## Périmètre

1. **Légende en bas** du tableau.
2. **Menu kebab** à la place du bouton « Modifier les lignes ».
3. **Export enrichi** : PDF (existant), **JPEG** (nouveau), **Partager** (nouveau).
4. **Undo** d'une suppression de ligne via snackbar.

Hors périmètre : profil dénivelé, notes, autres sections de la page course.

## 1. Légende déplacée en bas

Dans `WaypointsTable`, le bloc `.legend-mini` (actuellement rendu **avant** l'en-tête du
tableau) est déplacé **après** les lignes — sous le bouton « + Ajouter une ligne » quand il
est présent, sinon juste sous la dernière ligne. Aucun changement de style ni de contenu :
simple repositionnement du JSX.

## 2. Menu kebab (⋮)

Le bouton « Modifier les lignes » et sa barre interne (`.wtbl-bar`) sont **supprimés** de
`WaypointsTable`. Un **menu kebab** prend leur place visuelle : **au-dessus du tableau,
aligné à droite**, dans `CoursePageClient` (branche `waypoints.length > 0`).

### Pourquoi dans CoursePageClient

3 des 4 actions vivent déjà dans le parent (`RaceEditorModal`, `RaceImportSheet`, export).
On **remonte** l'état `editLines` au parent : `WaypointsTable` devient **contrôlé** via deux
nouvelles props `editLines: boolean` et `onEditLinesChange: (v: boolean) => void`, et perd son
`useState(editLines)` + sa `.wtbl-bar`. Tout le reste du rendu (mode édition, `×`, ajout de
ligne) lit la prop.

### Contenu du menu (icônes `lucide-react`)

| Libellé | Icône | Action |
|---|---|---|
| Modifier la course | `Pencil` | `setEditorOpen(true)` |
| Modifier les lignes | `Rows3` | `setEditLines(v => !v)` |
| Ré-importer | `Download` | `setImportOpen(true)` |
| Exporter › | `Share` | ouvre le **sous-menu export** |

Sous-menu Exporter :

| Libellé | Icône | Action |
|---|---|---|
| PDF | `FileText` | ouvre `/plan/courses/[id]/print` (onglet) |
| JPEG | `Image` | ouvre `/print?export=jpeg` |
| Partager | `Share2` | ouvre `/print?export=share` |

Icônes 14–15 px, `currentColor`, à gauche du libellé avec un petit gap. Le menu se ferme
au clic dehors (backdrop) et après sélection d'une action. Le sous-menu Exporter s'ouvre
au clic sur « Exporter › » (deuxième niveau inline ou panneau secondaire).

Les deux liens du bas actuels (« Exporter en PDF » / « Ré-importer ») sont **retirés**
(repliés dans le kebab).

## 3. Export — hub `/print`

La page `/print` est déjà la « carte de course » bien formatée (choix des colonnes inclus).
Elle devient le **hub d'export**. On ajoute à sa `toolbar` deux boutons : **JPEG** et
**Partager**, à côté de « Imprimer / PDF ».

### Génération de l'image

- Dépendance : **`html-to-image`** (pur JS, sans deps transitives).
- La carte est affichée **tournée 90°** à l'écran (`.card { transform: rotate(90deg) }`),
  non tournée seulement en `@media print`. Pour la capture on rend la carte **à plat** :
  une classe `.exporting` sur `.pdfroot` applique au `.card`/`.cardwrap` la même géométrie
  que `@media print` (rotation annulée, position statique, fond blanc). On capture l'élément
  `.card` via `htmlToImage.toJpeg(cardEl, { backgroundColor: '#fff', pixelRatio: 2, quality: 0.95 })`,
  puis on retire `.exporting`.
- Nom de fichier : `<slug(race.name)>.jpg`.

### Comportements selon le paramètre `?export=`

- **(aucun)** : page normale (aperçu + toolbar).
- **`jpeg`** : une fois la carte prête, génère le JPEG et **déclenche le téléchargement**
  (lien `<a download>` programmatique — pas de geste requis).
- **`share`** : `navigator.share` exige un **geste utilisateur**. On **ne déclenche pas**
  automatiquement : à la place le bouton « Partager » de la toolbar est **mis en avant**
  (focus/scroll), et c'est le tap dessus qui génère le JPEG puis appelle
  `navigator.share({ files: [new File([blob], name, { type: 'image/jpeg' })], title: race.name })`.
  - **Fallback** si `navigator.canShare?.({ files })` est faux (desktop, navigateur sans
    Web Share fichiers) : on retombe sur le **téléchargement** du JPEG.

Les boutons JPEG/Partager fonctionnent aussi **manuellement** sur `/print` (indépendamment
du paramètre `?export=`), puisque la carte y est toujours présente.

## 4. Undo suppression de ligne (snackbar)

Entièrement local à `WaypointsTable`.

- `removeRow(i)` mémorise `{ row: Draft, index: number }` dans un state `lastDeleted` avant
  d'appeler `onChange(reindex(...))`.
- Une **snackbar** apparaît en bas du tableau : « Ligne supprimée — **Annuler** ».
  Auto-dismiss après **~6 s** (timeout nettoyé au démontage / nouvelle suppression).
- **Annuler** : réinsère la ligne à `index` dans `waypoints`, `onChange(reindex(next))`, puis
  efface `lastDeleted`. (Le `reindex` réassigne départ/arrivée — comportement déjà en place.)
- La snackbar ne gère qu'**une** suppression à la fois (la dernière) ; une nouvelle
  suppression remplace l'entrée précédente. Sortir du mode édition efface la snackbar.

Styles dans le bloc `<style>` de `.wtbl` (nouvelle classe `.wtbl-snack`), couleurs liées au
thème (`--trail-surface`, `--trail-border`, `--trail-primary`).

## Fichiers touchés

- `web/components/plan/WaypointsTable.tsx` — props `editLines`/`onEditLinesChange`, retrait
  `.wtbl-bar`, légende en bas, snackbar undo.
- `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx` — état `editLines`, menu kebab +
  sous-menu export, retrait des liens du bas.
- `web/app/(main)/plan/courses/[id]/print/page.tsx` — boutons JPEG/Partager, classe
  `.exporting`, lecture de `?export=`, génération via `html-to-image`.
- `web/package.json` — ajout `html-to-image`.

## Tests / vérification

- `tsc` + `eslint` propres (build autoritatif sur Vercel).
- Vérif visuelle locale : légende en bas ; kebab ouvre les 4 actions ; chaque action câblée ;
  export JPEG télécharge une image lisible (carte à plat, fond blanc) ; « Partager » ouvre la
  feuille native sur mobile / retombe sur téléchargement sur desktop ; suppression d'une ligne
  → snackbar → Annuler restaure la ligne au bon endroit.

## Risques / notes

- **Web Share fichiers** non supporté partout (desktop, certains navigateurs) → fallback
  téléchargement explicite.
- **Capture html-to-image** : rendre la carte à plat avant capture est essentiel (sinon
  image tournée/rognée). Police « Space Grotesk » doit être chargée au moment de la capture
  (attendre `document.fonts.ready`).
- Pas de migration Supabase.

## Drift notes

Retours de Franck après test en prod (2026-06-12, même jour) :
- **Undo (§4)** : snackbar transient remplacé par un **bouton « ↶ Annuler » à côté de
  « ✓ Terminé »** dans la barre d'édition — pile LIFO (annulations multiples), vidée en
  sortant du mode édition. Pas de timer, plus de `.wtbl-snack`.
- **Toolbar `/print`** : la rangée horizontale débordait sur mobile (`width:120mm` > écran,
  boutons empilés au même endroit). Refaite en **colonne** : titre → 3 boutons d'export
  égaux (PDF · JPEG · Partager, icônes lucide) → « Personnaliser les colonnes » pleine
  largeur (s'applique aux 3 formats — la carte capturée respecte déjà la config colonnes).
- **Bandeau objectif** : lien « Modifier » retiré (doublon du kebab) ; « Définir l'objectif »
  conservé quand l'objectif n'est pas renseigné.
- **Menu kebab** : `bg-trail-surface` quasi invisible sur fond bleu nuit → surface élevée
  (`bg-trail-card`), bordure `--ink-500`, ombre renforcée + **scrim** `bg-black/50`.

Deuxième vague de retours prod (2026-06-12) :
- **« Annuler » = annulation complète du mode édition** (pas un undo LIFO action par
  action) : snapshot des lignes pris à l'entrée du mode « Modifier les lignes »,
  « Annuler » restaure tout (suppressions, ajouts, cellules) et sort du mode.
- **Libellé « JPEG » → « Image »** partout (sous-menu kebab, bouton `/print`, caption).
- **Kebab → Image n'exporte plus directement** : `?export=jpeg` met seulement le focus
  (liseré blanc, comme `?export=share`) sur le bouton Image — l'utilisateur passe par
  l'aperçu pour personnaliser les colonnes avant d'exporter.
- **Bug flash portrait→paysage→portrait à la capture** : la capture basculait l'aperçu
  à plat (`setFlat`) puis le restaurait. Désormais on rasterise un **clone hors écran**
  (wrapper `pdfroot exporting` en `position:fixed;left:-10000px`) — l'aperçu ne bouge plus.
- **« Personnaliser les colonnes » plus visible** : `--trail-card` + bordure `--ink-500`
  + texte blanc (au lieu de surface/bordure sombres).
- **Kebab déplacé dans l'en-tête du bloc** « Tableau de course » (prop `action` du
  composant `Section`), à droite du titre.

Troisième vague de retours prod (2026-06-12) :
- **Bouton « Modifier » (EditButton) retiré** du haut de la fiche course (doublon du kebab).
- **Kebab déplacé dans l'en-tête du bloc « nom de la course »** (à droite du titre `<h1>`),
  plus dans la `Section` Tableau (prop `action` de `Section` retirée, composant restauré).
  Nouvelle prop `hasTableau` : sans tableau, seul « Modifier la course » s'affiche.
- **Sous-menu « Exporter » supprimé** : « Exporter » est une action directe qui ouvre la
  page `/print` (l'utilisateur y choisit PDF / Image / Partager après avoir personnalisé
  les colonnes). `onExport` passe de `(kind) => void` à `() => void`. Libellé d'accès du
  kebab : « Actions du tableau » → « Actions de la course ».
- **Chevron de dépliage de « Stratégie d'allure »** trop discret → pastille ronde
  (`--trail-surface` + bordure, `--trail-text`, 24 px) au lieu d'un ▾ muted 10 px.
- **Bouton « Personnaliser les colonnes » invisible en thème CLAIR** (texte blanc sur fond
  clair — régression de la 2e vague) → style **contour orange** thème-agnostique
  (`border/color: var(--trail-primary)`, fond transparent). Focus des boutons : `#fff` →
  `var(--trail-text)` (contrasté sur les 2 thèmes).

Quatrième vague de retours prod (2026-06-12) :
- **Badge de fraîcheur retiré** du bloc (« ✓ Confirmé édition 2026 ») : `FreshnessBadge`
  supprimé de `CoursePageClient`. (Le bandeau jaune `pendingDiff` « nouvelle édition / tableau
  changé » reste, c'est un composant distinct.)
- **Objectif + départ déplacés dans l'en-tête de « Stratégie d'allure »** (à droite du titre) :
  l'ancien bandeau objectif autonome est supprimé. Nouvelles props de `PacingStrategyCard` :
  `startTime`, `onEditObjective`, `onEditStart`. Quand l'objectif n'est pas défini (carte non
  rendue), un encart « Définir l'objectif » s'affiche à la place.
- **Édition par pop-ups indépendantes** : cliquer sur la valeur objectif (« 35h00 ») ou départ
  (« 19:00 ») ouvre une petite fenêtre dédiée (`QuickEditModal`, nouveau composant générique
  validate/onSave). Parsers dans `CoursePageClient` : `parseObjectiveMin` (35h00/35:00/35h/35)
  et `parseClockHHMM` (19:00/19h00). Les boutons font `preventDefault`+`stopPropagation` pour
  ne pas (dé)plier le `<details>`.
- **Badge de stratégie coloré selon l'état** : Régulier = gris (`--trail-muted`), Finir fort =
  bleu (#38BDF8), Partir vite = orange (`--trail-primary`). Variantes CSS `.psum-cur.v-even/
  v-start/v-end`. Défaut = Régulier (fade 0, inchangé). Le résumé `.psum` passe en `flex-wrap`
  pour gérer objectif/départ + badge + chevron sur mobile.

Cinquième vague de retours prod (2026-06-12) :
- **Saisie objectif/départ via clavier numérique impossible** (pas de « : ») → `QuickEditModal`
  (champ texte unique) remplacé par **`TimeEditModal`** : deux champs numériques `HH : MM`
  (`inputMode=numeric`, bornage heures `maxHours` = 23 horloge / 99 durée, minutes ≤ 59,
  auto-avance HH→MM). API `onSave(hours, minutes)`. Cohérent pour objectif ET départ.
  `parseObjectiveMin`/`parseClockHHMM`/`fmtObjective` supprimés ; ajout `parseStartClock`.
- **Nouvelle colonne d'export « Heure (à la montre) »** (`objclock`) UNIQUEMENT dans la carte
  `/print` (pas le tableau écran) : heure d'horloge projetée à chaque point = départ + temps
  écoulé cumulé (`formatElapsedToClock(startTime, elapsed[i])`, préfixe jour retiré). Ajoutée à
  `PRINT_COL_DEFS`/`DEFAULT_PRINT_ORDER` ; **masquée par défaut** (opt-in via `DEFAULT_HIDDEN`,
  `sanitize` la masque aussi pour les configs LS existantes). Toggle dans « Personnaliser les
  colonnes ».

Sixième vague de retours prod (2026-06-12) :
- **Colonne `objclock` renommée « Objectif (horaire) »** (label dialog ; `th` carte = « Horaire »)
  et **rangée juste après « Objectif »** même pour les configs LS existantes : `sanitize` insère
  désormais une clé manquante après son prédécesseur par défaut présent (au lieu de l'ajouter en
  fin de liste).
- **2e menu kebab dans l'en-tête du bloc « Tableau de course »** (haut-droite), en plus de celui
  du bloc nom de course. `TableActionsMenu` gagne `showEditRace?` (false → masque « Modifier la
  course ») et `label?` (aria « Actions du tableau »). `onEditRace` devient optionnel. Le composant
  `Section` regagne un slot `action` (en-tête en flex row, `mb-2` déplacé sur la row).

Septième vague de retours prod (2026-06-12) — carte `/print` :
- **Marque « TRAIL COCKPIT » en haut de la carte** (`.brand`, TRAIL en `--accent` / COCKPIT en
  `--ink-soft`) — présente aussi en PDF et image (dans `.card`, capturé par `renderJpeg`).
- **Zoom de l'aperçu écran** : barre `−/%/+` (1×→3×, pas 0,5). État `zoom` → variable CSS
  `--zoom` sur `.pdfroot`. `.zoomview` réserve la taille mise à l'échelle (`calc(65mm/120mm × --zoom)`)
  et `.cardwrap` est `scale(--zoom)` (origin top-left) ; `.previewscroll` (overflow auto, max-h 78vh)
  permet de défiler la carte agrandie. **N'affecte NI le PDF NI l'image** : `@media print` et le
  clone `.exporting` remettent `transform:none` / `width:auto`. Zoom=1 = rendu identique à avant.

Huitième vague de retours prod (2026-06-12) — carte `/print` :
- **Logo agrandi + `.RUN`** : `.brand` passe à 10px, ajout `.b3` « .RUN » en `--accent` →
  « TRAIL COCKPIT.RUN » (bandeau horizontal centré, choix Franck vs vertical/empilé).
- **Zoom au pincement, plus de barre `−/%/+`** (retirée) : listeners natifs non-passifs sur
  `.previewscroll` (`touchstart/move/end` 2 doigts → ratio de distance × zoom de départ, clamp
  1–3 ; `preventDefault` car React passe `onTouchMove` en passif) + `ctrl+wheel` (pincement
  trackpad desktop). `touch-action:pan-x pan-y` = pan 1 doigt via overflow, pas de pinch-zoom
  navigateur. `zoomRef` suit `zoom` pour les handlers attachés une fois (deps `[ready, race]`).

Neuvième vague (2026-06-12) — carte `/print` :
- **Logo déplacé du bandeau supérieur vers le MILIEU de l'en-tête** (`.brand` désormais
  enfant de `.hd`, entre le bloc nom/infos à gauche et l'objectif à droite) : `flex:1;
  align-self:center;text-align:center` → aligné verticalement avec les 2 lignes nom+infos.
  Plus de ligne de marque séparée en haut.
