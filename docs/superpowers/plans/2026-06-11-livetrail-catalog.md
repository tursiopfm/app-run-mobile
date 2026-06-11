# Catalogue LiveTrail & onglet Auto enrichi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Résoudre une course LiveTrail dans l'onglet Auto **sans appeler OpenAI** quand elle est déjà au catalogue local, et peupler ce catalogue (accumulation passive + snapshot cron).

**Architecture:** Nouvelle table légère `livetrail_catalog` (index nom→événement, **aucun waypoint stocké**). `find-race.ts` gagne un étage « catalogue d'abord » : `searchCatalogUrls(target)` → réutilise `resolveCandidates`/`listLivetrailRaces` existants (waypoints re-fetch frais) → court-circuite OpenAI si confident. Accumulation passive depuis les candidats LiveTrail résolus via OpenAI. Cron snapshot des événements à venir. `resolveCandidates` reste **pur** (zéro DB).

**Tech Stack:** Next.js 14, TypeScript, Jest, Supabase (`@supabase/ssr`, service role), `fast-xml-parser`.

Spec : `docs/superpowers/specs/2026-06-11-livetrail-catalog-design.md`.

---

## Structure des fichiers

- **Create** `web/supabase/migrations/038_livetrail_catalog.sql` — table + index unique + index trigram + RLS.
- **Create** `web/lib/race-import/catalog.ts` — helpers purs (`normalizeSearchText`, `yearFromLivetrailUrl`, `harvestEventUrls`, `candidatesToRows`, `rankEventUrls`) + DB (`accumulateCatalog`, `searchCatalogUrls`) + orchestration cron (`runCatalogSnapshot`).
- **Create** `web/__tests__/lib/race-import/catalog.test.ts`.
- **Create** `web/lib/race-import/search-openai.ts` — `searchRaceUrls` (extrait de find-race.ts).
- **Modify** `web/lib/race-import/find-race.ts` — importer `searchRaceUrls` depuis `./search-openai` ; `findRaceCandidates` à deux étages + accumulation.
- **Modify** `web/__tests__/lib/race-import/find-race.test.ts` — tests `findRaceCandidates` (catalogue vs OpenAI).
- **Create** `web/app/api/cron/livetrail-catalog/route.ts` — cron (auth `CRON_SECRET` → `runCatalogSnapshot`).

**Conventions :** tests `cd web && npx jest <chemin>` ; typecheck `cd web && npx tsc --noEmit`. Piège TS : pas de `for...of`/spread sur `Set`/`Map`/itérateur `matchAll` → utiliser `Array.from`/index. Working tree : modifications **non liées** + travail parallèle de la session Fraîcheur → ne stager QUE les fichiers listés par tâche. Migration **non auto-appliquée** : rappeler à Franck de coller le SQL dans Supabase.

**Mock Supabase (rappel du pattern repo)** :
```ts
jest.mock('@/lib/database/supabase-server', () => ({ createServiceClient: jest.fn() }))
const mockCreateServiceClient = createServiceClient as jest.Mock
// puis client = { from: jest.fn().mockImplementation((t) => ({ upsert: ... } | { select: ... })) }
```

---

## Task 1 : Migration `038_livetrail_catalog.sql`

**Files:**
- Create: `web/supabase/migrations/038_livetrail_catalog.sql`

- [ ] **Step 1 : écrire la migration**

```sql
-- Catalogue LiveTrail : index léger (nom→événement) pour résoudre une course sans OpenAI.
-- Grain = une course-édition. AUCUN waypoint stocké (re-fetch frais à l'import).
-- Écritures réservées au service role ; lecture pour les utilisateurs authentifiés.
create extension if not exists pg_trgm;

create table if not exists livetrail_catalog (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null default 'livetrail',
  event_slug    text not null,
  event_name    text,
  course_name   text,
  edition_year  integer,
  total_km      numeric(6,2),
  total_dplus   integer,
  source_url    text not null,
  search_text   text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

-- NULLS NOT DISTINCT (PG15+) : une course sans année/nom ne se duplique pas, et
-- la cible d'onConflict reste des colonnes réelles (upsert PostgREST).
create unique index if not exists livetrail_catalog_uniq
  on livetrail_catalog (platform, event_slug, course_name, edition_year) nulls not distinct;

create index if not exists livetrail_catalog_search
  on livetrail_catalog using gin (search_text gin_trgm_ops);

alter table livetrail_catalog enable row level security;

create policy "livetrail_catalog_select_auth" on livetrail_catalog
  for select to authenticated using (true);
```

- [ ] **Step 2 : commit**

```bash
git add web/supabase/migrations/038_livetrail_catalog.sql
git commit -m "feat(catalog): migration 038 table livetrail_catalog (index + RLS lecture)"
```

