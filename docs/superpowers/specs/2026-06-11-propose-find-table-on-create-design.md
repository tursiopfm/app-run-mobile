# Proposer la recherche du tableau à la fin de la création de course — Design

**Date :** 2026-06-11
**Statut :** À implémenter

## Objectif

À la **fin de la création** d'une course, proposer d'aller chercher automatiquement
le tableau de course (l'onglet « Auto » existant). Garder aussi l'onglet Auto
disponible à tout moment dans l'import (les tableaux ne sont pas toujours publiés à
l'inscription).

## Contexte (existant)

- Création/édition de course : `web/components/plan/ObjectifCourseBlock.tsx`
  (`openCreate()` ouvre `RaceEditorModal` en mode création). `RaceEditorModal`
  (`web/components/plan/RaceEditorModal.tsx`) : `isEdit = race !== null` ;
  `handleSave()` construit `toSave` (avec `id` généré), `await saveRace(toSave)`,
  puis `onSaved()` + `onClose()`. `onSaved` = recharge la liste.
- Feuille d'import (`web/components/plan/RaceImportSheet.tsx`) : vit sur la page
  **détail** `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx` (state
  `importOpen` → `setImportOpen(true)`). Elle a déjà l'onglet **Auto** (par défaut),
  pré-rempli depuis la fiche (prop `race`), avec la fonction `findRace()`.
- Navigation vers le détail : `router.push('/plan/courses/{id}')`.

## Design

### 1. `RaceEditorModal` — écran « proposer » après création

- Ajouter un état `createdId: string | null` (null par défaut).
- Dans `handleSave()` : après `await saveRace(toSave)`, appeler `onSaved()` (la liste
  reste à jour pour le cas « Plus tard »), puis :
  - si **création** (`!isEdit`) → `setCreatedId(toSave.id)` (NE PAS fermer ; on
    affiche l'écran de proposition).
  - si **édition** → `onClose()` (comportement actuel inchangé).
- Quand `createdId !== null`, le rendu de la modale montre un écran de confirmation
  au lieu du formulaire :
  - Titre « Course créée ✓ »
  - Texte « Chercher le tableau de course automatiquement (ravitos, barrières,
    objectif) ? »
  - **[Oui, chercher]** → `router.push('/plan/courses/' + createdId + '?import=auto')`
    puis `onClose()`.
  - **[Plus tard]** → `onClose()`.
- `useRouter` (next/navigation) ajouté au composant.
- Reset : à la réouverture de la modale (`open` change), remettre `createdId = null`
  (sinon l'écran « proposer » resterait collé).

### 2. `RaceImportSheet` — auto-lancer la recherche

- Nouvelle prop optionnelle `autoSearch?: boolean`.
- Effet dédié (après la définition de `findRace`) :
  `useEffect(() => { if (open && autoSearch) void findRace() }, [open, autoSearch])`
  (avec `// eslint-disable-next-line react-hooks/exhaustive-deps`). L'effet de reset
  existant (qui force `tab='auto'` et vide `candidates`) s'exécute avant (défini plus
  haut) → on arrive sur l'onglet Auto puis la recherche démarre.

### 3. `CoursePageClient` — ouvrir l'import en mode auto via l'URL

- `useSearchParams` + `useRouter`. Nouvel état `autoSearch` (bool).
- Effet au montage : si `searchParams.get('import') === 'auto'` →
  `setImportOpen(true)`, `setAutoSearch(true)`, puis `router.replace('/plan/courses/'
  + race.id)` (retire le param pour qu'un refresh ne ré-ouvre pas).
- Passer `autoSearch={autoSearch}` à `<RaceImportSheet>`. Dans le `onClose` du sheet :
  `setAutoSearch(false)` (les réouvertures manuelles ne relancent pas la recherche).

## Flux

```
Création course (ObjectifCourseBlock → RaceEditorModal)
  → save → onSaved() (liste à jour)
  → écran « Course créée — chercher le tableau ? »
    → [Plus tard] : close
    → [Oui] : router.push(/plan/courses/{id}?import=auto) + close
        → CoursePageClient lit ?import=auto → ouvre la feuille (onglet Auto) + autoSearch
        → RaceImportSheet auto-lance findRace() → meilleur match → Importer → preview → save
```

## Gestion d'erreurs

- Recherche auto échoue (modèle search indispo, rien trouvé) → l'état `findError`
  existant de la feuille s'affiche ; l'utilisateur peut réessayer ou utiliser
  URL/PDF/Image. Aucun blocage.
- `[Plus tard]` → rien de spécial ; la course est créée, le tableau se fera plus tard
  via l'onglet Auto (ou manuel).

## Tests

- Logique de recherche déjà couverte (find-race tests). Ici la valeur est surtout du
  câblage UI (état/navigation/effet) → vérification **headless** : (a) l'écran
  « proposer » de `RaceEditorModal` après création, (b) que l'onglet Auto s'ouvre.
  Pas de nouvelle logique pure à tester unitairement.

## Hors périmètre

- Pas de changement en mode édition.
- Pas de pré-remplissage de la fiche depuis la recherche (on consomme la fiche).
- Aucune migration DB.
