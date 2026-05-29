# Spec — Import + édition du tableau de course (onglet Plan)

> **Status: Spec** · 2026-05-29 · Phase 1 (sans projection ETA)

## Contexte

Pour chaque course d'objectif planifiée dans l'onglet Plan, l'utilisateur veut
pouvoir importer automatiquement le **tableau des points de passage** (ravitos,
distances, dénivelés cumulés, barrières horaires) depuis le site officiel de la
course, un PDF, une image (screenshot) ou un texte collé. L'extraction est
faite par un LLM multimodal côté serveur, puis le tableau est éditable ligne
par ligne par l'utilisateur, qui a toujours le dernier mot.

Cible : **web Next.js (`web/`)** uniquement. Pas d'Android.

## Scope (phase 1)

### Inclus

- Table Supabase `race_waypoints` liée à la fiche de course existante (`races`).
- Endpoint d'import qui accepte 4 types de source :
  1. **URL** du site officiel (fetch HTML serveur)
  2. **PDF** uploadé (extraction texte via `pdf-parse`)
  3. **Image** / screenshot (passée en base64 au LLM multimodal)
  4. **Texte** collé directement
- Extraction par **OpenAI `gpt-4o`** avec Structured Outputs (`response_format:
  json_schema`) garantissant un JSON conforme.
- Validation métier manuelle côté serveur (km croissants, énumérations).
- UI dans la page `/plan/courses/[id]` : un seul bloc **« Tableau de course »**
  qui *remplace* les deux placeholders existants `Barrières horaires` et
  `Plan de course` (`CoursePageClient.tsx:118-124`).
- Édition inline du tableau : modifier, ajouter, supprimer une ligne. L'ordre
  suit toujours les km cumulés.
- Interface `RaceParser` vide (point d'extension futur pour parsers
  site-spécifiques).

### Exclu (futur)