- [ ] **Step 3 : rappel à Franck**

Afficher : « Migration `038_livetrail_catalog.sql` créée — **non auto-appliquée** : colle le SQL dans le SQL Editor Supabase (ou `supabase db push`). Le code tolère son absence (lecture catalogue vide → fallback OpenAI ; upsert qui rate = best-effort). »

---

## Task 2 : `catalog.ts` — helpers purs

**Files:**
- Create: `web/lib/race-import/catalog.ts`
- Test: `web/__tests__/lib/race-import/catalog.test.ts`

- [ ] **Step 1 : écrire les tests qui échouent**

`web/__tests__/lib/race-import/catalog.test.ts` (le mock `supabase-server` est posé d'emblée
car importer `catalog.ts` charge ce module ; il sera réellement utilisé en Task 3) :
```ts
jest.mock('@/lib/database/supabase-server', () => ({ createServiceClient: jest.fn() }))
import { createServiceClient } from '@/lib/database/supabase-server'
const mockCreate = createServiceClient as jest.Mock

import {
  normalizeSearchText, yearFromLivetrailUrl, harvestEventUrls,
  candidatesToRows, rankEventUrls,
} from '@/lib/race-import/catalog'
import type { RaceCandidate, RaceTarget } from '@/lib/race-import/find-race'

const target: RaceTarget = { name: 'Ultra Marin', date: '2026-06-26', distance: 177, elevation: 1430 }

function cand(over: Partial<RaceCandidate>): RaceCandidate {
  return {
    url: 'https://x.v3.livetrail.net/fr/2026', parserId: 'livetrail', raceName: 'Grand Raid',
    totalKm: 177, totalDplus: 1430, nbPoints: 14, waypoints: [], confident: false, ...over,
  }
}

describe('normalizeSearchText', () => {
  it('minuscule + sans accent', () => {
    expect(normalizeSearchText('Ultra-Marin ÉCOTRAIL')).toBe('ultra-marin ecotrail')
  })
})

describe('yearFromLivetrailUrl', () => {
  it('v3 /fr/2026/... → 2026', () => {
    expect(yearFromLivetrailUrl('https://ecotrail.v3.livetrail.net/fr/2026/races/80k')).toBe(2026)
  })
  it('parcours.php sans année → null', () => {
    expect(yearFromLivetrailUrl('https://tsj.livetrail.run/parcours.php?course=U')).toBeNull()
  })
})

describe('harvestEventUrls', () => {
  it('extrait les sous-domaines livetrail, exclut utmb.world, déduplique', () => {
    const html = `
      <a href="https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026">x</a>
      <a href="https://live.utmb.world/fr/races/abc">utmb</a>
      <a href="https://comblorane.v3.livetrail.net/fr/2026">y</a>
      <a href="https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026">dup</a>`
    const out = harvestEventUrls(html)
    expect(out).toContain('https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026')
    expect(out).toContain('https://comblorane.v3.livetrail.net/fr/2026')
    expect(out.some((u) => u.includes('utmb.world'))).toBe(false)
    expect(out.filter((u) => u.includes('ultramarin')).length).toBe(1)
  })
})

describe('candidatesToRows', () => {
  it('filtre livetrail, mappe les champs et dérive l\'année', () => {
    const rows = candidatesToRows([
      cand({ url: 'https://ultramarin.v3.livetrail.net/fr/2026', raceName: 'Grand Raid', totalKm: 177, totalDplus: 1430 }),
      cand({ parserId: 'utmb', url: 'https://x.utmb.world/fr/races/a' }),  // ignoré
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].platform).toBe('livetrail')
    expect(rows[0].event_slug).toBe('ultramarin')
    expect(rows[0].course_name).toBe('Grand Raid')
    expect(rows[0].edition_year).toBe(2026)
    expect(rows[0].total_km).toBe(177)
    expect(rows[0].source_url).toBe('https://ultramarin.v3.livetrail.net/fr/2026')
    expect(rows[0].search_text).toContain('grand raid')
    expect(rows[0].search_text).toContain('ultramarin')
  })
})

describe('rankEventUrls', () => {
  it('classe par proximité distance/D+, URLs distinctes', () => {
    const out = rankEventUrls(target, [
      { source_url: 'https://far.v3.livetrail.net/fr/2026', total_km: 50, total_dplus: 500 },
      { source_url: 'https://good.v3.livetrail.net/fr/2026', total_km: 177, total_dplus: 1430 },
      { source_url: 'https://good.v3.livetrail.net/fr/2026', total_km: 100, total_dplus: 780 }, // même event
    ])
    expect(out[0]).toBe('https://good.v3.livetrail.net/fr/2026')
    expect(out).toHaveLength(2)  // distinct par source_url
  })
})
```

