# Import historique Garmin (export GDPR) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un utilisateur d'uploader son export GDPR Garmin (ZIP) et d'importer tout son historique d'activités — parsing 100 % côté navigateur, CES calculé, charge ATL/CTL/TSB cohérente, **zéro doublon** garanti par un écran de résolution de conflits.

**Architecture (Phase 1 — ce plan) :** Le navigateur lit le ZIP avec `fflate` (aucun upload du ZIP), extrait uniquement les `*summarizedActivities*.json`, mappe vers `NormalizedActivity`, calcule le CES localement, détecte les doublons contre les activités existantes, présente un écran de résolution, puis POST des batchs JSON normalisés à une route serveur `/api/garmin-import/*` qui **re-vérifie les doublons** et écrit via service client (RLS respecté : `user_id` dérivé de la session). ATL/CTL/TSB sont recalculés automatiquement à la lecture (`buildChargeMetrics`) — pas d'étape de recalcul à coder.

**Phase 2 (plan séparé, esquissée en fin de document) :** parsing des `.fit` imbriqués via `@garmin/fitsdk` en Web Workers → streams réels (decoupling, GAP, D−) → enrichissement des activités conservées + CES affiné.

**Tech Stack :** Next.js 14 App Router, TypeScript strict, Supabase (service client serveur), `fflate` (nouvelle dép.), Jest. Réutilise `effort-score.ts`, `stream-metrics.ts`, `NormalizedActivity`.

---

## Décisions d'architecture (validées avec Franck, 2026-06-09)

1. **Écriture = route API serveur.** Le navigateur ne touche jamais Supabase directement. Raisons : `activity_metrics` a RLS activé **sans policy utilisateur** (écriture client impossible) ; le « remplacement » d'une activité Strava nécessite un `DELETE` que le client ne peut pas faire (pas de policy DELETE sur `activities`) ; le re-check anti-concurrence est plus fiable côté serveur. La route dérive `user_id` de la session (`getServerUser()`), **ignore tout `user_id` envoyé par le client**.
2. **Phasage : résumés d'abord.** Phase 1 importe depuis `summarizedActivities.json` (CES via modèle HR-proxy / allure-seuil, + facteur descente depuis le `elevationLoss` du résumé). Phase 2 ajoute les streams FIT. Chaque phase est livrable et testable seule.
3. **Provider Strava intouché.** On crée un chemin dédié `lib/garmin-import/` ; on ne modifie ni `lib/providers/strava/*` ni `importActivities` (Strava).
4. **`NormalizedActivity` inchangé.** Le type couvre déjà `provider: 'garmin'`. La perte de dénivelé (`elevationLoss`) ne devient pas un champ : elle est passée à `computeCesResult` via `CesStreamMetrics.elevationLossM` au moment du commit, et persistée comme métrique `elevation_loss_m`.
5. **Recalcul de charge = gratuit.** `daily_metrics` n'est plus maintenue ; `data/charge.ts` recalcule l'EWMA à la lecture sur ~1 an. Aucune tâche de recalcul ATL/CTL/TSB à écrire — il suffit que les activités + CES soient en base.
6. **Route group réel = `(main)`** (le prompt disait `(dashboard)`). Page : `app/(main)/import/garmin/page.tsx`, accessible depuis Réglages.

### Politique de résolution des conflits (Phase 1)

- **Garder Strava** (défaut) : le doublon Garmin est ignoré, rien n'est écrit pour lui.
- **Remplacer par Garmin** : la ligne existante (typiquement Strava) est **soft-deletée** (`deleted_at = now()`, cohérent avec migration 008) puis l'activité Garmin (résumé) est insérée. Garantit **une seule ligne active** par activité réelle.
  - ⚠️ Limite assumée Phase 1 : la version Garmin de résumé n'a pas de streams (CES via HR-proxy). Le « vrai » remplacement enrichi (streams FIT) arrive en Phase 2. L'option *« Enrichir les activités conservées »* du prompt est donc **déférée en Phase 2** (elle exige les FIT). L'UI Phase 1 ne montre pas cette case.
  - ⚠️ Si Strava reste connecté, une re-sync future peut re-créer la ligne soft-deletée. C'est inhérent à garder les deux providers ; documenté, hors scope Phase 1.
- **Mode avancé (repliable)** : choix par activité (`keep_strava` | `replace_garmin`) avec comparaison côte à côte (date, distance, durée, D+, FC dispo par source).
- **Re-check serveur** : juste avant écriture, le commit recharge l'état DB courant et re-classe chaque conflit (gère un webhook Strava arrivé pendant l'import). Idempotence par `upsert onConflict (user_id, provider, provider_activity_id)`.

---

## Structure de fichiers

**Créés — client (purs, testables) :**
- `web/lib/garmin-import/types.ts` — types entrée/sortie (raw Garmin, rapport, conflits).
- `web/lib/garmin-import/unzip.ts` — fflate : localise + parse les `*summarizedActivities*.json`. Aucune extraction totale en mémoire.
- `web/lib/garmin-import/mapper.ts` — `garminSummaryToNormalized()` : conversions d'unités + mapping sport + sanity-checks.
- `web/lib/garmin-import/dedup.ts` — `matchesExisting()`, `classifyActivities()` (purs).

**Créés — serveur :**
- `web/lib/garmin-import/commit.ts` — écriture service-client : upsert nouvelles, soft-delete + insert pour remplacements, CES (avec `elevationLossM`), métriques. Re-dedup.
- `web/app/api/garmin-import/existing/route.ts` — GET activités existantes sur la plage de dates (pour dedup client).
- `web/app/api/garmin-import/commit/route.ts` — POST batch normalisé + décisions → `commit.ts`.

**Créés — UI :**
- `web/app/(main)/import/garmin/page.tsx` — page (server) qui rend le client component.
- `web/components/import/garmin/GarminImportFlow.tsx` — orchestration des phases (`'use client'`).
- `web/components/import/garmin/ConflictResolution.tsx` — écran de résolution.

