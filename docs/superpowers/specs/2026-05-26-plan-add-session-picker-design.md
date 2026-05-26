# Spec — Picker d'ajout de séance (Plan tab)

> **Status:** Spec validée — implémentation pas encore commencée
> **Périmètre :** onglet Plan uniquement. Pas de migration SQL, pas de changement data model.

## Goal

Quand l'athlète tape le `+` d'une journée (vue semaine ou détail mois), interposer un **bottom-sheet picker** entre le tap et l'ouverture de `SessionEditorModal`. Le picker propose deux chemins :

1. **Créer une nouvelle séance** (CTA orange) → ouvre l'éditeur vierge sur la bonne date.
2. **Choisir un template dans la bibliothèque** (search + pills filtres + grille) → ouvre l'éditeur pré-rempli avec les valeurs du template.

## Problème actuel

Aujourd'hui le `+` ouvre directement `SessionEditorModal` vierge. L'athlète qui veut planifier une séance « classique » (footing 45', VMA 10×400m, SL 2h) doit la re-saisir intégralement à chaque fois — alors que la `BibliothequeSeancesBlock` contient déjà ces templates et que le drag-and-drop existe pour les déposer sur un jour.

Le DnD bibliothèque → calendrier reste utile (rapide, visuel), mais :
- Il n'est pas découvrable depuis le `+`.
- Il oblige à scroller jusqu'à la bibliothèque puis à viser un jour précis (frustrant sur mobile, surtout pour la vue mois où la cellule fait ~50px).

Le picker comble ce gap : on reste au même endroit, la date est déjà décidée, et on choisit.

## UX retenue

### Format : bottom-sheet modale

- Mobile : slide-up qui couvre ~78% de la hauteur, grabber visible en haut.
- Desktop : modale centrée, max-width ~560px.
- Fermeture : tap sur le scrim, swipe-down sur le grabber, bouton ✕, touche Échap.

Choix retenu vs vraie page Next.js (perd le contexte calendaire) ou panneau inline (trop étroit pour search + pills + grille).

### Composition (mobile, top → bottom)

1. Grabber + header « Ajouter une séance » + date longue (« Mardi 13 mai 2026 ») + close ✕
2. CTA orange pleine largeur : **« + Créer une nouvelle séance »**
3. Séparateur texte « OU CHOISIR DANS LA BIBLIOTHÈQUE »
4. Search input (placeholder « Rechercher une séance… »)
5. Pills filtres scrollables horizontalement : `Tous · <visibleTypes>`
6. Grille de templates 2 colonnes (mobile) / 3 (desktop)

Mockup de référence : [Prompts/plan-add-session-sheet-mockup.html](../../../Prompts/plan-add-session-sheet-mockup.html) (4 scènes : initial, éditeur pré-rempli, filtre actif, éditeur vierge).

### Comportement de sélection

**Tap CTA orange « Créer »** : ferme le sheet → ouvre `SessionEditorModal` avec `initialDate` seulement (comportement actuel, inchangé). Pas de bandeau pré-remplissage.

**Tap sur un template** : ferme le sheet → ouvre `SessionEditorModal` avec :
- `initialDate` = date du `+` cliqué
- `prefillTemplate` = le `SessionTemplate` complet
- L'éditeur extrait : `title`, `type`, `duration` (defaultDuration), `distance` (defaultDistance), `elevation` (defaultElevation), `intensity` (defaultIntensity), `tss` (recalculé via `estimateCharge()` cohérent avec ce que fait `TemplateEditorModal` aujourd'hui)
- Affiche un bandeau orange en tête : « ✨ Pré-rempli depuis *<titre>* »
- Tous les champs restent éditables ; les champs pré-remplis sont visuellement marqués (bordure orange + fond très léger orange) pour rassurer l'athlète qu'il peut tout modifier.

### Filtres et recherche

Réutilisent la logique de `BibliothequeSeancesBlock` :
- **Pills** : `Tous` + un pill par type retourné par `useActivityTypes().visibleTypes` (donc respecte les préfs masquage de l'athlète). Pill active prend la couleur du type via `resolveSessionMeta(slug, types).color`.
- **Search** : matche sur `template.title` + `template.tags` (case-insensitive), combiné AND avec le filtre type.
- **Grille** : merge `customTemplates` (haut) + `SESSION_TEMPLATES` filtrés par `getHiddenSystemTemplateIds()`. Même ordonnancement que la bibliothèque.

Différences volontaires vs `BibliothequeSeancesBlock` :
- Pas de toggle expand/collapse sur les pills (overkill dans un picker éphémère)
- Pas de bouton « ⚙ Personnalisé » (les préfs se gèrent dans la bibliothèque)
- Pas de pagination « Voir plus » — le scroll vertical du sheet suffit
- Pas de bouton ✕ supprimer sur chaque carte (lecture seule ici)
- Pas de DnD (tap = sélection)

## Architecture & réutilisation

### Nouveau composant

- **`web/components/plan/SessionAddSheet.tsx`** — le bottom-sheet picker. Pattern portal cohérent avec `SessionEditorModal` (Échap ferme, scrim cliquable).

Props :

```ts
type Props = {
  open: boolean
  dateISO: string                 // date du + cliqué (pour le header + initialDate de l'éditeur)
  onClose: () => void
  onPickTemplate: (template: SessionTemplate) => void
  onCreateBlank: () => void
}
```

### Composants factorisés

Extraits de `BibliothequeSeancesBlock.tsx` vers `web/components/plan/library/` pour partage :

- **`library/TemplateCard.tsx`** — carte template. Nouvelle prop `mode: 'drag' | 'pick'` :
  - `drag` (défaut, conserve le comportement actuel) : `useDraggable` + bouton ✕ supprimer
  - `pick` : pas de DnD, pas de bouton ✕, clic = `onSelect(template)`
- **`library/FilterBar.tsx`** — barre de pills + search. Nouvelle prop `variant: 'full' | 'compact'` :
  - `full` (défaut, biblio actuelle) : `Tous + peek + ExpandToggle + ⚙ Personnalisé` + collapse animé
  - `compact` (picker) : `Tous + tous les visibleTypes en row scrollable horizontale`, pas d'expand, pas de bouton préfs

`BibliothequeSeancesBlock.tsx` est refactoré pour consommer ces deux composants — comportement utilisateur inchangé.

### Composant modifié

- **`SessionEditorModal.tsx`** : nouvelle prop optionnelle `prefillTemplate?: SessionTemplate | null`.
  - Si présent et `session === null` : initialise l'état avec les valeurs du template + affiche le bandeau « Pré-rempli depuis *X* » au-dessus des tabs.
  - Si `session !== null` (mode édition) : `prefillTemplate` est ignoré, comportement inchangé.
  - Indicateur visuel « pré-rempli » sur les champs concernés (bordure orange + fond très léger orange). Persiste tant que l'éditeur est ouvert ; pas de tracking « touched » par champ (simple state, suffisant pour l'usage).