- [ ] **Step 2 : lancer → échec attendu**

Run: `cd web && npx jest __tests__/lib/race-import/catalog.test.ts`
Expected: FAIL (module `catalog` inexistant).

- [ ] **Step 3 : écrire `catalog.ts` (helpers purs uniquement)**

```ts
// Catalogue LiveTrail : index léger (nom→événement) pour résoudre une course sans OpenAI,
// + accumulation passive, recherche et snapshot. AUCUN waypoint stocké (re-fetch frais).
// (Les imports createServiceClient / listLivetrailRaces sont ajoutés en Task 3 / Task 6,
//  quand les fonctions qui les utilisent sont écrites — évite les imports inutilisés.)
import 'server-only'
import type { RaceCandidate, RaceTarget } from './find-race'

// ── Helpers purs ──

// Minuscule + sans accent, pour les ILIKE.
export function normalizeSearchText(s: string): string {
  // ̀-ͯ = diacritiques combinants (séparés par NFD).
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// Année depuis une URL LiveTrail v3 (/fr/2026/...). null sinon.
export function yearFromLivetrailUrl(url: string): number | null {
  const m = url.match(/\/((?:19|20)\d{2})(?:\/|$)/)
  return m ? Number(m[1]) : null
}

function slugFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.split('.')[0] || null
  } catch {
    return null
  }
}

// Liens d'événement LiveTrail dans un HTML. Exclut utmb.world (déjà couvert par utmbParser).
export function harvestEventUrls(html: string): string[] {
  const re = /https?:\/\/[a-z0-9-]+\.(?:v3\.)?livetrail\.(?:net|run)[^\s"'<>)]*/gi
  const out: string[] = []
  const seen = new Set<string>()
  for (const m of Array.from(html.matchAll(re))) {
    const u = m[0]
    if (seen.has(u)) continue
    seen.add(u)
    out.push(u)
  }
  return out
}

export interface CatalogRow {
  platform: string
  event_slug: string
  event_name: string | null
  course_name: string | null
  edition_year: number | null
  total_km: number | null
  total_dplus: number | null
  source_url: string
  search_text: string
  last_seen_at: string
}

// Candidats résolus → lignes catalogue (pur, testable sans DB). Ne garde que LiveTrail.
export function candidatesToRows(candidates: RaceCandidate[]): CatalogRow[] {
  const now = new Date().toISOString()
  const rows: CatalogRow[] = []
  for (const c of candidates) {
    if (c.parserId !== 'livetrail') continue
    const slug = slugFromUrl(c.url)
    if (!slug) continue
    const courseName = c.raceName
    rows.push({
      platform: 'livetrail',
      event_slug: slug,
      event_name: null,
      course_name: courseName,
      edition_year: yearFromLivetrailUrl(c.url),
      total_km: c.totalKm,
      total_dplus: c.totalDplus,
      source_url: c.url,
      search_text: normalizeSearchText([courseName ?? '', slug].join(' ')),
      last_seen_at: now,
    })
  }
  return rows
}

export interface CatalogMatch {
  source_url: string
  total_km: number | null
  total_dplus: number | null
}

// Classe les lignes matchées par proximité distance/D+, renvoie les source_url DISTINCTS.
export function rankEventUrls(target: RaceTarget, rows: CatalogMatch[]): string[] {
  const scored = rows.map((r) => {
    const errKm = Math.abs((r.total_km ?? 0) - target.distance) / Math.max(target.distance, 1)
    const errD =
      target.elevation > 0 && r.total_dplus != null
        ? Math.abs(r.total_dplus - target.elevation) / target.elevation
        : 0.5
    return { url: r.source_url, score: errKm + errD }
  })
  scored.sort((a, b) => a.score - b.score)
  const out: string[] = []
  const seen = new Set<string>()
  for (const s of scored) {
    if (seen.has(s.url)) continue
    seen.add(s.url)
    out.push(s.url)
  }
  return out
}
```

- [ ] **Step 4 : lancer → succès**

Run: `cd web && npx jest __tests__/lib/race-import/catalog.test.ts`
Expected: PASS (5 describes).

- [ ] **Step 5 : typecheck + commit**

Run: `cd web && npx tsc --noEmit` (expect exit 0).
```bash
git add web/lib/race-import/catalog.ts web/__tests__/lib/race-import/catalog.test.ts
git commit -m "feat(catalog): helpers purs (normalize, year-from-url, harvest, rows, rank)"
```

---

## Task 3 : `catalog.ts` — couche DB (`accumulateCatalog` + `searchCatalogUrls`)

**Files:**
- Modify: `web/lib/race-import/catalog.ts`
- Test: `web/__tests__/lib/race-import/catalog.test.ts`

- [ ] **Step 1 : ajouter les tests DB (échec attendu)**

