# Import Garmin GDPR — Phase 2 : streams FIT (enrichissement) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Après l'import des résumés (Phase 1, livré sur `master`), enrichir les activités dépourvues de streams avec les vraies séries temporelles issues des `.fit` de l'export Garmin — parsées en Web Workers, côté navigateur, en streaming mémoire-borné — pour calculer découplage / GAP / D− et affiner le CES.

**Architecture :** Le flux d'import continue après le commit des résumés sur une **« Étape 2 : enrichissement détaillé » optionnelle**, en **réutilisant le ZIP déjà sélectionné** (pas de re-upload). Le navigateur stream les `UploadedFiles_*.zip` imbriqués, décode chaque `.fit` dans un **pool de Web Workers** (`@garmin/fitsdk`), produit un `StreamSet` au **même format que les streams Strava existants**, le downsample à 5 s, le gzip (`fflate`) et le POST par lots à une route serveur qui écrit `activity_streams` (`source='garmin'`). Un **unique recalcul** final (`recalculateUserEffortScores`) recompute CES + métriques depuis les streams stockés.

**Périmètre d'enrichissement :** toute activité de l'utilisateur **sans streams** matchée à un FIT — les Garmin importées en Phase 1 **et** les activités conservées (ex. Strava gardé) dépourvues de streams.

**Tech Stack :** Next 14 App Router, TypeScript strict, `@garmin/fitsdk` (nouvelle dép.), `fflate` (déjà présent), Web Workers (webpack 5 natif via `new Worker(new URL(...))`), Supabase service client. Réutilise `StreamSet`, `computeStreamMetrics`, `recalculateUserEffortScores`, `activity_streams` (migration 030).

---

## Décisions d'architecture (validées avec Franck, 2026-06-10)

1. **Flux intégré.** L'enrichissement est une étape optionnelle qui suit le commit Phase 1 dans la **même session**, réutilisant l'objet `File` déjà choisi. Skippable. Pas de re-upload.
2. **Périmètre large.** On enrichit toute activité matchée à un FIT qui n'a **pas** de ligne `activity_streams` — couvre Garmin importées + conservées (Strava sans streams).
3. **Écriture = route serveur** (cohérent Phase 1), service client. Le recalcul CES réutilise `recalculateUserEffortScores(userId)` tel quel (lit les streams, recompute CES + métriques). **Aucune migration** : `activity_streams` existe (030) avec `source` text (on met `'garmin'`).
4. **Format streams identique à Strava.** `StreamSet { time, altitude, heartrate, velocity, distance, grade }`, downsamplé 5 s, gzippé. **`grade` est dérivé** (absent des FIT) depuis altitude/distance. Gzip client via `fflate.gzipSync` → lu par `gunzipSync` (zlib) serveur (interop).
5. **Mémoire bornée.** Jamais plus de ~50 Mo de FIT décompressés simultanément : on stream les zips imbriqués et on traite les `.fit` **un par un**, en n'enrichissant que les FIT dont le timestamp matche une activité à enrichir (peek du `file_id` avant décodage complet).
6. **Matching FIT ↔ activité** par `activityId` (si présent dans le `file_id`/nom) sinon par **timestamp de début ± 120 s**, contre la liste des activités-sans-streams de la période.
7. **Testabilité FIT sans fixture binaire** : `@garmin/fitsdk` fournit un `Encoder` → les tests encodent un FIT synthétique puis le redécodent (round-trip réel).

---

## Structure de fichiers