### Triggers à câbler

- [VueSemaineBlock.tsx:249](../../../web/components/plan/VueSemaineBlock.tsx#L249) — `openCreate(dateISO)` ouvre désormais `SessionAddSheet` au lieu de `SessionEditorModal` directement.
- [DayDetailPanel.tsx:58](../../../web/components/plan/DayDetailPanel.tsx#L58) — idem.

Le flow de `SessionAddSheet` :
- `onCreateBlank` → setEditorOpen(true) sans `prefillTemplate`
- `onPickTemplate(t)` → setPrefill(t) + setEditorOpen(true)
- À la fermeture du sheet via `onClose` → ne pas ouvrir l'éditeur

Le drag-and-drop bibliothèque → jour reste branché tel quel via `PlanSessionsDndProvider`. Pas touché.

## Edge cases

| Cas | Comportement |
|---|---|
| Bibliothèque vide (tous système masqués + zéro custom) | Empty state : « Aucune séance dans ta bibliothèque » + flèche vers le CTA orange |
| Aucun résultat (search/filtre trop restrictif) | « Aucune séance ne correspond » + bouton « Réinitialiser les filtres » |
| Type custom masqué mais template existe | Le template reste affiché en filtre `Tous` ; la pill du type masqué n'apparaît pas (cohérent biblio) |
| Tap sur scrim | Ferme le sheet (= annule) |
| Swipe-down sur grabber | Ferme le sheet |
| Échap clavier | Ferme le sheet |
| Sheet déjà ouvert + clic sur un autre `+` | Le composant parent réinitialise `dateISO` ; le sheet reste ouvert mais affiche la nouvelle date (pas de close/reopen visible) |

## i18n

Nouvelles clés sous `plan.add*` dans `web/lib/i18n/dictionaries/fr.ts` et `en.ts` :

| Clé | FR | EN |
|---|---|---|
| `addTitle` | « Ajouter une séance » | "Add a session" |
| `addCreateBtn` | « + Créer une nouvelle séance » | "+ Create new session" |
| `addOrLibrary` | « Ou choisir dans la bibliothèque » | "Or pick from library" |
| `addSearchPh` | « Rechercher une séance… » | "Search a session…" |
| `addNoMatch` | « Aucune séance ne correspond » | "No session matches" |
| `addReset` | « Réinitialiser les filtres » | "Reset filters" |
| `addEmpty` | « Aucune séance dans ta bibliothèque » | "Your library is empty" |
| `addPrefillBanner(title)` | « ✨ Pré-rempli depuis *X* » | "✨ Prefilled from *X*" |
| `addCloseAria` | « Fermer le sélecteur » | "Close picker" |
| `addPickAria(title)` | « Choisir le template X » | "Pick template X" |

## Tests (Jest)

Tests à ajouter dans `web/__tests__/components/plan/` :

- `SessionAddSheet.test.tsx`
  - Rend le titre, la date, le CTA, le séparateur, search, pills, grille
  - Tap CTA → appelle `onCreateBlank` puis `onClose` n'est pas appelé (l'éditeur prend le relais)
  - Tap sur un template → appelle `onPickTemplate(template)` avec le bon objet
  - Tap sur scrim → `onClose`
  - Touche Échap → `onClose`
  - Empty state bibliothèque vide
  - Empty state filtre vide + bouton reset
  - Filtrage par type (pill) + recherche AND
- `SessionEditorModal.test.tsx` — extension
  - `prefillTemplate` initialise correctement les champs
  - Bandeau « Pré-rempli depuis » affiché
  - Champs pré-remplis ont la classe `prefilled` puis la perdent après édition
  - Sans `prefillTemplate` → comportement actuel inchangé
- `library/FilterBar.test.tsx` — couvre `variant: 'full'` et `variant: 'compact'`
- `library/TemplateCard.test.tsx` — couvre `mode: 'drag'` et `mode: 'pick'`

## Hors scope (YAGNI)

- Pas de section « Récents / favoris » dans le picker (ajoutable plus tard si besoin réel)
- Pas de preview détaillée du template (l'éditeur pré-rempli est déjà la preview)
- Pas de drag-and-drop depuis le picker (pas de cas d'usage, la date est déjà fixée)
- Pas d'animation View Transitions entre picker et éditeur (transition simple via state, suffisant)
- Pas de modification de `BibliothequeSeancesBlock` au-delà du refactor d'extraction
