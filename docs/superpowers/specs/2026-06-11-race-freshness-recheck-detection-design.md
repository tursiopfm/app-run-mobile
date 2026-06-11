# Re-checks automatiques & diff — Lot 2a : Détection (backend)

> **Status: Spec** · 2026-06-11
>
> Lot 2 du brief « versioning des éditions & fraîcheur ». **Lot 2a = détection** (ce
> document) : cron qui re-fetch, détecte un changement / une nouvelle édition, et
> enregistre un `pending_diff`. **Lot 2b = UX** (spec séparé) : bandeau + modal de
> validation calqué sur la résolution de conflit Garmin.
>
> Pré-requis : Lot 1 livré (`race_tableau_meta`, `computeFreshness`, `hashWaypoints`,
> parsers avec détection d'édition). Cf. `2026-06-11-race-edition-freshness-capture-design.md`.

## Contexte

Les organisateurs publient/modifient les tableaux tard (parcours de repli, barrières
décalées jusqu'à J-3 ; édition N publiée parfois quelques semaines avant). Le Lot 1
date le tableau au moment de l'import mais ne re-vérifie jamais la source. Le Lot 2a
ajoute une boucle de fond qui re-fetch les tableaux des **courses planifiées**,
détecte les changements (hash) et les nouvelles éditions, et **enregistre** un diff
en attente — **sans jamais écraser** les `race_waypoints` (la validation utilisateur
est le Lot 2b).

## Objectifs (Lot 2a)

1. Cron (déclenché en externe, Bearer `CRON_SECRET`) qui sélectionne les courses à
   re-checker selon une cadence resserrée à l'approche de la course.
2. Re-fetch déterministe (parsers livetrail/utmb) + comparaison au `source_hash`.
3. Détection d'un changement de contenu (diff waypoints) et d'un changement d'édition
   (N-1 → N).
4. Enregistrement d'un `pending_diff` sur `race_tableau_meta` + mise à jour de
   `source_checked_at` à **chaque** passage (même inchangé).

## Non-objectifs (→ Lot 2b / backlog)

- **Tout l'UX** : bandeau « le tableau a changé », modal de validation, application du
  diff (remplacement des waypoints), affichage « dernière vérif le … ». = Lot 2b.
- Re-check des imports **génériques/LLM** (site officiel sans parser) : trop coûteux
  (LLM par course/jour). Hors 2a — seules les URLs **parsables** (livetrail/utmb) sont
  re-checkées.
- Email / push. Centre de notifications. (Décision : livraison in-app au Lot 2b.)

## Déclencheur

Nouvelle route `web/app/api/cron/race-freshness/route.ts`, pattern identique aux crons
existants (`livetrail-catalog`, `strava-import`) :

```ts
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runFreshnessRecheck()   // lib, service role
  return NextResponse.json(result)             // { checked, changed, newEdition }
}
```

Déclenché **en externe** (GitHub Actions, comme les autres crons — pas de `crons` dans
`vercel.json`, plan Hobby). Le workflow GA (quotidien) sera fourni au plan. Service
role (`createServiceClient`) pour traiter toutes les courses, tous utilisateurs.

## Sélection des courses

Requête (service role) : `race_tableau_meta` jointe à `races`, filtrée :
- `source_url is not null` **et** parsable (`findParserForUrl(source_url) != null` —
  filtré en JS après fetch),
- `races.date >= today` (courses à venir),
- `pending_diff is null` (ne pas ré-écraser un diff déjà en attente de validation).

Puis, en JS, on garde celles **dues** selon `isDueForRecheck` et on cap à
`MAX_RACES_PER_TICK = 5`. Throttle `300 ms` entre fetches, UA
`TrailCockpitBot/1.0 (+https://trailcockpit.run)`.

### Cadence resserrée (fonction pure)

`isDueForRecheck(daysUntilRace, lastCheckedAtISO, nowISO): boolean` — approxime
J-30/J-14/J-3 sans tracker de jalons (état = seul `source_checked_at`) :

| Jours avant la course | Re-check si dernier contrôle remonte à |
|---|---|
| ≤ 3 | > 1 jour |
| ≤ 14 | > 7 jours |
| ≤ 30 | > 14 jours |
| > 30 | jamais |

(`daysUntilRace < 0` → course passée → jamais, filet ; la requête exclut déjà `date < today`.)

## Détection de changement

Pour chaque course due :

1. `parser = findParserForUrl(source_url)` ; si `null` → skip (générique, hors 2a).
2. `data = await parser.parse(source_url)` → nouveaux waypoints + `editionYear/editionDate/...`.
3. `newHash = hashWaypoints(data.waypoints)`.
4. `newFresh = computeFreshness({editionYear, editionDate, dateExplicit, startDayOfMonth}, race.date)`.
5. Décision :
   - **`new_edition`** si l'édition a avancé vers la cible : `freshness_status` stocké
     était `provisional_previous_edition` **et** `newFresh.freshnessStatus === 'confirmed'`
     (ou `newFresh.editionYear > meta.edition_year`). (Possible seulement si la source
     porte l'année — URL v3 / UTMB.)
   - sinon **`changed`** si `newHash !== source_hash`.
   - sinon **rien** (juste `source_checked_at = now`).
6. Si `new_edition` ou `changed` → on lit les `race_waypoints` actuels (l'« ancien »),
   on calcule `diffWaypoints(old, data.waypoints)`, et on **upsert le `pending_diff`**.
   On **n'écrit jamais** dans `race_waypoints`.
7. Dans tous les cas : `source_checked_at = now()`.

> Best-effort par course : une exception (source injoignable, parse échoué) est
> attrapée, loggée, et n'arrête pas la boucle ; `source_checked_at` n'est PAS bougé en
> cas d'échec de fetch (on retentera au prochain tick).

> **Limite connue (`new_edition`)** : LiveTrail `parcours.php` renvoie le tableau
> **courant** de la course (non daté par l'URL), donc le diff `changed` capte bien une
> mise à jour de parcours/barrières. Mais l'`editionYear` LiveTrail dérive de l'**URL
> stockée** (figée) → la détection `new_edition` (N-1 → N) est fiable surtout pour
> **UTMB** (la page expose `startDateIso` de l'édition courante). Pour LiveTrail, une
> nouvelle édition se manifeste de toute façon via `changed` (le tableau bouge). On
> assume cette limite en 2a ; un raffinement (re-résoudre l'URL de l'édition courante)
> pourra venir plus tard.

## Diff waypoints (fonction pure)

`web/lib/race-import/waypoint-diff.ts` :

```ts
type WP = Omit<RaceWaypoint, 'id' | 'raceId'>

export interface WaypointFieldChange { field: 'km' | 'dPlus' | 'dMoins' | 'cutoffRaw' | 'supplies'; from: unknown; to: unknown }
export interface WaypointModified { name: string; changes: WaypointFieldChange[] }
export interface WaypointDiff {
  added: WP[]
  removed: WP[]
  modified: WaypointModified[]
}

export function diffWaypoints(oldWps: WP[], newWps: WP[]): WaypointDiff
```

- **Appariement par nom normalisé** (minuscule sans accent, cf. `normalizeSearchText`),
  fallback : plus proche `km` non encore apparié (tolérance ± 1 km).
- `removed` = anciens non appariés ; `added` = nouveaux non appariés ; `modified` =
  appariés dont au moins un champ comparé diffère (km, dPlus, dMoins, cutoffRaw,
  supplies — supplies comparées triées).
- Pur, déterministe, testable sans DB.

## Stockage du `pending_diff`

Migration **040** (039 = Lot 1, 038 = catalog) : ajoute deux colonnes à
`race_tableau_meta` :

```sql
alter table race_tableau_meta add column if not exists pending_diff jsonb;
alter table race_tableau_meta add column if not exists pending_diff_at timestamptz;
```

Forme du `pending_diff` (jsonb) :

```ts
interface PendingDiff {
  kind: 'changed' | 'new_edition'
  detectedAt: string                 // ISO
  newWaypoints: WP[]                 // à appliquer si l'utilisateur accepte (Lot 2b)
  newMeta: {                         // édition recalculée de la nouvelle source
    editionYear: number | null
    editionDate: string | null
    dateExplicit: boolean
    freshnessStatus: FreshnessStatus
    sourceHash: string
  }
  summary: { added: number; removed: number; modified: number; modifiedDetails: WaypointModified[] }
}
```

Le Lot 2b lira `pending_diff`/`pending_diff_at`, affichera le résumé, et videra ces
colonnes à la résolution (en appliquant ou en rejetant `newWaypoints`/`newMeta`).

## Garde-fous

- Seules les **courses planifiées** (`date >= today`) avec `source_url` parsable —
  jamais tout le catalogue.
- `source_checked_at` mis à jour **à chaque** passage réussi (socle de l'affichage
  « dernière vérif le … » au Lot 2b ; et alimente la cadence).
- Throttle 300 ms entre fetches ; UA identifiable ; cap `MAX_RACES_PER_TICK`.
- Un échec par course est isolé (try/catch), loggé, n'interrompt pas le tick.
- `pending_diff is null` dans la sélection → on ne re-détecte pas tant qu'un diff
  n'est pas résolu (pas d'écrasement d'un diff en attente).

## Tests

- **`diffWaypoints`** : ajout, suppression, modification (chaque champ), appariement
  par nom normalisé (accents/casse), fallback km, supplies triées (ordre indifférent),
  diff vide si identiques.
- **`isDueForRecheck`** : la matrice de cadence (≤3/≤14/≤30/>30 × dernier-contrôle
  récent/ancien), course passée → false.
- **`runFreshnessRecheck` (tick)** : service client mocké —
  - hash inchangé → pas de `pending_diff`, `source_checked_at` bougé ;
  - hash changé → `pending_diff` `changed` enregistré, `race_waypoints` NON touché ;
  - édition N-1→cible → `pending_diff` `new_edition` ;
  - course avec `pending_diff` déjà présent → ignorée ;
  - cap `MAX_RACES_PER_TICK` respecté.
- **Auth route** : 401 sans/avec mauvais Bearer.

## Fichiers (indicatif)

- `web/supabase/migrations/040_race_tableau_pending_diff.sql` *(create)*
- `web/lib/race-import/waypoint-diff.ts` *(create — diffWaypoints)*
- `web/lib/race-import/recheck.ts` *(create — isDueForRecheck + runFreshnessRecheck, server-only, service role)*
- `web/app/api/cron/race-freshness/route.ts` *(create — GET Bearer)*
- `web/types/plan.ts` *(PendingDiff, WaypointDiff types)*
- `web/__tests__/lib/race-import/{waypoint-diff,recheck}.test.ts` *(create)*
- Workflow GitHub Actions (déclencheur quotidien) — fourni au plan.
```
