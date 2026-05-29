# Race Waypoints Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'utilisateur d'importer (URL / PDF / Image / Texte) le tableau des points de passage d'une course objectif via OpenAI `gpt-4o`, et de l'éditer ligne par ligne dans la page `/plan/courses/[id]`.

**Architecture:** Une nouvelle table Supabase `race_waypoints` (FK `races.id`). Un module isolé `web/lib/race-import/` qui contient le prompt, le schéma JSON pour Structured Outputs et la fonction `extractWaypoints()` server-only. Deux routes API : `/api/race-import` (extraction sans sauvegarde) et `/api/races/[id]/waypoints` (CRUD). Deux composants React : `WaypointsTable` (édition inline) et `RaceImportSheet` (bottom-sheet 4 onglets). Intégration dans `CoursePageClient` en remplacement des deux blocs placeholder existants.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (`@supabase/ssr`), OpenAI SDK (`openai`), `pdf-parse`, Jest + ts-jest, Tailwind.

**Spec source:** `docs/superpowers/specs/2026-05-29-race-waypoints-import-design.md`

---

## File Map

| Path | Action | Responsabilité |
|---|---|---|
| `web/supabase/migrations/025_race_waypoints.sql` | create | Table + index + RLS |
| `web/types/plan.ts` | modify | Ajout types `RaceWaypoint`, `CutoffKind`, `WaypointType`, `ExtractedRaceData` |
| `web/lib/race-import/prompt.ts` | create | Prompt système isolé (constante exportée) |
| `web/lib/race-import/schema.ts` | create | JSON Schema OpenAI + validateur métier + conversion snake/camel |
| `web/lib/race-import/extract.ts` | create | Appel OpenAI server-only |
| `web/lib/race-import/sources/index.ts` | create | Interface `RaceParser` vide |
| `web/lib/race-import/fetch-url.ts` | create | Fetch HTML sécurisé (whitelist, timeout, limite taille) |
| `web/lib/race-import/parse-pdf.ts` | create | Wrapper `pdf-parse` server-only |
| `web/app/api/race-import/route.ts` | create | POST router 4 sources → extract → JSON preview |
| `web/app/api/races/[id]/waypoints/route.ts` | create | GET liste, PUT remplace tout |
| `web/components/plan/WaypointsTable.tsx` | create | Tableau éditable inline |
| `web/components/plan/RaceImportSheet.tsx` | create | Bottom-sheet portal 4 onglets |
| `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx` | modify | Remplace blocs placeholder + intègre sheet/table |
| `web/package.json` | modify | Ajout `openai` + `pdf-parse` + `@types/pdf-parse` |
| `web/__tests__/lib/race-import/schema.test.ts` | create | Tests validateur |
| `web/__tests__/lib/race-import/extract.test.ts` | create | Tests mapping JSON → ExtractedRaceData |
| `web/__tests__/lib/race-import/sources.test.ts` | create | Tests registre vide |

---

## Task 1 : Migration SQL `025_race_waypoints.sql`

**Files:**
- Create: `web/supabase/migrations/025_race_waypoints.sql`

- [ ] **Step 1: Écrire le fichier de migration**

```sql
-- Migration: 025 - race_waypoints
-- Tableau des points de passage d'une course objectif (ravitos, BH, dénivelés cumulés).
-- Lié à la table races. RLS via jointure sur races.athlete_id.

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

create policy "waypoints_select_own" on race_waypoints for select
  using (exists (select 1 from races r where r.id = race_id and r.athlete_id = auth.uid()));
create policy "waypoints_insert_own" on race_waypoints for insert
  with check (exists (select 1 from races r where r.id = race_id and r.athlete_id = auth.uid()));
create policy "waypoints_update_own" on race_waypoints for update
  using (exists (select 1 from races r where r.id = race_id and r.athlete_id = auth.uid()));
create policy "waypoints_delete_own" on race_waypoints for delete
  using (exists (select 1 from races r where r.id = race_id and r.athlete_id = auth.uid()));
```

- [ ] **Step 2: Commit**

```bash
git add web/supabase/migrations/025_race_waypoints.sql
git commit -m "feat(plan): migration 025 race_waypoints (RLS via races.athlete_id)"
```

- [ ] **Step 3: Rappeler à Franck d'appliquer la migration**

Afficher dans la réponse de fin de tâche :
> ⚠️ Migration `025_race_waypoints.sql` à coller manuellement dans Supabase SQL Editor avant d'utiliser le module en runtime.

---

## Task 2 : Types TypeScript

**Files:**
- Modify: `web/types/plan.ts` (fin de fichier)

- [ ] **Step 1: Ajouter les types à la fin de `web/types/plan.ts`**

```ts
// === Waypoints d'une course objectif (ravitos, points de passage, BH) ===
export type CutoffKind = 'clock_time' | 'elapsed' | 'unknown'

export type WaypointType =
  | 'depart'
  | 'ravito'
  | 'pointage'
  | 'arrivee'
  | 'autre'

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

// Sortie brute du LLM (sans id ni raceId).
export interface ExtractedRaceData {
  raceName: string | null
  editionYear: number | null
  waypoints: Array<Omit<RaceWaypoint, 'id' | 'raceId'>>
}
```

- [ ] **Step 2: Vérifier que `npm run lint` passe**

Run (depuis `web/`) : `npm run lint`
Expected : aucune nouvelle erreur sur `types/plan.ts`.

- [ ] **Step 3: Commit**

```bash
git add web/types/plan.ts
git commit -m "feat(plan): types RaceWaypoint / ExtractedRaceData"
```

---

## Task 3 : Prompt système isolé

**Files:**
- Create: `web/lib/race-import/prompt.ts`

- [ ] **Step 1: Créer le fichier**