Le mock `supabase-server` + `mockCreate` existent déjà (posés en Task 2). Ajouter
`accumulateCatalog, searchCatalogUrls` à l'import depuis `@/lib/race-import/catalog`, puis
ajouter ces describes :
```ts
describe('accumulateCatalog', () => {
  afterEach(() => jest.clearAllMocks())

  it('upsert les lignes livetrail avec onConflict', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null })
    mockCreate.mockReturnValue({ from: jest.fn().mockReturnValue({ upsert }) })
    await accumulateCatalog([cand({ url: 'https://um.v3.livetrail.net/fr/2026', raceName: 'Grand Raid' })])
    expect(upsert).toHaveBeenCalledTimes(1)
    const [rows, opts] = upsert.mock.calls[0]
    expect(rows[0].event_slug).toBe('um')
    expect(opts.onConflict).toBe('platform,event_slug,course_name,edition_year')
  })

  it('aucun candidat livetrail → pas de client DB', async () => {
    await accumulateCatalog([cand({ parserId: 'utmb', url: 'https://x.utmb.world/fr/races/a' })])
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('searchCatalogUrls', () => {
  afterEach(() => jest.clearAllMocks())

  function mockSelect(data: unknown) {
    const limit = jest.fn().mockResolvedValue({ data, error: null })
    const or = jest.fn().mockReturnValue({ limit })
    const eq = jest.fn().mockReturnValue({ or })
    const select = jest.fn().mockReturnValue({ eq })
    mockCreate.mockReturnValue({ from: jest.fn().mockReturnValue({ select }) })
    return { select, eq, or }
  }

  it('tokenise le nom, classe et renvoie les URLs distinctes', async () => {
    const { or } = mockSelect([
      { source_url: 'https://good.v3.livetrail.net/fr/2026', total_km: 177, total_dplus: 1430 },
      { source_url: 'https://far.v3.livetrail.net/fr/2026', total_km: 50, total_dplus: 500 },
    ])
    const out = await searchCatalogUrls(target)
    expect(or).toHaveBeenCalledWith('search_text.ilike.%ultra%,search_text.ilike.%marin%')
    expect(out[0]).toBe('https://good.v3.livetrail.net/fr/2026')
  })

  it('nom sans token ≥3 → [] sans requête', async () => {
    const out = await searchCatalogUrls({ ...target, name: 'a b' })
    expect(out).toEqual([])
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('erreur DB → []', async () => {
    const limit = jest.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
    mockCreate.mockReturnValue({ from: jest.fn().mockReturnValue({
      select: () => ({ eq: () => ({ or: () => ({ limit }) }) }) }) })
    expect(await searchCatalogUrls(target)).toEqual([])
  })
})
```

- [ ] **Step 2 : lancer → échec attendu**

Run: `cd web && npx jest __tests__/lib/race-import/catalog.test.ts`
Expected: FAIL (`accumulateCatalog`/`searchCatalogUrls` non exportées).

- [ ] **Step 3 : implémenter la couche DB dans `catalog.ts`**

Ajouter en haut de `catalog.ts` (sous `import 'server-only'`) :
```ts
import { createServiceClient } from '@/lib/database/supabase-server'
```
Puis ajouter à la fin de `catalog.ts` :
```ts
// ── Couche DB (service role) ──

const SEARCH_TOP_K = 5

// Accumulation passive : upsert des candidats LiveTrail résolus. Best-effort.
export async function accumulateCatalog(candidates: RaceCandidate[]): Promise<void> {
  const rows = candidatesToRows(candidates)
  if (rows.length === 0) return
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('livetrail_catalog')
    .upsert(rows, { onConflict: 'platform,event_slug,course_name,edition_year' })
  if (error) console.warn('[catalog] upsert error:', error.message)
}

// Recherche catalogue : tokens du nom → ILIKE → URLs d'événement classées (sans OpenAI).
export async function searchCatalogUrls(target: RaceTarget): Promise<string[]> {
  // Tokens alphanumériques (évite toute injection dans le filtre PostgREST .or()).
  const tokens = normalizeSearchText(target.name)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3)
  if (tokens.length === 0) return []

  const supabase = createServiceClient()
  const orFilter = tokens.map((t) => `search_text.ilike.%${t}%`).join(',')
  const { data, error } = await supabase
    .from('livetrail_catalog')
    .select('source_url, total_km, total_dplus')
    .eq('platform', 'livetrail')
    .or(orFilter)
    .limit(100)
  if (error || !data) return []
  return rankEventUrls(target, data as CatalogMatch[]).slice(0, SEARCH_TOP_K)
}
```

- [ ] **Step 4 : lancer → succès**

