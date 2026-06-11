# Versioning des éditions & fraîcheur des tableaux — Lot 1 : Capture de l'édition

> **Status: Implémenté** · 2026-06-11 · Code: `web/lib/race-import/freshness.ts`, `hash.ts`, `sources/livetrail.ts`, `sources/utmb.ts`, `schema.ts`, `prompt.ts` · `web/app/api/races/[id]/waypoints/route.ts` · `web/components/plan/{RaceImportSheet,FreshnessBadge}.tsx` · migration `039_race_tableau_meta.sql` · branche `feat/race-edition-freshness`
>
> Lot 1 d'un brief en 2 lots (cf. décision de périmètre). **Lot 1 = capture de
> l'édition** (ce document). **Lot 2 = re-checks automatiques & diff** (spec séparé,
> à venir). Le Lot 1 pose le schéma de provenance/fraîcheur que le Lot 2 consommera.

## Contexte

Les organisateurs publient souvent le tableau de la nouvelle édition tard (parfois
quelques semaines avant le départ) ; parcours et barrières peuvent changer jusqu'à
J-3. Aujourd'hui l'app importe un tableau de course (ensemble de `race_waypoints`
liés à une `races`) sans tracer **à quelle édition** il se rapporte. Conséquence :
un athlète peut préparer sur le tableau N-1 sans le savoir.

Le Lot 1 rend ce cas **explicite** : on détecte l'année d'édition du tableau
importé, on la compare à l'édition cible de l'athlète, et on affiche un statut de
fraîcheur (confirmé / provisoire N-1 / non identifié), corrigeable à la main.

## Objectifs (Lot 1)

1. Tracer la provenance et la fraîcheur de chaque tableau importé (table 1:1).
2. Détecter l'année/date d'édition **à fond** depuis chaque source (LiveTrail, UTMB,
   pipeline LLM), par fusion de signaux + recoupement avec la fiche.
3. Calculer un `freshness_status` (`confirmed` / `provisional_previous_edition` /
   `unknown`) en comparant l'édition détectée à l'année de la `races.date`.
4. Afficher le statut : badge sur le détail course + ligne « édition détectée » dans
   la table de validation avant upsert, avec correction manuelle de `edition_year`.

## Non-objectifs (→ Lot 2 ou backlog)

- Re-checks automatiques (J-30/J-14/J-3), diff waypoint-par-waypoint, notifications,
  résolution de conflit. **C'est tout le Lot 2.**
