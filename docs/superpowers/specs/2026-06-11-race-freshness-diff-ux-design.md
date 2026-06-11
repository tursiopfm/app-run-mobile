# Re-checks & diff — Lot 2b : UX de validation

> **Status: Spec** · 2026-06-11
>
> Lot 2b (UX) du brief « versioning des éditions & fraîcheur ». Consomme le
> `pending_diff` écrit par le **Lot 2a** (détection, déjà mergé). Pré-requis : Lot 1
> (`race_tableau_meta`, GET waypoints renvoyant `meta`) + Lot 2a (migration 040
> `pending_diff`/`pending_diff_at`, `PendingDiff`). Specs :
> `2026-06-11-race-edition-freshness-capture-design.md`,
> `2026-06-11-race-freshness-recheck-detection-design.md`.

## Contexte

Le Lot 2a enregistre un `pending_diff` sur `race_tableau_meta` quand le tableau d'une
course planifiée a changé (parcours/barrières/ravitos) ou qu'une nouvelle édition est
sortie — **sans jamais écraser** les `race_waypoints`. Le Lot 2b donne à l'utilisateur
le moyen de **voir** ce diff et de **décider** : appliquer le nouveau tableau, ou
garder l'actuel. Livraison **in-app uniquement** (aucune infra notif/email).

## Objectifs (Lot 2b)

1. Exposer `pending_diff`/`pending_diff_at` au client (via la meta déjà renvoyée par le
   GET waypoints).
2. Endpoint de résolution `apply` / `dismiss` (auth + ownership).
3. Bandeau sur le détail course + indicateur léger sur le bloc Objectif.
4. Modal de diff (résumé + détails) calqué sur la résolution de conflit Garmin.

## Non-objectifs

- Email / push / centre de notifications.
- Diff par-champ éditable à la main (on applique **en bloc** ou on garde l'actuel).
- Historique des diffs résolus.

## 1. Exposition des données

- Étendre `RaceTableauMeta` (`web/types/plan.ts`) : `pendingDiff: PendingDiff | null` +
  `pendingDiffAt: string | null`.
- `rowToTableauMeta` (`web/lib/race-import/schema.ts`) : mapper `row.pending_diff` →
  `pendingDiff`, `row.pending_diff_at` → `pendingDiffAt`. Le GET
  `/api/races/[id]/waypoints` fait déjà `select('*')` + renvoie `meta` → exposé **sans
  nouvelle requête**.

## 2. Endpoint de résolution

`POST /api/races/[id]/tableau-recheck` (`runtime='nodejs'`), body `{ action: 'apply' | 'dismiss' }`.
Auth `getUser()` → 401 ; ownership `races.athlete_id = user.id` → 404 ; lit la meta, si
`pending_diff` absent → 409 (« aucun diff en attente »).

- **`apply`** :
  1. Remplace les `race_waypoints` (delete + insert, même logique que `PUT
     /api/races/[id]/waypoints`) par `pending_diff.newWaypoints`.
  2. Met à jour `race_tableau_meta` depuis `pending_diff.newMeta` :
     `edition_year`, `edition_date`, `date_explicit`, `freshness_status`,
     `source_hash` ← `newMeta.sourceHash` ; `source_checked_at = now()` ;
     `pending_diff = null`, `pending_diff_at = null`.
- **`dismiss`** (« garder l'actuel ») :
  - Ne touche pas les `race_waypoints`.
  - **Avance `source_hash` ← `pending_diff.newMeta.sourceHash`** (le cron ne
    re-signalera pas le même changement) ; `pending_diff = null`,
    `pending_diff_at = null`.

Réponse : `{ ok: true }`. Le client recharge ensuite waypoints + meta.

## 3. Surfaces

### Détail course (`CoursePageClient.tsx`)
Sous le `<Section title="Tableau de course">`, **au-dessus** du `FreshnessBadge`/tableau,
si `meta?.pendingDiff` : un **bandeau** cliquable :
> ⚠️ Le tableau a changé — {summary.added} ajout(s) · {summary.removed} retrait(s) · {summary.modified} modif(s) · détecté le {pendingDiffAt}

(ou « ✨ Nouvelle édition {newMeta.editionYear} disponible » si `kind === 'new_edition'`).
Clic → ouvre `TableauDiffModal`. À la résolution → `reload()`.

### Bloc Objectif (`ObjectifCourseBlock.tsx`)
Indicateur **léger** (pastille ⚠️) sur la carte de la course ayant un `pendingDiff`,
menant au détail course (pas de modal ici). Le bloc devra connaître les courses avec
diff en attente : un fetch léger (GET de la meta par course est trop coûteux) → on
ajoute un helper `getRacesWithPendingDiff(): Promise<Set<string>>` (lib/plan/storage)
qui lit `race_tableau_meta` (race_id where pending_diff not null) en une requête.

> Si le coût d'intégration sur le bloc Objectif dépasse la valeur (le bandeau du détail
> course suffit au MVP), l'indicateur Objectif peut être livré en second — le bandeau
> détail est le cœur du Lot 2b.

## 4. Modal `TableauDiffModal`

Nouveau `web/components/plan/TableauDiffModal.tsx`, portal (pattern `RaceEditorModal` /
`ConflictResolution`). Props : `{ diff: PendingDiff; onApply: () => void; onDismiss: () => void; onClose: () => void; busy: boolean }`.

- En-tête : kind (`changed` → « Le tableau a été mis à jour » / `new_edition` → « Nouvelle
  édition {year} »), compteurs `added/removed/modified`.
- Corps : liste des **modifs** (`modifiedDetails` : nom du point + chaque champ changé
  `km/dPlus/dMoins/cutoffRaw/supplies` avec `from → to` lisible), puis les **ajouts**
  (nom @ km) et **retraits** (nom @ km).
- Pied : 2 boutons — **« Appliquer le nouveau tableau »** (primary) / **« Garder
  l'actuel »** — déclenchent `onApply`/`onDismiss` (désactivés si `busy`).

Helpers d'affichage purs (formatage `supplies`, `cutoffRaw`, `from→to`) dans le composant
ou un petit module ; pas de logique métier (le diff est déjà calculé).

## 5. Tests

- **`rowToTableauMeta`** : mappe `pending_diff`/`pending_diff_at` (présent et null).
- **Endpoint `tableau-recheck`** (handlers, supabase mocké) :
  - 401 sans user ; 404 si course pas au user ; 409 si pas de `pending_diff` ;
  - `apply` → insert des `newWaypoints` + meta mise à jour (`source_hash`, edition,
    `pending_diff` vidé) ;
  - `dismiss` → waypoints intouchés, `source_hash` avancé, `pending_diff` vidé.
- **`TableauDiffModal`** : rendu d'un diff (compteurs + une modif + un ajout + un
  retrait), clic Appliquer/Garder appelle le bon callback. *(test léger ; attention au
  provider i18n si le composant utilise `useT` — sinon pas de dépendance i18n.)*

## Fichiers (indicatif)

- `web/types/plan.ts` *(RaceTableauMeta += pendingDiff/pendingDiffAt)*
- `web/lib/race-import/schema.ts` *(rowToTableauMeta)*
- `web/app/api/races/[id]/tableau-recheck/route.ts` *(create — POST apply/dismiss)*
- `web/components/plan/TableauDiffModal.tsx` *(create)*
- `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx` *(bandeau + modal + reload)*
- `web/lib/plan/storage.ts` *(getRacesWithPendingDiff)* + `web/components/plan/ObjectifCourseBlock.tsx` *(indicateur)*
- Tests : `web/__tests__/...` (schema, route tableau-recheck, modal)