- Toute **projection ETA / scénarios horaires** (colonnes "22h / 24h / ETA" du
  screenshot fourni — ignorées à l'extraction).
- Conversion `clock_time ↔ elapsed` des barrières horaires.
- Parsers dédiés (ultra-marin, UTMB, ITRA…) — interface seulement, aucun
  parser concret en phase 1.
- Profil dénivelé visualisé (bloc `Profil de la course` reste tel quel).

## Règle CRITIQUE — nature de la barrière horaire (BH)

Deux natures possibles selon la course :

- **`clock_time`** → heure réelle, ex. `09:00`, `16:30`, `Sam 18h30`
- **`elapsed`** → temps écoulé depuis le départ, ex. `16h30` = 16h30 de course

Le LLM détecte la nature et stocke la valeur **brute** (`cutoff_raw`) sans
conversion. En cas de doute → `cutoff_kind = 'unknown'`. **Jamais d'invention,
jamais de conversion.**

## Architecture

### Flux nominal

```
[UI] RaceImportSheet (URL / PDF / Image / Texte)
   ↓ POST /api/race-import { raceId, source, payload }
[API] route handler
   ├─ Préparation contenu (fetch URL / pdf-parse / base64 / texte)
   ↓
[LIB] extractWaypoints(input) → OpenAI GPT-4o (Structured Outputs)
   ↓ JSON garanti conforme au schéma
[LIB] validateRaceData() — km croissants, enums
   ↓
[UI] Preview dans la sheet (tableau éditable)
   ↓ Confirmer
[API] PUT /api/races/[id]/waypoints — remplace tout
   ↓
[UI] WaypointsTable rendu sur la page course
```

### Composants

| Unité | Rôle | Dépendances |
|---|---|---|
| `lib/race-import/prompt.ts` | Prompt système isolé | — |
| `lib/race-import/schema.ts` | JSON Schema OpenAI + validateur métier | — |
| `lib/race-import/extract.ts` | Appel LLM, server-only | `openai`, prompt, schema |
| `lib/race-import/sources/index.ts` | Interface `RaceParser`, registre vide | — |
| `app/api/race-import/route.ts` | Router input → extract (pas d'insert) | extract, `pdf-parse` |
| `app/api/races/[id]/waypoints/route.ts` | CRUD waypoints | Supabase |
| `components/plan/WaypointsTable.tsx` | Tableau éditable inline | — |
| `components/plan/RaceImportSheet.tsx` | Bottom sheet d'import 4 onglets | WaypointsTable, API |
| `app/(main)/plan/courses/[id]/CoursePageClient.tsx` | Intégration UI | sheet, table, API |

Chaque unité a une responsabilité unique. `extract` ne connaît pas Supabase.
`WaypointsTable` ne connaît pas le LLM. `route.ts` orchestre.

## Schéma JSON normalisé (Structured Outputs)

```json
{
  "race_name": "string | null",
  "edition_year": "number | null",
  "waypoints": [
    {
      "order_index": "number",
      "name": "string",
      "km": "number",
      "km_inter": "number | null",
      "d_plus": "number | null",
      "d_moins": "number | null",
      "cutoff_raw": "string | null",
      "cutoff_kind": "'clock_time' | 'elapsed' | 'unknown'  // toujours présent côté LLM ; null en DB si cutoff_raw est null",
      "type": "'depart' | 'ravito' | 'pointage' | 'arrivee' | 'autre'"
    }
  ]
}
```

## Prompt système (LLM)

```
Tu es un extracteur de roadbook de course de trail. À partir du contenu fourni
(HTML, texte, ou image d'un tableau), extrais UNIQUEMENT le tableau des points
de passage.

Règles :
- Respecte exactement le schéma fourni (Structured Outputs).
- Donnée absente → null. N'invente JAMAIS de valeur.
- Nombres sans unité : "1 433 m" → 1433 ; "13,7 km" → 13.7.
- cutoff_raw = la barrière EXACTEMENT comme affichée, sans conversion.
- cutoff_kind :
  - "clock_time" si heure réelle du jour (09:00, Sam 18h30),
  - "elapsed" si temps de course écoulé depuis le départ,
  - "unknown" si ambigu. En cas de doute → "unknown".
- N'extrais PAS les colonnes de projection / ETA / scénarios horaires.
- order_index croissant selon km. Premier point (km 0) → "depart",
  dernier → "arrivee".
- Aucun tableau exploitable → { "race_name": null, "edition_year": null,
  "waypoints": [] }.
```

## Schéma Supabase — migration `025_race_waypoints.sql`

```sql
create table if not exists race_waypoints (
  id           uuid primary key default gen_random_uuid(),
  race_id      uuid references races(id) on delete cascade not null,
  order_index  integer not null,
  name         text not null,
  km           numeric(8,3) not null,
  km_inter     numeric(8,3),
  d_plus       integer,
  d_moins      integer,
  cutoff_raw   text,
  cutoff_kind  text check (cutoff_kind in ('clock_time','elapsed','unknown')),
  type         text not null check (type in ('depart','ravito','pointage','arrivee','autre')),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists idx_race_waypoints_race
  on race_waypoints(race_id, order_index);

alter table race_waypoints enable row level security;

-- RLS via jointure sur races.athlete_id
create policy "waypoints_select_own" on race_waypoints for select
  using (exists (select 1 from races r where r.id = race_id and r.athlete_id = auth.uid()));
create policy "waypoints_insert_own" on race_waypoints for insert
  with check (exists (select 1 from races r where r.id = race_id and r.athlete_id = auth.uid()));
create policy "waypoints_update_own" on race_waypoints for update
  using (exists (select 1 from races r where r.id = race_id and r.athlete_id = auth.uid()));
create policy "waypoints_delete_own" on race_waypoints for delete
  using (exists (select 1 from races r where r.id = race_id and r.athlete_id = auth.uid()));
```

**Rappel** : à coller dans Supabase SQL Editor (migrations non auto-appliquées).

## Validation métier (server-side, manuelle)

Après le retour Structured Outputs (forme & types déjà garantis) :

- `waypoints.length >= 1` ou bien `waypoints == []` (cas "rien d'exploitable").
- `order_index` séquentiels à partir de 0 (réindexation automatique si trous).
- `km` **strictement croissants** (pas de doublons). Si le LLM en produit, on
  rejette → 422 avec message clair.
- `km_inter`, `d_plus`, `d_moins` non négatifs si présents.
- `type` : exactement un `depart` au premier ordre, exactement un `arrivee` au
  dernier ordre. Si manquants → forcer à `depart`/`arrivee`.
- Convention de casse : la sortie LLM est en **snake_case** (matche le JSON
  Schema), conversion en **camelCase** au passage `ExtractedRaceData` côté TS.

Toute violation → erreur 422 avec message clair pour l'UI. Pas de correction
silencieuse non documentée.

## UI — `WaypointsTable` (édition inline)

Colonnes affichées (compact, scrollable horizontal sur mobile) :

| Point | Dist | Inter. | D+ | D− | BH | Type |
|---|---|---|---|---|---|---|

Interactions :
- Cliquer sur une cellule → édition inline.
- Bouton **+ Ajouter une ligne** en bas → ouvre une nouvelle ligne vide.
- Icône poubelle par ligne → confirmation puis suppression.
- L'ordre est calculé à la volée par `km` croissant ; pas de drag & drop manuel.
- Champ BH : input texte libre (valeur brute) + select `clock_time / elapsed / unknown`.
- Champ Type : select avec les 5 énums.

Pas d'undo phase 1 — l'utilisateur peut ré-importer pour repartir.

## UI — `RaceImportSheet` (bottom sheet)

4 onglets : **URL** / **PDF** / **Image** / **Texte**.

- **URL** : input + bouton "Extraire". Fetch côté serveur, timeout 10 s, taille
  HTML limitée à 1 Mo.
- **PDF** : upload (max 5 Mo). `pdf-parse` côté serveur.
- **Image** : upload (max 4 Mo, jpg/png/webp). Base64 → GPT-4o multimodal.
- **Texte** : `<textarea>`.

État unique partagé pour l'aperçu :
1. État `idle`
2. État `extracting` (spinner, timeout 30 s)
3. État `preview` : `WaypointsTable` éditable + boutons "Annuler" / "Sauvegarder"
4. État `error` : message + bouton "Réessayer"

À la sauvegarde : `PUT /api/races/[id]/waypoints` remplace tous les waypoints
existants pour cette course.

## Intégration `CoursePageClient.tsx`

**Suppression** des deux blocs existants :

```tsx
// REMPLACÉ :
<Section title="Barrières horaires">…Bientôt…</Section>
<Section title="Plan de course">…Bientôt…</Section>
```

**Par** :

```tsx
<Section title="Tableau de course">
  {waypoints.length === 0 ? (
    <button onClick={() => setImportOpen(true)}>Importer le tableau</button>
  ) : (
    <>
      <WaypointsTable waypoints={waypoints} onChange={…} />
      <button onClick={() => setImportOpen(true)}>Ré-importer</button>
    </>
  )}
</Section>
<RaceImportSheet
  raceId={race.id}
  open={importOpen}
  onClose={() => setImportOpen(false)}
  onSaved={(wps) => { setWaypoints(wps); setImportOpen(false) }}
/>
```

Chargement des waypoints : appel `GET /api/races/[id]/waypoints` côté client
au mount.

## Types TypeScript (`web/types/plan.ts`)

Ajout :

```ts
export type CutoffKind = 'clock_time' | 'elapsed' | 'unknown'
export type WaypointType = 'depart' | 'ravito' | 'pointage' | 'arrivee' | 'autre'

export interface RaceWaypoint {
  id: string
  raceId: string
  orderIndex: number
  name: string
  km: number
  kmInter: number | null
  dPlus: number | null
  dMoins: number | null
  cutoffRaw: string | null
  cutoffKind: CutoffKind | null
  type: WaypointType
}

export interface ExtractedRaceData {
  raceName: string | null
  editionYear: number | null
  waypoints: Omit<RaceWaypoint, 'id' | 'raceId'>[]
}
```

## Sécurité & robustesse

- `extract.ts` est `import 'server-only'` — aucun risque de fuite de la clé
  OpenAI côté client.
- `OPENAI_API_KEY` ajoutée dans Vercel (env Production + Preview).
- Fetch URL : whitelist du protocole (`http`/`https` uniquement), pas de
  redirection vers `file://`, taille max 1 Mo, timeout 10 s.
- Upload PDF/image : limite taille via `request.formData()` côté route handler,
  rejet si dépassement.
- RLS Supabase fait le gating final : un user ne peut écrire que sur ses
  propres waypoints (via jointure sur `races.athlete_id`).
- Pas de comptage / rate-limiting d'appels OpenAI en phase 1 (usage limité à
  franck). À ajouter quand l'app sera ouverte à d'autres utilisateurs.

## Tests (`web/__tests__/`)

- `lib/race-import/schema.test.ts` — invariants : km croissants, énumérations,
  `order_index` séquentiel, depart/arrivee aux extrémités.
- `lib/race-import/extract.test.ts` — mock `openai`, vérifie le mapping
  JSON → `ExtractedRaceData` (camelCase).
- `lib/race-import/sources/index.test.ts` — registre vide retourne null.
- Pas de test E2E sur la sheet en phase 1.

## Dépendances npm à ajouter

```json
"openai": "^4.x",
"pdf-parse": "^1.x"
```

Pas de Zod. Validation manuelle (~10 lignes) — Structured Outputs garantit
déjà la forme.

## Livrables (ordre d'implémentation)

1. Migration SQL `025_race_waypoints.sql`.
2. Types TS + validateur métier (`schema.ts`).
3. Prompt isolé (`prompt.ts`).
4. Fonction d'extraction LLM (`extract.ts`).
5. Route d'import (`/api/race-import`).
6. Route CRUD waypoints (`/api/races/[id]/waypoints`).
7. Composant `WaypointsTable`.
8. Composant `RaceImportSheet`.
9. Intégration `CoursePageClient` (remplacement des 2 blocs).
10. Interface `RaceParser` vide (`sources/index.ts`).
11. Tests Jest.

## Risques connus

- **Sites avec tableau image-only** → l'image rendue dynamiquement n'est pas
  accessible en fetch HTML. Le user peut utiliser l'onglet "Image" en
  alternative (screenshot manuel).
- **Sites en JS-only (SPA)** → `fetch` ne récupèrera pas le contenu rendu.
  Pareil : fallback Image / Texte.
- **PDF scanné** → `pdf-parse` retourne du texte vide. Fallback Image.
- **GPT-4o hallucinations sur tableaux denses** → l'édition manuelle est le
  filet de sécurité. Documenté dans l'UI ("Vérifie les chiffres avant de
  sauvegarder").

## Sources connues — comportement attendu

| Source | Pattern URL | Onglet recommandé | Notes |
|---|---|---|---|
| **livetrail.net** | `<slug>.v3.livetrail.net` (~214 courses/an) | **Image** ou **Texte** | SPA JS — fetch HTML ne renvoie rien d'exploitable. Screenshot du tableau "Durchgangstabelle / tableau de passage" → GPT-4o multimodal. V2 possible : parser dédié sur l'API JSON privée. |
| **ultra-marin.fr** | page statique | **URL** | HTML statique avec tableau lisible — fetch direct OK. |
| **utmbmontblanc.com / utmb.world** | pages statiques | **URL** ou **Image** | Tableaux souvent en HTML mais layout complexe — Image plus fiable. |
| **PDF règlement officiel** | — | **PDF** | `pdf-parse` extrait le texte ; le LLM retrouve le tableau dedans. |
| **Site officiel exotique** | — | **Image** ou **Texte** | Fallback universel. |

## Décisions actées

| Question | Choix |
|---|---|
| Nom de colonne ordre | `order_index` (mot non réservé) |
| Sources phase 1 | URL + Image + Texte + **PDF** |
| Validation | Manuelle (pas de Zod) |
| Position UI | Remplace `Barrières horaires` + `Plan de course` |
| Modèle LLM | OpenAI `gpt-4o` (multimodal, Structured Outputs) |
| Provider | OpenAI |
| Parsers site-spécifiques | Interface seulement, 0 parser concret |