Run: `cd web && npx jest __tests__/lib/race-import/catalog.test.ts`
Expected: PASS (helpers purs + DB). NB : le test `or` attend l'ordre des tokens `ultra,marin` (issu de « Ultra Marin »).

- [ ] **Step 5 : typecheck + commit**

Run: `cd web && npx tsc --noEmit` (expect exit 0).
```bash
git add web/lib/race-import/catalog.ts web/__tests__/lib/race-import/catalog.test.ts
git commit -m "feat(catalog): accumulateCatalog + searchCatalogUrls (service role, best-effort)"
```

---

## Task 4 : extraire `searchRaceUrls` → `search-openai.ts`

**But :** isoler l'appel OpenAI pour pouvoir le mocker dans les tests de `findRaceCandidates` (Task 5). Refacto pure, comportement inchangé.

**Files:**
- Create: `web/lib/race-import/search-openai.ts`
- Modify: `web/lib/race-import/find-race.ts`

- [ ] **Step 1 : vérifier qu'aucun autre module n'importe `searchRaceUrls`**

Run: `cd web && npx tsc --noEmit` puis chercher les imports : `searchRaceUrls` n'est utilisé que dans `find-race.ts` (interne) et n'est pas importé ailleurs (la route `find/route.ts` importe `findRaceCandidates`). Si un autre import existe, le rediriger vers `./search-openai` à l'étape 3.

- [ ] **Step 2 : créer `search-openai.ts`**

Couper de `find-race.ts` le bloc `export async function searchRaceUrls(...) {...}` ET l'import OpenAI du haut du fichier, et les coller dans `web/lib/race-import/search-openai.ts` :
```ts
// Recherche web OpenAI → URLs candidates (citations + filet regex). Isolé pour testabilité.
import 'server-only'
import OpenAI from 'openai'
import type { RaceTarget } from './find-race'

// Note : web_search_options / annotations pas toujours typés selon la version du SDK → cast any localisés.
export async function searchRaceUrls(target: RaceTarget): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY absente côté serveur')
  const year = target.date.slice(0, 4)
  const client = new OpenAI({ apiKey })
  const prompt =
    `Trouve les pages web de la course de trail « ${target.name} » ` +
    `(édition ${year}, environ ${target.distance} km et ${target.elevation} m de D+). ` +
    `Donne en priorité : (1) sa page de chronométrage LiveTrail ` +
    `(livetrail.net / livetrail.run) ou UTMB (utmb.world), ET (2) son site officiel ` +
    `ou sa page de résultats. Liste toutes les URLs directes pertinentes.`
  const res = await client.chat.completions.create({
    model: 'gpt-4o-search-preview',
    web_search_options: { search_context_size: 'high' },
    messages: [{ role: 'user', content: prompt }],
  } as any)
  const msg: any = res.choices[0]?.message
  const urls: string[] = []
  for (const a of msg?.annotations ?? []) {
    if (a?.type === 'url_citation' && a.url_citation?.url) urls.push(a.url_citation.url)
  }
  const content: string = msg?.content ?? ''
  for (const m of Array.from(content.matchAll(/https?:\/\/[^\s)\]"'<>]+/g))) urls.push(m[0])
  return urls
}
```
(Reprendre **exactement** le corps actuel de `searchRaceUrls` dans find-race.ts ; ci-dessus = la version courante.)

- [ ] **Step 3 : dans `find-race.ts`, importer depuis `./search-openai`**

Supprimer l'`import OpenAI from 'openai'` devenu inutile. Ajouter en haut :
```ts
import { searchRaceUrls } from './search-openai'
```
`findRaceCandidates` continue d'appeler `searchRaceUrls(target)` (signature identique).

- [ ] **Step 4 : typecheck + suite import + commit**

Run: `cd web && npx tsc --noEmit` (expect exit 0).
Run: `cd web && npx jest __tests__/lib/race-import` (expect toutes PASS — refacto sans changement de comportement).
```bash
git add web/lib/race-import/search-openai.ts web/lib/race-import/find-race.ts
git commit -m "refactor(race-import): extrait searchRaceUrls dans search-openai.ts (testabilite)"
```

---

## Task 5 : `find-race.ts` — onglet Auto à deux étages + accumulation

**Files:**
- Modify: `web/lib/race-import/find-race.ts`
- Test: `web/__tests__/lib/race-import/find-race.test.ts`

- [ ] **Step 1 : ajouter les tests `findRaceCandidates` (échec attendu)**