**Créés — purs / testables (TDD) :**
- `web/lib/garmin-import/fit-decode.ts` — `decodeFitToStreams(bytes) → { streams, startTimeMs, activityId }` (SDK Decoder) ; `recordsToStreamSet(records)`, `deriveGrade(altitude, distance)`, downsample 5 s inline (pas d'import Node).
- `web/lib/garmin-import/fit-match.ts` — `buildActivityIndex(activities)`, `matchFit(meta, index)` (activityId puis timestamp ±120 s).
- `web/lib/garmin-import/nested-unzip.ts` — `forEachFit(outerZip, onFit)` : stream les `DI-Connect-Uploaded-Files/UploadedFiles_*.zip` → `.fit` un par un, mémoire bornée.
- `web/lib/garmin-import/stream-pack.ts` — `packStreamsClient(streams) → base64(gzip(JSON))` via `fflate`.
- `web/lib/garmin-import/enrich-types.ts` — types Phase 2.

**Créés — serveur :**
- `web/app/api/garmin-import/needs-streams/route.ts` — GET activités sans streams sur la période → `{ id, provider, providerActivityId, startTime }[]`.
- `web/app/api/garmin-import/streams/route.ts` — POST lot `{ activityId, streamsGz, pointCount }[]` → écrit `activity_streams` (service client) ; `?recalc=1` déclenche `recalculateUserEffortScores`.
- `web/lib/garmin-import/enrich-commit.ts` — helper serveur : upsert `activity_streams` + (option) recalc.

**Créés — workers / orchestration (intégration) :**
- `web/workers/fit-parser.worker.ts` — reçoit `{ id, bytes }`, renvoie `{ id, streams, pointCount }` (appelle `fit-decode`).
- `web/lib/garmin-import/fit-pool.ts` — pool de workers (`min(hardwareConcurrency-1, 4)`).

**Modifiés :**
- `web/package.json` — `@garmin/fitsdk`.
- `web/components/import/garmin/GarminImportFlow.tsx` — état + Étape 2 (réutilise le `File`).
- `web/components/import/garmin/EnrichmentStep.tsx` (nouveau) — UI Étape 2 (proposition, progression, skip).

**Tests :** `web/__tests__/lib/garmin-import/fit-decode.test.ts`, `fit-match.test.ts`, `nested-unzip.test.ts`, `stream-pack.test.ts`, `enrich-commit.test.ts`.

---

## Task 1 : Dépendance `@garmin/fitsdk` + spike API + types

**Files:**
- Modify: `web/package.json`
- Create: `web/lib/garmin-import/enrich-types.ts`
- Temp: un script de spike (non commité)

- [ ] **Step 1 : Installer**

Run : `cd c:/Users/Franc/app-run-mobile/web; npm install @garmin/fitsdk`

- [ ] **Step 2 : Spike — confirmer l'API Decoder/Encoder** (script jetable `web/tmp-fit-spike.mjs`, exécuté avec `node`, **supprimé après**)

But : vérifier empiriquement les noms exacts (`Decoder`, `Stream.fromByteArray`, `decoder.read()`, `messages.recordMesgs`, champs `timestamp`/`heartRate`/`enhancedAltitude`/`enhancedSpeed`/`distance`, `messages.fileIdMesgs[0].timeCreated`) et l'API `Encoder` (`onMesg`/`writeMesg`, `Profile.MesgNum`, `close()`).

```js
// web/tmp-fit-spike.mjs  (jetable — NE PAS committer)
import pkg from '@garmin/fitsdk'
console.log('exports:', Object.keys(pkg))
const { Encoder, Decoder, Stream, Profile } = pkg
// … encoder un FILE_ID + 3 RECORD, fermer, redécoder, console.log(messages) …
```

Run : `cd c:/Users/Franc/app-run-mobile/web; node tmp-fit-spike.mjs`
Noter les noms réels dans le rapport. **Supprimer le fichier** avant de committer.

> Si l'`Encoder` du SDK est inutilisable pour les tests, fallback : committer une **petite fixture** `.fit` réelle sous `web/__tests__/fixtures/sample.fit` (Franck peut en fournir une depuis son export) et tester le décodage dessus.

- [ ] **Step 3 : Types** `web/lib/garmin-import/enrich-types.ts`

```ts
import type { StreamSet } from '@/lib/activities/stream-metrics'

/** Métadonnées légères d'un FIT (peek file_id) pour le matching avant décodage complet. */
export type FitMeta = { startTimeMs: number | null; activityId: string | null }

/** Résultat de décodage complet d'un FIT. */
export type FitDecoded = FitMeta & { streams: StreamSet }

/** Activité à enrichir (sans streams), projetée pour le matching. */
export type EnrichCandidate = {
  id: string                    // uuid DB
  provider: string
  providerActivityId: string
  startTime: string             // ISO
}

/** Un stream prêt à écrire pour une activité. */
export type StreamUpload = { activityId: string; streamsGz: string; pointCount: number }

export type EnrichReport = { enriched: number; matched: number; skipped: number; errors: number }
```

- [ ] **Step 4 : Commit** (sans le script spike)

```bash
git add web/package.json web/package-lock.json web/lib/garmin-import/enrich-types.ts
git commit -m "feat(garmin-fit): add @garmin/fitsdk dep + enrichment types"
```

---

## Task 2 : Décodage FIT → StreamSet + dérivation du grade (TDD)

**Files:**
- Create: `web/lib/garmin-import/fit-decode.ts`
- Test: `web/__tests__/lib/garmin-import/fit-decode.test.ts`

> Utilise les **noms d'API confirmés au Task 1**. Le pseudo-code ci-dessous suppose l'API publique documentée du SDK (`Decoder`, `Stream.fromByteArray`, `decoder.read()`, `messages.recordMesgs`, `messages.fileIdMesgs`). Ajuster si le spike a révélé d'autres noms.

- [ ] **Step 1 : Test (round-trip via Encoder)** — encode un FIT à 4 records (altitude/distance/HR/vitesse croissants), décode, vérifie le StreamSet et le grade dérivé.

```ts
// web/__tests__/lib/garmin-import/fit-decode.test.ts
import { recordsToStreamSet, deriveGrade } from '@/lib/garmin-import/fit-decode'

test('deriveGrade : pente = Δaltitude/Δdistance en %', () => {
  // +10 m sur 100 m = 10 %
  const grade = deriveGrade([100, 110, 120], [0, 100, 200])
  expect(grade[1]).toBeCloseTo(10, 1)
  expect(grade[2]).toBeCloseTo(10, 1)
})

test('deriveGrade : premier point = 0, distance plate = 0 %', () => {
  const grade = deriveGrade([100, 100], [0, 0])
  expect(grade[0]).toBe(0)
  expect(grade[1]).toBe(0)
})

test('recordsToStreamSet : mappe records → arrays, time relatif au 1er, enhanced prioritaire', () => {
  const t0 = 1_600_000_000_000
  const records = [
    { timestamp: new Date(t0),        heartRate: 120, enhancedAltitude: 100, enhancedSpeed: 2.0, distance: 0 },
    { timestamp: new Date(t0 + 5000), heartRate: 130, enhancedAltitude: 105, enhancedSpeed: 2.5, distance: 12 },
  ]
  const s = recordsToStreamSet(records as never)
  expect(s.time).toEqual([0, 5])
  expect(s.heartrate).toEqual([120, 130])
  expect(s.altitude).toEqual([100, 105])
  expect(s.velocity).toEqual([2.0, 2.5])
  expect(s.distance).toEqual([0, 12])
  expect(s.grade?.length).toBe(2)
})
```

- [ ] **Step 2 : Run → FAIL** : `cd c:/Users/Franc/app-run-mobile/web; npx jest garmin-import/fit-decode`

- [ ] **Step 3 : Implémenter**

```ts
// web/lib/garmin-import/fit-decode.ts
import pkg from '@garmin/fitsdk'
import type { StreamSet } from '@/lib/activities/stream-metrics'
import type { FitDecoded } from './enrich-types'

const { Decoder, Stream } = pkg as { Decoder: any; Stream: any }

type FitRecord = {
  timestamp?: Date
  heartRate?: number
  altitude?: number
  enhancedAltitude?: number
  speed?: number
  enhancedSpeed?: number
  distance?: number
}

/** Pente (%) par échantillon : Δaltitude/Δdistance, 0 au 1er point et si distance plate. */
export function deriveGrade(altitude: number[], distance: number[]): number[] {
  const n = Math.min(altitude.length, distance.length)
  const out: number[] = new Array(n).fill(0)
  for (let i = 1; i < n; i++) {
    const dd = distance[i] - distance[i - 1]
    out[i] = dd > 0.5 ? ((altitude[i] - altitude[i - 1]) / dd) * 100 : 0
  }
  return out
}

export function recordsToStreamSet(records: FitRecord[]): StreamSet {
  const usable = records.filter(r => r.timestamp instanceof Date)
  if (usable.length === 0) return {}
  const t0 = usable[0].timestamp!.getTime()
  const time: number[] = [], altitude: number[] = [], heartrate: number[] = [], velocity: number[] = [], distance: number[] = []
  for (const r of usable) {
    time.push(Math.round((r.timestamp!.getTime() - t0) / 1000))
    altitude.push(r.enhancedAltitude ?? r.altitude ?? NaN)
    heartrate.push(r.heartRate ?? NaN)
    velocity.push(r.enhancedSpeed ?? r.speed ?? NaN)
    distance.push(r.distance ?? NaN)
  }
  return { time, altitude, heartrate, velocity, distance, grade: deriveGrade(altitude, distance) }
}

/** Downsample par fenêtre de `everyS` s (1er point/fenêtre + dernier). Copie locale de la
 * logique Strava (streams.ts importe zlib → on ne le réutilise pas côté worker). */
export function downsample5s(s: StreamSet, everyS = 5): StreamSet {
  const t = s.time
  if (!t || t.length === 0) return s
  const keep: number[] = []
  let next = -Infinity
  for (let i = 0; i < t.length; i++) if (t[i] >= next) { keep.push(i); next = t[i] + everyS }
  if (keep[keep.length - 1] !== t.length - 1) keep.push(t.length - 1)
  const pick = (a?: number[]) => (a ? keep.map(i => a[i]) : undefined)
  return { time: pick(s.time), altitude: pick(s.altitude), heartrate: pick(s.heartrate), velocity: pick(s.velocity), distance: pick(s.distance), grade: pick(s.grade) }
}

/** Décode des octets FIT → streams downsamplés + métadonnées. */
export function decodeFitToStreams(bytes: Uint8Array): FitDecoded {
  const stream = Stream.fromByteArray(bytes)
  const decoder = new Decoder(stream)
  const { messages } = decoder.read({ convertDateTimesToDates: true, convertTypesToStrings: true })
  const records: FitRecord[] = messages.recordMesgs ?? []
  const fileId = (messages.fileIdMesgs ?? [])[0] as { timeCreated?: Date; serialNumber?: number } | undefined
  const startTimeMs = records[0]?.timestamp instanceof Date
    ? records[0].timestamp.getTime()
    : (fileId?.timeCreated instanceof Date ? fileId.timeCreated.getTime() : null)
  const streams = downsample5s(recordsToStreamSet(records))
  return { streams, startTimeMs, activityId: null }  // activityId rarement dans le FIT → matching par timestamp
}
```

- [ ] **Step 4 : Run → PASS** : `cd c:/Users/Franc/app-run-mobile/web; npx jest garmin-import/fit-decode`

> Si le spike (Task 1) a confirmé que l'`Encoder` marche, AJOUTER un test round-trip qui encode 3 records, passe les octets à `decodeFitToStreams`, et vérifie `streams.time`/`heartrate`. Sinon, `recordsToStreamSet` + `deriveGrade` (purs) suffisent à la couverture unitaire et `decodeFitToStreams` est validé en intégration (Task 9, export réel).

- [ ] **Step 5 : Commit**

```bash
git add web/lib/garmin-import/fit-decode.ts web/__tests__/lib/garmin-import/fit-decode.test.ts
git commit -m "feat(garmin-fit): decode FIT records to StreamSet with derived grade"
```

---

## Task 3 : Matching FIT ↔ activité (TDD, pur)

**Files:**
- Create: `web/lib/garmin-import/fit-match.ts`
- Test: `web/__tests__/lib/garmin-import/fit-match.test.ts`

- [ ] **Step 1 : Test**

```ts
// web/__tests__/lib/garmin-import/fit-match.test.ts
import { buildActivityIndex, matchFit } from '@/lib/garmin-import/fit-match'
import type { EnrichCandidate } from '@/lib/garmin-import/types'  // ré-export depuis enrich-types via types si souhaité

const cands: EnrichCandidate[] = [
  { id: 'a', provider: 'garmin', providerActivityId: '111', startTime: '2024-01-01T08:00:00.000Z' },
  { id: 'b', provider: 'strava', providerActivityId: 's2',  startTime: '2024-02-01T09:00:00.000Z' },
]

test('match par activityId', () => {
  const idx = buildActivityIndex(cands)
  expect(matchFit({ activityId: '111', startTimeMs: 0 }, idx)?.id).toBe('a')
})

test('match par timestamp ±120 s', () => {
  const idx = buildActivityIndex(cands)
  const ms = new Date('2024-02-01T09:01:30.000Z').getTime() // +90 s
  expect(matchFit({ activityId: null, startTimeMs: ms }, idx)?.id).toBe('b')
})

test('hors tolérance → null', () => {
  const idx = buildActivityIndex(cands)
  const ms = new Date('2024-02-01T09:05:00.000Z').getTime() // +5 min
  expect(matchFit({ activityId: null, startTimeMs: ms }, idx)).toBeNull()
})
```

- [ ] **Step 2 : Run → FAIL**

- [ ] **Step 3 : Implémenter**

```ts
// web/lib/garmin-import/fit-match.ts
import type { FitMeta, EnrichCandidate } from './enrich-types'

const TOL_MS = 120_000

export type ActivityIndex = {
  byActivityId: Map<string, EnrichCandidate>
  byTime: { ms: number; c: EnrichCandidate }[]   // trié par ms
}

export function buildActivityIndex(cands: EnrichCandidate[]): ActivityIndex {
  const byActivityId = new Map<string, EnrichCandidate>()
  const byTime: { ms: number; c: EnrichCandidate }[] = []
  for (const c of cands) {
    if (c.provider === 'garmin') byActivityId.set(c.providerActivityId, c)
    byTime.push({ ms: new Date(c.startTime).getTime(), c })
  }
  byTime.sort((a, b) => a.ms - b.ms)
  return { byActivityId, byTime }
}

export function matchFit(meta: FitMeta, idx: ActivityIndex): EnrichCandidate | null {
  if (meta.activityId && idx.byActivityId.has(meta.activityId)) return idx.byActivityId.get(meta.activityId)!
  if (meta.startTimeMs == null) return null
  let best: EnrichCandidate | null = null, bestDiff = TOL_MS + 1
  for (const e of idx.byTime) {
    const d = Math.abs(e.ms - meta.startTimeMs)
    if (d <= TOL_MS && d < bestDiff) { best = e.c; bestDiff = d }
  }
  return best
}
```

> Note : `EnrichCandidate` vit dans `enrich-types.ts`. Importer depuis là (`@/lib/garmin-import/enrich-types`). Le test ci-dessus l'importe — corriger le chemin d'import si besoin.

- [ ] **Step 4 : Run → PASS**
- [ ] **Step 5 : Commit** `feat(garmin-fit): match FIT files to activities by id or timestamp`

---

## Task 4 : Extraction streaming des `.fit` imbriqués (TDD)

**Files:**
- Create: `web/lib/garmin-import/nested-unzip.ts`
- Test: `web/__tests__/lib/garmin-import/nested-unzip.test.ts`

Objectif : depuis l'outer ZIP, décompresser **uniquement** les `DI-Connect-Uploaded-Files/UploadedFiles_*.zip`, puis pour chaque, extraire les `.fit` **un par un** en invoquant un callback `async`, sans charger tous les FIT en mémoire.

- [ ] **Step 1 : Test** (construit un outer-zip contenant un nested-zip de 2 `.fit` via `fflate.zipSync`)

```ts
// web/__tests__/lib/garmin-import/nested-unzip.test.ts
import { zipSync, strToU8 } from 'fflate'
import { forEachFit } from '@/lib/garmin-import/nested-unzip'

test('itère les .fit des UploadedFiles_*.zip imbriqués, ignore le reste', async () => {
  const nested = zipSync({ '1.fit': strToU8('FITDATA-1'), '2.fit': strToU8('FITDATA-2'), 'note.txt': strToU8('x') })
  const outer = zipSync({
    'DI_CONNECT/DI-Connect-Uploaded-Files/UploadedFiles_0.zip': nested,
    'DI_CONNECT/DI-Connect-Fitness/x_summarizedActivities.json': strToU8('[]'),
  })
  const names: string[] = []
  await forEachFit(outer, async (name, bytes) => { names.push(name); expect(bytes.length).toBeGreaterThan(0) })
  expect(names.sort()).toEqual(['1.fit', '2.fit'])
})
```

- [ ] **Step 2 : Run → FAIL**

- [ ] **Step 3 : Implémenter** (Phase 1 : `unzipSync` filtré par zip imbriqué ; le filtre garantit qu'on ne décompresse que le nested courant. Pour des nested > ~50 Mo, basculer sur l'API async `Unzip` — noté en commentaire.)

```ts
// web/lib/garmin-import/nested-unzip.ts
import { unzipSync } from 'fflate'

const NESTED_RE = /DI-Connect-Uploaded-Files\/UploadedFiles_.*\.zip$/i
const FIT_RE = /\.fit$/i

/**
 * Pour chaque .fit des UploadedFiles_*.zip imbriqués, appelle onFit(name, bytes).
 * Traite un nested-zip à la fois ; à l'intérieur, un .fit à la fois (les bytes ne
 * survivent pas à l'itération). Mémoire ≈ taille d'un nested-zip + un .fit.
 */
export async function forEachFit(
  outerZip: Uint8Array,
  onFit: (name: string, bytes: Uint8Array) => Promise<void>,
): Promise<void> {
  const nestedZips = unzipSync(outerZip, { filter: f => NESTED_RE.test(f.name) })
  for (const nestedName of Object.keys(nestedZips)) {
    const inner = unzipSync(nestedZips[nestedName], { filter: f => FIT_RE.test(f.name) })
    for (const fitName of Object.keys(inner)) {
      await onFit(fitName.split('/').pop()!, inner[fitName])
    }
  }
}
```

> ⚠️ Limite mémoire à l'exécution : `unzipSync` d'un nested-zip charge ce nested en entier. Si un `UploadedFiles_*.zip` dépasse ~50 Mo décompressé, remplacer par l'API streaming `Unzip` de fflate (callbacks `onfile` + push de chunks lus depuis `File.slice().stream()`). À évaluer Task 9 sur l'export réel ; garder l'API `forEachFit` identique.

- [ ] **Step 4 : Run → PASS**
- [ ] **Step 5 : Commit** `feat(garmin-fit): stream .fit files from nested UploadedFiles zips`

---

## Task 5 : Pack streams client (TDD)

**Files:**
- Create: `web/lib/garmin-import/stream-pack.ts`
- Test: `web/__tests__/lib/garmin-import/stream-pack.test.ts`

- [ ] **Step 1 : Test** (gzip puis vérifier qu'on relit le JSON via `fflate.gunzipSync`)

```ts
// web/__tests__/lib/garmin-import/stream-pack.test.ts
import { gunzipSync, strFromU8 } from 'fflate'
import { packStreamsClient } from '@/lib/garmin-import/stream-pack'

test('packStreamsClient → base64(gzip(JSON)) relisible', () => {
  const s = { time: [0, 5], heartrate: [120, 130] }
  const b64 = packStreamsClient(s)
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  expect(JSON.parse(strFromU8(gunzipSync(bytes)))).toEqual(s)
})
```

> jsdom fournit `atob`. Si absent dans l'env de test, utiliser `Buffer.from(b64,'base64')`.

- [ ] **Step 2 : Run → FAIL**
- [ ] **Step 3 : Implémenter**

```ts
// web/lib/garmin-import/stream-pack.ts
import { gzipSync, strToU8 } from 'fflate'
import type { StreamSet } from '@/lib/activities/stream-metrics'

export function packStreamsClient(s: StreamSet): string {
  const gz = gzipSync(strToU8(JSON.stringify(s)))
  let bin = ''
  for (let i = 0; i < gz.length; i++) bin += String.fromCharCode(gz[i])
  return btoa(bin)
}
```

> Format identique à `packStreams` serveur (base64(gzip(JSON))) → `unpackStreams`/`gunzipSync` (zlib) le relit (interop gzip). En prod (navigateur) `btoa` existe ; en test jsdom aussi.

- [ ] **Step 4 : Run → PASS**
- [ ] **Step 5 : Commit** `feat(garmin-fit): client-side gzip pack for streams (fflate)`

---

## Task 6 : Routes serveur (needs-streams + streams) + helper d'écriture (TDD du helper)

**Files:**
- Create: `web/lib/garmin-import/enrich-commit.ts`
- Test: `web/__tests__/lib/garmin-import/enrich-commit.test.ts`
- Create: `web/app/api/garmin-import/needs-streams/route.ts`
- Create: `web/app/api/garmin-import/streams/route.ts`

- [ ] **Step 1 : Test du helper** (mock supabase, vérifie upsert sur `activity_streams`)

```ts
// web/__tests__/lib/garmin-import/enrich-commit.test.ts
import { writeStreamRows } from '@/lib/garmin-import/enrich-commit'
import type { StreamUpload } from '@/lib/garmin-import/enrich-types'

function fakeSupabase() {
  const calls: { table: string; rows: unknown }[] = []
  return {
    calls,
    api: { from(table: string) { return { upsert(rows: unknown) { calls.push({ table, rows }); return { error: null } } } } },
  }
}

test('writeStreamRows upsert activity_streams avec source garmin', async () => {
  const { api, calls } = fakeSupabase()
  const uploads: StreamUpload[] = [{ activityId: 'a1', streamsGz: 'GZ', pointCount: 42 }]
  const n = await writeStreamRows(api as never, 'user-1', uploads)
  expect(n).toBe(1)
  const row = (calls[0].rows as any[])[0]
  expect(calls[0].table).toBe('activity_streams')
  expect(row).toMatchObject({ activity_id: 'a1', user_id: 'user-1', source: 'garmin', point_count: 42, streams_gz: 'GZ' })
})
```

- [ ] **Step 2 : Run → FAIL**
- [ ] **Step 3 : Implémenter le helper**

```ts
// web/lib/garmin-import/enrich-commit.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { StreamUpload } from './enrich-types'

export async function writeStreamRows(
  supabase: SupabaseClient, userId: string, uploads: StreamUpload[],
): Promise<number> {
  if (uploads.length === 0) return 0
  const rows = uploads.map(u => ({
    activity_id: u.activityId, user_id: userId, downsample_s: 5,
    point_count: u.pointCount, streams_gz: u.streamsGz, source: 'garmin',
  }))
  const { error } = await supabase.from('activity_streams').upsert(rows, { onConflict: 'activity_id' })
  if (error) throw new Error(`Garmin streams upsert: ${error.message}`)
  return rows.length
}
```

- [ ] **Step 4 : Run → PASS**

- [ ] **Step 5 : Route `needs-streams` (GET)**

```ts
// web/app/api/garmin-import/needs-streams/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import type { EnrichCandidate } from '@/lib/garmin-import/enrich-types'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')
  // Activités de la période SANS ligne activity_streams.
  let q = supabase
    .from('activities')
    .select('id, provider, provider_activity_id, start_time, activity_streams(activity_id)')
    .eq('user_id', user.id).is('deleted_at', null)
    .order('start_time', { ascending: true }).limit(20000)
  if (from) q = q.gte('start_time', from)
  if (to) q = q.lte('start_time', to)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const out: EnrichCandidate[] = (data ?? [])
    .filter((r: any) => !r.activity_streams || r.activity_streams.length === 0)
    .map((r: any) => ({ id: String(r.id), provider: String(r.provider), providerActivityId: String(r.provider_activity_id), startTime: String(r.start_time) }))
  return NextResponse.json(out)
}
```

> Le join `activity_streams(activity_id)` suppose une FK détectable par PostgREST (activity_streams.activity_id → activities.id, migration 030). Vérifier au runtime ; sinon faire deux requêtes (ids avec streams via `activity_streams` puis filtrer).

- [ ] **Step 6 : Route `streams` (POST)**

```ts
// web/app/api/garmin-import/streams/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/database/get-user'
import { createServiceClient } from '@/lib/database/supabase-server'
import { writeStreamRows } from '@/lib/garmin-import/enrich-commit'
import { recalculateUserEffortScores } from '@/lib/sync/recalculate-scores'
import type { StreamUpload } from '@/lib/garmin-import/enrich-types'

export async function POST(req: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: { uploads: StreamUpload[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }) }
  const service = createServiceClient()
  try {
    const written = await writeStreamRows(service, user.id, body.uploads ?? [])
    if (req.nextUrl.searchParams.get('recalc') === '1') await recalculateUserEffortScores(user.id)
    return NextResponse.json({ written })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Écriture streams échouée' }, { status: 500 })
  }
}
```

- [ ] **Step 7 : tsc + eslint**

Run : `cd c:/Users/Franc/app-run-mobile/web; npx tsc --noEmit` (filtrer `garmin-import`) ; `npx eslint app/api/garmin-import lib/garmin-import`

- [ ] **Step 8 : Commit** `feat(garmin-fit): needs-streams + streams write routes (+ recalc)`

---

## Task 7 : Web Worker FIT + pool (intégration)

**Files:**
- Create: `web/workers/fit-parser.worker.ts`
- Create: `web/lib/garmin-import/fit-pool.ts`

> Pas de test unitaire (worker bundlé). Validation : tsc + eslint + intégration Task 9. Le worker n'importe QUE du code sans dépendance Node (`fit-decode.ts` est pur, `@garmin/fitsdk` est JS).

- [ ] **Step 1 : Worker**

```ts
// web/workers/fit-parser.worker.ts
import { decodeFitToStreams } from '@/lib/garmin-import/fit-decode'

self.onmessage = (e: MessageEvent<{ id: string; bytes: ArrayBuffer }>) => {
  const { id, bytes } = e.data
  try {
    const { streams, startTimeMs } = decodeFitToStreams(new Uint8Array(bytes))
    const pointCount = streams.time?.length ?? 0
    ;(self as unknown as Worker).postMessage({ id, streams, startTimeMs, pointCount })
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : 'decode error' })
  }
}
```

- [ ] **Step 2 : Pool** `fit-pool.ts` — `createFitPool()` expose `decode(id, bytes): Promise<{streams, startTimeMs, pointCount} | {error}>`, instancie `min(navigator.hardwareConcurrency-1, 4)` workers via `new Worker(new URL('@/workers/fit-parser.worker.ts', import.meta.url))`, file d'attente FIFO, et `terminate()`.

```ts
// web/lib/garmin-import/fit-pool.ts  (squelette — compléter la file d'attente)
export type FitResult = { id: string; streams?: import('@/lib/activities/stream-metrics').StreamSet; startTimeMs?: number | null; pointCount?: number; error?: string }

export function createFitPool() {
  const size = Math.max(1, Math.min((navigator.hardwareConcurrency || 2) - 1, 4))
  const workers = Array.from({ length: size }, () =>
    new Worker(new URL('@/workers/fit-parser.worker.ts', import.meta.url)))
  // … file d'attente : assigner chaque {id,bytes} à un worker libre, résoudre la promesse sur onmessage(id) …
  // expose decode(id, bytes: ArrayBuffer): Promise<FitResult> et terminate()
  return { /* decode, terminate */ }
}
```

> ⚠️ Transférer l'`ArrayBuffer` au worker en **transferable** (`postMessage(msg, [bytes])`) pour éviter la copie (mémoire). À implémenter dans le pool.

- [ ] **Step 3 : tsc + eslint** (le worker peut nécessiter que `tsconfig` inclue `webworker` dans `lib` — vérifier ; sinon ajouter `/// <reference lib="webworker" />` en tête du worker).

- [ ] **Step 4 : Commit** `feat(garmin-fit): web worker + pool for parallel FIT decoding`

---

## Task 8 : UI Étape 2 — enrichissement (intégration)

**Files:**
- Modify: `web/components/import/garmin/GarminImportFlow.tsx`
- Create: `web/components/import/garmin/EnrichmentStep.tsx`

Comportement :
- Conserver le `File` choisi en `useRef`/state (`onFile` garde `file`).
- Après le commit Phase 1 (`state='done'`), proposer l'enrichissement : nouvel état `'enrich_offer'` rendu par `EnrichmentStep` (texte « Enrichir avec les données détaillées (FC seconde par seconde, découplage, GAP)… » + boutons « Enrichir » / « Plus tard »).
- Sur « Enrichir » → `state='enriching'` :
  1. GET `/api/garmin-import/needs-streams?from&to` (période de l'import) → `EnrichCandidate[]`. Si vide → message « Rien à enrichir », retour `done`.
  2. `buildActivityIndex(cands)`.
  3. `createFitPool()`. `forEachFit(outerZipBytes, async (name, bytes) => …)` : pour chaque FIT, peek léger n'est pas trivial → décoder via le pool (le décodage renvoie `startTimeMs`), `matchFit({activityId:null, startTimeMs}, idx)`. Si match → `packStreamsClient(streams)` → bufferiser `{activityId, streamsGz, pointCount}`. Tenir un compteur de progression sur le nombre de FIT traités.
  4. POST les uploads par lots (ex. 50) à `/api/garmin-import/streams` ; **dernier lot avec `?recalc=1`** pour recompute CES une seule fois.
  5. Barre de progression (réutiliser le `ProgressBar` de Phase 1 — l'exporter ou le dupliquer).
  6. Récap : `{enriched}` activités enrichies, `{errors}` erreurs → CTA Cockpit.
- `beforeunload` actif pendant `'enriching'`.
- Garder l'`ArrayBuffer` de l'outer-zip : en Phase 1 on lit déjà `file.arrayBuffer()` ; le réutiliser (le garder en ref) plutôt que re-lire, OU re-lire depuis le `File` au début de l'enrichissement pour limiter la rétention mémoire entre les phases (préférable pour les gros exports → re-`file.arrayBuffer()` au lancement de l'enrichissement).

> ⚠️ Mémoire : ne pas garder à la fois le `Uint8Array` Phase 1 et les FIT décodés. Libérer le buffer résumés après le commit ; relire `file.arrayBuffer()` au début de l'enrichissement.

- [ ] **Step 1** : garder `file` ; ajouter états `enrich_offer` / `enriching` / progression.
- [ ] **Step 2** : `EnrichmentStep.tsx` (offer + progression + récap) au style `trail-*`.
- [ ] **Step 3** : orchestration (needs-streams → forEachFit+pool → match → pack → POST lots → recalc).
- [ ] **Step 4** : tsc + eslint sur `components/import` et `app/(main)/import`.
- [ ] **Step 5** : Commit `feat(garmin-fit): optional enrichment step (workers → streams → CES)`

---

## Task 9 : Parcours réel + ajustements (manuel, Franck)

**Files:** —

- [ ] **Step 1** : `npm run dev`, importer l'export Garmin réel, lancer l'Étape 2.
- [ ] **Step 2** : vérifier — sur 3 activités trail connues — que le détail affiche désormais FC/altitude, et que le CES change (découplage/GAP pris en compte). Comparer la cohérence du D− vs Garmin Connect.
- [ ] **Step 3** : surveiller la mémoire (onglet Performances) sur l'export complet ; si un `UploadedFiles_*.zip` fait freezer/OOM, basculer `nested-unzip` sur l'API streaming `Unzip` de fflate (cf. note Task 4).
- [ ] **Step 4** : vérifier qu'un second passage d'enrichissement n'écrit rien (activités déjà streamées exclues par `needs-streams`).
- [ ] **Step 5** : MAJ doc — bandeau `Status: Implémenté` sur le plan Phase 1/2, MAJ `docs/reference/` si le modèle CES change, retirer l'item Phase 2 de `tasks/backlog.md`.

---

## Self-review (couverture)

- Décodage FIT + grade dérivé → Task 2 (TDD). ✓
- Matching id/timestamp → Task 3 (TDD). ✓
- Streaming zips imbriqués mémoire-borné → Task 4 (TDD) + note streaming Task 9. ✓
- Pack client interop gzip → Task 5 (TDD). ✓
- Écriture streams + recalc CES (réutilise `recalculateUserEffortScores`) → Task 6. ✓
- Pool de workers (concurrence bornée, transferable) → Task 7. ✓
- Flux intégré optionnel + périmètre (sans-streams matchées) + progression + beforeunload → Task 8. ✓
- Validation réelle + bascule streaming si OOM + doc → Task 9. ✓

## Risques connus / à confirmer à l'exécution

- **API exacte `@garmin/fitsdk`** (noms de champs/messages, Encoder pour tests) → dé-risqué par le spike Task 1.
- **Bundling Web Worker dans Next 14** (`new Worker(new URL(...))`) → standard webpack 5 ; à confirmer Task 7 (sinon, fallback : worker en fichier `public/` + classic worker).
- **Mémoire sur très gros nested-zip** → bascule vers `Unzip` streaming si besoin (Task 4/9).
- **Fiabilité du matching par timestamp** si plusieurs activités très rapprochées (< 2 min) → on prend la plus proche ; acceptable, à valider Task 9.