```ts
// Prompt système isolé pour l'extracteur de roadbook.
// Volontairement sans logique : tient dans un fichier dédié pour pouvoir
// l'itérer sans toucher l'appel LLM.

export const RACE_EXTRACTION_SYSTEM_PROMPT = `Tu es un extracteur de roadbook de course de trail. À partir du contenu fourni (HTML, texte, ou image d'un tableau), extrais UNIQUEMENT le tableau des points de passage.

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
- order_index croissant selon km. Premier point (km 0) → "depart", dernier → "arrivee".
- Aucun tableau exploitable → { "race_name": null, "edition_year": null, "waypoints": [] }.`
```

- [ ] **Step 2: Commit**

```bash
git add web/lib/race-import/prompt.ts
git commit -m "feat(race-import): prompt système isolé"
```

---

## Task 4 : Schéma OpenAI + validateur métier + conversion

**Files:**
- Create: `web/lib/race-import/schema.ts`
- Test: `web/__tests__/lib/race-import/schema.test.ts`

- [ ] **Step 1: Écrire les tests (FAIL)**

Créer `web/__tests__/lib/race-import/schema.test.ts` :

```ts
import {
  validateExtractedRaceData,
  rawToExtractedRaceData,
  RACE_EXTRACTION_JSON_SCHEMA,
} from '@/lib/race-import/schema'

describe('rawToExtractedRaceData (snake → camel)', () => {
  it('convertit la sortie LLM snake_case en camelCase', () => {
    const raw = {
      race_name: 'CCC',
      edition_year: 2024,
      waypoints: [
        {
          order_index: 0,
          name: 'Courmayeur',
          km: 0,
          km_inter: 0,
          d_plus: 0,
          d_moins: 0,
          cutoff_raw: '09:00',
          cutoff_kind: 'clock_time',
          type: 'depart',
        },
      ],
    }
    const out = rawToExtractedRaceData(raw)
    expect(out.raceName).toBe('CCC')
    expect(out.editionYear).toBe(2024)
    expect(out.waypoints[0]).toEqual({
      orderIndex: 0,
      name: 'Courmayeur',
      km: 0,
      kmInter: 0,
      dPlus: 0,
      dMoins: 0,
      cutoffRaw: '09:00',
      cutoffKind: 'clock_time',
      type: 'depart',
    })
  })

  it('nullifie cutoffKind quand cutoffRaw est null', () => {
    const raw = {
      race_name: null,
      edition_year: null,
      waypoints: [
        {
          order_index: 0,
          name: 'Start',
          km: 0,
          km_inter: null,
          d_plus: null,
          d_moins: null,
          cutoff_raw: null,
          cutoff_kind: 'unknown',
          type: 'depart',
        },
      ],
    }
    const out = rawToExtractedRaceData(raw)
    expect(out.waypoints[0].cutoffRaw).toBeNull()
    expect(out.waypoints[0].cutoffKind).toBeNull()
  })
})

describe('validateExtractedRaceData', () => {
  function makeWaypoint(over: Partial<{
    orderIndex: number; km: number; type: string; name: string;
    kmInter: number | null; dPlus: number | null; dMoins: number | null;
  }>) {
    return {
      orderIndex: 0,
      name: 'A',
      km: 0,
      kmInter: null,
      dPlus: null,
      dMoins: null,
      cutoffRaw: null,
      cutoffKind: null,
      type: 'depart',
      ...over,
    } as any
  }

  it('accepte une liste vide (aucun tableau exploitable)', () => {
    expect(() =>
      validateExtractedRaceData({
        raceName: null,
        editionYear: null,
        waypoints: [],
      }),
    ).not.toThrow()
  })

  it('rejette km non strictement croissants', () => {
    expect(() =>
      validateExtractedRaceData({
        raceName: null,
        editionYear: null,
        waypoints: [
          makeWaypoint({ orderIndex: 0, km: 0, type: 'depart' }),
          makeWaypoint({ orderIndex: 1, name: 'B', km: 0, type: 'arrivee' }),
        ],
      }),
    ).toThrow(/km.*croissant/i)
  })

  it('rejette d_plus négatif', () => {
    expect(() =>
      validateExtractedRaceData({
        raceName: null,
        editionYear: null,
        waypoints: [makeWaypoint({ dPlus: -10 })],
      }),
    ).toThrow(/d_plus|dPlus/i)
  })

  it("force depart/arrivee aux extrémités quand types intermédiaires fournis", () => {
    const data = {
      raceName: null,
      editionYear: null,
      waypoints: [
        makeWaypoint({ orderIndex: 0, km: 0, type: 'ravito' }),
        makeWaypoint({ orderIndex: 1, name: 'B', km: 10, type: 'ravito' }),
      ],
    }
    const out = validateExtractedRaceData(data)
    expect(out.waypoints[0].type).toBe('depart')
    expect(out.waypoints[1].type).toBe('arrivee')
  })

  it("réindexe order_index séquentiellement à partir de 0", () => {
    const data = {
      raceName: null,
      editionYear: null,
      waypoints: [
        makeWaypoint({ orderIndex: 5, km: 0, type: 'depart' }),
        makeWaypoint({ orderIndex: 9, name: 'B', km: 10, type: 'arrivee' }),
      ],
    }
    const out = validateExtractedRaceData(data)
    expect(out.waypoints.map(w => w.orderIndex)).toEqual([0, 1])
  })
})

describe('RACE_EXTRACTION_JSON_SCHEMA', () => {
  it("a un type 'object' à la racine avec strict: true", () => {
    expect(RACE_EXTRACTION_JSON_SCHEMA.schema.type).toBe('object')
    expect(RACE_EXTRACTION_JSON_SCHEMA.strict).toBe(true)
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run (depuis `web/`) : `npx jest __tests__/lib/race-import/schema.test.ts`
Expected : FAIL avec `Cannot find module '@/lib/race-import/schema'`.

- [ ] **Step 3: Implémenter `web/lib/race-import/schema.ts`**

```ts
// JSON Schema pour OpenAI Structured Outputs + validateur métier + conversion.
import type {
  ExtractedRaceData,
  CutoffKind,
  WaypointType,
  RaceWaypoint,
} from '@/types/plan'

// ── JSON Schema pour response_format: { type: 'json_schema', json_schema: ... } ──
export const RACE_EXTRACTION_JSON_SCHEMA = {
  name: 'race_roadbook_extraction',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      race_name: { type: ['string', 'null'] },
      edition_year: { type: ['number', 'null'] },
      waypoints: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            order_index: { type: 'number' },
            name: { type: 'string' },
            km: { type: 'number' },
            km_inter: { type: ['number', 'null'] },
            d_plus: { type: ['number', 'null'] },
            d_moins: { type: ['number', 'null'] },
            cutoff_raw: { type: ['string', 'null'] },
            cutoff_kind: {
              type: 'string',
              enum: ['clock_time', 'elapsed', 'unknown'],
            },
            type: {
              type: 'string',
              enum: ['depart', 'ravito', 'pointage', 'arrivee', 'autre'],
            },
          },
          required: [
            'order_index', 'name', 'km', 'km_inter', 'd_plus', 'd_moins',
            'cutoff_raw', 'cutoff_kind', 'type',
          ],
        },
      },
    },
    required: ['race_name', 'edition_year', 'waypoints'],
  },
} as const