En HAUT de `find-race.test.ts` (avec les autres `jest.mock`), ajouter :
```ts
jest.mock('@/lib/race-import/catalog', () => ({
  searchCatalogUrls: jest.fn(),
  accumulateCatalog: jest.fn(async () => {}),
}))
jest.mock('@/lib/race-import/search-openai', () => ({
  searchRaceUrls: jest.fn(),
}))
```
Ajouter aux imports applicatifs :
```ts
import { findRaceCandidates } from '@/lib/race-import/find-race'
import { searchCatalogUrls, accumulateCatalog } from '@/lib/race-import/catalog'
import { searchRaceUrls } from '@/lib/race-import/search-openai'
const mockSearchCatalog = searchCatalogUrls as jest.Mock
const mockAccumulate = accumulateCatalog as jest.Mock
const mockSearchOpenai = searchRaceUrls as jest.Mock
```
Puis ce describe (réutilise `mockFetchLivetrail` + `LIVETRAIL_XML` déjà présents dans le fichier) :
```ts
describe('findRaceCandidates — catalogue d\'abord', () => {
  beforeEach(() => { mockSearchCatalog.mockReset(); mockAccumulate.mockReset(); mockSearchOpenai.mockReset() })
  afterEach(() => jest.restoreAllMocks())

  it('hit catalogue confident → renvoie sans appeler OpenAI', async () => {
    mockFetchLivetrail()
    mockSearchCatalog.mockResolvedValue(['https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026'])
    const target = { name: 'Ultra Marin', date: '2026-06-26', distance: 177, elevation: 1430 }
    const out = await findRaceCandidates(target)
    expect(out[0].raceName).toBe('Grand Raid')
    expect(out[0].confident).toBe(true)
    expect(mockSearchOpenai).not.toHaveBeenCalled()
  })

  it('catalogue vide → fallback OpenAI + accumulation', async () => {
    mockFetchLivetrail()
    mockSearchCatalog.mockResolvedValue([])
    mockSearchOpenai.mockResolvedValue(['https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026'])
    const target = { name: 'Ultra Marin', date: '2026-06-26', distance: 177, elevation: 1430 }
    const out = await findRaceCandidates(target)
    expect(mockSearchOpenai).toHaveBeenCalledTimes(1)
    expect(out[0].raceName).toBe('Grand Raid')
    expect(mockAccumulate).toHaveBeenCalledTimes(1)
    expect((mockAccumulate.mock.calls[0][0] as any[])[0].raceName).toBe('Grand Raid')
  })

  it('hit catalogue NON confident → fallback OpenAI', async () => {
    mockFetchLivetrail()
    mockSearchCatalog.mockResolvedValue(['https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026'])
    mockSearchOpenai.mockResolvedValue([])
    const target = { name: 'Ultra Marin', date: '2026-06-26', distance: 250, elevation: 9000 } // hors tolérance
    await findRaceCandidates(target)
    expect(mockSearchOpenai).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2 : lancer → échec attendu**

Run: `cd web && npx jest __tests__/lib/race-import/find-race.test.ts`
Expected: FAIL (`findRaceCandidates` actuel n'appelle ni `searchCatalogUrls` ni `accumulateCatalog`).

- [ ] **Step 3 : réécrire `findRaceCandidates`**

Dans `find-race.ts`, ajouter l'import :
```ts
import { searchCatalogUrls, accumulateCatalog } from './catalog'
```
Remplacer la fonction `findRaceCandidates` existante par :
```ts
// Orchestrateur : catalogue local d'abord (gratuit), sinon recherche OpenAI + accumulation.
export async function findRaceCandidates(target: RaceTarget): Promise<RaceCandidate[]> {
  // Tier 1 : catalogue local. Court-circuite OpenAI si un candidat est confident.
  try {
    const catalogUrls = await searchCatalogUrls(target)
    if (catalogUrls.length > 0) {
      const ranked = await resolveCandidates(target, catalogUrls)
      if (ranked.length > 0 && ranked[0].confident) return ranked
    }
  } catch (err) {
    console.warn('[find-race] tier catalogue ignoré:', (err as Error).message)
  }

  // Tier 2 : recherche OpenAI (inchangé) + accumulation passive best-effort.
  const rawUrls = await searchRaceUrls(target)
  const ranked = await resolveCandidates(target, rawUrls)
  try {
    await accumulateCatalog(ranked)
  } catch {
    /* accumulation best-effort : ne casse jamais la résolution */
  }
  return ranked
}
```

- [ ] **Step 4 : lancer → succès**

Run: `cd web && npx jest __tests__/lib/race-import/find-race.test.ts`
Expected: PASS (nouveaux `findRaceCandidates` + tous les `resolveCandidates`/`rank`/`harvest` existants — inchangés car `resolveCandidates` n'a pas bougé).

- [ ] **Step 5 : typecheck + commit**

Run: `cd web && npx tsc --noEmit` (expect exit 0).
```bash
git add web/lib/race-import/find-race.ts web/__tests__/lib/race-import/find-race.test.ts
git commit -m "feat(catalog): onglet Auto a deux etages (catalogue d'abord, fallback OpenAI + accumulation)"
```

---

## Task 6 : cron snapshot `livetrail-catalog`

**Files:**
- Modify: `web/lib/race-import/catalog.ts` (ajoute `runCatalogSnapshot`)
- Test: `web/__tests__/lib/race-import/catalog.test.ts`
- Create: `web/app/api/cron/livetrail-catalog/route.ts`

- [ ] **Step 1 : VÉRIF préalable — `/fr/events` est-il exploitable en `fetch()` brut ?**

Run:
```bash
cd web && node -e "fetch('https://web.livetrail.net/fr/events',{headers:{'User-Agent':'TrailCockpitBot/1.0'}}).then(r=>r.text()).then(h=>{const m=h.match(/[a-z0-9-]+\.(?:v3\.)?livetrail\.(?:net|run)/gi)||[];console.log('liens livetrail trouves:',[...new Set(m)].slice(0,10))})"
```
- **Si la liste contient des sous-domaines** (ex. `comblorane.v3.livetrail.net`) → continuer (le HTML est exploitable côté serveur).
- **Si la liste est vide** (page rendue 100 % client) → **NE PAS** implémenter le snapshot via `fetch()`. Marquer Task 6 comme **différée** dans `tasks/backlog.md` (« snapshot LiveTrail : /fr/events rendu client, nécessite fetch rendu ou endpoint API ») et **s'arrêter ici** : l'accumulation passive (Tasks 1-5) est déjà un incrément complet et fonctionnel. Signaler à Franck.

- [ ] **Step 2 : ajouter le test `runCatalogSnapshot` (échec attendu)**

Dans `catalog.test.ts`, ajouter (mocke `listLivetrailRaces` au niveau module, en haut du fichier avec les autres `jest.mock`) :
```ts
jest.mock('@/lib/race-import/sources/livetrail', () => ({
  listLivetrailRaces: jest.fn(),
}))
import { listLivetrailRaces } from '@/lib/race-import/sources/livetrail'
const mockList = listLivetrailRaces as jest.Mock
```
Ajouter `runCatalogSnapshot` à l'import depuis `@/lib/race-import/catalog`, puis :
```ts
describe('runCatalogSnapshot', () => {
  afterEach(() => jest.restoreAllMocks())

  it('fetch /fr/events, énumère les événements et upsert', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '<a href="https://um.v3.livetrail.net/fr/2026">x</a>',
    } as any)
    mockList.mockResolvedValue([
      { raceName: 'Grand Raid', data: { raceName: null, editionYear: null, waypoints: [
        { orderIndex: 0, name: 'D', km: 0, kmInter: null, dPlus: 0, dMoins: 0, cutoffRaw: null, cutoffKind: null, type: 'depart', supplies: [], targetOverrideSec: null },
        { orderIndex: 1, name: 'A', km: 177, kmInter: null, dPlus: 1430, dMoins: 0, cutoffRaw: null, cutoffKind: null, type: 'arrivee', supplies: [], targetOverrideSec: null },
      ] } },
    ])
    const upsert = jest.fn().mockResolvedValue({ error: null })
    mockCreate.mockReturnValue({ from: jest.fn().mockReturnValue({ upsert }) })

    const out = await runCatalogSnapshot()
    expect(out.events).toBe(1)
    expect(upsert).toHaveBeenCalled()
    expect(upsert.mock.calls[0][0][0].event_slug).toBe('um')
    expect(upsert.mock.calls[0][0][0].total_km).toBe(177)
  })
})
```

- [ ] **Step 3 : lancer → échec attendu**

Run: `cd web && npx jest __tests__/lib/race-import/catalog.test.ts`
Expected: FAIL (`runCatalogSnapshot` non exportée).

- [ ] **Step 4 : implémenter `runCatalogSnapshot` dans `catalog.ts`**

Ajouter en haut de `catalog.ts` (avec les autres imports) :
```ts
import { listLivetrailRaces } from './sources/livetrail'
import type { ExtractedRaceData } from '@/types/plan'
```
Puis ajouter à la fin de `catalog.ts` :
```ts
const SNAPSHOT_MAX_EVENTS = 30
const SNAPSHOT_UA = 'TrailCockpitBot/1.0 (+https://trailcockpit.run)'

