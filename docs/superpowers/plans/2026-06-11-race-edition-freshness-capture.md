# Capture de l'édition & fraîcheur des tableaux — Lot 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tracer à quelle édition se rapporte chaque tableau de course importé, et afficher un statut de fraîcheur (confirmé / provisoire N-1 / non identifié) corrigeable à la main.

**Architecture:** Nouvelle table 1:1 `race_tableau_meta` (provenance + fraîcheur). Détection multi-signaux par source (LiveTrail : jour-du-mois XML + année d'URL ; UTMB : `startDateIso` du JSON in-page ; LLM : `edition_date`/`date_explicit` du prompt). Fonction pure `computeFreshness` recoupée à la date de la fiche. Le badge se lit depuis la meta sur le détail course ; la table de validation expose un `edition_year` éditable.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (SSR + RLS), Jest. Spec : `docs/superpowers/specs/2026-06-11-race-edition-freshness-capture-design.md`.

**Conventions repo :** tests jest lancés depuis `web/` (`cd web` puis `npx jest …`). `tsc --noEmit` + `eslint` autoritatifs en local (pas de `next build` si un `next dev` tourne). Migrations Supabase **non auto-appliquées**. ~50 tests jest échouent en pré-existant (useI18n hors provider) — lancer uniquement les suites pertinentes.

---

## Task 1 : Migration `037_race_tableau_meta`

**Files:**
- Create: `web/supabase/migrations/037_race_tableau_meta.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- Migration: 037 - race_tableau_meta
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

- [ ] **Step 2 : Vérifier la cohérence**

Comparer aux conventions de `web/supabase/migrations/025_race_waypoints.sql` (FK `on delete cascade`, RLS via `exists … athlete_id = auth.uid()`). Pas de test automatisé (SQL).

- [ ] **Step 3 : Commit**

```bash
git add web/supabase/migrations/037_race_tableau_meta.sql
git commit -m "feat(race-import): migration 037 race_tableau_meta (édition + provenance)"
```

> **Rappel post-merge :** coller ce SQL dans le Dashboard Supabase (non auto-appliqué).

---

## Task 2 : Types socle + fonction pure `computeFreshness`

**Files:**
- Modify: `web/types/plan.ts` (ajouts additifs, non cassants)
- Create: `web/lib/race-import/freshness.ts`
- Test: `web/__tests__/lib/race-import/freshness.test.ts`

`computeFreshness` doit rester **client-safe** (réutilisée dans la table de validation, Task 8) : aucun `server-only`, aucun `node:`.

- [ ] **Step 1 : Ajouter les types socle dans `web/types/plan.ts`**

Après le bloc `ExtractedRaceData` (fin de fichier), ajouter :

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
```

- [ ] **Step 2 : Écrire le test `freshness.test.ts`**

```ts
import { computeFreshness, type DetectedEdition } from '@/lib/race-import/freshness'

const base: DetectedEdition = {
  editionYear: null, editionDate: null, dateExplicit: false, startDayOfMonth: null,
}

describe('computeFreshness', () => {
  it('année détectée == cible, jour inconnu → confirmed', () => {
    const r = computeFreshness({ ...base, editionYear: 2026 }, '2026-06-28')
    expect(r.freshnessStatus).toBe('confirmed')
    expect(r.editionYear).toBe(2026)
  })

  it('editionDate explicite même année → confirmed (jour ignoré)', () => {
    const r = computeFreshness({ ...base, editionDate: '2026-08-28', dateExplicit: true }, '2026-08-29')
    expect(r.freshnessStatus).toBe('confirmed')
    expect(r.editionYear).toBe(2026)
    expect(r.editionDate).toBe('2026-08-28')
  })

  it('année détectée < cible → provisional_previous_edition (garde l\'année réelle)', () => {
    const r = computeFreshness({ ...base, editionYear: 2025 }, '2026-06-28')
    expect(r.freshnessStatus).toBe('provisional_previous_edition')
    expect(r.editionYear).toBe(2025)
  })

  it('année détectée > cible → unknown', () => {
    const r = computeFreshness({ ...base, editionYear: 2027 }, '2026-06-28')
    expect(r.freshnessStatus).toBe('unknown')
  })

  it('aucune année détectée → unknown', () => {
    const r = computeFreshness({ ...base }, '2026-06-28')
    expect(r.freshnessStatus).toBe('unknown')
    expect(r.editionYear).toBeNull()
  })

  it('même année + jour XML qui concorde → confirmed + editionDate reconstruite', () => {
    const r = computeFreshness({ ...base, editionYear: 2026, startDayOfMonth: 28 }, '2026-06-28')
    expect(r.freshnessStatus).toBe('confirmed')
    expect(r.editionDate).toBe('2026-06-28')
  })

  it('même année + jour XML différent → unknown (incohérent)', () => {
    const r = computeFreshness({ ...base, editionYear: 2026, startDayOfMonth: 14 }, '2026-06-28')
    expect(r.freshnessStatus).toBe('unknown')
    expect(r.editionDate).toBeNull()
  })

  it('date fiche non parsable → unknown', () => {
    const r = computeFreshness({ ...base, editionYear: 2026 }, '')
    expect(r.freshnessStatus).toBe('unknown')
  })
})
```

- [ ] **Step 3 : Lancer le test (échoue)**

Run: `cd web && npx jest __tests__/lib/race-import/freshness.test.ts`
Expected: FAIL (`Cannot find module '@/lib/race-import/freshness'`).

- [ ] **Step 4 : Implémenter `web/lib/race-import/freshness.ts`**

```ts
// Fraîcheur d'un tableau importé : compare l'édition détectée à l'année de la fiche.
// Fonction PURE et client-safe (réutilisée dans la table de validation) — pas de server-only.
import type { FreshnessStatus } from '@/types/plan'

export interface DetectedEdition {
  editionYear: number | null
  editionDate: string | null        // ISO YYYY-MM-DD si connu (signal fort)
  dateExplicit: boolean
  startDayOfMonth: number | null    // signal indépendant (LiveTrail)
}

export interface FreshnessResult {
  editionYear: number | null
  editionDate: string | null
  freshnessStatus: FreshnessStatus
}

function partsOf(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null
}

export function computeFreshness(detected: DetectedEdition, ficheDateISO: string): FreshnessResult {
  const fiche = partsOf(ficheDateISO)
  const detYear = detected.editionDate ? partsOf(detected.editionDate)?.y ?? null : detected.editionYear

  // Année cible ou année détectée inexploitable → unknown.
  if (fiche == null || detYear == null) {
    return { editionYear: detYear, editionDate: detected.editionDate, freshnessStatus: 'unknown' }
  }

  if (detYear < fiche.y) {
    return { editionYear: detYear, editionDate: detected.editionDate, freshnessStatus: 'provisional_previous_edition' }
  }
  if (detYear > fiche.y) {
    return { editionYear: detYear, editionDate: detected.editionDate, freshnessStatus: 'unknown' }
  }

  // detYear === année cible.
  // Date explicite (UTMB / LLM) = signal fort → confirmed, recoupement jour ignoré.
  if (detected.editionDate) {
    return { editionYear: detYear, editionDate: detected.editionDate, freshnessStatus: 'confirmed' }
  }
  // Jour XML connu mais différent de la fiche → incohérent → unknown.
  if (detected.startDayOfMonth != null && detected.startDayOfMonth !== fiche.d) {
    return { editionYear: detYear, editionDate: null, freshnessStatus: 'unknown' }
  }
  // Jour concorde ou inconnu → confirmed. Reconstruit editionDate si le jour concorde.
  const editionDate =
    detected.startDayOfMonth != null && detected.startDayOfMonth === fiche.d
      ? `${fiche.y}-${String(fiche.m).padStart(2, '0')}-${String(fiche.d).padStart(2, '0')}`
      : null
  return { editionYear: detYear, editionDate, freshnessStatus: 'confirmed' }
}
```

- [ ] **Step 5 : Lancer les tests (passent) + tsc**

Run: `cd web && npx jest __tests__/lib/race-import/freshness.test.ts && npx tsc --noEmit`
Expected: PASS, 0 erreur tsc.

- [ ] **Step 6 : Commit**

```bash
git add web/types/plan.ts web/lib/race-import/freshness.ts web/__tests__/lib/race-import/freshness.test.ts
git commit -m "feat(race-import): computeFreshness pur + types FreshnessStatus/RaceTableauMeta"
```

---

## Task 3 : Étendre `ExtractedRaceData` (4 champs de détection) + propager les défauts

But : ajouter `editionDate`, `dateExplicit`, `startDayOfMonth`, `startTimeRaw` à `ExtractedRaceData`, avec valeurs **neutres** partout, en gardant `tsc` + `jest` verts. Les valeurs réelles arrivent aux Tasks 4/5/6.

**Files:**
- Modify: `web/types/plan.ts`
- Modify: `web/lib/race-import/schema.ts`
- Modify: `web/lib/race-import/sources/livetrail.ts`
- Modify: `web/lib/race-import/sources/utmb.ts`
- Modify: `web/__tests__/lib/race-import/find-race.test.ts` (mock `extractWaypoints`)
- Test : suites existantes `schema`, `livetrail`, `utmb`, `find-race`

- [ ] **Step 1 : Étendre `ExtractedRaceData` dans `web/types/plan.ts`**

```ts
export interface ExtractedRaceData {
  raceName: string | null
  editionYear: number | null
  editionDate: string | null        // ISO YYYY-MM-DD si une date complète détectée
  dateExplicit: boolean             // true si année/date lue explicitement dans la source
  startDayOfMonth: number | null    // signal LiveTrail (jour-du-mois du départ), null ailleurs
  startTimeRaw: string | null       // signal LiveTrail (heure de départ 'HH:MM'), null ailleurs
  waypoints: Array<Omit<RaceWaypoint, 'id' | 'raceId'>>
}
```

- [ ] **Step 2 : Propager dans `schema.ts`**

Dans `rawToExtractedRaceData`, ajouter les 4 champs (défauts — le schema LLM les remplira en Task 6) :

```ts
export function rawToExtractedRaceData(raw: RawExtraction): ExtractedRaceData {
  return {
    raceName: raw.race_name,
    editionYear: raw.edition_year,
    editionDate: null,
    dateExplicit: false,
    startDayOfMonth: null,
    startTimeRaw: null,
    waypoints: raw.waypoints.map((w) => ({ /* inchangé */
      orderIndex: w.order_index, name: w.name, km: w.km, kmInter: w.km_inter,
      dPlus: w.d_plus, dMoins: w.d_moins, cutoffRaw: w.cutoff_raw,
      cutoffKind: w.cutoff_raw === null ? null : (w.cutoff_kind as CutoffKind),
      type: w.type, supplies: [], targetOverrideSec: null,
    })),
  }
}
```

Dans `validateExtractedRaceData`, le `return` final propage les 4 champs :

```ts
  return {
    raceName: data.raceName,
    editionYear: data.editionYear,
    editionDate: data.editionDate,
    dateExplicit: data.dateExplicit,
    startDayOfMonth: data.startDayOfMonth,
    startTimeRaw: data.startTimeRaw,
    waypoints: reindexed,
  }
```

(Le early-return `if (wps.length === 0) return data` renvoie déjà `data` complet — OK.)

- [ ] **Step 3 : Défauts dans les parsers**

`livetrail.ts` — `mapPointsBlock` :
```ts
  return validateExtractedRaceData({
    raceName: null, editionYear: null, editionDate: null, dateExplicit: false,
    startDayOfMonth: null, startTimeRaw: null, waypoints,
  })
```

`utmb.ts` — `parse` :
```ts
    return validateExtractedRaceData({
      raceName: null, editionYear: null, editionDate: null, dateExplicit: false,
      startDayOfMonth: null, startTimeRaw: null, waypoints,
    })
```

- [ ] **Step 4 : Réparer les mocks de test**

`find-race.test.ts` — les deux `mockExtract.mockResolvedValue({...})` doivent inclure les nouveaux champs :
```ts
    mockExtract.mockResolvedValue({
      raceName: 'Ultra Marin', editionYear: null,
      editionDate: null, dateExplicit: false, startDayOfMonth: null, startTimeRaw: null,
      waypoints: [ /* inchangé */ ],
    })
```
(et l'autre `mockResolvedValue({ raceName: null, editionYear: null, … waypoints: [] })` de même.)

- [ ] **Step 5 : Vérifier tsc + suites concernées**

Run:
```bash
cd web && npx tsc --noEmit && npx jest __tests__/lib/race-import/schema __tests__/lib/race-import/livetrail __tests__/lib/race-import/utmb __tests__/lib/race-import/find-race
```
Expected: 0 erreur tsc, suites vertes. Si une suite construit un `ExtractedRaceData` attendu en dur, y ajouter les 4 champs.

- [ ] **Step 6 : Commit**

```bash
git add -A
git commit -m "refactor(race-import): champs édition/détection sur ExtractedRaceData (défauts neutres)"
```

---

## Task 4 : Détection LiveTrail (jour-du-mois XML + année d'URL)

**Files:**
- Modify: `web/lib/race-import/sources/livetrail.ts`
- Test: `web/__tests__/lib/race-import/livetrail-edition.test.ts` (create)

Constat source réel : `<pt t="D" … hp="12-19:10">` (départ) → jour 12, heure 19:10. L'URL v3 porte l'année (`/fr/2026/`). `parcours.php?course=` n'a pas d'année.

- [ ] **Step 1 : Écrire le test**

```ts
import { parseLivetrailStart, extractYearFromLivetrailUrl } from '@/lib/race-import/sources/livetrail'

describe('parseLivetrailStart', () => {
  it('DD-HH:MM → { day, time }', () => {
    expect(parseLivetrailStart('12-19:10')).toEqual({ day: 12, time: '19:10' })
  })
  it('vide / invalide → null', () => {
    expect(parseLivetrailStart('')).toBeNull()
    expect(parseLivetrailStart(undefined)).toBeNull()
    expect(parseLivetrailStart('bogus')).toBeNull()
  })
})

describe('extractYearFromLivetrailUrl', () => {
  it('URL v3 avec /YYYY/ → année', () => {
    expect(extractYearFromLivetrailUrl('https://tsj.v3.livetrail.net/fr/2026/races/Ultra')).toBe(2026)
  })
  it('parcours.php sans année → null', () => {
    expect(extractYearFromLivetrailUrl('https://tsj.livetrail.run/parcours.php?course=Ultra')).toBeNull()
  })
  it('URL invalide → null', () => {
    expect(extractYearFromLivetrailUrl('pas-une-url')).toBeNull()
  })
})
```

- [ ] **Step 2 : Lancer (échoue)**

Run: `cd web && npx jest __tests__/lib/race-import/livetrail-edition.test.ts`
Expected: FAIL (exports inexistants).

- [ ] **Step 3 : Implémenter les helpers + câbler**

Dans `livetrail.ts`, ajouter (exportés) :

```ts
// "DD-HH:MM" (format hp/hd LiveTrail) → jour-du-mois + heure de départ.
export function parseLivetrailStart(
  hp: string | undefined,
): { day: number; time: string } | null {
  if (!hp) return null
  const m = /^(\d{1,2})-(\d{2}:\d{2})$/.exec(hp.trim())
  if (!m) return null
  const day = Number(m[1])
  if (day < 1 || day > 31) return null
  return { day, time: m[2] }
}

// Année d'édition depuis le path d'une URL LiveTrail v3 (/fr/2026/...). null sinon.
export function extractYearFromLivetrailUrl(url: string): number | null {
  let path: string
  try { path = new URL(url).pathname } catch { return null }
  const m = path.match(/\/(20\d{2})(?:\/|$)/)
  return m ? Number(m[1]) : null
}
```

Dans `mapPointsBlock`, après avoir construit `waypoints`, dériver le départ depuis `pts[0]` :
```ts
  const start = parseLivetrailStart(pts[0]?.['@_hp'])
  return validateExtractedRaceData({
    raceName: null, editionYear: null, editionDate: null, dateExplicit: false,
    startDayOfMonth: start?.day ?? null,
    startTimeRaw: start?.time ?? null,
    waypoints,
  })
```

> Le type `RawPt` ne déclare pas `@_hp` : ajouter `'@_hp'?: string` à `type RawPt`.

Injecter l'année d'URL dans `parse` et `listLivetrailRaces` (elles ont l'URL) :

`parse` :
```ts
  async parse(url: string): Promise<ExtractedRaceData> {
    const { slug, raceId } = extractSlugAndRaceId(url)
    const xml = await fetchParcoursXml(slug, raceId)
    const data = mapXmlToExtracted(xml, raceId)
    const year = extractYearFromLivetrailUrl(url)
    return { ...data, editionYear: year, dateExplicit: year != null }
  },
```

`listLivetrailRaces` — dans la boucle `out.push`, appliquer l'année d'URL :
```ts
      const year = extractYearFromLivetrailUrl(url)
      out.push({
        raceName: (id ? nameById.get(id) : undefined) ?? null,
        data: { ...data, editionYear: year, dateExplicit: year != null },
      })
```

- [ ] **Step 4 : Vérifier**

Run: `cd web && npx jest __tests__/lib/race-import/livetrail && npx tsc --noEmit`
Expected: PASS (nouvelle suite + suite livetrail existante), 0 tsc.

- [ ] **Step 5 : Commit**

```bash
git add web/lib/race-import/sources/livetrail.ts web/__tests__/lib/race-import/livetrail-edition.test.ts
git commit -m "feat(race-import): détection édition LiveTrail (jour départ XML + année URL)"
```

---

## Task 5 : Détection UTMB (`startDateIso` du JSON in-page)

**Files:**
- Modify: `web/lib/race-import/sources/utmb.ts`
- Test: `web/__tests__/lib/race-import/utmb-edition.test.ts` (create)

Constat source réel (`montblanc.utmb.world/races/utmb`) : le HTML contient `"startDateIso":"2026-08-28T17:45:00"` (et `"startDate":"…"`). On lit la date ISO → `editionDate` (partie date) + `editionYear` + `dateExplicit=true`.

- [ ] **Step 1 : Écrire le test**

```ts
import { extractUtmbEditionDate } from '@/lib/race-import/sources/utmb'

describe('extractUtmbEditionDate', () => {
  it('lit startDateIso → date ISO', () => {
    const html = 'x{"foo":1,"startDateIso":"2026-08-28T17:45:00","bar":2}y'
    expect(extractUtmbEditionDate(html)).toBe('2026-08-28')
  })
  it('fallback startDate si pas de startDateIso', () => {
    const html = '...."startDate":"2025-08-29T18:00:00"....'
    expect(extractUtmbEditionDate(html)).toBe('2025-08-29')
  })
  it('absent → null', () => {
    expect(extractUtmbEditionDate('<html>rien</html>')).toBeNull()
  })
})
```

- [ ] **Step 2 : Lancer (échoue)**

Run: `cd web && npx jest __tests__/lib/race-import/utmb-edition.test.ts`
Expected: FAIL (export inexistant).

- [ ] **Step 3 : Implémenter + câbler**

Dans `utmb.ts`, ajouter (exporté) :
```ts
// Date d'édition depuis le JSON embarqué (startDateIso prioritaire, sinon startDate).
// Renvoie la partie date ISO (YYYY-MM-DD) ou null.
export function extractUtmbEditionDate(html: string): string | null {
  const m =
    html.match(/"startDateIso"\s*:\s*"(\d{4}-\d{2}-\d{2})/) ??
    html.match(/"startDate"\s*:\s*"(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}
```

Dans `parse`, après extraction des waypoints, dériver l'édition (échec silencieux si absent) :
```ts
  async parse(url: string): Promise<ExtractedRaceData> {
    const html = await fetchHtml(url)
    const points = extractPointsJson(html)
    const total = points.length
    const waypoints = points
      .filter((p, i) => isUsefulPoint(p, i, total))
      .map((p, i) => mapUtmbPoint(p, i))
    const editionDate = extractUtmbEditionDate(html)
    const editionYear = editionDate ? Number(editionDate.slice(0, 4)) : null
    return validateExtractedRaceData({
      raceName: null, editionYear, editionDate, dateExplicit: editionDate != null,
      startDayOfMonth: null, startTimeRaw: null, waypoints,
    })
  },
```

- [ ] **Step 4 : Vérifier**

Run: `cd web && npx jest __tests__/lib/race-import/utmb && npx tsc --noEmit`
Expected: PASS, 0 tsc.

- [ ] **Step 5 : Commit**

```bash
git add web/lib/race-import/sources/utmb.ts web/__tests__/lib/race-import/utmb-edition.test.ts
git commit -m "feat(race-import): détection édition UTMB (startDateIso du JSON in-page)"
```

---

## Task 6 : Détection LLM (`edition_date` + `date_explicit`)

**Files:**
- Modify: `web/lib/race-import/prompt.ts`
- Modify: `web/lib/race-import/schema.ts`
- Test: `web/__tests__/lib/race-import/schema.test.ts` (étendre)

- [ ] **Step 1 : Étendre le test schema**

Ajouter à `schema.test.ts` un cas couvrant le mapping des nouveaux champs :
```ts
import { rawToExtractedRaceData } from '@/lib/race-import/schema'

it('mappe edition_date / date_explicit', () => {
  const out = rawToExtractedRaceData({
    race_name: 'X', edition_year: 2026, edition_date: '2026-06-28', date_explicit: true,
    waypoints: [],
  } as any)
  expect(out.editionDate).toBe('2026-06-28')
  expect(out.dateExplicit).toBe(true)
  expect(out.editionYear).toBe(2026)
})
```

- [ ] **Step 2 : Lancer (échoue)**

Run: `cd web && npx jest __tests__/lib/race-import/schema -t "edition_date"`
Expected: FAIL (`editionDate` vaut `null` car non mappé).

- [ ] **Step 3 : Étendre le JSON schema + le mapping**

`schema.ts` — `RACE_EXTRACTION_JSON_SCHEMA.schema.properties`, ajouter :
```ts
      edition_date: { type: ['string', 'null'] },
      date_explicit: { type: 'boolean' },
```
et les ajouter à `required` (Structured Outputs `strict:true` exige TOUTES les clés dans `required`) :
```ts
    required: ['race_name', 'edition_year', 'edition_date', 'date_explicit', 'waypoints'],
```

`type RawExtraction` : ajouter `edition_date: string | null` et `date_explicit: boolean`.

`rawToExtractedRaceData` : remplacer les défauts posés en Task 3 par les vraies valeurs :
```ts
    editionDate: raw.edition_date,
    dateExplicit: raw.date_explicit,
```
(garder `startDayOfMonth: null`, `startTimeRaw: null` — non pertinents pour le LLM.)

- [ ] **Step 4 : Étendre le prompt**

`prompt.ts` — ajouter aux règles, avant la dernière puce :
```
- edition_year / edition_date : extrais toute mention d'année ou de date de l'édition (titre du roadbook, barrières datées « sam. 28 juin 23h30 », « édition 2026 »). edition_date au format ISO (YYYY-MM-DD) si une date complète est lisible, sinon null. edition_year = l'année si trouvée, sinon null.
- date_explicit = true uniquement si une année ou une date a été RÉELLEMENT trouvée dans le contenu (false si tu n'as rien trouvé).
```
Et mettre à jour la phrase « Aucun tableau exploitable » :
```
- Aucun tableau exploitable → { "race_name": null, "edition_year": null, "edition_date": null, "date_explicit": false, "waypoints": [] }.
```

- [ ] **Step 5 : Vérifier**

Run: `cd web && npx jest __tests__/lib/race-import/schema && npx tsc --noEmit`
Expected: PASS, 0 tsc.

- [ ] **Step 6 : Commit**

```bash
git add web/lib/race-import/prompt.ts web/lib/race-import/schema.ts web/__tests__/lib/race-import/schema.test.ts
git commit -m "feat(race-import): détection édition LLM (edition_date + date_explicit)"
```

---

## Task 7 : Persistance de la meta (hash + route waypoints)

**Files:**
- Create: `web/lib/race-import/hash.ts`
- Test: `web/__tests__/lib/race-import/hash.test.ts` (create)
- Modify: `web/app/api/races/[id]/waypoints/route.ts`

La route PUT remplace déjà les waypoints. On y calcule la fraîcheur + le hash et on upsert `race_tableau_meta` **uniquement si** le body contient `meta` (l'édition manuelle des waypoints, sans `meta`, ne touche pas la fraîcheur). La route GET renvoie aussi la meta (pour le badge).

- [ ] **Step 1 : Test du hash**

```ts
import { hashWaypoints } from '@/lib/race-import/hash'

const wp = (over: any = {}) => ({
  orderIndex: 0, name: 'A', km: 0, kmInter: null, dPlus: 0, dMoins: 0,
  cutoffRaw: null, cutoffKind: null, type: 'depart', supplies: [], targetOverrideSec: null, ...over,
})

describe('hashWaypoints', () => {
  it('déterministe, insensible à l\'ordre du tableau', () => {
    const a = hashWaypoints([wp({ orderIndex: 0 }), wp({ orderIndex: 1, name: 'B', km: 10 })])
    const b = hashWaypoints([wp({ orderIndex: 1, name: 'B', km: 10 }), wp({ orderIndex: 0 })])
    expect(a).toBe(b)
  })
  it('change si un km/cutoff/supply change', () => {
    const base = hashWaypoints([wp()])
    expect(hashWaypoints([wp({ km: 1 })])).not.toBe(base)
    expect(hashWaypoints([wp({ cutoffRaw: 'sam. 10:00' })])).not.toBe(base)
    expect(hashWaypoints([wp({ supplies: ['liquid'] })])).not.toBe(base)
  })
  it('insensible à l\'ordre des supplies', () => {
    expect(hashWaypoints([wp({ supplies: ['solid', 'liquid'] })]))
      .toBe(hashWaypoints([wp({ supplies: ['liquid', 'solid'] })]))
  })
})
```

- [ ] **Step 2 : Lancer (échoue)**

Run: `cd web && npx jest __tests__/lib/race-import/hash.test.ts`
Expected: FAIL (module inexistant).

- [ ] **Step 3 : Implémenter `web/lib/race-import/hash.ts`**

```ts
// Hash du CONTENU MÉTIER d'un tableau (pas du HTML brut) : stable aux changements
// cosmétiques de la source, bouge si parcours / barrière / ravito changent.
// Socle du diff de fraîcheur (Lot 2).
import 'server-only'
import { createHash } from 'node:crypto'
import type { RaceWaypoint } from '@/types/plan'

type WP = Omit<RaceWaypoint, 'id' | 'raceId'>

export function hashWaypoints(waypoints: WP[]): string {
  const canonical = waypoints
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((w) => ({
      orderIndex: w.orderIndex,
      name: w.name,
      km: w.km,
      dPlus: w.dPlus,
      dMoins: w.dMoins,
      cutoffRaw: w.cutoffRaw,
      type: w.type,
      supplies: [...w.supplies].sort(),
    }))
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}
```

- [ ] **Step 4 : Lancer (passe)**

Run: `cd web && npx jest __tests__/lib/race-import/hash.test.ts`
Expected: PASS.

- [ ] **Step 5 : Étendre la route `waypoints/route.ts`**

Imports en tête :
```ts
import { computeFreshness, type DetectedEdition } from '@/lib/race-import/freshness'
import { hashWaypoints } from '@/lib/race-import/hash'
```

**GET** — joindre la meta. Après la requête `race_waypoints`, lire la meta et la renvoyer :
```ts
  const { data: metaRow } = await supabase
    .from('race_tableau_meta')
    .select('*')
    .eq('race_id', params.id)
    .maybeSingle()

  const waypoints: RaceWaypoint[] = (data ?? []).map(rowToRaceWaypoint as any)
  return NextResponse.json({ waypoints, meta: metaRow ? rowToTableauMeta(metaRow) : null })
```

**PUT** — étendre le `select` de la course pour récupérer la date, accepter `meta` optionnel, calculer + upsert :
```ts
  // select id → id, date :
  const { data: race, error: raceErr } = await supabase
    .from('races')
    .select('id, date')
    .eq('id', params.id)
    .eq('athlete_id', user.id)
    .single()
  // … (404 inchangé)

  const body = await request.json() as {
    waypoints: Array<Omit<RaceWaypoint, 'id' | 'raceId'>>
    meta?: {
      editionYear: number | null
      editionDate: string | null
      dateExplicit: boolean
      startDayOfMonth: number | null
      sourceUrl: string | null
    }
  }
```
Après l'insert des waypoints réussi (et aussi dans la branche `rows.length === 0` si tu veux gérer le vide — mais un import a toujours des points), avant le `return`, upsert la meta si `body.meta` présent :
```ts
  if (body.meta) {
    const detected: DetectedEdition = {
      editionYear: body.meta.editionYear,
      editionDate: body.meta.editionDate,
      dateExplicit: body.meta.dateExplicit,
      startDayOfMonth: body.meta.startDayOfMonth,
    }
    const fresh = computeFreshness(detected, race.date as string)
    await supabase.from('race_tableau_meta').upsert({
      race_id: params.id,
      edition_year: fresh.editionYear,
      edition_date: fresh.editionDate,
      date_explicit: body.meta.dateExplicit,
      freshness_status: fresh.freshnessStatus,
      source_url: body.meta.sourceUrl,
      source_hash: hashWaypoints(body.waypoints ?? []),
      source_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'race_id' })
  }
```

Ajouter le helper `rowToTableauMeta` (dans `schema.ts`, exporté) :
```ts
export function rowToTableauMeta(row: any): RaceTableauMeta {
  return {
    raceId: row.race_id,
    editionYear: row.edition_year,
    editionDate: row.edition_date,
    dateExplicit: row.date_explicit,
    freshnessStatus: row.freshness_status,
    sourceUrl: row.source_url,
    sourceCheckedAt: row.source_checked_at,
    sourceHash: row.source_hash,
  }
}
```
(importer `RaceTableauMeta` dans `schema.ts` ; importer `rowToTableauMeta` dans la route.)

- [ ] **Step 6 : Vérifier**

Run: `cd web && npx tsc --noEmit && npx jest __tests__/lib/race-import/hash`
Expected: 0 tsc, hash vert.

- [ ] **Step 7 : Commit**

```bash
git add web/lib/race-import/hash.ts web/lib/race-import/schema.ts web/app/api/races/[id]/waypoints/route.ts web/__tests__/lib/race-import/hash.test.ts
git commit -m "feat(race-import): persiste race_tableau_meta (fraîcheur + hash) à l'upsert waypoints"
```

---

## Task 8 : UX — table de validation (édition détectée + `edition_year` éditable)

**Files:**
- Modify: `web/components/plan/RaceImportSheet.tsx`

Contexte (déjà lu) : l'import (`/api/race-import` ou `/api/race-import/find`) renvoie un `ExtractedRaceData` (désormais avec les champs édition) ; `setDraft(body.data.waypoints)` ne garde que les waypoints. La sauvegarde fait `PUT /api/races/${raceId}/waypoints` avec `{ waypoints: draft }`. Il faut : capturer la meta détectée + l'URL source, l'afficher avec un statut recalculé live, et l'envoyer dans le PUT.

- [ ] **Step 1 : État pour la meta détectée**

Ajouter près de `const [draft, setDraft] = …` :
```ts
const [detected, setDetected] = useState<{
  editionYear: number | null
  editionDate: string | null
  dateExplicit: boolean
  startDayOfMonth: number | null
  sourceUrl: string | null
} | null>(null)
```

- [ ] **Step 2 : Capturer à l'import**

Dans le handler de recherche auto (après `setDraft(c.waypoints)`), `c` est un `RaceCandidate` (a `url`, `editionYear`, `editionDate`, `dateExplicit`, `startDayOfMonth`) :
```ts
setDetected({
  editionYear: c.editionYear, editionDate: c.editionDate, dateExplicit: c.dateExplicit,
  startDayOfMonth: c.startDayOfMonth, sourceUrl: c.url,
})
```
Dans le handler d'import direct (URL/fichier), après `setDraft(body.data.waypoints)` :
```ts
const d = body.data
setDetected({
  editionYear: d.editionYear, editionDate: d.editionDate, dateExplicit: d.dateExplicit,
  startDayOfMonth: d.startDayOfMonth, sourceUrl: importedUrl ?? null, // importedUrl = l'URL collée si onglet URL, sinon null
})
```
> `RaceCandidate` (find-race) doit exposer `editionDate`/`dateExplicit`/`startDayOfMonth` : ils sont déjà sur `ParsedCandidate extends` via `ExtractedRaceData`? Non — `ParsedCandidate` ne porte que `raceName/totalKm/...`. **Sous-étape** : ajouter `editionYear`, `editionDate`, `dateExplicit`, `startDayOfMonth` à `ParsedCandidate` dans `find-race.ts` et les remplir là où on construit les candidats (utmb : depuis `data` ; livetrail : depuis `r.data` ; generic : depuis `data`). Mettre à jour les tests find-race en conséquence. (Si tu préfères limiter le scope : exposer au minimum `editionYear`, `editionDate`, `dateExplicit`, `startDayOfMonth` — c'est ce que la meta consomme.)

- [ ] **Step 3 : Afficher la ligne « Édition détectée » + champ éditable**

Au-dessus du `<WaypointsTable waypoints={draft} … />` (≈ ligne 264), quand `draft.length > 0 && detected` :
```tsx
{detected && draft.length > 0 && (() => {
  const fresh = computeFreshness(
    { editionYear: detected.editionYear, editionDate: detected.editionDate,
      dateExplicit: detected.dateExplicit, startDayOfMonth: detected.startDayOfMonth },
    race.date,
  )
  const badge = fresh.freshnessStatus === 'confirmed'
    ? { icon: '✅', text: `Confirmé édition ${fresh.editionYear ?? '?'}` }
    : fresh.freshnessStatus === 'provisional_previous_edition'
    ? { icon: '⚠️', text: `Provisoire — édition ${fresh.editionYear ?? '?'}` }
    : { icon: '❔', text: 'Édition non identifiée — vérifiez' }
  return (
    <div className="flex items-center gap-2 mb-2 text-body-sm">
      <span>{badge.icon} {badge.text}</span>
      <label className="ml-auto flex items-center gap-1 text-caption text-trail-muted">
        Année
        <input
          type="number" inputMode="numeric"
          value={detected.editionYear ?? ''}
          onChange={(e) => setDetected({ ...detected, editionYear: Number(e.target.value) || null, editionDate: null })}
          className="w-16 px-2 py-1 rounded-[8px] bg-trail-surface border border-trail-border text-trail-text text-center"
        />
      </label>
    </div>
  )
})()}
```
Importer `computeFreshness` en tête du fichier. (Override manuel : on annule `editionDate` pour que le recalcul reparte de l'année saisie.)

- [ ] **Step 4 : Envoyer la meta dans le PUT**

Dans le handler de save, body du PUT :
```ts
body: JSON.stringify({
  waypoints: draft,
  meta: detected ? {
    editionYear: detected.editionYear, editionDate: detected.editionDate,
    dateExplicit: detected.dateExplicit, startDayOfMonth: detected.startDayOfMonth,
    sourceUrl: detected.sourceUrl,
  } : undefined,
}),
```

- [ ] **Step 5 : Vérifier**

Run: `cd web && npx tsc --noEmit && npx eslint components/plan/RaceImportSheet.tsx`
Expected: 0 erreur.

- [ ] **Step 6 : Commit**

```bash
git add web/components/plan/RaceImportSheet.tsx web/lib/race-import/find-race.ts web/__tests__/lib/race-import/find-race.test.ts
git commit -m "feat(plan): table de validation — édition détectée + année éditable + envoi meta"
```

---

## Task 9 : UX — badge de fraîcheur sur le détail course

**Files:**
- Modify: `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx` (ou `WaypointsTable.tsx` si le fetch waypoints y vit)

Le GET `/api/races/[id]/waypoints` renvoie désormais `{ waypoints, meta }`. Afficher un badge au-dessus du tableau depuis `meta`.

- [ ] **Step 1 : Lire la structure du fetch**

Repérer dans `CoursePageClient.tsx` l'appel `GET /api/races/${id}/waypoints` et l'état des waypoints. Ajouter un état `meta` rempli depuis `body.meta`.

- [ ] **Step 2 : Composant badge**

Créer un petit composant local `FreshnessBadge` (dans le même fichier ou `web/components/plan/FreshnessBadge.tsx`) :
```tsx
import type { RaceTableauMeta } from '@/types/plan'

export function FreshnessBadge({ meta }: { meta: RaceTableauMeta | null }) {
  if (!meta) return null
  const map = {
    confirmed: { icon: '✅', text: `Confirmé édition ${meta.editionYear ?? '?'}`, cls: 'text-trail-primary' },
    provisional_previous_edition: { icon: '⚠️', text: `Provisoire — basé sur l'édition ${meta.editionYear ?? '?'}`, cls: 'text-trail-warn' },
    unknown: { icon: '❔', text: 'Édition non identifiée — vérifiez la source', cls: 'text-trail-muted' },
  }[meta.freshnessStatus]
  return (
    <div className={`flex items-center gap-2 text-body-sm mb-2 ${map.cls}`}>
      <span aria-hidden>{map.icon}</span><span>{map.text}</span>
    </div>
  )
}
```
> Vérifier qu'une classe de couleur « warn » existe (sinon utiliser `text-[color:#EAB308]` comme la priorité B dans `ObjectifCourseBlock`).

- [ ] **Step 3 : Rendre le badge au-dessus du tableau**

Insérer `<FreshnessBadge meta={meta} />` juste avant le `<WaypointsTable …>` de la page détail.

- [ ] **Step 4 : Vérifier**

Run: `cd web && npx tsc --noEmit && npx eslint app/\(main\)/plan/courses/\[id\]/CoursePageClient.tsx`
Expected: 0 erreur. Test manuel (dev) : importer un tableau → badge cohérent.

- [ ] **Step 5 : Commit**

```bash
git add -A
git commit -m "feat(plan): badge de fraîcheur (confirmé/provisoire/non identifié) sur le détail course"
```

---

## Clôture

- [ ] **Mise à jour doc** : ajouter le bandeau `> **Status: Implémenté** · 2026-06-11 · Code: web/lib/race-import/freshness.ts …` en tête du spec ; si divergence, section `## Drift notes`.
- [ ] **Revue finale** : agent-skills:code-reviewer sur l'ensemble du diff de branche.
- [ ] **Rappel migration** : indiquer à Franck de coller `037_race_tableau_meta.sql` dans le Dashboard Supabase.
- [ ] **finishing-a-development-branch** pour clôturer.

## Notes d'ordre / dépendances

- Ordre obligatoire : **1 → 2 → 3** (3 doit précéder 4/5/6/7/8). 4, 5, 6 indépendants entre eux. 7 dépend de 2+3. 8 dépend de 2+3+7 (et de l'exposition des champs sur `ParsedCandidate`). 9 dépend de 7.
- Chaque tâche se termine `tsc` vert + suites pertinentes vertes ; commit à chaque tâche.
- Hors-scope (Lot 2) : re-checks auto, diff, notifications. Ne rien anticiper ici (YAGNI).
```