**Modifiés :**
- `web/package.json` — ajout dép. `fflate`.
- `web/components/settings/*` (section Réglages) — lien vers `/import/garmin` (1 ligne, à confirmer à l'exécution selon le composant Réglages réel).
- `web/lib/i18n/dictionaries/fr.ts` + `en.ts` — clés UI (si le reste de l'app i18n l'exige ; sinon textes FR en dur comme `ManualImportSection`).

**Tests :** miroir sous `web/__tests__/lib/garmin-import/`.

---

## Task 1 : Dépendance `fflate` + types

**Files:**
- Modify: `web/package.json`
- Create: `web/lib/garmin-import/types.ts`

- [ ] **Step 1 : Installer fflate**

Run (depuis `web/`) : `npm install fflate@^0.8.2`
Expected : `package.json` gagne `"fflate": "^0.8.2"` dans `dependencies`, `package-lock.json` mis à jour.

- [ ] **Step 2 : Écrire les types**

```ts
// web/lib/garmin-import/types.ts
import type { NormalizedActivity } from '@/lib/providers/strava/mapper'

/** Activité brute telle que lue dans summarizedActivities.json (champs partiels, unités Garmin). */
export type GarminSummaryActivity = {
  activityId?: number
  activityType?: string | { typeKey?: string }
  beginTimestamp?: number      // epoch ms GMT
  startTimeLocal?: number       // epoch ms (heure locale)
  distance?: number             // centimètres
  duration?: number             // millisecondes (elapsed)
  movingDuration?: number       // millisecondes
  elevationGain?: number        // centimètres
  elevationLoss?: number        // centimètres
  avgHr?: number
  maxHr?: number
  avgSpeed?: number             // unité à valider empiriquement
  calories?: number
  activityName?: string
}

/** Résultat du mapping d'une activité, avec D− conservé pour le CES au commit. */
export type GarminMapped = {
  normalized: NormalizedActivity
  elevationLossM: number | null
}

export type MapWarning = { activityId: string; field: string; message: string }

/** Activité existante en base, projetée pour le matching de doublons. */
export type ExistingActivity = {
  id: string
  provider: string
  providerActivityId: string
  startTime: string            // ISO
  movingTimeSec: number
  durationSec: number
  distanceM: number
  avgHr: number | null
  elevationGainM: number | null
}

export type ConflictDecision = 'keep_strava' | 'replace_garmin'

export type ConflictItem = {
  garmin: GarminMapped
  existing: ExistingActivity
  decision: ConflictDecision   // défaut 'keep_strava'
}

export type DedupClassification = {
  nouvelles: GarminMapped[]
  conflits: ConflictItem[]
}

export type ImportReport = {
  totalParsed: number
  imported: number
  conflictsKeptStrava: number
  conflictsReplaced: number
  errors: number
  warnings: MapWarning[]
  periodStart: string | null
  periodEnd: string | null
}
```

- [ ] **Step 3 : Commit**

```bash
git add web/package.json web/package-lock.json web/lib/garmin-import/types.ts
git commit -m "feat(garmin-import): add fflate dep + import types"
```

---

## Task 2 : Mapper Garmin → NormalizedActivity (TDD)

**Files:**
- Create: `web/lib/garmin-import/mapper.ts`
- Test: `web/__tests__/lib/garmin-import/mapper.test.ts`

- [ ] **Step 1 : Test qui échoue**

```ts
// web/__tests__/lib/garmin-import/mapper.test.ts
import { garminSummaryToMapped } from '@/lib/garmin-import/mapper'
import type { GarminSummaryActivity } from '@/lib/garmin-import/types'

const base: GarminSummaryActivity = {
  activityId: 123456789,
  activityType: 'trail_running',
  beginTimestamp: 1_600_000_000_000,
  startTimeLocal: 1_600_007_200_000, // +2h (local labellisé)
  distance: 1_050_000,   // cm → 10500 m
  duration: 3_600_000,   // ms → 3600 s
  movingDuration: 3_500_000, // ms → 3500 s
  elevationGain: 55_000, // cm → 550 m
  elevationLoss: 60_000, // cm → 600 m
  avgHr: 150,
  maxHr: 175,
  calories: 800,
  activityName: 'Sortie trail',
}

test('convertit les unités Garmin (cm→m, ms→s, epoch→ISO) et mappe le sport', () => {
  const { normalized, elevationLossM } = garminSummaryToMapped('user-1', base).result!
  expect(normalized.provider).toBe('garmin')
  expect(normalized.providerActivityId).toBe('123456789')
  expect(normalized.sportType).toBe('trail_running')
  expect(normalized.distanceM).toBe(10500)
  expect(normalized.durationSec).toBe(3600)
  expect(normalized.movingTimeSec).toBe(3500)
  expect(normalized.elevationGainM).toBe(550)
  expect(normalized.avgHr).toBe(150)
  expect(normalized.maxHr).toBe(175)
  expect(elevationLossM).toBe(600)
  // start_time = heure locale étiquetée UTC (convention repo) → dérivé de startTimeLocal
  expect(normalized.startTime).toBe(new Date(1_600_007_200_000).toISOString())
})

test('activityType objet { typeKey } supporté', () => {
  const { normalized } = garminSummaryToMapped('u', { ...base, activityType: { typeKey: 'running' } }).result!
  expect(normalized.sportType).toBe('running')
})

test('sans activityId → erreur, pas de crash', () => {
  const out = garminSummaryToMapped('u', { ...base, activityId: undefined })
  expect(out.result).toBeNull()
  expect(out.warning?.field).toBe('activityId')
})

test('incohérence vitesse/distance/durée → warning mais mappe quand même', () => {
  // distance 10500 m / 3500 s ≈ 3.0 m/s ; avgSpeed 30 (incohérent d'un facteur 10)
  const out = garminSummaryToMapped('u', { ...base, avgSpeed: 30 })
  expect(out.result).not.toBeNull()
  expect(out.warning?.field).toBe('avgSpeed')
})
```

- [ ] **Step 2 : Lancer → échoue**

Run : `cd web && npx jest garmin-import/mapper`
Expected : FAIL « Cannot find module '@/lib/garmin-import/mapper' ».

- [ ] **Step 3 : Implémenter**

```ts
// web/lib/garmin-import/mapper.ts
import type { NormalizedActivity } from '@/lib/providers/strava/mapper'
import type { GarminSummaryActivity, GarminMapped, MapWarning } from './types'

const cmToM = (cm?: number) => (cm != null ? Math.round((cm / 100) * 10) / 10 : 0)
const msToS = (ms?: number) => (ms != null ? Math.round(ms / 1000) : 0)

function sportKey(t: GarminSummaryActivity['activityType']): string {
  if (!t) return 'other'
  return typeof t === 'string' ? t : (t.typeKey ?? 'other')
}

/** Sanity-check vitesse : avgSpeed (présumé m/s) doit être ≈ distance/durée à ±30 %. */
function speedWarning(a: GarminSummaryActivity, distanceM: number, movingSec: number, id: string): MapWarning | null {
  if (a.avgSpeed == null || distanceM <= 0 || movingSec <= 0) return null
  const expected = distanceM / movingSec
  const ratio = a.avgSpeed / expected
  if (ratio < 0.7 || ratio > 1.4) {
    return { activityId: id, field: 'avgSpeed', message: `avgSpeed=${a.avgSpeed} incohérent (attendu ≈ ${expected.toFixed(2)} m/s)` }
  }
  return null
}

export type MapOutcome = { result: GarminMapped | null; warning: MapWarning | null }

export function garminSummaryToMapped(userId: string, a: GarminSummaryActivity): MapOutcome {
  if (a.activityId == null) {
    return { result: null, warning: { activityId: '?', field: 'activityId', message: 'activityId manquant' } }
  }
  const id = String(a.activityId)
  const distanceM = cmToM(a.distance)
  const durationSec = msToS(a.duration)
  const movingTimeSec = msToS(a.movingDuration) || durationSec
  const localMs = a.startTimeLocal ?? a.beginTimestamp
  if (localMs == null) {
    return { result: null, warning: { activityId: id, field: 'startTime', message: 'aucun timestamp' } }
  }
  const startTime = new Date(localMs).toISOString()

  const normalized: NormalizedActivity = {
    userId,
    provider: 'garmin',
    providerActivityId: id,
    sportType: sportKey(a.activityType),
    name: a.activityName ?? 'Activité Garmin',
    startTime,
    durationSec,
    movingTimeSec,
    distanceM,
    elevationGainM: cmToM(a.elevationGain),
    avgHr: a.avgHr != null ? Math.round(a.avgHr) : null,
    maxHr: a.maxHr != null ? Math.round(a.maxHr) : null,
    avgPower: null,
    calories: a.calories ?? null,
    externalTrainingLoad: null,
    rawPayload: { source: 'garmin_gdpr', summary: a },
  }
  return {
    result: { normalized, elevationLossM: a.elevationLoss != null ? cmToM(a.elevationLoss) : null },
    warning: speedWarning(a, distanceM, movingTimeSec, id),
  }
}
```

- [ ] **Step 4 : Lancer → passe**

Run : `cd web && npx jest garmin-import/mapper`
Expected : PASS (4 tests).

- [ ] **Step 5 : Commit**

```bash
git add web/lib/garmin-import/mapper.ts web/__tests__/lib/garmin-import/mapper.test.ts
git commit -m "feat(garmin-import): map Garmin summary to NormalizedActivity with unit checks"
```

---

## Task 3 : Extraction ZIP via fflate (TDD)

**Files:**
- Create: `web/lib/garmin-import/unzip.ts`
- Test: `web/__tests__/lib/garmin-import/unzip.test.ts`

- [ ] **Step 1 : Test qui échoue** (on fabrique un ZIP en mémoire avec `zipSync` de fflate)

```ts
// web/__tests__/lib/garmin-import/unzip.test.ts
import { zipSync, strToU8 } from 'fflate'
import { extractSummaries } from '@/lib/garmin-import/unzip'

function buildZip(files: Record<string, string>): Uint8Array {
  const entries: Record<string, Uint8Array> = {}
  for (const [path, content] of Object.entries(files)) entries[path] = strToU8(content)
  return zipSync(entries)
}

test('lit uniquement les *summarizedActivities*.json et ignore le reste', () => {
  const summaries = JSON.stringify([{ summarizedActivitiesExport: [{ activityId: 1 }, { activityId: 2 }] }])
  const zip = buildZip({
    'DI_CONNECT/DI-Connect-Fitness/foo_0_summarizedActivities.json': summaries,
    'DI_CONNECT/DI-Connect-User/user_profile.json': '{"x":1}',
    'DI_CONNECT/DI-Connect-Uploaded-Files/UploadedFiles_0.zip': 'binaire-ignoré',
  })
  const acts = extractSummaries(zip)
  expect(acts.map(a => a.activityId)).toEqual([1, 2])
})

test('supporte un tableau racine sans wrapper', () => {
  const zip = buildZip({ 'DI_CONNECT/DI-Connect-Fitness/x_summarizedActivities.json': JSON.stringify([{ activityId: 9 }]) })
  expect(extractSummaries(zip).map(a => a.activityId)).toEqual([9])
})

test('plusieurs fichiers summarized → concaténés', () => {
  const zip = buildZip({
    'DI_CONNECT/DI-Connect-Fitness/a_0_summarizedActivities.json': JSON.stringify([{ activityId: 1 }]),
    'DI_CONNECT/DI-Connect-Fitness/a_1_summarizedActivities.json': JSON.stringify([{ activityId: 2 }]),
  })
  expect(extractSummaries(zip).map(a => a.activityId).sort()).toEqual([1, 2])
})

test('JSON corrompu dans un fichier → ignoré sans throw', () => {
  const zip = buildZip({
    'DI_CONNECT/DI-Connect-Fitness/ok_summarizedActivities.json': JSON.stringify([{ activityId: 5 }]),
    'DI_CONNECT/DI-Connect-Fitness/bad_summarizedActivities.json': '{ pas du json',
  })
  expect(extractSummaries(zip).map(a => a.activityId)).toEqual([5])
})
```

- [ ] **Step 2 : Lancer → échoue**

Run : `cd web && npx jest garmin-import/unzip`
Expected : FAIL « Cannot find module '@/lib/garmin-import/unzip' ».

- [ ] **Step 3 : Implémenter** (fflate `unzipSync` filtré ; ne décompresse que les entrées ciblées via le filtre)

```ts
// web/lib/garmin-import/unzip.ts
import { unzipSync } from 'fflate'
import type { GarminSummaryActivity } from './types'

const SUMMARY_RE = /DI-Connect-Fitness\/.*summarizedActivities.*\.json$/i

/** Déballe le contenu d'un fichier summarizedActivities (wrapper variable). */
function parseSummaryJson(text: string): GarminSummaryActivity[] {
  let json: unknown
  try { json = JSON.parse(text) } catch { return [] }
  // Formes connues : [{ summarizedActivitiesExport: [...] }] | [...] | { summarizedActivitiesExport: [...] }
  if (Array.isArray(json)) {
    if (json.length && typeof json[0] === 'object' && json[0] != null && 'summarizedActivitiesExport' in (json[0] as object)) {
      return (json as { summarizedActivitiesExport?: GarminSummaryActivity[] }[])
        .flatMap(w => w.summarizedActivitiesExport ?? [])
    }
    return json as GarminSummaryActivity[]
  }
  if (json && typeof json === 'object' && 'summarizedActivitiesExport' in json) {
    return (json as { summarizedActivitiesExport?: GarminSummaryActivity[] }).summarizedActivitiesExport ?? []
  }
  return []
}

/**
 * Extrait toutes les activités résumées du ZIP Garmin.
 * Le filtre de unzipSync ne décompresse QUE les fichiers summarized (les
 * UploadedFiles_*.zip volumineux ne sont jamais décompressés en Phase 1).
 */
export function extractSummaries(zip: Uint8Array): GarminSummaryActivity[] {
  const dec = new TextDecoder()
  const out: GarminSummaryActivity[] = []
  const files = unzipSync(zip, { filter: (f) => SUMMARY_RE.test(f.name) })
  for (const name of Object.keys(files)) {
    out.push(...parseSummaryJson(dec.decode(files[name])))
  }
  return out
}
```

> Note exécution : `unzipSync` (synchrone) suffit en Phase 1 car on ne décompresse **que** les JSON résumés (quelques Mo), pas les `.fit`. Si un export pose un souci de blocage UI au unzip du conteneur, basculer sur l'API asynchrone `unzip` de fflate — décision à l'exécution, garder `extractSummaries` synchrone par défaut (testable simplement).

- [ ] **Step 4 : Lancer → passe**

Run : `cd web && npx jest garmin-import/unzip`
Expected : PASS (4 tests).

- [ ] **Step 5 : Commit**

```bash
git add web/lib/garmin-import/unzip.ts web/__tests__/lib/garmin-import/unzip.test.ts
git commit -m "feat(garmin-import): extract summarizedActivities from GDPR zip via fflate"
```

---

## Task 4 : Déduplication cross-provider (TDD, pur)

**Files:**
- Create: `web/lib/garmin-import/dedup.ts`
- Test: `web/__tests__/lib/garmin-import/dedup.test.ts`

Critères de match (les trois ensemble) : début ±120 s **ET** durée ±1 % **ET** distance ±1 %.

- [ ] **Step 1 : Test qui échoue**

```ts
// web/__tests__/lib/garmin-import/dedup.test.ts
import { matchesExisting, classifyActivities } from '@/lib/garmin-import/dedup'
import type { ExistingActivity, GarminMapped } from '@/lib/garmin-import/types'

function mapped(over: Partial<GarminMapped['normalized']>): GarminMapped {
  return {
    normalized: {
      userId: 'u', provider: 'garmin', providerActivityId: '1', sportType: 'running',
      name: 'x', startTime: '2024-01-01T08:00:00.000Z', durationSec: 3600, movingTimeSec: 3600,
      distanceM: 10000, elevationGainM: 100, avgHr: 150, maxHr: 170, avgPower: null,
      calories: null, externalTrainingLoad: null, rawPayload: {}, ...over,
    },
    elevationLossM: 100,
  }
}
function existing(over: Partial<ExistingActivity>): ExistingActivity {
  return {
    id: 'e1', provider: 'strava', providerActivityId: 's1',
    startTime: '2024-01-01T08:00:00.000Z', movingTimeSec: 3600, durationSec: 3600,
    distanceM: 10000, avgHr: 150, elevationGainM: 100, ...over,
  }
}

test('match exact', () => {
  expect(matchesExisting(mapped({}).normalized, existing({}))).toBe(true)
})
test('décalage 90 s + 0.5 % distance + 0.5 % durée → match', () => {
  expect(matchesExisting(
    mapped({ startTime: '2024-01-01T08:01:30.000Z', distanceM: 10050, movingTimeSec: 3618 }).normalized,
    existing({}),
  )).toBe(true)
})
test('décalage 3 min → pas de match', () => {
  expect(matchesExisting(mapped({ startTime: '2024-01-01T08:03:00.000Z' }).normalized, existing({}))).toBe(false)
})
test('distance +5 % → pas de match', () => {
  expect(matchesExisting(mapped({ distanceM: 10500 }).normalized, existing({}))).toBe(false)
})

test('classifyActivities sépare nouvelles et conflits, défaut keep_strava', () => {
  const a = mapped({ providerActivityId: '1', startTime: '2024-01-01T08:00:00.000Z' })   // conflit
  const b = mapped({ providerActivityId: '2', startTime: '2024-06-01T08:00:00.000Z' })   // nouvelle
  const { nouvelles, conflits } = classifyActivities([a, b], [existing({})])
  expect(nouvelles.map(n => n.normalized.providerActivityId)).toEqual(['2'])
  expect(conflits).toHaveLength(1)
  expect(conflits[0].decision).toBe('keep_strava')
  expect(conflits[0].existing.id).toBe('e1')
})
```

- [ ] **Step 2 : Lancer → échoue**

Run : `cd web && npx jest garmin-import/dedup`
Expected : FAIL « Cannot find module ».

- [ ] **Step 3 : Implémenter**

```ts
// web/lib/garmin-import/dedup.ts
import type { NormalizedActivity } from '@/lib/providers/strava/mapper'
import type { ExistingActivity, GarminMapped, DedupClassification } from './types'

const START_TOLERANCE_MS = 120_000
const PCT_TOLERANCE = 0.01

function within(a: number, b: number, pct: number): boolean {
  const ref = Math.max(Math.abs(a), Math.abs(b))
  if (ref === 0) return true
  return Math.abs(a - b) / ref <= pct
}

export function matchesExisting(g: NormalizedActivity, e: ExistingActivity): boolean {
  const dt = Math.abs(new Date(g.startTime).getTime() - new Date(e.startTime).getTime())
  if (dt > START_TOLERANCE_MS) return false
  if (!within(g.movingTimeSec, e.movingTimeSec, PCT_TOLERANCE)) return false
  if (!within(g.distanceM, e.distanceM, PCT_TOLERANCE)) return false
  return true
}

export function classifyActivities(
  garmin: GarminMapped[],
  existing: ExistingActivity[],
): DedupClassification {
  // Index par jour pour éviter O(n*m) sur de gros historiques.
  const byDay = new Map<string, ExistingActivity[]>()
  for (const e of existing) {
    const day = e.startTime.slice(0, 10)
    const arr = byDay.get(day) ?? []
    arr.push(e)
    byDay.set(day, arr)
  }
  const candidates = (g: NormalizedActivity): ExistingActivity[] => {
    const d = new Date(g.startTime)
    const days = [d, new Date(d.getTime() - 86_400_000), new Date(d.getTime() + 86_400_000)]
      .map(x => x.toISOString().slice(0, 10))
    return days.flatMap(day => byDay.get(day) ?? [])
  }

  const nouvelles: GarminMapped[] = []
  const conflits: DedupClassification['conflits'] = []
  for (const g of garmin) {
    const hit = candidates(g.normalized).find(e => matchesExisting(g.normalized, e))
    if (hit) conflits.push({ garmin: g, existing: hit, decision: 'keep_strava' })
    else nouvelles.push(g)
  }
  return { nouvelles, conflits }
}
```

- [ ] **Step 4 : Lancer → passe**

Run : `cd web && npx jest garmin-import/dedup`
Expected : PASS (5 tests).

- [ ] **Step 5 : Commit**

```bash
git add web/lib/garmin-import/dedup.ts web/__tests__/lib/garmin-import/dedup.test.ts
git commit -m "feat(garmin-import): cross-provider duplicate detection"
```

---

## Task 5 : Helper de commit serveur (TDD)

**Files:**
- Create: `web/lib/garmin-import/commit.ts`
- Test: `web/__tests__/lib/garmin-import/commit.test.ts`

Responsabilités : calculer le CES (avec `elevationLossM` → facteur descente), upsert des nouvelles + de leurs métriques, et pour chaque remplacement : soft-delete de la ligne existante + insert Garmin. Écrit via service client passé en paramètre (injectable → mockable en test).

- [ ] **Step 1 : Test qui échoue** (mock du client Supabase, vérifie les appels)

```ts
// web/__tests__/lib/garmin-import/commit.test.ts
import { commitGarminImport } from '@/lib/garmin-import/commit'
import type { GarminMapped, ConflictItem } from '@/lib/garmin-import/types'

function fakeSupabase() {
  const calls: { table: string; op: string; rows: unknown }[] = []
  const api = {
    from(table: string) {
      return {
        upsert(rows: unknown) {
          calls.push({ table, op: 'upsert', rows })
          return { select: () => ({ data: asRows(rows), error: null }) , data: null, error: null }
        },
        update(rows: unknown) {
          return { eq: () => { calls.push({ table, op: 'update', rows }); return { error: null } } }
        },
      }
    },
  }
  function asRows(rows: unknown) {
    const arr = Array.isArray(rows) ? rows : [rows]
    return arr.map((r, i) => ({ id: `db-${i}`, provider_activity_id: (r as { provider_activity_id: string }).provider_activity_id }))
  }
  return { api, calls }
}

const g = (id: string): GarminMapped => ({
  normalized: {
    userId: 'u', provider: 'garmin', providerActivityId: id, sportType: 'running', name: 'n',
    startTime: '2024-01-01T08:00:00.000Z', durationSec: 3600, movingTimeSec: 3600, distanceM: 10000,
    elevationGainM: 100, avgHr: 150, maxHr: 170, avgPower: null, calories: null,
    externalTrainingLoad: null, rawPayload: {},
  },
  elevationLossM: 120,
})

test('insère les nouvelles + leurs métriques CES', async () => {
  const { api, calls } = fakeSupabase()
  const report = await commitGarminImport(api as never, 'u', { nouvelles: [g('1')], conflits: [] }, {})
  expect(report.imported).toBe(1)
  expect(calls.some(c => c.table === 'activities' && c.op === 'upsert')).toBe(true)
  expect(calls.some(c => c.table === 'activity_metrics' && c.op === 'upsert')).toBe(true)
})

test('remplacement : soft-delete de l’existant + insert Garmin', async () => {
  const { api, calls } = fakeSupabase()
  const conflit: ConflictItem = {
    garmin: g('2'),
    existing: { id: 'strava-row', provider: 'strava', providerActivityId: 's', startTime: '2024-01-01T08:00:00.000Z', movingTimeSec: 3600, durationSec: 3600, distanceM: 10000, avgHr: 150, elevationGainM: 100 },
    decision: 'replace_garmin',
  }
  const report = await commitGarminImport(api as never, 'u', { nouvelles: [], conflits: [conflit] }, {})
  expect(report.conflictsReplaced).toBe(1)
  // soft-delete = update deleted_at sur activities
  expect(calls.some(c => c.table === 'activities' && c.op === 'update')).toBe(true)
})

test('keep_strava : aucune écriture pour le conflit', async () => {
  const { api, calls } = fakeSupabase()
  const conflit: ConflictItem = {
    garmin: g('3'),
    existing: { id: 'x', provider: 'strava', providerActivityId: 's', startTime: '2024-01-01T08:00:00.000Z', movingTimeSec: 3600, durationSec: 3600, distanceM: 10000, avgHr: 150, elevationGainM: 100 },
    decision: 'keep_strava',
  }
  const report = await commitGarminImport(api as never, 'u', { nouvelles: [], conflits: [conflit] }, {})
  expect(report.conflictsKeptStrava).toBe(1)
  expect(calls).toHaveLength(0)
})
```

- [ ] **Step 2 : Lancer → échoue**

Run : `cd web && npx jest garmin-import/commit`
Expected : FAIL « Cannot find module ».

- [ ] **Step 3 : Implémenter**

```ts
// web/lib/garmin-import/commit.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeCesResult } from '@/lib/analytics/effort-score'
import type { UserProfileForCes, ActivityInput, CesStreamMetrics } from '@/lib/analytics/types'
import type { NormalizedActivity } from '@/lib/providers/strava/mapper'
import type { GarminMapped, DedupClassification, ImportReport } from './types'

function toActivityInput(act: NormalizedActivity): ActivityInput {
  return {
    id: act.providerActivityId,
    rawSportType: act.sportType,
    name: act.name,
    startDate: act.startTime,
    movingTimeSeconds: act.movingTimeSec,
    elapsedTimeSeconds: act.durationSec,
    distanceMeters: act.distanceM,
    elevationGainMeters: act.elevationGainM,
    averageHeartrate: act.avgHr ?? undefined,
    maxHeartrate: act.maxHr ?? undefined,
    calories: act.calories ?? undefined,
  }
}

function activityRow(userId: string, m: GarminMapped) {
  const sm: CesStreamMetrics | undefined =
    m.elevationLossM != null ? { gradeAdjustedPaceS: null, decouplingPct: null, elevationLossM: m.elevationLossM } : undefined
  const ces = computeCesResult(toActivityInput(m.normalized), {} as UserProfileForCes, sm)
  return { ces, sm, row: {
    user_id: userId,
    provider: 'garmin',
    provider_activity_id: m.normalized.providerActivityId,
    sport_type: m.normalized.sportType,
    name: m.normalized.name,
    start_time: m.normalized.startTime,
    duration_sec: m.normalized.durationSec,
    moving_time_sec: m.normalized.movingTimeSec,
    distance_m: m.normalized.distanceM,
    elevation_gain_m: m.normalized.elevationGainM,
    avg_hr: m.normalized.avgHr,
    max_hr: m.normalized.maxHr,
    avg_power: null,
    calories: m.normalized.calories,
    external_training_load: null,
    ces: ces.ces,
    effort_score_version: ces.version,
    effort_score_updated_at: new Date().toISOString(),
    raw_payload: m.normalized.rawPayload,
  } }
}

/** Recompute le CES avec le profil utilisateur fourni (chargé par la route). */
function withProfile(userId: string, m: GarminMapped, profile: UserProfileForCes) {
  const built = activityRow(userId, m)
  const sm = built.sm
  const ces = computeCesResult(toActivityInput(m.normalized), profile, sm)
  return { ces, row: { ...built.row, ces: ces.ces } }
}

async function insertActivitiesWithMetrics(
  supabase: SupabaseClient, userId: string, items: GarminMapped[], profile: UserProfileForCes,
): Promise<number> {
  if (items.length === 0) return 0
  let saved = 0
  const BATCH = 500
  for (let i = 0; i < items.length; i += BATCH) {
    const slice = items.slice(i, i + BATCH)
    const built = slice.map(m => withProfile(userId, m, profile))
    const { data, error } = await supabase
      .from('activities')
      .upsert(built.map(b => b.row), { onConflict: 'user_id,provider,provider_activity_id' })
      .select('id, provider_activity_id')
    if (error) throw new Error(`Garmin activity upsert: ${error.message}`)
    const rows = (data ?? []) as { id: string; provider_activity_id: string }[]
    const cesById = new Map(built.map(b => [b.row.provider_activity_id, b.ces]))
    const metricRows = rows.flatMap(r => {
      const ces = cesById.get(r.provider_activity_id)!
      const base = [
        { activity_id: r.id, metric_key: 'ces', metric_value: ces.ces },
        { activity_id: r.id, metric_key: 'cardio_load', metric_value: ces.cardioLoad },
        { activity_id: r.id, metric_key: 'muscle_load', metric_value: ces.muscleLoad },
        { activity_id: r.id, metric_key: 'intensity_factor', metric_value: ces.intensityFactor },
      ]
      return base
    })
    if (metricRows.length) {
      const { error: mErr } = await supabase.from('activity_metrics').upsert(metricRows, { onConflict: 'activity_id,metric_key' })
      if (mErr) throw new Error(`Garmin metrics upsert: ${mErr.message}`)
    }
    saved += rows.length
  }
  return saved
}

export async function commitGarminImport(
  supabase: SupabaseClient,
  userId: string,
  classification: DedupClassification,
  profile: UserProfileForCes,
): Promise<ImportReport> {
  const replacements = classification.conflits.filter(c => c.decision === 'replace_garmin')
  const keptStrava = classification.conflits.length - replacements.length

  // Soft-delete des lignes remplacées AVANT insert (garantit une seule ligne active).
  for (const r of replacements) {
    await supabase.from('activities').update({ deleted_at: new Date().toISOString() }).eq('id', r.existing.id)
  }

  const toInsert = [...classification.nouvelles, ...replacements.map(r => r.garmin)]
  const imported = await insertActivitiesWithMetrics(supabase, userId, toInsert, profile)

  const dates = toInsert.map(m => m.normalized.startTime).sort()
  return {
    totalParsed: classification.nouvelles.length + classification.conflits.length,
    imported,
    conflictsKeptStrava: keptStrava,
    conflictsReplaced: replacements.length,
    errors: 0,
    warnings: [],
    periodStart: dates[0] ?? null,
    periodEnd: dates[dates.length - 1] ?? null,
  }
}
```

> ⚠️ Dépendance schéma : `deleted_at` existe sur `activities` (migration 008). `effort_score_version` / `effort_score_updated_at` existent (migration 006). À vérifier au début de l'exécution via `web/supabase/migrations/008_*.sql` et `006_*.sql`. **Aucune migration nouvelle n'est requise en Phase 1.**

- [ ] **Step 4 : Lancer → passe**

Run : `cd web && npx jest garmin-import/commit`
Expected : PASS (3 tests).

- [ ] **Step 5 : Commit**

```bash
git add web/lib/garmin-import/commit.ts web/__tests__/lib/garmin-import/commit.test.ts
git commit -m "feat(garmin-import): server commit helper (insert + replace + metrics)"
```

---

## Task 6 : Routes API (existing + commit)

**Files:**
- Create: `web/app/api/garmin-import/existing/route.ts`
- Create: `web/app/api/garmin-import/commit/route.ts`

- [ ] **Step 1 : Route `existing` (GET)** — renvoie les activités sur la plage de dates pour la dedup client.

```ts
// web/app/api/garmin-import/existing/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import type { ExistingActivity } from '@/lib/garmin-import/types'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')
  let q = supabase
    .from('activities')
    .select('id, provider, provider_activity_id, start_time, moving_time_sec, duration_sec, distance_m, avg_hr, elevation_gain_m')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('start_time', { ascending: true })
    .limit(10000)
  if (from) q = q.gte('start_time', from)
  if (to) q = q.lte('start_time', to)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const out: ExistingActivity[] = (data ?? []).map(r => ({
    id: String(r.id), provider: String(r.provider), providerActivityId: String(r.provider_activity_id),
    startTime: String(r.start_time), movingTimeSec: Number(r.moving_time_sec ?? 0),
    durationSec: Number(r.duration_sec ?? 0), distanceM: Number(r.distance_m ?? 0),
    avgHr: r.avg_hr != null ? Number(r.avg_hr) : null,
    elevationGainM: r.elevation_gain_m != null ? Number(r.elevation_gain_m) : null,
  }))
  return NextResponse.json(out)
}
```

- [ ] **Step 2 : Route `commit` (POST)** — re-dedup serveur + écriture via service client.

```ts
// web/app/api/garmin-import/commit/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/database/get-user'
import { createClient, createServiceClient } from '@/lib/database/supabase-server'
import { classifyActivities } from '@/lib/garmin-import/dedup'
import { commitGarminImport } from '@/lib/garmin-import/commit'
import type { GarminMapped, ConflictItem, ExistingActivity } from '@/lib/garmin-import/types'
import type { UserProfileForCes } from '@/lib/analytics/types'

type Body = {
  nouvelles: GarminMapped[]
  conflits: ConflictItem[]   // avec décisions de l'utilisateur
}

export async function POST(req: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Body
  try { body = (await req.json()) as Body } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }) }

  // user_id dérivé de la session — on écrase tout user_id client (sécurité RLS-équivalente).
  const forceUser = (m: GarminMapped): GarminMapped => ({ ...m, normalized: { ...m.normalized, userId: user.id } })
  const nouvelles = (body.nouvelles ?? []).map(forceUser)
  const conflits = (body.conflits ?? []).map(c => ({ ...c, garmin: forceUser(c.garmin) }))

  // Profil pour le CES.
  const rls = await createClient()
  const { data: profileRow } = await rls
    .from('profiles')
    .select('max_hr, resting_hr, threshold_hr, aerobic_threshold_hr, ftp_watts, threshold_pace_run_sec_per_km, threshold_pace_trail_sec_per_km')
    .eq('id', user.id).maybeSingle()
  const profile: UserProfileForCes = profileRow ?? {}

  // RE-CHECK anti-concurrence : recharger l'état DB courant et reclasser.
  const all = [...nouvelles, ...conflits.map(c => c.garmin)]
  const dates = all.map(m => m.normalized.startTime).sort()
  const service = createServiceClient()
  const { data: existRows } = await service
    .from('activities')
    .select('id, provider, provider_activity_id, start_time, moving_time_sec, duration_sec, distance_m, avg_hr, elevation_gain_m')
    .eq('user_id', user.id).is('deleted_at', null)
    .gte('start_time', dates[0] ?? '1970-01-01').lte('start_time', dates[dates.length - 1] ?? '2999-01-01')
  const existing: ExistingActivity[] = (existRows ?? []).map(r => ({
    id: String(r.id), provider: String(r.provider), providerActivityId: String(r.provider_activity_id),
    startTime: String(r.start_time), movingTimeSec: Number(r.moving_time_sec ?? 0),
    durationSec: Number(r.duration_sec ?? 0), distanceM: Number(r.distance_m ?? 0),
    avgHr: r.avg_hr != null ? Number(r.avg_hr) : null,
    elevationGainM: r.elevation_gain_m != null ? Number(r.elevation_gain_m) : null,
  }))

  // Reclasse SANS perdre les décisions utilisateur : une nouvelle qui matche désormais
  // une ligne existante devient un conflit défaut keep_strava (sécurité anti-doublon).
  const fresh = classifyActivities(all, existing)
  const decisionByExisting = new Map(conflits.map(c => [c.existing.id, c.decision]))
  const merged = {
    nouvelles: fresh.nouvelles,
    conflits: fresh.conflits.map(c => ({ ...c, decision: decisionByExisting.get(c.existing.id) ?? 'keep_strava' as const })),
  }

  try {
    const report = await commitGarminImport(service, user.id, merged, profile)
    return NextResponse.json(report)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Commit échoué' }, { status: 500 })
  }
}
```

- [ ] **Step 3 : Vérif type + lint**

Run : `cd web && npx tsc --noEmit && npx eslint app/api/garmin-import`
Expected : 0 erreur (le build autoritatif reste Vercel — cf. mémoire `reference_windows_local_build`).

- [ ] **Step 4 : Commit**

```bash
git add web/app/api/garmin-import
git commit -m "feat(garmin-import): existing + commit API routes with server-side re-dedup"
```

---

## Task 7 : UI — flow d'import

**Files:**
- Create: `web/app/(main)/import/garmin/page.tsx`
- Create: `web/components/import/garmin/GarminImportFlow.tsx`
- Create: `web/components/import/garmin/ConflictResolution.tsx`

> Pas de TDD UI (cohérent avec `ManualImportSection` non testé). Vérification = lint + parcours manuel (`npm run dev`). Textes FR en dur (comme `ManualImportSection`), dark theme, classes `trail-*`.

- [ ] **Step 1 : Page server**

```tsx
// web/app/(main)/import/garmin/page.tsx
import { GarminImportFlow } from '@/components/import/garmin/GarminImportFlow'

export default function GarminImportPage() {
  return <GarminImportFlow />
}
```

- [ ] **Step 2 : `GarminImportFlow.tsx`** — machine à états : `intro → parsing → resolve → committing → done | error`.

Comportement requis (résumé ; le code complet suit le pattern `ManualImportSection` pour le style) :
- **intro** : explication + lien `https://www.garmin.com/fr-FR/account/datamanagement/` (target _blank, rel noopener) + mention 24–48 h ; dropzone/file-picker `accept=".zip"`.
- **À la sélection** : lire le fichier en `ArrayBuffer` → `new Uint8Array` → `extractSummaries` → `garminSummaryToMapped` (collecter warnings, ignorer les `result === null`) → calcule `periodStart/End` → GET `/api/garmin-import/existing?from&to` → `classifyActivities`. Afficher « Analyse des activités : X / Y » (compteur sur la boucle de mapping).
- Si `conflits.length === 0` → aller direct à **committing**.
- Sinon → **resolve** (rendre `<ConflictResolution>`).
- **committing** : POST `/api/garmin-import/commit` avec `{ nouvelles, conflits }`. Spinner « Import en cours… ».
- **done** : récap (importées, conflits gardés Strava / remplacés, erreurs, période) + CTA `<Link href="/dashboard">` Cockpit + `router.refresh()`.
- **beforeunload** : `useEffect` ajoutant un handler `beforeunload` qui `preventDefault()` tant que l'état ∈ {parsing, committing}. Survit au changement d'onglet (le travail est en mémoire JS ; pas de dépendance au focus).

```tsx
// squelette — à compléter au style trail-* pendant l'exécution
'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { extractSummaries } from '@/lib/garmin-import/unzip'
import { garminSummaryToMapped } from '@/lib/garmin-import/mapper'
import { classifyActivities } from '@/lib/garmin-import/dedup'
import type { GarminMapped, ConflictItem, ExistingActivity, ImportReport, MapWarning } from '@/lib/garmin-import/types'
import { ConflictResolution } from './ConflictResolution'

type State = 'intro' | 'parsing' | 'resolve' | 'committing' | 'done' | 'error'

export function GarminImportFlow() {
  const router = useRouter()
  const [state, setState] = useState<State>('intro')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [nouvelles, setNouvelles] = useState<GarminMapped[]>([])
  const [conflits, setConflits] = useState<ConflictItem[]>([])
  const [report, setReport] = useState<ImportReport | null>(null)
  const [warnings, setWarnings] = useState<MapWarning[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const busy = state === 'parsing' || state === 'committing'
    if (!busy) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [state])

  async function onFile(file: File) {
    setState('parsing'); setErrorMsg('')
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      const summaries = extractSummaries(buf)
      setProgress({ done: 0, total: summaries.length })
      const mapped: GarminMapped[] = []
      const warns: MapWarning[] = []
      for (let i = 0; i < summaries.length; i++) {
        const out = garminSummaryToMapped('me', summaries[i])
        if (out.result) mapped.push(out.result)
        if (out.warning) warns.push(out.warning)
        if (i % 200 === 0) setProgress({ done: i, total: summaries.length })
      }
      setWarnings(warns)
      const dates = mapped.map(m => m.normalized.startTime).sort()
      const params = new URLSearchParams()
      if (dates[0]) params.set('from', dates[0])
      if (dates[dates.length - 1]) params.set('to', dates[dates.length - 1])
      const existing = (await (await fetch(`/api/garmin-import/existing?${params}`)).json()) as ExistingActivity[]
      const cls = classifyActivities(mapped, existing)
      setNouvelles(cls.nouvelles); setConflits(cls.conflits)
      if (cls.conflits.length === 0) await commit(cls.nouvelles, [])
      else setState('resolve')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Échec du parsing'); setState('error')
    }
  }

  async function commit(nv: GarminMapped[], cf: ConflictItem[]) {
    setState('committing')
    try {
      const res = await fetch('/api/garmin-import/commit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nouvelles: nv, conflits: cf }),
      })
      const json = (await res.json()) as ImportReport & { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Commit échoué')
      setReport({ ...json, warnings }); setState('done'); router.refresh()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Échec du commit'); setState('error')
    }
  }

  // … rendu par état (intro/parsing/resolve/committing/done/error) au style trail-* …
  return null // remplacer par le JSX pendant l'exécution
}
```

- [ ] **Step 3 : `ConflictResolution.tsx`**

- En-tête : « {N} activités existent déjà via Strava. Quelle source veux-tu conserver ? »
- Deux boutons globaux (un tap) : « Garder mes données Strava » (toutes décisions → `keep_strava`) / « Remplacer par les données Garmin » (toutes → `replace_garmin`), puis appelle `onResolve(conflits)`.
- Mode avancé repliable (`<details>`) : liste avec comparaison côte à côte (date, distance, durée, D+, FC dispo par source) + toggle par activité.
- Bouton « Annuler l'import » → `onCancel()` (retour intro).

```tsx
// squelette
'use client'
import { useState } from 'react'
import type { ConflictItem, ConflictDecision } from '@/lib/garmin-import/types'

export function ConflictResolution({ conflits, onResolve, onCancel }: {
  conflits: ConflictItem[]
  onResolve: (resolved: ConflictItem[]) => void
  onCancel: () => void
}) {
  const [items, setItems] = useState(conflits)
  const setAll = (d: ConflictDecision) => onResolve(items.map(c => ({ ...c, decision: d })))
  const setOne = (i: number, d: ConflictDecision) =>
    setItems(prev => prev.map((c, idx) => idx === i ? { ...c, decision: d } : c))
  // … JSX trail-* : en-tête, 2 CTA globaux, <details> avancé, bouton annuler …
  return null
}
```

- [ ] **Step 4 : Compléter le JSX au style trail-*, vérifier lint**

Run : `cd web && npx eslint app/(main)/import components/import`
Expected : 0 erreur.

- [ ] **Step 5 : Commit**

```bash
git add "web/app/(main)/import" web/components/import
git commit -m "feat(garmin-import): import UI flow with conflict resolution screen"
```

---

## Task 8 : Point d'entrée Réglages + parcours manuel

**Files:**
- Modify: section Réglages (composant réel à localiser à l'exécution, voisin de `ManualImportSection`).

- [ ] **Step 1 : Ajouter un lien vers `/import/garmin`** dans Réglages (sous l'import manuel GPX), libellé « Importer l'historique Garmin ».

- [ ] **Step 2 : Parcours manuel** (`npm run dev`, fichier export Garmin réel) :
  - Vérifier les unités sur 5 activités connues vs Garmin Connect (distance m, durée s, date).
  - Forcer un conflit (activité déjà en base via Strava) → écran de résolution, tester keep/replace + mode avancé.
  - Double import du même ZIP → 0 doublon (idempotence).
  - Vérifier que ATL/CTL/TSB du Cockpit/Charge reflètent l'historique après import.

- [ ] **Step 3 : Commit**

```bash
git add -A
git commit -m "feat(garmin-import): settings entry point for Garmin history import"
```

---

## Self-review (couverture spec Phase 1)

- Parsing ZIP côté client sans upload → Task 3 (fflate, filtre summarized). ✓
- Mapping unités + sport → Task 2. ✓
- Dédup bloquante + résolution explicite + single-row + idempotence + re-check concurrence → Tasks 4/5/6. ✓
- Recalcul ATL/CTL/TSB → automatique (lecture), documenté. ✓
- Écriture batch 500 + service client → Task 5. ✓
- UI mobile-first + progression + conflits + récap + beforeunload → Task 7. ✓
- **Différé Phase 2** (non couvert ici, volontaire) : parsing FIT, Web Workers, streams réels (decoupling/GAP/D− stream), option « enrichir les conservées », matching FIT↔résumé, pool de workers, gestion mémoire < 50 Mo de FIT.

---

## Phase 2 — esquisse (plan séparé à rédiger)

**Objectif :** enrichir les activités (nouvelles ET conservées sans streams) avec les vrais streams issus des `.fit`.

**Grandes lignes :**
1. `workers/fit-parser.worker.ts` — `@garmin/fitsdk` ; `ArrayBuffer` → `StreamSet` (`time, altitude, heartrate, velocity, distance`, + `grade` **dérivé** d'altitude/distance car absent des FIT). Pool `min(navigator.hardwareConcurrency - 1, 4)`.
2. `lib/garmin-import/unzip-fit.ts` — itération **streaming** des `UploadedFiles_*.zip` imbriqués, extraction des `.fit` un par un (jamais > ~50 Mo décompressés simultanément ; API async `unzip` de fflate).
3. Matching FIT↔résumé par `activityId` (nom de fichier / métadonnées FIT) sinon timestamp ±2 min.
4. Pack streams via `fflate.gzipSync` (format interop `base64(gzip(JSON))` lu par `unpackStreams`/`gunzipSync` serveur) → écriture `activity_streams` (`source: 'garmin'`) + métriques `decoupling_pct` / `grade_adjusted_pace_s` / `elevation_loss_m` + CES affiné.
5. Option UI « Enrichir les activités conservées » (case à cocher) — calcule les streams pour les lignes gardées sans dupliquer.
6. Rapport d'erreurs FIT corrompus.

**Décisions à trancher en Phase 2 :** dérivation du `grade` (lissage), taille de batch d'écriture streams, et si l'enrichissement passe par une nouvelle route ou réutilise `commit`.