type RawWaypoint = {
  order_index: number
  name: string
  km: number
  km_inter: number | null
  d_plus: number | null
  d_moins: number | null
  cutoff_raw: string | null
  cutoff_kind: 'clock_time' | 'elapsed' | 'unknown'
  type: WaypointType
}

type RawExtraction = {
  race_name: string | null
  edition_year: number | null
  waypoints: RawWaypoint[]
}

// ── Conversion snake_case (LLM) → camelCase (TS) ──
export function rawToExtractedRaceData(raw: RawExtraction): ExtractedRaceData {
  return {
    raceName: raw.race_name,
    editionYear: raw.edition_year,
    waypoints: raw.waypoints.map((w) => ({
      orderIndex: w.order_index,
      name: w.name,
      km: w.km,
      kmInter: w.km_inter,
      dPlus: w.d_plus,
      dMoins: w.d_moins,
      cutoffRaw: w.cutoff_raw,
      // Si pas de cutoff brut, le kind n'a pas de sens — on nullifie.
      cutoffKind: w.cutoff_raw === null ? null : (w.cutoff_kind as CutoffKind),
      type: w.type,
    })),
  }
}

// ── Validation métier + normalisation (réindexation, fix depart/arrivee) ──
export class ValidationError extends Error {}

export function validateExtractedRaceData(
  data: ExtractedRaceData,
): ExtractedRaceData {
  const wps = [...data.waypoints]

  // Cas vide → on accepte.
  if (wps.length === 0) return data

  // Tri par km croissant (sécurité, le LLM peut se tromper).
  wps.sort((a, b) => a.km - b.km)

  // 1) km strictement croissants.
  for (let i = 1; i < wps.length; i++) {
    if (wps[i].km <= wps[i - 1].km) {
      throw new ValidationError(
        `km doivent être strictement croissants (waypoint ${i} : km=${wps[i].km} <= km=${wps[i - 1].km} précédent)`,
      )
    }
  }

  // 2) Non-négativité.
  for (const w of wps) {
    if (w.kmInter !== null && w.kmInter < 0) {
      throw new ValidationError(`km_inter négatif sur "${w.name}"`)
    }
    if (w.dPlus !== null && w.dPlus < 0) {
      throw new ValidationError(`d_plus négatif sur "${w.name}"`)
    }
    if (w.dMoins !== null && w.dMoins < 0) {
      throw new ValidationError(`d_moins négatif sur "${w.name}"`)
    }
  }

  // 3) depart/arrivee forcés aux extrémités.
  wps[0] = { ...wps[0], type: 'depart' }
  wps[wps.length - 1] = { ...wps[wps.length - 1], type: 'arrivee' }

  // 4) order_index séquentiel.
  const reindexed = wps.map((w, i) => ({ ...w, orderIndex: i }))

  return {
    raceName: data.raceName,
    editionYear: data.editionYear,
    waypoints: reindexed,
  }
}

// ── Helpers DB ↔ TS ──
type DbRow = {
  id: string
  race_id: string
  order_index: number
  name: string
  km: number | string
  km_inter: number | string | null
  d_plus: number | null
  d_moins: number | null
  cutoff_raw: string | null
  cutoff_kind: CutoffKind | null
  type: WaypointType
}

export function rowToRaceWaypoint(row: DbRow): RaceWaypoint {
  return {
    id: row.id,
    raceId: row.race_id,
    orderIndex: row.order_index,
    name: row.name,
    km: Number(row.km),
    kmInter: row.km_inter === null ? null : Number(row.km_inter),
    dPlus: row.d_plus,
    dMoins: row.d_moins,
    cutoffRaw: row.cutoff_raw,
    cutoffKind: row.cutoff_kind,
    type: row.type,
  }
}
```

- [ ] **Step 4: Lancer les tests, vérifier PASS**

Run : `npx jest __tests__/lib/race-import/schema.test.ts`
Expected : tous les tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/race-import/schema.ts web/__tests__/lib/race-import/schema.test.ts
git commit -m "feat(race-import): JSON schema + validateur métier + conversion DB"
```

---

## Task 5 : Interface RaceParser vide

**Files:**
- Create: `web/lib/race-import/sources/index.ts`
- Test: `web/__tests__/lib/race-import/sources.test.ts`

- [ ] **Step 1: Écrire les tests (FAIL)**

```ts
import { findParserForUrl, registerParser, getRegisteredParsers } from '@/lib/race-import/sources'

describe('parser registry', () => {
  it('renvoie null si aucun parser ne match', () => {
    expect(findParserForUrl('https://livetrail.net/foo')).toBeNull()
  })

  it("liste vide par défaut", () => {
    expect(getRegisteredParsers()).toEqual([])
  })

  it('register + match', () => {
    const parser = {
      id: 'test-parser',
      match: (url: string) => url.includes('example.com'),
      parse: async () => ({ raceName: null, editionYear: null, waypoints: [] }),
    }
    registerParser(parser)
    expect(findParserForUrl('https://example.com/x')).toBe(parser)
    expect(findParserForUrl('https://other.com/x')).toBeNull()
  })
})
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run : `npx jest __tests__/lib/race-import/sources.test.ts`
Expected : FAIL "Cannot find module".

- [ ] **Step 3: Implémenter `web/lib/race-import/sources/index.ts`**

```ts
// Point d'extension futur pour parsers site-spécifiques.
// Phase 1 : aucun parser concret enregistré, défaut LLM partout.
import type { ExtractedRaceData } from '@/types/plan'

export interface RaceParser {
  id: string
  match(url: string): boolean
  parse(html: string): Promise<ExtractedRaceData>
}

const REGISTRY: RaceParser[] = []

export function registerParser(parser: RaceParser): void {
  REGISTRY.push(parser)
}

export function findParserForUrl(url: string): RaceParser | null {
  return REGISTRY.find((p) => p.match(url)) ?? null
}

export function getRegisteredParsers(): RaceParser[] {
  return [...REGISTRY]
}
```

- [ ] **Step 4: Vérifier PASS**

Run : `npx jest __tests__/lib/race-import/sources.test.ts`
Expected : tous les tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/race-import/sources/index.ts web/__tests__/lib/race-import/sources.test.ts
git commit -m "feat(race-import): interface RaceParser + registre (vide en phase 1)"
```

---

## Task 6 : Ajout des dépendances npm

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: Ajouter les dépendances**

Run (depuis `web/`) :

```bash
npm install openai pdf-parse
npm install --save-dev @types/pdf-parse
```

