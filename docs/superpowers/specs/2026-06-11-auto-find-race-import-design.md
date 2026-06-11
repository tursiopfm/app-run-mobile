# Auto-trouver l'URL de course + import — Design

**Date :** 2026-06-11
**Statut :** À implémenter

## Objectif

Depuis les infos déjà saisies dans la fiche de course (**nom, date, distance, D+**),
trouver automatiquement l'URL de la page de la course (UTMB / LiveTrail), la valider,
faire **confirmer** la bonne course à l'athlète, puis importer le tableau — **sans
qu'il ait à chercher/coller l'URL**.

## Contexte (état actuel)

- Type `Race` (`web/types/plan.ts:71`) : `name`, `date` (ISO `YYYY-MM-DD`),
  `distance` (km), `elevation` (m D+), `location?`, … → toutes les infos sont là.
- Import (`web/components/plan/RaceImportSheet.tsx`) : onglets **URL / PDF / Image /
  Texte** → `POST /api/race-import` → preview (`WaypointsTable`) → `PUT
  /api/races/{id}/waypoints`. La feuille reçoit `raceId` ; elle est rendue dans
  `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx:217` qui possède déjà
  l'objet `race`.
- Parsers déterministes enregistrés via registre (`lib/race-import/sources/index.ts`)
  : `utmb.ts` et `livetrail.ts` (`findParserForUrl` → `parser.parse(url)` →
  `ExtractedRaceData`). `route.ts` les importe en side-effect.
- LLM : client `openai` (gpt-4o) côté serveur (`lib/race-import/extract.ts`),
  `OPENAI_API_KEY` déjà configurée. **Aucune recherche web aujourd'hui.**

## Architecture — Recherche → validation par parsing → confirmation

La fiabilité ne vient PAS de l'URL « devinée » par le LLM, mais de la **validation
par parsing** : on parse chaque candidat et on **compare distance/D+** aux valeurs
saisies. C'est ce qui choisit la bonne **variante** d'un même événement (ex. 100M vs
100K) et écarte les faux positifs. Réutilise les parsers + la preview + le save
existants. **Aucune migration DB.**

## Composants

### 1. Endpoint `POST /api/race-import/find`

**Entrée** (JSON) : `{ name: string, date: string, distance: number, elevation: number }`.

**Étapes :**

a) **Recherche web OpenAI.** Modèle `gpt-4o-search-preview` via le client `openai`
   (`chat.completions.create`, `web_search_options: {}`, pas de `temperature` —
   rejeté par les modèles search). Prompt (FR) : demander la/les **page(s)
   officielle(s) LiveTrail ou UTMB (`utmb.world`)** de la course de trail `{name}`,
   édition `{année tirée de date}`, ~`{distance}` km, ~`{elevation}` m D+ ; demander
   d'**inclure les URLs**.
   - **Récolte des URLs** : depuis `choices[0].message.annotations`
     (`type:'url_citation'` → `url_citation.url`) **et** un regex `https?://…` sur
     `content` (filet de sécurité). Normaliser, dédupliquer.
   - **Filtrer** aux hôtes importables : `*.utmb.world` ou `*.livetrail.{net,run}`.
     Plafonner à `MAX_CANDIDATES = 5`.

