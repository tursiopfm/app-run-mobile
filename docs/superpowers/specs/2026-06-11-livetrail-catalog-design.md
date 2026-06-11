# Catalogue LiveTrail & onglet Auto enrichi — Design

> Sous-projet **A** du brief « Extension des sources de tableaux de course ».
> Statut : design validé (brainstorming), spec en revue. Pas encore implémenté.

## 1. Contexte & objectif

Le module d'import des tableaux de course résout aujourd'hui une course **à la demande** :
l'onglet « Auto » de [RaceImportSheet.tsx](../../../web/components/plan/RaceImportSheet.tsx)
envoie la fiche (nom/date/distance/D+) à `/api/race-import/find` →
[find-race.ts](../../../web/lib/race-import/find-race.ts) lance une recherche OpenAI
(`gpt-4o-search-preview`, payante et faillible) → parse les URLs trouvées → classe par
distance/D+.

**Objectif** : ajouter un **catalogue LiveTrail local** qui permet de résoudre une course
**sans appeler OpenAI** quand elle est déjà connue, alimentant l'onglet Auto en suggestions
**instantanées et gratuites**. Usage cible retenu : *autocomplétion / parcourir le
référentiel*.

### Constat de faisabilité (vérifié le 2026-06-11)

Le brief supposait un « index des sous-domaines » LiveTrail. **Il n'existe pas** :

- La seule page d'index publique ([web.livetrail.net/fr/events](https://web.livetrail.net/fr/events))
  ne liste que les événements **à venir** (~20, fenêtre glissante). Pas de pagination ni de
  filtre par année dans le HTML.
- `/api/events` renvoie 404 ; aucune API publique documentée.
- L'accès **par événement** est solide : `{slug}.v3.livetrail.net` et surtout le legacy
  `{slug}.livetrail.run/parcours.php` (déjà exploité par le parseur) renvoient **toutes les
  courses + waypoints** d'un événement.
- `robots.txt` absent (404) sur les deux domaines → pas d'interdiction publiée ; on
  s'auto-throttle quand même.

**Conséquence** : pas de « crawl exhaustif » possible. Le modèle retenu est
**accumulation incrémentale + snapshot glissant**, et le catalogue est **clairsemé au début**
puis se densifie. Pour une course absente, l'utilisateur retombe sur le flux Auto/OpenAI
existant. L'autocomplétion est une **accélération opportuniste**, pas un référentiel mondial.

## 2. Périmètre

**Dans le scope :**

- Table catalogue **légère** `livetrail_catalog` (index, **pas** de waypoints stockés).
- Peuplement : accumulation passive (à chaque résolution LiveTrail) + cron snapshot des
  événements à venir.
- Résolution **catalogue-d'abord** dans l'onglet Auto (fallback OpenAI inchangé).

**Hors scope (autres specs) :**

- Stockage des waypoints / résilience offline (rejeté : on garde les waypoints frais).
- Champs `edition_year`/`edition_date`/`freshness_status`/`source_checked_at`/`source_hash`
  au niveau course persistée → **sous-projet Fraîcheur** (voir §7).
- `OpenSplitTimeParser` (sous-projet B), prompts LLM par famille (C).
- Pré-remplissage à la création de course ; nouvel onglet UI (on enrichit Auto en place).
- Historique multi-millésimes au-delà de ce que les snapshots accumulent.

## 3. Modèle de données — `livetrail_catalog` (migration 038)

Grain = **une course-édition**. Migration `web/supabase/migrations/038_livetrail_catalog.sql`
(numéro **038** ; **037** est réservé au sous-projet Fraîcheur — voir §7).