- [ ] **Step 2: Vérifier que `package.json` contient les nouvelles entrées**

`web/package.json` → `dependencies` doit inclure `openai` et `pdf-parse`. `devDependencies` doit inclure `@types/pdf-parse`.

- [ ] **Step 3: Vérifier que build / tests existants ne cassent pas**

Run :
```bash
npm test
npm run lint
```
Expected : pas de régression.

- [ ] **Step 4: Commit**

```bash
git add web/package.json web/package-lock.json
git commit -m "chore(deps): add openai + pdf-parse pour race-import"
```

---

## Task 7 : Fetch URL sécurisé

**Files:**
- Create: `web/lib/race-import/fetch-url.ts`

- [ ] **Step 1: Implémenter le module**

```ts
// Fetch HTML sécurisé pour l'extraction de roadbook.
// - Whitelist http(s) uniquement (refus de file:, data:, etc.)
// - Timeout 10s
// - Limite taille 1 Mo
import 'server-only'

const MAX_BYTES = 1_000_000
const TIMEOUT_MS = 10_000

export class FetchUrlError extends Error {}

export async function fetchRaceHtml(rawUrl: string): Promise<string> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new FetchUrlError('URL invalide')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new FetchUrlError(`Protocole non autorisé : ${parsed.protocol}`)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(parsed.toString(), {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'TrailCockpitBot/1.0' },
    })
  } catch (err) {
    clearTimeout(timer)
    throw new FetchUrlError(`Fetch échoué : ${(err as Error).message}`)
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    throw new FetchUrlError(`HTTP ${res.status}`)
  }

  // Lecture en streaming pour borner la taille.
  const reader = res.body?.getReader()
  if (!reader) {
    const text = await res.text()
    if (text.length > MAX_BYTES) throw new FetchUrlError('Réponse trop volumineuse')
    return text
  }

  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    if (value) {
      total += value.length
      if (total > MAX_BYTES) {
        await reader.cancel()
        throw new FetchUrlError('Réponse trop volumineuse (>1 Mo)')
      }
      chunks.push(value)
    }
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))))
}
```

- [ ] **Step 2: Commit**

```bash
git add web/lib/race-import/fetch-url.ts
git commit -m "feat(race-import): fetch HTML sécurisé (whitelist + timeout + cap taille)"
```

---

## Task 8 : Wrapper pdf-parse

**Files:**
- Create: `web/lib/race-import/parse-pdf.ts`

- [ ] **Step 1: Implémenter**

```ts
// Extraction texte depuis un PDF en mémoire.
import 'server-only'
import pdfParse from 'pdf-parse'

export class ParsePdfError extends Error {}

export async function parsePdfText(buffer: Buffer): Promise<string> {
  try {
    const result = await pdfParse(buffer)
    const text = (result.text || '').trim()
    if (!text) {
      throw new ParsePdfError(
        'Aucun texte extrait — PDF scanné ou vide. Essaye l\'onglet Image.',
      )
    }
    return text
  } catch (err) {
    if (err instanceof ParsePdfError) throw err
    throw new ParsePdfError(`Erreur PDF : ${(err as Error).message}`)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add web/lib/race-import/parse-pdf.ts
git commit -m "feat(race-import): wrapper pdf-parse server-only"
```

---

## Task 9 : Fonction d'extraction OpenAI

**Files:**
- Create: `web/lib/race-import/extract.ts`
- Test: `web/__tests__/lib/race-import/extract.test.ts`

- [ ] **Step 1: Écrire les tests (FAIL)**

```ts
import { extractWaypoints } from '@/lib/race-import/extract'

jest.mock('openai', () => {
  const create = jest.fn()
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: { completions: { create } },
    })),
    _create: create,
  }
})

// Récup du mock pour le contrôler dans les tests.
const openaiMod = require('openai')
const mockCreate = openaiMod._create as jest.Mock

describe('extractWaypoints', () => {
  beforeEach(() => {
    mockCreate.mockReset()
    process.env.OPENAI_API_KEY = 'test-key'
  })

  it('mappe la sortie LLM snake_case en ExtractedRaceData camelCase', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              race_name: 'CCC',
              edition_year: 2024,
              waypoints: [
                {
                  order_index: 0,
                  name: 'Courmayeur',
                  km: 0,
                  km_inter: 0,
                  d_plus: 0,
                  d_moins: 0,
                  cutoff_raw: '09:00',
                  cutoff_kind: 'clock_time',
                  type: 'depart',
                },
                {
                  order_index: 1,
                  name: 'Chamonix',
                  km: 101.7,
                  km_inter: 6.9,
                  d_plus: 6105,
                  d_moins: 6285,
                  cutoff_raw: '12:00',
                  cutoff_kind: 'clock_time',
                  type: 'arrivee',
                },
              ],
            }),
          },
        },
      ],
    })

    const out = await extractWaypoints({ text: 'roadbook CCC ...' })
    expect(out.raceName).toBe('CCC')
    expect(out.waypoints).toHaveLength(2)
    expect(out.waypoints[0].orderIndex).toBe(0)
    expect(out.waypoints[1].name).toBe('Chamonix')
  })

  it('jette une erreur claire si OPENAI_API_KEY absente', async () => {
    delete process.env.OPENAI_API_KEY
    await expect(extractWaypoints({ text: 'x' })).rejects.toThrow(/OPENAI_API_KEY/)
  })

  it('jette une erreur si aucun input fourni', async () => {
    await expect(extractWaypoints({})).rejects.toThrow(/input/i)
  })

  it("appelle gpt-4o avec response_format json_schema strict", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"race_name":null,"edition_year":null,"waypoints":[]}' } }],
    })
    await extractWaypoints({ text: 'x' })
    const args = mockCreate.mock.calls[0][0]
    expect(args.model).toBe('gpt-4o')
    expect(args.response_format.type).toBe('json_schema')
    expect(args.response_format.json_schema.strict).toBe(true)
  })

  it('passe une image en content multimodal', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"race_name":null,"edition_year":null,"waypoints":[]}' } }],
    })
    await extractWaypoints({ imageBase64: 'iVBORw0KG...', imageMime: 'image/png' })
    const args = mockCreate.mock.calls[0][0]
    const userMsg = args.messages.find((m: any) => m.role === 'user')
    expect(userMsg.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'image_url' }),
      ]),
    )
  })
})
```

- [ ] **Step 2: Vérifier FAIL**

Run : `npx jest __tests__/lib/race-import/extract.test.ts`
Expected : FAIL "Cannot find module".