b) **Validation par parsing.** Pour chaque URL où `findParserForUrl(url)` renvoie un
   parser : `parser.parse(url)` en parallèle (`Promise.allSettled`, chaque parse a
   déjà son timeout/cap). Pour chaque succès, calculer :
   - `totalKm` = km du dernier waypoint ; `totalDplus` = `dPlus` du dernier waypoint
     (cumulés) ; `nbPoints` = waypoints.length ; `raceName` = `data.raceName` (souvent
     `null` → fallback nom saisi pour l'affichage).
   - Conserver `waypoints` (déjà parsés → pas de re-parse au moment de l'import).

c) **Classement** — fonction **pure** `rankRaceCandidates(target, parsed[])`
   (testable isolément). Pour chaque candidat :
   - `errKm = |totalKm − target.distance| / max(target.distance, 1)`
   - `errD = target.elevation > 0 && totalDplus != null ? |totalDplus −
     target.elevation| / target.elevation : 0.5` (pénalité si D+ manquant)
   - `nameSim ∈ [0,1]` = recouvrement de tokens entre `normalize(target.name)` et
     `normalize(raceName ?? '')` (lowercase, sans accents/ponctuation).
   - `score = errKm + errD − 0.3 × nameSim` (plus bas = meilleur).
   - `confident = errKm ≤ 0.12 && errD ≤ 0.20`.
   Trier par `score` croissant. Le **meilleur match** = premier.

**Sortie** : `{ candidates: RaceCandidate[] }` triés, où
```ts
interface RaceCandidate {
  url: string
  parserId: string                 // 'utmb' | 'livetrail'
  raceName: string | null
  totalKm: number
  totalDplus: number | null
  nbPoints: number
  confident: boolean
  waypoints: ExtractedRaceData['waypoints']
}
```
(`candidates: []` si rien trouvé / rien de parsable.)

**Câblage** : la route importe `sources/utmb` + `sources/livetrail` en side-effect
(comme `race-import/route.ts`).

### 2. UI — onglet « Auto » dans `RaceImportSheet`

- **Nouvelle prop** `race: Pick<Race,'name'|'date'|'distance'|'elevation'>` (le caller
  `CoursePageClient.tsx` passe `race={race}` — données déjà dispo).
- **Nouvel onglet `'auto'`** (premier, par défaut), à côté de URL/PDF/Image/Texte.
- Contenu de l'onglet Auto :
  - Récap **lecture seule** des infos de la fiche utilisées (nom · distance · D+ ·
    année) + bouton **« Trouver ma course »**.
  - Au clic → `POST /api/race-import/find` avec les 4 champs.
  - **Résultat** : carte du **meilleur match** :
    « *{raceName ?? nom saisi} — {totalKm} km · {totalDplus} D+ · {nbPoints} pts* »
    + badge « ✓ correspond à tes chiffres » si `confident`, sinon « à vérifier ».
    Boutons : **[Importer]** · lien *« Voir les autres résultats »* (déplie la liste
    des candidats suivants, chacun avec ses chiffres + un bouton Importer).
  - **[Importer]** sur un candidat → `setDraft(candidate.waypoints)` +
    `setStatus('preview')` → on réutilise **exactement** la preview existante
    (`WaypointsTable`) → ajustements éventuels → **Sauvegarder** (chemin inchangé).
- **Replis** :
  - `candidates: []` (rien trouvé / rien de parsable) → message « Course introuvable
    automatiquement — utilise URL / PDF / Image » (bascule vers les onglets manuels).
  - Erreur réseau / `OPENAI_API_KEY` absente → message d'erreur + bouton Réessayer
    (pattern d'erreur existant de la feuille).
- **Déclenché au clic** (jamais automatiquement) → coût maîtrisé.

## Flux de données

```
Fiche (name,date,distance,elevation)
  → onglet Auto → POST /api/race-import/find
      → recherche OpenAI → URLs candidates (filtrées utmb/livetrail)
      → parse parallèle (parsers existants) → totals
      → rankRaceCandidates(target, parsed) → candidats triés
  → carte « meilleur match » (+ liste) → [Importer]
  → setDraft(waypoints) → preview WaypointsTable → PUT /api/races/{id}/waypoints
```

## Gestion d'erreurs

- `OPENAI_API_KEY` absente → 500 « clé absente » (comme `extract.ts`).
- Recherche échoue / aucune URL → `{ candidates: [] }`.
- Toutes les `parse()` échouent (UTMB/LiveTrail HS, structure changée) →
  `{ candidates: [] }` → repli manuel.
- Mauvaise course trouvée mais chiffres faux → `confident:false`, l'athlète voit que
  ça ne colle pas et peut « voir les autres résultats » ou basculer en manuel.

## Tests

- `rankRaceCandidates` (pur) : variante 100M (139 km) vs 100K (86 km) avec
  `target.distance=139` → le 100M ressort 1er et `confident:true` ; le 100K
  `confident:false`. D+ manquant → pénalité appliquée. Égalité de distance →
  `nameSim` départage.
- Récolte/filtre d'URLs : extrait les URLs `utmb.world`/`livetrail.*` depuis des
  annotations + du texte, déduplique, ignore les autres domaines, plafonne à 5.
- Endpoint `find` : **mock** du client `openai` (annotations d'URLs) + **mock**
  `fetch` (HTML UTMB / XML LiveTrail) → vérifie le classement et la forme de sortie.
  Réutilise les fixtures existantes (`utmb.test.ts` / `livetrail.test.ts`).
- UI : test léger du câblage find → preview (le candidat sélectionné peuple `draft`).

## Risques

- **Disponibilité du modèle de recherche** : `gpt-4o-search-preview` doit être
  accessible via la clé/SDK. À vérifier à l'implémentation ; alternative = Responses
  API outil `web_search`. La récolte d'URLs par annotations + regex est robuste au
  format.
- **Recherche imprécise** sur petites courses → moins de candidats : géré par le
  repli manuel ; la validation par parsing évite d'importer un mauvais résultat.
- **Coût** : 1 appel recherche + ≤5 fetch de parse par clic (bouton, pas auto).

## Hors périmètre (futur)

- Courses **non** UTMB/LiveTrail (pas de parser → pas d'import auto ; repli manuel).
- Déclenchement **automatique** à l'ouverture de la fiche (ici : bouton explicite).
- Pré-remplissage des champs de la fiche depuis la recherche (ici on consomme la
  fiche, on ne la modifie pas).
