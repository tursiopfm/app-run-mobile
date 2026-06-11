# Élargir la recherche auto de course (LiveTrail événement + fallback générique) — Design

**Date :** 2026-06-11
**Statut :** À implémenter

## Objectif

Faire marcher la recherche auto de tableau de course (onglet « Auto ») pour
**toutes les grandes courses**, pas seulement celles dont la recherche tombe sur
une URL de course UTMB précise. Deux causes traitées :
1. La recherche tombe souvent sur la **page d'événement LiveTrail** (qui liste toutes
   les courses), pas sur une URL de course précise → le parser LiveTrail actuel exige
   un id de course → échec (ex. Ultra Marin).
2. Certaines courses ne sont **ni sur UTMB ni sur LiveTrail** (seulement leur site
   officiel) → aucun parser.

## Contexte (existant)

- `web/lib/race-import/find-race.ts` : `searchRaceUrls` (OpenAI `gpt-4o-search-preview`,
  prompt restreint « LiveTrail ou UTMB »), `harvestRaceUrls`, `parseCandidate`
  (1 URL → 1 `ParsedCandidate` via `findParserForUrl`), `resolveCandidates`
  (filtre aux URLs parsables → parse → dédup → `rankRaceCandidates`).
- `web/lib/race-import/sources/livetrail.ts` : `extractSlugAndRaceId(url)` (exige un
  raceId), `fetchParcoursXml(slug, raceId)`, `mapXmlToExtracted(xml, raceId)`
  (sélectionne **un** bloc `<points course="raceId">`). Le XML `parcours.php`
  contient en réalité **toutes** les courses : `<courses><c id n>…</courses>` +
  un bloc `<points course="X">` par course.
- `web/lib/race-import/extract.ts` : `extractWaypoints(input)` (LLM gpt-4o ;
  `{ html }`/`{ text }`/`{ pdfText }`/`{ imageBase64 }`). `fetch-url.ts` :
  `fetchRaceHtml(url)`.
- `rankRaceCandidates(target, parsed[])` : classe par écart distance/D+
  (`confident = errKm≤0.12 && errD≤0.20`). `RaceCandidate = ParsedCandidate +
  confident`.

### Vérifié empiriquement (Ultra Marin)

- La recherche renvoie `https://ultramarin-breizhchrono.v3.livetrail.net/fr/2025`
  (page **événement**, sans id de course) → `extractSlugAndRaceId` lève → 0 candidat.
- `https://{slug}.livetrail.run/parcours.php` (avec n'importe quel `?course=` ou
  **sans param**) renvoie **les 8 courses** avec leurs noms (`<c id="GdRaid"
  n="Grand Raid">`, `Raid`, `Arvor`…) et tous les blocs `<points>`. Donc le **slug
  seul suffit** pour tout récupérer.

## Design

### 1. `searchRaceUrls` — prompt élargi

Le prompt demande désormais **la page de chronométrage (LiveTrail livetrail.net/run
ou UTMB utmb.world) ET le site officiel / page résultats** de la course. → on récolte
des URLs timing (parse déterministe) ET des URLs officielles (fallback générique).
Récolte d'URLs inchangée (annotations + regex, dédup).

### 2. `livetrail.ts` — lister toutes les courses d'un événement

- Refactor : extraire la logique « un bloc `<points>` → waypoints » de
  `mapXmlToExtracted` dans un helper réutilisable `mapPointsBlock(block, raceId)`.
