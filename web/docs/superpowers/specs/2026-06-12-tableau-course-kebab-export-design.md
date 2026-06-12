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