- [ ] **Step 3: Implémenter `web/lib/race-import/extract.ts`**

```ts
import 'server-only'
import OpenAI from 'openai'
import type { ExtractedRaceData } from '@/types/plan'
import { RACE_EXTRACTION_SYSTEM_PROMPT } from './prompt'
import {
  RACE_EXTRACTION_JSON_SCHEMA,
  rawToExtractedRaceData,
  validateExtractedRaceData,
} from './schema'

export type ExtractInput =
  | { text: string }
  | { html: string }
  | { pdfText: string }
  | { imageBase64: string; imageMime: 'image/png' | 'image/jpeg' | 'image/webp' }

function isImageInput(
  i: ExtractInput,
): i is Extract<ExtractInput, { imageBase64: string }> {
  return 'imageBase64' in i
}

export async function extractWaypoints(
  input: Partial<ExtractInput> | {},
): Promise<ExtractedRaceData> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY absente côté serveur')
  }

  const i = input as ExtractInput
  const hasText = 'text' in i && i.text
  const hasHtml = 'html' in i && i.html
  const hasPdf = 'pdfText' in i && i.pdfText
  const hasImage = 'imageBase64' in i && i.imageBase64
  if (!hasText && !hasHtml && !hasPdf && !hasImage) {
    throw new Error('Aucun input fourni (text / html / pdfText / imageBase64)')
  }

  const client = new OpenAI({ apiKey })

  let userContent: any
  if (isImageInput(i)) {
    userContent = [
      { type: 'text', text: 'Extrais le tableau des points de passage de cette image.' },
      {
        type: 'image_url',
        image_url: { url: `data:${i.imageMime};base64,${i.imageBase64}` },
      },
    ]
  } else if ('html' in i) {
    userContent = `Contenu HTML :\n\n${i.html.slice(0, 200_000)}`
  } else if ('pdfText' in i) {
    userContent = `Texte extrait d'un PDF :\n\n${i.pdfText.slice(0, 200_000)}`
  } else {
    userContent = `Texte fourni :\n\n${(i as any).text.slice(0, 200_000)}`
  }

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: RACE_EXTRACTION_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: RACE_EXTRACTION_JSON_SCHEMA,
    },
    temperature: 0,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('Réponse OpenAI vide')
  }

  const raw = JSON.parse(content)
  return validateExtractedRaceData(rawToExtractedRaceData(raw))
}
```

- [ ] **Step 4: Lancer les tests**

Run : `npx jest __tests__/lib/race-import/extract.test.ts`
Expected : PASS sur tous.

- [ ] **Step 5: Commit**

```bash
git add web/lib/race-import/extract.ts web/__tests__/lib/race-import/extract.test.ts
git commit -m "feat(race-import): extractWaypoints (OpenAI gpt-4o Structured Outputs)"
```

---

## Task 10 : Route POST /api/race-import

**Files:**
- Create: `web/app/api/race-import/route.ts`

- [ ] **Step 1: Implémenter le route handler**

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import { extractWaypoints, type ExtractInput } from '@/lib/race-import/extract'
import { fetchRaceHtml } from '@/lib/race-import/fetch-url'
import { parsePdfText } from '@/lib/race-import/parse-pdf'

export const runtime = 'nodejs'
export const maxDuration = 60

// POST /api/race-import
// Body (multipart si pdf/image, sinon JSON) :
// - source: 'url' | 'pdf' | 'image' | 'text'
// - url / text : champ texte
// - file : champ fichier (PDF ou image)
//
// PAS de persistance ici : renvoie le JSON extrait pour preview client.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ct = request.headers.get('content-type') || ''
  let source = ''
  let input: Partial<ExtractInput> = {}

  try {
    if (ct.includes('multipart/form-data')) {
      const form = await request.formData()
      source = String(form.get('source') || '')
      const file = form.get('file') as File | null

      if (source === 'pdf') {
        if (!file) throw new Error('Fichier PDF manquant')
        if (file.size > 5_000_000) throw new Error('PDF > 5 Mo')
        const buf = Buffer.from(await file.arrayBuffer())
        const pdfText = await parsePdfText(buf)
        input = { pdfText }
      } else if (source === 'image') {
        if (!file) throw new Error('Fichier image manquant')
        if (file.size > 4_000_000) throw new Error('Image > 4 Mo')
        const mime = file.type as 'image/png' | 'image/jpeg' | 'image/webp'
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime)) {
          throw new Error(`Format image non supporté : ${mime}`)
        }
        const buf = Buffer.from(await file.arrayBuffer())
        input = { imageBase64: buf.toString('base64'), imageMime: mime }
      } else {
        throw new Error(`source invalide pour multipart : ${source}`)
      }
    } else {
      const body = await request.json() as { source: string; url?: string; text?: string }
      source = body.source

      if (source === 'url') {
        if (!body.url) throw new Error('URL manquante')
        const html = await fetchRaceHtml(body.url)
        input = { html }
      } else if (source === 'text') {
        if (!body.text || !body.text.trim()) throw new Error('Texte manquant')
        input = { text: body.text }
      } else {
        throw new Error(`source invalide : ${source}`)
      }
    }

    const data = await extractWaypoints(input)
    return NextResponse.json({ data })
  } catch (err) {
    const msg = (err as Error).message
    return NextResponse.json({ error: msg }, { status: 422 })
  }
}
```

- [ ] **Step 2: Vérifier que le build TS passe**

Run : `npx tsc --noEmit -p web/tsconfig.json` (ou `cd web && npm run lint`).
Expected : aucune erreur TS sur le nouveau fichier.

- [ ] **Step 3: Commit**

```bash
git add web/app/api/race-import/route.ts
git commit -m "feat(race-import): POST /api/race-import (URL/PDF/Image/Texte)"
```

---

## Task 11 : Route CRUD /api/races/[id]/waypoints

**Files:**
- Create: `web/app/api/races/[id]/waypoints/route.ts`

- [ ] **Step 1: Implémenter**

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import { rowToRaceWaypoint } from '@/lib/race-import/schema'
import type { RaceWaypoint } from '@/types/plan'

export const runtime = 'nodejs'

// GET /api/races/[id]/waypoints → liste ordonnée.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('race_waypoints')
    .select('*')
    .eq('race_id', params.id)
    .order('order_index', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const waypoints: RaceWaypoint[] = (data ?? []).map(rowToRaceWaypoint as any)
  return NextResponse.json({ waypoints })
}