| Colonne | Type | Note |
|---|---|---|
| `id` | `uuid pk default gen_random_uuid()` | |
| `platform` | `text not null default 'livetrail'` | extension future (OpenSplitTime…) |
| `event_slug` | `text not null` | sous-domaine, ex. `ultramarin-breizhchrono` |
| `event_name` | `text` (nullable) | nom événement (depuis snapshot ; null en accumulation seule) |
| `course_name` | `text` (nullable) | nom course, ex. `Grand Raid` (le `course_id` du XML n'est pas exposé par `listLivetrailRaces`, owned Fraîcheur → on clé sur le nom) |
| `edition_year` | `int` (nullable) | depuis date snapshot / année URL v3 ; null si inconnu |
| `edition_date` | `date` (nullable) | si connue |
| `total_km` | `numeric(6,2)` (nullable) | dernier waypoint |
| `total_dplus` | `int` (nullable) | dernier waypoint |
| `source_url` | `text not null` | URL événement à ré-importer (slug-based) |
| `search_text` | `text not null` | normalisé (minuscule, sans accent) = `event_name + course_name + event_slug` |
| `first_seen_at` | `timestamptz not null default now()` | |
| `last_seen_at` | `timestamptz not null default now()` | rafraîchi à chaque vue (cron/accumulation) |

**Unicité (upsert)** : index unique
`(platform, event_slug, course_name, edition_year) NULLS NOT DISTINCT` (Postgres 15+ —
traite les `NULL` comme égaux, donc une course sans année/nom ne se duplique pas, et la cible
d'`onConflict` reste une liste de colonnes réelles exploitable par l'upsert PostgREST).

**Recherche** : `create extension if not exists pg_trgm;` puis index GIN
`(search_text gin_trgm_ops)` pour des `ILIKE '%token%'` rapides. À petite échelle un scan
plein suffit, mais l'index est posé d'emblée.

**RLS** : `enable row level security` ; policy `select` pour `authenticated`. **Aucune** policy
insert/update : les écritures passent par le **service role** (`createServiceClient`, qui
bypasse RLS) depuis l'accumulation serveur et le cron.

**Rappel** : migration **non auto-appliquée** → coller le SQL dans le Dashboard Supabase.

## 4. Énumération & peuplement

Nouveau fichier `web/lib/race-import/catalog.ts` (logique d'upsert + recherche). Deux sources.

### 4.1 Accumulation passive (gratuit, aucun crawl en plus)

Helper `accumulateCatalog(candidates: RaceCandidate[])` appelé dans
[find-race.ts](../../../web/lib/race-import/find-race.ts) après la résolution **OpenAI** (tier 2),
pour capturer les événements LiveTrail nouvellement découverts. Il filtre les candidats
`parserId === 'livetrail'` (qui portent `url`, `raceName`, `totalKm`, `totalDplus`), bâtit les
lignes (`event_slug` = host du `url`, `course_name` = `raceName`) et upsert via
`createServiceClient`. **`resolveCandidates` reste pur** (aucune DB) → tests existants intacts.
Tolérant aux échecs (un upsert qui rate ne casse pas la résolution).

`edition_year` est dérivé de l'**URL source** (`/fr/{YYYY}/`) par un helper pur
`yearFromLivetrailUrl(url)` (local au catalogue tant que Fraîcheur n'a pas exporté son
`extractYearFromLivetrailUrl` — même regex ; consolidation en suite). `null` si l'URL ne porte
pas d'année → la clé `NULLS NOT DISTINCT` regroupe alors sur « édition courante ».

### 4.2 Snapshot glissant (seeding)

Route `web/app/api/cron/livetrail-catalog/route.ts` (`GET`, auth `CRON_SECRET`,
`createServiceClient`) — même pattern que
[strava-import](../../../web/app/api/cron/strava-import/route.ts) :

1. `fetch('https://web.livetrail.net/fr/events')`.
2. Extraire les liens `{slug}.v3.livetrail.net` / `{slug}.livetrail.net` / `.run` du HTML ;
   **exclure** `*.utmb.world` (déjà couvert par `utmbParser`).
3. Pour chaque slug, appeler `listLivetrailRaces` puis `accumulateCatalog`.
4. Garde-fous : traitement **séquentiel** + **délai inter-événements** (300 ms),
   **cap 30 événements/run**, `User-Agent: TrailCockpitBot/1.0 (+contact)`.

> **v1** : le *skip des slugs récemment vus* (`last_seen_at` < 7 j) est **différé** — la
> fenêtre `/fr/events` ne contient que ~20-30 événements à venir et le cron est hebdo, donc
> re-fetcher la fenêtre rafraîchit juste les totaux à coût borné. À ajouter si le crawl
> s'élargit (requête des slugs frais avant la boucle).

Déclenchement **externe ~hebdomadaire** (GitHub Action vers l'URL + `CRON_SECRET`, comme les
crons existants) ; entrée `vercel.json > crons` possible en alternative (attention aux limites
du plan Hobby).

> **Risque à vérifier en implémentation** : `web.livetrail.net/fr/events` peut être rendu
> côté client (SPA). Si un `fetch()` serveur ne renvoie pas les liens d'événements, le
> snapshot devra utiliser un fetch rendu ou un endpoint de données. **Étape de vérif**
> obligatoire avant de coder le parsing (cf. plan).

## 5. Résolution — onglet Auto à deux étages (UI inchangée)

`findRaceCandidates(target)` (appelé par `/api/race-import/find`) gagne un étage **catalogue
d'abord** :

```text
1. Tier catalogue : searchCatalogUrls(target)
   → ILIKE sur search_text par tokens du nom → slugs d'événements candidats,
     classés par proximité total_km/total_dplus, top K.
   → resolveCandidates(target, slugUrls)   [RÉUTILISE l'existant : listLivetrailRaces + rank]
   → si ranked[0].confident  →  RETURN (zéro appel OpenAI)
2. Tier OpenAI (inchangé) : searchRaceUrls(target) + resolveCandidates(target, rawUrls)
```

Points clés :

- **Waypoints toujours re-fetch frais** : le catalogue ne fournit que des **slugs/URLs** ;
  `resolveCandidates` → `listLivetrailRaces` refait le fetch `parcours.php`. Aucun waypoint
  stocké, donc jamais périmé.
- **Réutilisation maximale** : `searchCatalogUrls` est le seul code neuf côté résolution ; tout
  le reste (ranking distance/D+, dédup, forme `RaceCandidate`) est l'existant.
- **Réponse identique** : `/api/race-import/find` renvoie toujours `{ candidates: RaceCandidate[] }`
  → [RaceImportSheet.tsx](../../../web/components/plan/RaceImportSheet.tsx) **ne change pas**.

## 6. Fraîcheur & robustesse

- Totaux catalogue (`total_km`/`total_dplus`) = uniquement **ranking/affichage + gating
  `confident`** ; re-fetch à l'import, donc une dérive (organisateur qui édite le parcours)
  est cosmétique.
- Si `listLivetrailRaces` échoue à la résolution (événement offline) → la branche catalogue ne
  produit rien de confident → fallback OpenAI. Dégradation gracieuse.
- Gating `confident` (`TOL_KM`/`TOL_D` existants) protège des faux positifs : un mauvais
  événement matché par token mais hors distance/D+ ne court-circuite pas OpenAI.

## 7. Interfaces avec le travail Fraîcheur (contrat de collaboration)

Deux sessions travaillent en parallèle sur ce module (même working tree). Spec Fraîcheur :
[2026-06-11-race-edition-freshness-capture-design.md](2026-06-11-race-edition-freshness-capture-design.md)
(Lot 1 = capture d'édition ; Lot 2 = re-checks/diff, à venir). Frontière d'ownership
(fichiers disjoints) :

| Couture | Propriétaire | Contrat |
|---|---|---|
| Migration champs édition/fraîcheur (course persistée) | **Fraîcheur** | migration **037** |
| Migration `livetrail_catalog` | **Catalogue (ce doc)** | migration **038** |
| `web/lib/race-import/sources/livetrail.ts` (détection édition) | **Fraîcheur** | ajoute `extractYearFromLivetrailUrl(url)` + `parseLivetrailStart(hp)` + champs `editionDate`/`startDayOfMonth`/`startTimeRaw` sur `ExtractedRaceData` |
| `web/lib/race-import/catalog.ts` + cron + `searchCatalogUrls` | **Catalogue** | dérive `edition_year` via un helper local `yearFromLivetrailUrl(url)` (consolidable avec `extractYearFromLivetrailUrl` de Fraîcheur ensuite) |
| Types schéma (`ExtractedRaceData`, champs fraîcheur) | **Fraîcheur** | Catalogue **n'édite pas** ces types ; `RaceCandidate.url` sert de `source_url` au chemin d'écriture Fraîcheur |
| Badge fraîcheur sur la carte candidat | **Fraîcheur** | si un `edition_year` au niveau candidat devient nécessaire → suite coordonnée (hors scope ici) |
| Crons `app/api/cron/*` | partagé | noms distincts : `livetrail-catalog` (moi) vs re-check (Fraîcheur) — pas de conflit fichier |

Migrations **037 puis 038** : coordonner l'ordre pour éviter deux « 037 ». Ce doc est la source
de vérité du contrat ; la session Fraîcheur doit le référencer.

## 8. Tests (Jest)

- `catalog.ts` : `searchCatalogUrls` (tokenisation du nom, classement par distance/D+, top K) ;
  `upsertCatalogEntries` (mapping races → lignes, dédup via clé unique, lecture optionnelle de
  `editionYear`/`editionDate`). Mock du `createServiceClient` (query builder).
- Cron `livetrail-catalog` : extraction des slugs depuis le HTML `/fr/events` (LiveTrail vs
  exclusion `utmb.world`), respect du cap, skip des slugs frais. Mock `fetch` (events +
  `parcours.php`).
- `findRaceCandidates` : un hit catalogue **confident** court-circuite OpenAI
  (`searchRaceUrls` non appelé) ; un miss/non-confident retombe sur OpenAI. Mock
  `searchCatalogUrls` + `searchRaceUrls`.

Réutilise les fixtures de
[livetrail.test.ts](../../../web/__tests__/lib/race-import/livetrail.test.ts).

## 9. Garde-fous

- Respect `robots.txt` (absent ici) ; throttle (séquentiel + délai) ; cap événements/run ;
  `User-Agent` identifiable avec contact ; skip des slugs récemment vus (anti re-crawl).
- Accumulation passive **tolérante aux échecs** : ne jamais casser la résolution si l'upsert
  rate.
- Écritures réservées au service role (RLS lecture seule pour les utilisateurs).

## 10. Hors-périmètre / suites

- Champs fraîcheur sur la course persistée → sous-projet Fraîcheur (037).
- `OpenSplitTimeParser` (B), prompts LLM par famille (C), email partenariat Trace de Trail (E).
- Badge fraîcheur au niveau candidat (coordination Fraîcheur).
- Pré-remplissage à la création de course.