- Recalcul de la fraîcheur après édition **manuelle** des waypoints dans la table
  (la meta est posée à l'import ; une édition manuelle ne la recalcule pas — backlog).
- Re-check des sources sans URL (paste / PDF / image) : `source_url` reste `null`,
  ces tableaux ne seront pas re-checkables au Lot 2. Assumé.

## Constats empiriques (sources réelles, 2026-06-11)

Sondés en direct pour ancrer le design :

- **LiveTrail `parcours.php` (XML legacy, public, sans auth)** : chaque `<pt>` porte
  `hp`/`hd` au format **`DD-HH:MM`** (jour-du-mois + heure). Le point de **départ**
  est `t="D"` ; son `hp` donne le **jour-du-mois et l'heure de départ** de l'édition
  décrite (ex. Ultra Saint-Jacques : `hp="12-19:10"` → jour 12, 19:10). **Le XML
  n'expose ni mois ni année.** Les barrières `b="14-11:00"` sont aussi `DD-HH:MM`.
- **LiveTrail v3 (`{slug}.v3.livetrail.net`)** : SPA Next.js. `editions.json` et les
  routes `/api/...` renvoient la page d'erreur Next, **pas de JSON exploitable**.
  Donc pas de date propre via un endpoint devinable. En revanche l'**URL v3 porte
  l'année** dans son path : `/fr/{YYYY}/...`.
- **UTMB (`{event}.utmb.world/.../races/{code}`)** : la page embarque un JSON
  `"points":[…]` (déjà lu par le parser). Le **champ date d'édition** est dans le
  JSON de la page (à localiser sur fixture réelle à l'implémentation — UTMB World
  affiche la date d'édition de façon proéminente, elle est dans le payload).

## Modèle de données

Nouvelle migration **`037_race_tableau_meta.sql`** (la dernière est `036`).

```sql
-- Provenance + fraîcheur d'un tableau de course importé. 1:1 avec races.
-- RLS par jointure sur races.athlete_id (même pattern que race_waypoints).
create table if not exists race_tableau_meta (
  race_id           uuid primary key references races(id) on delete cascade,
  edition_year      integer,
  edition_date      date,
  date_explicit     boolean not null default false,
  freshness_status  text not null
                    check (freshness_status in
                      ('confirmed','provisional_previous_edition','unknown')),
  source_url        text,
  source_checked_at timestamptz not null default now(),
  source_hash       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table race_tableau_meta enable row level security;

create policy "tableau_meta_select_own" on race_tableau_meta for select
  using (exists (select 1 from races r where r.id = race_id and r.athlete_id = auth.uid()));
create policy "tableau_meta_insert_own" on race_tableau_meta for insert
  with check (exists (select 1 from races r where r.id = race_id and r.athlete_id = auth.uid()));
create policy "tableau_meta_update_own" on race_tableau_meta for update
  using (exists (select 1 from races r where r.id = race_id and r.athlete_id = auth.uid()));
create policy "tableau_meta_delete_own" on race_tableau_meta for delete
  using (exists (select 1 from races r where r.id = race_id and r.athlete_id = auth.uid()));
```

> Séparée de `races` exprès : `races` = fiche utilisateur, `race_tableau_meta` =
> métadonnées d'import. **Rappel : migration non auto-appliquée → coller le SQL dans
> le Dashboard Supabase.**

## Types (`web/types/plan.ts`)

`ExtractedRaceData` a **déjà** `editionYear: number | null`. On ajoute :

```ts
export type FreshnessStatus =
  | 'confirmed'
  | 'provisional_previous_edition'
  | 'unknown'

export interface RaceTableauMeta {
  raceId: string
  editionYear: number | null
  editionDate: string | null        // ISO YYYY-MM-DD
  dateExplicit: boolean
  freshnessStatus: FreshnessStatus
  sourceUrl: string | null
  sourceCheckedAt: string           // ISO timestamp
  sourceHash: string | null
}

// Étendre ExtractedRaceData :
//   editionDate: string | null      // ISO YYYY-MM-DD si une date complète a été détectée
//   dateExplicit: boolean           // true si une date/année a été lue explicitement
//                                    // dans la source (vs déduite / absente)
```

Tous les producteurs d'`ExtractedRaceData` (parsers + LLM + tests + `find-race`)
doivent fournir les deux nouveaux champs. Valeur neutre = `editionDate: null`,
`dateExplicit: false`. La normalisation `validateExtractedRaceData` propage les
deux champs (comme elle propage déjà `editionYear`).

## Détection par source

But : produire pour chaque tableau un triplet **`(editionYear?, editionDate?,
dateExplicit)`** + un signal de **jour-du-mois** indépendant quand dispo.

### LLM (`prompt.ts` + `schema.ts`)

- Prompt : instruire d'extraire toute mention d'année/date (titre du roadbook,
  barrières datées « sam. 28 juin 23h30 », « édition 2026 »), et de renvoyer
  `edition_date` (ISO si une date complète est lisible) + `date_explicit`
  (true si une année/date a été réellement trouvée dans le contenu).
- JSON schema : ajouter `edition_date: ['string','null']` et `date_explicit: boolean`
  aux `properties` + `required` (Structured Outputs `strict:true` exige les deux).
- `rawToExtractedRaceData` : mapper `edition_date` → `editionDate`,
  `date_explicit` → `dateExplicit`. `edition_year` déjà mappé.

### UTMB (`sources/utmb.ts`)

- Localiser le champ date d'édition dans le JSON embarqué (fixture réelle), l'extraire
  → `editionDate` (ISO) + `editionYear` = son année + `dateExplicit = true`.
- Si le champ est introuvable (structure UTMB changée) : `editionYear/Date = null`,
  `dateExplicit = false` (dégrade en `unknown`, ne casse pas le parse).

### LiveTrail (`sources/livetrail.ts`)

Le XML n'a ni mois ni année → fusion :

- **Année** ← path de l'URL source si `/{YYYY}/` présent (URL v3). Sinon `null`.
  Helper pur `extractYearFromLivetrailUrl(url): number | null`.
- **Jour-du-mois + heure de départ** ← `hp` du point `t="D"` (départ), format
  `DD-HH:MM`. Helper pur `parseLivetrailStart(hp): { day: number; time: string } | null`.
  Exposé sur `ExtractedRaceData` via un champ interne de détection (voir ci-dessous)
  — le `day` sert au recoupement, le `time` peut pré-remplir `races.startTime`.
- `editionDate` : seulement si année (URL) **et** mois connus. Le mois n'est pas dans
  le XML → on **ne fabrique pas** de date complète côté parser ; `editionDate = null`,
  `editionYear` = année URL (ou null), `dateExplicit = (année URL présente)`.
  La date complète éventuelle se reconstruit au calcul de fraîcheur en croisant le
  mois de la fiche (cf. § suivant).

> Le jour-du-mois détecté est porté jusqu'au calcul de fraîcheur. Implémentation :
> ajouter à `ExtractedRaceData` un champ optionnel **`startDayOfMonth: number | null`**
> (rempli par LiveTrail, `null` ailleurs), ET réutiliser `startTime` existant n'est
> pas applicable (c'est sur `Race`, pas sur l'extraction) → on ajoute aussi
> **`startTimeRaw: string | null`** sur `ExtractedRaceData` pour le pré-remplissage.
> Ces deux champs sont des signaux de détection, neutres (`null`) pour les autres sources.

### UTMB — pas de jour-du-mois XML

UTMB fournit une `editionDate` explicite → le recoupement jour n'est pas nécessaire
(`startDayOfMonth = null`).

## Calcul de fraîcheur (fonction pure)

Nouveau module `web/lib/race-import/freshness.ts` :

```ts
export interface DetectedEdition {
  editionYear: number | null
  editionDate: string | null      // ISO si connu
  dateExplicit: boolean
  startDayOfMonth: number | null  // signal indépendant (LiveTrail)
}

export interface FreshnessResult {
  editionYear: number | null
  editionDate: string | null
  freshnessStatus: FreshnessStatus
}

// ficheDateISO = races.date (YYYY-MM-DD). Année cible = year(ficheDateISO).
export function computeFreshness(
  detected: DetectedEdition,
  ficheDateISO: string,
): FreshnessResult
```

Règles (année cible `Y = year(ficheDate)`, jour fiche `Df = day(ficheDate)`) :

| Année détectée | Recoupement jour (si `startDayOfMonth` connu)        | Statut |
|---|---|---|
| `=== Y` | jour concorde **ou** inconnu | `confirmed` |
| `=== Y` | jour **≠** `Df`                | `unknown` *(⚠️ : la source dit la même année mais un autre jour → donnée incohérente ; `provisional_previous_edition` est réservé à « année détectée < cible », donc on retombe sur `unknown` « à vérifier ».)* |
| `< Y`   | —                              | `provisional_previous_edition` (garde l'`editionYear` réel) |
| `> Y`   | —                              | `unknown` *(édition future inattendue → à vérifier)* |
| `null`  | jour `=== Df`                  | `unknown` *(le jour concorde mais sans année on n'affirme rien ; voir note)* |
| `null`  | jour inconnu ou `≠ Df`         | `unknown` |

- Si `editionDate` détectée (UTMB / LLM) : `editionYear` en est dérivé ; le
  recoupement jour est ignoré (date explicite = signal fort).
- LiveTrail confirmé : `editionDate` reconstruite = `Y-{mois fiche}-{startDayOfMonth}`
  **seulement si** le jour concorde (sinon `null`). Sert d'affichage, pas d'autorité.

> Note « jour concorde sans année » : on reste `unknown` mais on **pourra** afficher
> un sous-texte « le jour de départ correspond à votre fiche » pour guider la
> correction manuelle. Optionnel, non bloquant.

## Persistance

Au moment où l'import upsert les `race_waypoints` (chemin existant), upsert aussi
`race_tableau_meta` :

- `source_hash = sha256(canonicalize(waypoints normalisés))` — hash du **contenu
  métier** (km, dPlus, dMoins, cutoffRaw, supplies, par orderIndex), pas du HTML
  brut. Stable aux changements cosmétiques de la source, bouge si le parcours / une
  barrière / un ravito change → exactement le signal que le Lot 2 veut differ.
  Helper pur `hashWaypoints(waypoints): string` (`canonicalize` = JSON trié déterministe).
- `source_url` = l'URL importée (`null` pour paste/PDF/image).
- `source_checked_at = now()`.
- `edition_year`, `edition_date`, `date_explicit`, `freshness_status` issus de
  `computeFreshness`.

Storage helpers (`web/lib/plan/storage.ts` ou module dédié) : `saveRaceTableauMeta`,
`getRaceTableauMeta(raceId)`. Lecture/écriture Supabase si dispo, no-op gracieux
sinon (cohérent avec le reste du plan).

## UX

### Table de validation avant upsert (`RaceImportSheet.tsx`)

- Ligne « **Édition détectée** » au-dessus du tableau preview : affiche le statut
  (✅/⚠️/❔) + l'`edition_year` détecté.
- Champ **`edition_year` éditable** (number) : l'override manuel recalcule le statut
  côté client (rappel `computeFreshness` avec l'année saisie) avant upsert.

### Détail course (`WaypointsTable.tsx` / `CoursePageClient.tsx`)

Badge au-dessus du tableau, lu depuis `race_tableau_meta` :

- `confirmed` → ✅ « Confirmé édition {year} »
- `provisional_previous_edition` → ⚠️ « Provisoire — basé sur l'édition {year} »
- `unknown` → ❔ « Édition non identifiée — vérifiez la source »

Jamais bloquant : un tableau N-1 reste pleinement utilisable.

## Tests

- **`computeFreshness`** (pur) : matrice complète du tableau ci-dessus (confirmed /
  provisional N-1 / provisional même-année-jour-différent / unknown futur / unknown
  sans année / recoupement jour).
- **`parseLivetrailStart`** : `"12-19:10"` → `{ day: 12, time: '19:10' }` ; formats
  vides / invalides → `null`.
- **`extractYearFromLivetrailUrl`** : v3 `/fr/2026/...` → 2026 ; `parcours.php?course=`
  (sans année) → `null`.
- **prompt/schema roundtrip** : `rawToExtractedRaceData` mappe `edition_date` /
  `date_explicit` ; `validateExtractedRaceData` les propage.
- **`hashWaypoints`** : déterministe (même entrée → même hash ; ordre des clés
  indifférent) ; change si un km/cutoff/supply change.
- **UTMB** : sur fixture réelle, extraction de `editionDate`/`editionYear` ; champ
  absent → `null` sans throw.

## Fichiers touchés (indicatif)

- `web/supabase/migrations/037_race_tableau_meta.sql` *(create)*
- `web/types/plan.ts` *(FreshnessStatus, RaceTableauMeta, champs ExtractedRaceData)*
- `web/lib/race-import/freshness.ts` *(create — computeFreshness, hashWaypoints)*
- `web/lib/race-import/prompt.ts`, `schema.ts` *(edition_date / date_explicit)*
- `web/lib/race-import/sources/livetrail.ts` *(parseLivetrailStart, year-from-url, startDayOfMonth/startTimeRaw)*
- `web/lib/race-import/sources/utmb.ts` *(editionDate du JSON)*
- `web/lib/plan/storage.ts` *(saveRaceTableauMeta / getRaceTableauMeta + upsert au chemin d'import)*
- `web/components/plan/RaceImportSheet.tsx` *(ligne édition + champ éditable)*
- `web/components/plan/WaypointsTable.tsx` ou `CoursePageClient.tsx` *(badge)*
- `web/__tests__/lib/race-import/*` *(freshness, livetrail-start, hash, schema)*
```
