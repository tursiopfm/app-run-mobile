# Auto-remplissage du site web de la course

> **Status: Implémenté** · 2026-06-12 · Code: web/lib/race-import/search-website.ts, web/app/api/race-import/website/route.ts, web/components/plan/RaceEditorModal.tsx, web/app/(main)/plan/courses/[id]/CoursePageClient.tsx, web/supabase/migrations/041_race_website_url.sql

## Problème

Quand un athlète crée une course dans l'onglet **Plan** et tape son nom, le bloc
« Site web » de la fiche course affiche un placeholder « Bientôt ». On veut le
remplir automatiquement avec l'adresse du **site officiel de l'organisation** de
la course, trouvée via une recherche web.

## Décisions (issues du brainstorming)

- **Déclencheur** : à la **création** de la course (1 seul appel OpenAI), pas à
  chaque frappe ni au blur.
- **Cible** : le **site officiel de l'organisation** (ex. `utmbmontblanc.com`),
  **pas** la page de chronométrage LiveTrail/UTMB. C'est une page d'accueil donc
  on n'utilise **pas** le pipeline lourd `find-race` (qui valide distance/D+ en
  parsant des waypoints).
- **Bloc « Site web »** : lien cliquable **+ édition / saisie manuelle**
  (robuste face à une recherche fausse ou vide).

## Architecture

### 1. Stockage — colonne `website_url` sur `races`

Le site web est un attribut de la course (comme `location`), pas une provenance
de tableau. On ne le met **pas** dans `race_tableau_meta` (qui n'existe que si un
tableau a été importé, le rendant inaccessible pour une course sans tableau).

- **Migration** `web/supabase/migrations/041_race_website_url.sql` :
  `alter table races add column if not exists website_url text;` (non
  auto-appliquée — à coller dans le SQL Editor Supabase).
- **Type** : `websiteUrl?: string` ajouté à l'interface `Race` (`types/plan.ts`).
- **Sérialisation** (`lib/plan/storage.ts`) : `website_url?: string | null` dans
  `RaceRow`, mappé dans `raceFromRow`/`raceToRow`, et **strippé dans le retry**
  de `saveRace` si la migration n'est pas encore appliquée — même pattern que
  `priority` / `pacing_fade` (migrations 022/035).

### 2. Recherche serveur

- **`web/lib/race-import/search-website.ts`** (`'server-only'`) :
  `searchOfficialWebsite({ name, date }): Promise<string | null>`.
  - Modèle `gpt-4o-search-preview`, `web_search_options: { search_context_size: 'high' }`.
  - Prompt ciblé : URL du site officiel de l'organisation, PAS chronométrage/
    résultats/inscription tierce.
  - Extraction : 1ʳᵉ annotation `url_citation` ; filet = 1ʳᵉ URL `https?://` du
    contenu (ponctuation de fin retirée) ; sinon `null`.
- **Route** `web/app/api/race-import/website/route.ts` (`runtime = 'nodejs'`),
  calquée sur `find/route.ts` : `POST { name, date }`, garde auth → 401, 400 si
  champs manquants, `200 { url: string | null }`, `422 { error }` sur exception.

### 3. Déclencheur — création de course

Dans `RaceEditorModal.handleSave` (branche **création** uniquement, après
`saveRace`), helper module-level `searchAndStoreWebsite` en **fire-and-forget** :
POST à la route ; au retour d'une URL, `saveRace({ ...race, websiteUrl })`. Non
bloquant : l'écran « Course créée » s'affiche immédiatement ; la recherche tourne
en fond et persiste l'URL quand elle aboutit. Toute erreur est avalée.

### 4. Bloc « Site web » (fiche course)

Composant `WebsiteBlock` dans `CoursePageClient.tsx` :
- **`race.websiteUrl` présent** → lien cliquable (`target="_blank" rel="noopener noreferrer"`)
  + bouton « Modifier ».
- **absent** → champ `<input url>` + « Enregistrer » (saisie manuelle) + bouton
  « Rechercher le site » (rappelle la route, état « Recherche… »).
- Toute validation persiste via `saveRace` puis met à jour l'état parent.
- Normalisation : préfixe `https://` si l'URL n'a pas de schéma.

## Flux de données

```
Création course (modal)
  └─ saveRace(course)                     → races (sans website)
  └─ POST /api/race-import/website        → searchOfficialWebsite()  [fond]
        └─ url ≠ null → saveRace({ ...course, websiteUrl })  → races.website_url

Ouverture fiche course
  └─ CoursePageClient lit race.websiteUrl
        ├─ présent  → lien + « Modifier »
        └─ absent   → input + « Enregistrer » / « Rechercher le site »
```

## Gestion d'erreur

- `OPENAI_API_KEY` absente, recherche infructueuse, ou réseau KO → l'URL reste
  vide ; le bloc retombe sur la saisie manuelle + bouton « Rechercher ». Aucune
  erreur visible à la création (fire-and-forget best-effort).

## Tests

- **`web/__tests__/lib/race-import/search-website.test.ts`** (mock OpenAI) :
  annotation `url_citation` → URL ; URL dans le contenu → URL (filet regex) ;
  ponctuation de fin retirée ; aucune URL → `null` ; `OPENAI_API_KEY` absente →
  lève.

## Hors scope (YAGNI)

- Pas de backfill auto des courses existantes (le bouton « Rechercher le site »
  couvre le cas).
- Pas de re-recherche au renommage d'une course.
- Pas de validation que l'URL est « vraiment » le bon organisateur (recherche +
  correction manuelle).

## Drift notes

- Le bloc « Site web » déclenche aussi la recherche **manuellement** (bouton
  « Rechercher le site ») en plus du fire-and-forget à la création — filet pour
  les cas où la recherche auto échoue, ne trouve rien, ou n'a pas fini avant
  l'ouverture de la fiche.