// Événement (raceName + waypoints) → candidats LiveTrail réutilisables par accumulateCatalog.
function racesToCandidates(
  url: string,
  races: Array<{ raceName: string | null; data: ExtractedRaceData }>,
): RaceCandidate[] {
  const out: RaceCandidate[] = []
  for (const r of races) {
    const wps = r.data.waypoints
    if (wps.length === 0) continue
    const last = wps[wps.length - 1]
    out.push({
      url, parserId: 'livetrail', raceName: r.raceName,
      totalKm: last.km, totalDplus: last.dPlus, nbPoints: wps.length,
      waypoints: wps, confident: false,
    })
  }
  return out
}

// Snapshot glissant : lit /fr/events, énumère les événements à venir et upsert le catalogue.
// Séquentiel + cap (poli). User-Agent identifiable. Best-effort par événement.
export async function runCatalogSnapshot(): Promise<{ events: number; upserted: number }> {
  const res = await fetch('https://web.livetrail.net/fr/events', {
    headers: { 'User-Agent': SNAPSHOT_UA },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} sur /fr/events`)
  const html = await res.text()
  const eventUrls = harvestEventUrls(html).slice(0, SNAPSHOT_MAX_EVENTS)

  let upserted = 0
  for (const url of eventUrls) {
    try {
      const races = await listLivetrailRaces(url)
      const candidates = racesToCandidates(url, races)
      await accumulateCatalog(candidates)
      upserted += candidates.length
    } catch {
      /* événement injoignable → ignoré */
    }
  }
  return { events: eventUrls.length, upserted }
}
```

- [ ] **Step 5 : lancer → succès**

Run: `cd web && npx jest __tests__/lib/race-import/catalog.test.ts`
Expected: PASS (helpers + DB + snapshot).

- [ ] **Step 6 : créer la route cron**

`web/app/api/cron/livetrail-catalog/route.ts` :
```ts
import { NextResponse } from 'next/server'
import { runCatalogSnapshot } from '@/lib/race-import/catalog'
import '@/lib/race-import/sources/livetrail' // side-effect: registerParser (cohérence)

export const runtime = 'nodejs'
export const maxDuration = 60

// Snapshot glissant du catalogue LiveTrail. Déclenché en externe ~hebdo (Bearer CRON_SECRET).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await runCatalogSnapshot()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[cron livetrail-catalog]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
```

- [ ] **Step 7 : typecheck + commit**

Run: `cd web && npx tsc --noEmit` (expect exit 0).
Run: `cd web && npx jest __tests__/lib/race-import` (expect toutes PASS).
```bash
git add web/lib/race-import/catalog.ts web/__tests__/lib/race-import/catalog.test.ts web/app/api/cron/livetrail-catalog/route.ts
git commit -m "feat(catalog): cron snapshot livetrail-catalog (/fr/events -> enumere -> upsert)"
```

- [ ] **Step 8 : rappel déclencheur**

Signaler à Franck : ajouter un trigger hebdo (GitHub Action ou `vercel.json > crons`) vers `GET /api/cron/livetrail-catalog` avec `Authorization: Bearer $CRON_SECRET`, comme les crons existants.

---

## Vérification de fin

- [ ] `cd web && npx tsc --noEmit` → exit 0.
- [ ] `cd web && npx jest __tests__/lib/race-import` → toutes PASS.
- [ ] Migration 038 collée dans Supabase (sinon catalogue vide → fallback OpenAI, sans casse).
- [ ] Vérif manuelle (après déploiement + migration) :
  1. Onglet Auto sur une course déjà résolue une fois → 2ᵉ recherche **instantanée** (pas d'attente OpenAI), candidat correct.
  2. Course jamais vue → fallback OpenAI fonctionne comme avant.
  3. `GET /api/cron/livetrail-catalog` (avec CRON_SECRET) → `{ events, upserted }` > 0 ; quelques lignes dans `livetrail_catalog`.

## Notes de drift / coordination

- **Couture `find-race.ts` avec Fraîcheur** : leur spec liste `find-race` parmi les producteurs d'`ExtractedRaceData` à étendre (`editionDate`/`dateExplicit`). En l'état `find-race.ts` **consomme** `ExtractedRaceData` (via `extractWaypoints`) mais n'en **construit** pas → il ne devrait pas nécessiter ces champs. **Si** les deux sessions éditent `find-race.ts`, coordonner l'ordre de merge (ce plan touche `findRaceCandidates` + l'import `searchRaceUrls`/`catalog` ; Fraîcheur ne devrait toucher que d'éventuels sites de construction d'`ExtractedRaceData`, inexistants ici).
- **`edition_year`** dérivé localement de l'URL (`yearFromLivetrailUrl`). À consolider avec `extractYearFromLivetrailUrl` de Fraîcheur une fois livré (même regex).
- **`event_name`** non peuplé en v1 (toujours `null`) ; `search_text` couvre `course_name` + `slug`. Extraire les noms d'événement depuis `/fr/events` = suite possible.
- **Snapshot SPA** : si l'étape de vérif Task 6 échoue (page rendue client), l'accumulation passive seule (Tasks 1-5) reste un incrément livrable ; snapshot → backlog.
- Aucune autre table que `livetrail_catalog` touchée. `resolveCandidates` reste pur.