// PUT /api/races/[id]/waypoints → remplace TOUS les waypoints.
// Body : { waypoints: Array<Omit<RaceWaypoint, 'id' | 'raceId'>> }
export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Vérifier que la course appartient au user (sécurité même si RLS le ferait).
  const { data: race, error: raceErr } = await supabase
    .from('races')
    .select('id')
    .eq('id', params.id)
    .eq('athlete_id', user.id)
    .single()
  if (raceErr || !race) {
    return NextResponse.json({ error: 'Course introuvable' }, { status: 404 })
  }

  const body = await request.json() as {
    waypoints: Array<Omit<RaceWaypoint, 'id' | 'raceId'>>
  }
  const rows = (body.waypoints ?? []).map((w) => ({
    race_id: params.id,
    order_index: w.orderIndex,
    name: w.name,
    km: w.km,
    km_inter: w.kmInter,
    d_plus: w.dPlus,
    d_moins: w.dMoins,
    cutoff_raw: w.cutoffRaw,
    cutoff_kind: w.cutoffRaw === null ? null : w.cutoffKind,
    type: w.type,
  }))

  // Stratégie remplacement : delete + insert dans une seule requête transactionnelle.
  const { error: delErr } = await supabase
    .from('race_waypoints')
    .delete()
    .eq('race_id', params.id)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  if (rows.length === 0) {
    return NextResponse.json({ waypoints: [] })
  }

  const { data: inserted, error: insErr } = await supabase
    .from('race_waypoints')
    .insert(rows)
    .select('*')
    .order('order_index', { ascending: true })

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  const waypoints: RaceWaypoint[] = (inserted ?? []).map(rowToRaceWaypoint as any)
  return NextResponse.json({ waypoints })
}
```

- [ ] **Step 2: Vérifier la compilation**

Run : `cd web && npm run lint`
Expected : pas d'erreur sur le fichier.

- [ ] **Step 3: Commit**

```bash
git add "web/app/api/races/[id]/waypoints/route.ts"
git commit -m "feat(race-import): API CRUD waypoints (GET + PUT remplace tout)"
```

---

## Task 12 : Composant WaypointsTable

**Files:**
- Create: `web/components/plan/WaypointsTable.tsx`

- [ ] **Step 1: Implémenter le composant**

```tsx
'use client'

// Tableau éditable inline des points de passage d'une course.
// Pas d'undo en phase 1 — re-import si besoin de reset.
import { useCallback } from 'react'
import type { RaceWaypoint, CutoffKind, WaypointType } from '@/types/plan'

type Draft = Omit<RaceWaypoint, 'id' | 'raceId'>

type Props = {
  waypoints: Draft[]
  onChange: (next: Draft[]) => void
  readOnly?: boolean
}

const TYPE_OPTIONS: { value: WaypointType; label: string }[] = [
  { value: 'depart',   label: 'Départ' },
  { value: 'ravito',   label: 'Ravito' },
  { value: 'pointage', label: 'Pointage' },
  { value: 'arrivee',  label: 'Arrivée' },
  { value: 'autre',    label: 'Autre' },
]

const KIND_OPTIONS: { value: CutoffKind; label: string }[] = [
  { value: 'clock_time', label: 'Heure' },
  { value: 'elapsed',    label: 'Temps' },
  { value: 'unknown',    label: '?' },
]

function emptyRow(orderIndex: number): Draft {
  return {
    orderIndex,
    name: '',
    km: 0,
    kmInter: null,
    dPlus: null,
    dMoins: null,
    cutoffRaw: null,
    cutoffKind: null,
    type: orderIndex === 0 ? 'depart' : 'ravito',
  }
}

function reindex(rows: Draft[]): Draft[] {
  const sorted = [...rows].sort((a, b) => a.km - b.km)
  return sorted.map((r, i) => ({
    ...r,
    orderIndex: i,
    type:
      i === 0 ? 'depart' :
      i === sorted.length - 1 ? 'arrivee' :
      r.type,
  }))
}