- Nouvelle fonction exportée `listLivetrailRaces(url): Promise<Array<{ raceName:
  string | null; data: ExtractedRaceData }>>` :
  - `slug` = premier segment du hostname (marche aussi pour la page événement).
  - Fetch `parcours.php` par slug **sans exiger de raceId** (`.run` puis fallback
    `.net`, mêmes timeout/cap que l'existant). (Réutiliser `fetchParcoursXml` rendu
    tolérant à un raceId absent, ou un `fetchParcoursXmlBySlug(slug)`.)
  - Parse le XML : map `<courses>` → `{ id: name }` ; pour **chaque** bloc
    `<points course="X">`, `mapPointsBlock` → waypoints → `validateExtractedRaceData`
    → `{ raceName: coursesMap[X] ?? null, data }`.
  - Retourne toutes les courses (départ/arrivée forcés, D− dérivé comme aujourd'hui).
- `livetrailParser.parse(url)` (import manuel d'une URL de course précise) **reste
  inchangé** (un seul bloc par raceId).

### 3. `find-race.ts` — résolution restructurée + fallback générique

`resolveCandidates(target, rawUrls)` devient :
1. `urls = harvestRaceUrls(rawUrls)`.
2. Classer chaque URL : `utmb` (`findParserForUrl().id==='utmb'`), `livetrail`
   (`id==='livetrail'`), sinon `other`.
3. **Candidats parsables** :
   - UTMB : `parseCandidate(url)` (1 candidat). (inchangé)
   - LiveTrail : dédup par **slug** ; pour chaque slug unique → `listLivetrailRaces`
     → un `ParsedCandidate` par course (`parserId:'livetrail'`, `raceName` du `<c>`,
     `totalKm`/`totalDplus` = dernier waypoint, `waypoints`).
   - Dédup global par `${parserId}|${totalKm}|${totalDplus}`.
4. `ranked = rankRaceCandidates(target, parsablesDédupliqués)`.
5. **Fallback générique** — seulement si `ranked.length === 0 || !ranked[0].confident` :
   - Prendre les `MAX_GENERIC = 2` premières URLs `other`.
   - Pour chacune : `fetchRaceHtml(url)` → `extractWaypoints({ html })` (LLM) →
     `ParsedCandidate` (`parserId:'generic'`, `raceName = data.raceName`,
     totals = dernier waypoint), en `try/catch` (null si échec). `Promise.allSettled`.
   - `ranked = rankRaceCandidates(target, dédup(parsables + génériques))`.
6. Retourner `ranked`.

→ Coût LLM maîtrisé : le fallback générique (≤2 appels gpt-4o) ne se déclenche **que
si** UTMB/LiveTrail n'ont pas donné de candidat **confident**. Cas nominal (UTMB ou
LiveTrail trouvé) : 0 appel LLM en plus de la recherche.

### 4. Classement

`rankRaceCandidates` inchangé (distance + D+). Une candidate LiveTrail « Grand Raid »
(175 km) l'emporte sur « Raid » (100 km) quand la fiche dit 175 km.

## Flux (Ultra Marin)

```
fiche (Ultra Marin, 177 km, 1430 D+)
 → searchRaceUrls → [ ...v3.livetrail.net/fr/2025 (événement), ultra-marin.fr, ... ]
 → resolveCandidates :
     livetrail slug "ultramarin-breizhchrono" → listLivetrailRaces → 8 candidates
       (Grand Raid 177, Raid 100, Arvor 56, …)
     rank par distance/D+ → Grand Raid 1er, confident → on s'arrête (pas de fallback)
 → carte « Grand Raid — 177 km · 1430 D+ » → Importer
```

## Gestion d'erreurs

- `listLivetrailRaces` échoue (réseau, XML invalide) → on l'ignore (try/catch dans la
  résolution), on retombe sur les autres candidats / le fallback générique.
- Fallback générique : chaque extraction en `try/catch` ; échec → candidat ignoré.
- Aucun candidat du tout → `{ candidates: [] }` → message + onglets manuels (existant).

## Tests

- `listLivetrailRaces` (livetrail) : sur une fixture XML multi-courses (réutiliser
  `FIXTURE_XML` de `livetrail.test.ts`, 2 courses) → retourne 2 entrées avec les bons
  `raceName` (depuis `<c n>`) et les bons totaux.
- `resolveCandidates` : URL d'événement LiveTrail (fetch mocké) → plusieurs candidats,
  la course dont distance/D+ matche la cible ressort 1ʳᵉ et `confident`.
- Fallback générique : avec UNIQUEMENT une URL `other` et `extractWaypoints` mocké
  (injecté/mocké) renvoyant des waypoints → un candidat générique apparaît ; et il ne
  se déclenche PAS si une candidate parsable confidente existe.
- `rankRaceCandidates` : inchangé (déjà couvert).

## Risques / hors-périmètre

- `parcours.php` par slug sans param : vérifié sur Ultra Marin (renvoie tout). Si une
  instance LiveTrail exige un param, passer un placeholder (`?course=all`) — le serveur
  renvoie quand même tous les blocs (vérifié : `?course=zzz` = idem).
- Fallback générique = fiabilité LLM variable (le site officiel n'a pas toujours un
  tableau exploitable) ; validé par distance/D+ et borné à 2 pages.
- Pas de nouveau parser site-spécifique (au-delà d'UTMB/LiveTrail) ici.
- Aucune migration DB.