export function WaypointsTable({ waypoints, onChange, readOnly }: Props) {
  const update = useCallback(
    (i: number, patch: Partial<Draft>) => {
      const next = waypoints.map((w, idx) => (idx === i ? { ...w, ...patch } : w))
      onChange(reindex(next))
    },
    [waypoints, onChange],
  )

  const remove = useCallback(
    (i: number) => {
      onChange(reindex(waypoints.filter((_, idx) => idx !== i)))
    },
    [waypoints, onChange],
  )

  const add = useCallback(() => {
    onChange(reindex([...waypoints, emptyRow(waypoints.length)]))
  }, [waypoints, onChange])

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] text-trail-text">
          <thead>
            <tr className="text-trail-muted text-[11px]">
              <th className="text-left p-1">Point</th>
              <th className="text-right p-1">Dist</th>
              <th className="text-right p-1">Inter</th>
              <th className="text-right p-1">D+</th>
              <th className="text-right p-1">D−</th>
              <th className="text-left p-1">BH</th>
              <th className="text-left p-1">Type</th>
              {!readOnly && <th />}
            </tr>
          </thead>
          <tbody>
            {waypoints.map((w, i) => (
              <tr key={`${w.orderIndex}-${i}`} className="border-t border-trail-border">
                <td className="p-1">
                  <input
                    type="text"
                    value={w.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    disabled={readOnly}
                    className="w-full bg-transparent outline-none"
                  />
                </td>
                <td className="p-1 w-[60px]">
                  <input
                    type="number" step="0.1"
                    value={w.km}
                    onChange={(e) => update(i, { km: parseFloat(e.target.value) || 0 })}
                    disabled={readOnly}
                    className="w-full bg-transparent outline-none text-right"
                  />
                </td>
                <td className="p-1 w-[60px]">
                  <input
                    type="number" step="0.1"
                    value={w.kmInter ?? ''}
                    onChange={(e) =>
                      update(i, { kmInter: e.target.value === '' ? null : parseFloat(e.target.value) })
                    }
                    disabled={readOnly}
                    className="w-full bg-transparent outline-none text-right"
                  />
                </td>
                <td className="p-1 w-[60px]">
                  <input
                    type="number"
                    value={w.dPlus ?? ''}
                    onChange={(e) =>
                      update(i, { dPlus: e.target.value === '' ? null : parseInt(e.target.value, 10) })
                    }
                    disabled={readOnly}
                    className="w-full bg-transparent outline-none text-right"
                  />
                </td>
                <td className="p-1 w-[60px]">
                  <input
                    type="number"
                    value={w.dMoins ?? ''}
                    onChange={(e) =>
                      update(i, { dMoins: e.target.value === '' ? null : parseInt(e.target.value, 10) })
                    }
                    disabled={readOnly}
                    className="w-full bg-transparent outline-none text-right"
                  />
                </td>
                <td className="p-1">
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={w.cutoffRaw ?? ''}
                      onChange={(e) => {
                        const v = e.target.value || null
                        update(i, {
                          cutoffRaw: v,
                          cutoffKind: v === null ? null : w.cutoffKind ?? 'unknown',
                        })
                      }}
                      disabled={readOnly}
                      className="w-[60px] bg-transparent outline-none"
                      placeholder="—"
                    />
                    {w.cutoffRaw && (
                      <select
                        value={w.cutoffKind ?? 'unknown'}
                        onChange={(e) => update(i, { cutoffKind: e.target.value as CutoffKind })}
                        disabled={readOnly}
                        className="bg-transparent outline-none text-[11px]"
                      >
                        {KIND_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </td>
                <td className="p-1">
                  <select
                    value={w.type}
                    onChange={(e) => update(i, { type: e.target.value as WaypointType })}
                    disabled={readOnly}
                    className="bg-transparent outline-none"
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </td>
                {!readOnly && (
                  <td className="p-1 w-[28px]">
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      aria-label={`Supprimer ${w.name || 'ligne'}`}
                      className="text-trail-danger text-[14px]"
                    >
                      ×
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <button
          type="button"
          onClick={add}
          className="text-[12px] text-trail-primary underline"
        >
          + Ajouter une ligne
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Vérifier la compilation**

Run : `cd web && npm run lint`
Expected : pas d'erreur sur le nouveau fichier.

- [ ] **Step 3: Commit**

```bash
git add web/components/plan/WaypointsTable.tsx
git commit -m "feat(plan): WaypointsTable — tableau de course éditable inline"
```

---

## Task 13 : Composant RaceImportSheet

**Files:**
- Create: `web/components/plan/RaceImportSheet.tsx`

- [ ] **Step 1: Implémenter**

```tsx
'use client'

// Bottom-sheet d'import du tableau de course : 4 onglets (URL / PDF / Image / Texte).
// Pattern portal aligné sur RaceEditorModal / SessionAddSheet.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ExtractedRaceData, RaceWaypoint } from '@/types/plan'
import { WaypointsTable } from './WaypointsTable'

type Tab = 'url' | 'pdf' | 'image' | 'text'

type Props = {
  raceId: string
  open: boolean
  onClose: () => void
  onSaved: (waypoints: RaceWaypoint[]) => void
}

type Status = 'idle' | 'extracting' | 'preview' | 'saving' | 'error'

export function RaceImportSheet({ raceId, open, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<Tab>('url')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [draft, setDraft] = useState<ExtractedRaceData['waypoints']>([])

  useEffect(() => {
    if (!open) return
    setTab('url'); setStatus('idle'); setError(null)
    setUrl(''); setText(''); setPdfFile(null); setImageFile(null); setDraft([])
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function extract() {
    setStatus('extracting'); setError(null)
    try {
      let res: Response
      if (tab === 'pdf' || tab === 'image') {
        const file = tab === 'pdf' ? pdfFile : imageFile
        if (!file) throw new Error('Fichier requis')
        const form = new FormData()
        form.append('source', tab)
        form.append('file', file)
        res = await fetch('/api/race-import', { method: 'POST', body: form })
      } else {
        res = await fetch('/api/race-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: tab, url, text }),
        })
      }
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erreur extraction')
      setDraft(body.data.waypoints)
      setStatus('preview')
    } catch (err) {
      setError((err as Error).message)
      setStatus('error')
    }
  }

  async function save() {
    setStatus('saving'); setError(null)
    try {
      const res = await fetch(`/api/races/${raceId}/waypoints`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waypoints: draft }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Erreur sauvegarde')
      onSaved(body.waypoints)
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setStatus('error')
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
      aria-modal="true" role="dialog"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-[16px] bg-trail-card border-t border-trail-border p-4 space-y-3"
      >
        <div className="flex justify-between items-center">
          <h2 className="text-[16px] font-semibold">Importer le tableau de course</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-trail-muted">×</button>
        </div>

        {status !== 'preview' && (
          <>
            <div className="flex gap-2 text-[12px]">
              {(['url', 'pdf', 'image', 'text'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`px-3 py-1 rounded-full ${
                    tab === t
                      ? 'bg-trail-primary text-white'
                      : 'bg-trail-surface text-trail-muted'
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>

            {tab === 'url' && (
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full p-2 rounded bg-trail-surface text-[13px]"
              />
            )}
            {tab === 'text' && (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                placeholder="Colle le tableau ici..."
                className="w-full p-2 rounded bg-trail-surface text-[13px]"
              />
            )}
            {tab === 'pdf' && (
              <input
                type="file" accept="application/pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              />
            )}
            {tab === 'image' && (
              <input
                type="file" accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              />
            )}

            <button
              type="button"
              onClick={extract}
              disabled={status === 'extracting'}
              className="w-full py-2 rounded bg-trail-primary text-white text-[13px] font-semibold disabled:opacity-50"
            >
              {status === 'extracting' ? 'Extraction…' : 'Extraire'}
            </button>
          </>
        )}

        {status === 'preview' && (
          <>
            <p className="text-[12px] text-trail-muted">
              Vérifie les chiffres, corrige ce qui doit l'être, puis sauvegarde.
            </p>
            <WaypointsTable
              waypoints={draft}
              onChange={(next) => setDraft(next)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setStatus('idle'); setDraft([]) }}
                className="flex-1 py-2 rounded border border-trail-border text-[13px]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={save}
                disabled={status === 'saving' || draft.length === 0}
                className="flex-1 py-2 rounded bg-trail-primary text-white text-[13px] font-semibold disabled:opacity-50"
              >
                {status === 'saving' ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
            </div>
          </>
        )}

        {error && (
          <div className="text-[12px] text-trail-danger">
            {error}
            <button
              type="button"
              onClick={() => { setError(null); setStatus('idle') }}
              className="ml-2 underline"
            >
              Réessayer
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 2: Lint**

Run : `cd web && npm run lint`
Expected : OK.

- [ ] **Step 3: Commit**

```bash
git add web/components/plan/RaceImportSheet.tsx
git commit -m "feat(plan): RaceImportSheet — 4 onglets URL/PDF/Image/Texte + preview"
```

---

## Task 14 : Intégration dans `CoursePageClient`

**Files:**
- Modify: `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx` (lignes 118-124, plus imports et state)

- [ ] **Step 1: Lire l'état actuel du fichier**

Run :
```bash
sed -n '1,160p' "web/app/(main)/plan/courses/[id]/CoursePageClient.tsx"
```

- [ ] **Step 2: Ajouter les imports en tête de fichier**

Ajouter sous la ligne `import { EditButton }` :

```ts
import { WaypointsTable } from '@/components/plan/WaypointsTable'
import { RaceImportSheet } from '@/components/plan/RaceImportSheet'
import type { RaceWaypoint } from '@/types/plan'
```

- [ ] **Step 3: Ajouter le state waypoints + fetch**

Dans le composant, sous `const [deleting, setDeleting] = useState(false)` :

```ts
const [waypoints, setWaypoints] = useState<RaceWaypoint[]>([])
const [importOpen, setImportOpen] = useState(false)
```

Dans `reload` (après le `setLoaded(true)`) :

```ts
const wpsRes = await fetch(`/api/races/${raceId}/waypoints`)
if (wpsRes.ok) {
  const body = await wpsRes.json()
  setWaypoints(body.waypoints ?? [])
}
```

- [ ] **Step 4: Remplacer les 2 blocs placeholder**

Remplacer le bloc actuel (lignes 118-124) :

```tsx
<Section title="Barrières horaires">
  <p className="text-[12px] text-trail-muted">Bientôt — saisie des barrières par km / poste de ravito.</p>
</Section>

<Section title="Plan de course">
  <p className="text-[12px] text-trail-muted">Bientôt — allure cible, stratégie ravito, vêtements.</p>
</Section>
```

par :

```tsx
<Section title="Tableau de course">
  {waypoints.length === 0 ? (
    <button
      type="button"
      onClick={() => setImportOpen(true)}
      className="text-[12px] text-trail-primary underline"
    >
      Importer le tableau (URL / PDF / Image / Texte)
    </button>
  ) : (
    <>
      <WaypointsTable
        waypoints={waypoints.map(({ id: _id, raceId: _rid, ...rest }) => rest)}
        onChange={() => { /* phase 1 : édition uniquement via re-import */ }}
        readOnly
      />
      <button
        type="button"
        onClick={() => setImportOpen(true)}
        className="mt-2 text-[12px] text-trail-primary underline"
      >
        Ré-importer
      </button>
    </>
  )}
</Section>
```

- [ ] **Step 5: Monter la sheet à côté du `RaceEditorModal`**

Ajouter juste avant `</div>` final du composant (sous `<RaceEditorModal … />`) :

```tsx
<RaceImportSheet
  raceId={race.id}
  open={importOpen}
  onClose={() => setImportOpen(false)}
  onSaved={(wps) => { setWaypoints(wps); setImportOpen(false) }}
/>
```

- [ ] **Step 6: Lint + build**

Run :
```bash
cd web
npm run lint
npm run build
```
Expected : pas d'erreur.

- [ ] **Step 7: Test manuel rapide**

Run : `cd web && npm run dev`
Ouvrir `http://localhost:3000/plan/courses/<id>` sur une course existante :
- Vérifier que les anciens blocs "Barrières horaires" et "Plan de course" ont disparu.
- Vérifier qu'un bloc "Tableau de course" avec un bouton "Importer..." s'affiche.
- Ouvrir la sheet, tester chaque onglet (URL, Texte au minimum — PDF/Image si tu as un échantillon sous la main).

- [ ] **Step 8: Commit**

```bash
git add "web/app/(main)/plan/courses/[id]/CoursePageClient.tsx"
git commit -m "feat(plan): tableau de course intégré dans la fiche (remplace 2 placeholders)"
```

---

## Task 15 : Documentation upkeep + variable d'env

**Files:**
- Modify: `docs/superpowers/specs/2026-05-29-race-waypoints-import-design.md`
- Modify: `web/README.md` (section env vars)

- [ ] **Step 1: Ajouter le bandeau Status dans la spec**

Au tout début de la spec, juste après la première ligne H1, modifier :

```md
> **Status: Spec** · 2026-05-29 · Phase 1 (sans projection ETA)
```

par :

```md
> **Status: Implémenté** · 2026-05-29 · Code: `web/lib/race-import/`, `web/app/api/race-import/`, `web/app/api/races/[id]/waypoints/`, `web/components/plan/{WaypointsTable,RaceImportSheet}.tsx`
```

- [ ] **Step 2: Documenter `OPENAI_API_KEY` dans `web/README.md`**

Ouvrir `web/README.md`, trouver la section des variables d'env, ajouter :

```
OPENAI_API_KEY        # Extracteur de roadbook (Plan → Tableau de course). Modèle gpt-4o.
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-05-29-race-waypoints-import-design.md web/README.md
git commit -m "docs(plan): Status Implémenté + doc OPENAI_API_KEY"
```

- [ ] **Step 4: Rappel utilisateur**

Afficher dans la réponse de fin :
> ⚠️ Avant que la feature marche en prod :
> 1. Appliquer la migration `025_race_waypoints.sql` dans Supabase SQL Editor.
> 2. Ajouter `OPENAI_API_KEY` dans Vercel Dashboard → Settings → Environment Variables (Production + Preview).

---

## Self-Review (engineering checklist, post-plan)

- ✅ Spec → tâches : migration (T1), types (T2), prompt (T3), schema (T4), sources (T5), deps (T6), fetch-url (T7), parse-pdf (T8), extract (T9), route import (T10), route CRUD (T11), table UI (T12), sheet UI (T13), intégration (T14), doc (T15) — tout couvert.
- ✅ Aucun "TBD"/"TODO"/"add appropriate handling" non détaillé.
- ✅ Conventions de nommage cohérentes (`orderIndex`, `cutoffKind`, `RaceWaypoint`, `ExtractedRaceData`) — utilisées dans tous les tasks suivants.
- ✅ TDD appliqué là où la pure logique le permet (schema.ts, sources/index.ts, extract.ts). UI et routes : test manuel + lint/build.
- ✅ Pas de fonction inventée ailleurs qu'à l'endroit où on l'implémente (validateExtractedRaceData, rawToExtractedRaceData, rowToRaceWaypoint, extractWaypoints, fetchRaceHtml, parsePdfText, registerParser, findParserForUrl).
- ✅ Commits fréquents : 1 par tâche, message conventionnel.
- ✅ Rappels migration + env var documentés en fin de Task 1 et Task 15.
