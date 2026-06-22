# Profil altimétrique dense — Option B — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher le **vrai profil altimétrique dense** (mètres réels) d'une course à partir d'une trace GPX, attachée manuellement (upload/URL) ou récupérée automatiquement pour les courses UTMB, en conservant l'escalier (Option A) comme fallback.

**Architecture:** Un pipeline pur unique (parse GPX dense → ré-échantillonnage à pas fixe + scaling sur la distance officielle → `{d,e}`) alimenté par deux acquisitions (GPX manuel, auto-UTMB fail-soft). Le profil est stocké gzippé dans `race_tracks`, lu avec les waypoints, et tracé par `ElevationProfileChart` (courbe dense + ravitos superposés + highlight croisé). Le D+/D- officiel n'est jamais touché.

**Tech Stack:** Next.js 14 App Router, TypeScript, Recharts 2.12 (`ComposedChart`/`Area`/`Scatter`), Supabase (Postgres), `fast-xml-parser`, `node:zlib`, Jest + @testing-library/react.

## Global Constraints

- **Langue UI : français.** Aucun i18n dans les composants `plan` (pas de `useT`/`I18nProvider`).
- **Migration `045_race_tracks.sql` NON auto-appliquée** : à coller manuellement dans le SQL Editor Supabase **AVANT** déploiement du code (le POST track écrit dans `race_tracks`).
- **Le D+/D- officiel ne doit jamais être recalculé ni écrasé** par le GPX. Le GPX ne sert qu'à la courbe `{km, altitude}`. **Aucune somme de dénivelé.**
- **Ne PAS modifier `web/lib/import/parse-gpx.ts`** (import d'activités) — nouveau module isolé `web/lib/race-track/`.
- **Non-régression Option A** : sans `denseProfile`, `ElevationProfileChart` doit se comporter exactement comme livré le 2026-06-21.
- **Auto-UTMB strictement fail-soft** : toute défaillance réseau/parsing renvoie `null`/204, jamais d'erreur bloquante.
- **Run jest/tsc depuis `web/`** (`cd c:/Users/Franc/app-run-mobile/web`), git depuis la racine. ~50 tests i18n échouent en pré-existant — ne lancer que les suites nommées.
- **Déploiement** : `git push` → Vercel. Jamais `vercel --prod` CLI.
- **Conventions route** (mirroir de `web/app/api/races/[id]/waypoints/route.ts`) : `createClient` depuis `@/lib/database/supabase-server`, `supabase.auth.getUser()`, ownership via `races.athlete_id == user.id`, `export const runtime = 'nodejs'`.

---

### Task 1: Pipeline GPX dense (parse + resample)

Deux fonctions pures : parser un GPX en points `{distance cumulée, altitude}`, puis ré-échantillonner à pas fixe avec scaling sur la distance officielle. Aucun calcul de D+.

**Files:**
- Create: `web/lib/race-track/parse-gpx-track.ts`
- Create: `web/lib/race-track/resample.ts`
- Test: `web/__tests__/lib/race-track/pipeline.test.ts`

**Interfaces:**
- Produces:
  - `interface TrackSample { distM: number; ele: number | null }`
  - `parseGpxTrack(xml: string): { points: TrackSample[]; distanceM: number }`
  - `interface DenseProfile { d: number[]; e: number[] }`
  - `resampleProfile(points: TrackSample[], officialDistanceKm: number): DenseProfile`
  Consommés par Tasks 2, 4, 5.

- [ ] **Step 1: Écrire les tests qui échouent**

`web/__tests__/lib/race-track/pipeline.test.ts` :

```ts
import { parseGpxTrack } from '@/lib/race-track/parse-gpx-track'
import { resampleProfile } from '@/lib/race-track/resample'

// 4 points, ~ montée puis descente. lat/lon espacés pour une distance non nulle.
const GPX = `<?xml version="1.0"?>
<gpx version="1.1"><trk><trkseg>
  <trkpt lat="45.900" lon="6.860"><ele>1000</ele></trkpt>
  <trkpt lat="45.905" lon="6.865"><ele>1200</ele></trkpt>
  <trkpt lat="45.910" lon="6.870"><ele>1100</ele></trkpt>
  <trkpt lat="45.915" lon="6.875"><ele>1300</ele></trkpt>
</trkseg></trk></gpx>`

describe('parseGpxTrack', () => {
  it('extrait les points avec distance cumulée croissante et altitude', () => {
    const { points, distanceM } = parseGpxTrack(GPX)
    expect(points).toHaveLength(4)
    expect(points[0]).toEqual({ distM: 0, ele: 1000 })
    expect(points[3].ele).toBe(1300)
    expect(points[1].distM).toBeGreaterThan(0)
    expect(points[3].distM).toBeGreaterThan(points[1].distM)
    expect(distanceM).toBe(points[3].distM)
  })

  it('lève si moins de 2 points', () => {
    expect(() => parseGpxTrack('<gpx><trk><trkseg><trkpt lat="1" lon="1"/></trkseg></trk></gpx>'))
      .toThrow()
  })

  it('lève si aucune altitude', () => {
    expect(() => parseGpxTrack(
      '<gpx><trk><trkseg><trkpt lat="1" lon="1"/><trkpt lat="2" lon="2"/></trkseg></trk></gpx>'))
      .toThrow()
  })
})

describe('resampleProfile', () => {
  it('scale l\'axe distance sur la distance officielle (dernier d == officialKm)', () => {
    const { points } = parseGpxTrack(GPX)
    const { d, e } = resampleProfile(points, 42)
    expect(d[0]).toBe(0)
    expect(d[d.length - 1]).toBeCloseTo(42, 3)
    expect(d.length).toBe(e.length)
    expect(d.length).toBeGreaterThanOrEqual(2)
    // distance strictement croissante
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeGreaterThan(d[i - 1])
    // altitudes dans la plage réelle
    expect(Math.min(...e)).toBeGreaterThanOrEqual(1000)
    expect(Math.max(...e)).toBeLessThanOrEqual(1300)
  })

  it('borne le nombre de points (<= 801) sur un très long parcours', () => {
    const pts = Array.from({ length: 3 }, (_, i) => ({ distM: i * 100_000, ele: 1000 + i }))
    const { d } = resampleProfile(pts, 200)
    expect(d.length).toBeLessThanOrEqual(801)
  })

  it('interpole les altitudes nulles depuis les voisins connus', () => {
    const pts = [
      { distM: 0, ele: 1000 }, { distM: 100, ele: null }, { distM: 200, ele: 1200 },
    ]
    const { e } = resampleProfile(pts, 1)
    expect(Math.min(...e)).toBeGreaterThanOrEqual(1000)
    expect(Math.max(...e)).toBeLessThanOrEqual(1200)
  })
})
```

- [ ] **Step 2: Lancer les tests → échec**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/race-track/pipeline.test.ts`
Expected: FAIL — modules `@/lib/race-track/parse-gpx-track` et `resample` introuvables.

- [ ] **Step 3: Implémenter `parse-gpx-track.ts`**

```ts
import { XMLParser } from 'fast-xml-parser'

export interface TrackSample {
  distM: number       // distance cumulée depuis le départ (mètres)
  ele: number | null  // altitude (mètres) ; null si absente sur ce point
}

const R = 6_371_000
function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat), dLon = toRad(bLon - aLon)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

// Parse un GPX en points {distance cumulée, altitude}. Mêmes conventions que
// lib/import/parse-gpx.ts (removeNSPrefix, trkpt). On ne garde PAS lat/lon
// (inutiles sans carte — YAGNI) : seules la distance cumulée et l'altitude servent.
export function parseGpxTrack(xml: string): { points: TrackSample[]; distanceM: number } {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true })
  const doc = parser.parse(xml)
  const trk = doc?.gpx?.trk
  const trkArr = Array.isArray(trk) ? trk : trk ? [trk] : []
  const raw: { lat: number; lon: number; ele: number | null }[] = []
  for (const t of trkArr) {
    const segs = Array.isArray(t?.trkseg) ? t.trkseg : t?.trkseg ? [t.trkseg] : []
    for (const seg of segs) {
      const pts = Array.isArray(seg?.trkpt) ? seg.trkpt : seg?.trkpt ? [seg.trkpt] : []
      for (const p of pts) {
        const lat = Number(p?.['@_lat']), lon = Number(p?.['@_lon'])
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
        const eleNum = p?.ele != null ? Number(p.ele) : NaN
        raw.push({ lat, lon, ele: Number.isFinite(eleNum) ? eleNum : null })
      }
    }
  }
  if (raw.length < 2) throw new Error('GPX invalide : moins de 2 points de trace.')
  if (raw.every((p) => p.ele == null)) throw new Error('GPX invalide : aucune altitude.')

  const points: TrackSample[] = []
  let dist = 0
  for (let i = 0; i < raw.length; i++) {
    if (i > 0) dist += haversine(raw[i - 1].lat, raw[i - 1].lon, raw[i].lat, raw[i].lon)
    points.push({ distM: dist, ele: raw[i].ele })
  }
  return { points, distanceM: Math.round(dist) }
}
```

- [ ] **Step 4: Implémenter `resample.ts`**

```ts
import type { TrackSample } from './parse-gpx-track'

export interface DenseProfile {
  d: number[]  // distances cumulées (km), scalées sur la distance officielle
  e: number[]  // altitudes (m)
}

const STEP_M = 75
const MAX_POINTS = 800

// Comble les altitudes nulles par interpolation linéaire entre voisins connus.
// Précondition (garantie par parseGpxTrack) : au moins une altitude non nulle.
function fillEle(points: TrackSample[]): { distM: number; ele: number }[] {
  const known = points
    .map((p, i) => ({ i, distM: p.distM, ele: p.ele }))
    .filter((p): p is { i: number; distM: number; ele: number } => p.ele != null)
  return points.map((p, i) => {
    if (p.ele != null) return { distM: p.distM, ele: p.ele }
    let prev: typeof known[number] | null = null, next: typeof known[number] | null = null
    for (const k of known) { if (k.i <= i) prev = k; if (k.i >= i) { next = k; break } }
    if (prev && next && prev.i !== next.i) {
      const t = (p.distM - prev.distM) / ((next.distM - prev.distM) || 1)
      return { distM: p.distM, ele: prev.ele + (next.ele - prev.ele) * t }
    }
    return { distM: p.distM, ele: (prev ?? next)!.ele }
  })
}

function eleAt(filled: { distM: number; ele: number }[], target: number): number {
  if (target <= filled[0].distM) return filled[0].ele
  const last = filled[filled.length - 1]
  if (target >= last.distM) return last.ele
  for (let i = 1; i < filled.length; i++) {
    if (filled[i].distM >= target) {
      const a = filled[i - 1], b = filled[i]
      const t = (target - a.distM) / ((b.distM - a.distM) || 1)
      return a.ele + (b.ele - a.ele) * t
    }
  }
  return last.ele
}

// Ré-échantillonne à pas fixe (~75 m, borné à MAX_POINTS) et scale l'axe distance
// de [0, distanceGpx] vers [0, officialDistanceKm] (pour aligner les ravitos au km).
// Aucun calcul de D+/D-.
export function resampleProfile(points: TrackSample[], officialDistanceKm: number): DenseProfile {
  const filled = fillEle(points)
  const totalM = filled[filled.length - 1].distM
  const n = Math.min(MAX_POINTS, Math.max(2, Math.round(totalM / STEP_M)))
  const d: number[] = [], e: number[] = []
  for (let k = 0; k <= n; k++) {
    const frac = k / n
    d.push(Math.round(officialDistanceKm * frac * 1000) / 1000)
    e.push(Math.round(eleAt(filled, frac * totalM)))
  }
  return { d, e }
}
```

- [ ] **Step 5: Lancer les tests → succès**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/race-track/pipeline.test.ts`
Expected: PASS (toutes les assertions).

- [ ] **Step 6: Commit**

```bash
git add web/lib/race-track/parse-gpx-track.ts web/lib/race-track/resample.ts web/__tests__/lib/race-track/pipeline.test.ts
git commit -m "feat(race-track): pipeline GPX dense (parse + resample + scaling)"
```

---

### Task 2: Stockage `race_tracks` (migration + type + gzip)

Migration de la table, type `RaceTrack`, et module de stockage (gzip/ungzip + upsert/read).

**Files:**
- Create: `web/supabase/migrations/045_race_tracks.sql`
- Modify: `web/types/plan.ts` (ajout `RaceTrack`)
- Create: `web/lib/race-track/storage.ts`
- Test: `web/__tests__/lib/race-track/storage.test.ts`

**Interfaces:**
- Consumes: `DenseProfile` (Task 1).
- Produces:
  - `interface RaceTrack { raceId: string; profile: { d: number[]; e: number[] }; pointCount: number; source: 'gpx_upload' | 'gpx_url' | 'utmb_auto'; distanceM: number | null; createdAt: string }`
  - `encodeProfile(p: DenseProfile): string`, `decodeProfile(s: string): DenseProfile`
  - `rowToRaceTrack(row: any): RaceTrack`
  - `upsertRaceTrack(supabase, raceId: string, args: { profile: DenseProfile; source: RaceTrack['source']; distanceM: number | null }): Promise<void>`
  - `getRaceTrack(supabase, raceId: string): Promise<RaceTrack | null>`
  Consommés par Tasks 4, 5, 6.

- [ ] **Step 1: Écrire le test qui échoue**

`web/__tests__/lib/race-track/storage.test.ts` :

```ts
import { encodeProfile, decodeProfile, rowToRaceTrack } from '@/lib/race-track/storage'

describe('encode/decodeProfile', () => {
  it('round-trip gzip+base64 d\'un profil dense', () => {
    const profile = { d: [0, 1.5, 3], e: [1000, 1200, 1100] }
    const encoded = encodeProfile(profile)
    expect(typeof encoded).toBe('string')
    expect(decodeProfile(encoded)).toEqual(profile)
  })
})

describe('rowToRaceTrack', () => {
  it('décode une ligne DB en RaceTrack', () => {
    const profile = { d: [0, 2], e: [500, 700] }
    const row = {
      race_id: 'r1', profile_gz: encodeProfile(profile), point_count: 2,
      source: 'gpx_upload', distance_m: 2000, created_at: '2026-06-22T00:00:00Z',
    }
    expect(rowToRaceTrack(row)).toEqual({
      raceId: 'r1', profile, pointCount: 2, source: 'gpx_upload',
      distanceM: 2000, createdAt: '2026-06-22T00:00:00Z',
    })
  })
})
```

- [ ] **Step 2: Lancer le test → échec**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/race-track/storage.test.ts`
Expected: FAIL — module `@/lib/race-track/storage` introuvable.

- [ ] **Step 3: Créer la migration**

`web/supabase/migrations/045_race_tracks.sql` :

```sql
-- 045 : trace GPS dense d'une course (profil altimétrique réel). 1 ligne/course.
-- profile_gz = base64(gzip(JSON {d:number[] km, e:number[] m})), miroir de
-- activity_streams.streams_gz. Le D+/D- officiel reste dans races/race_waypoints.
create table if not exists race_tracks (
  race_id     uuid primary key references races(id) on delete cascade,
  profile_gz  text not null,
  point_count integer not null,
  source      text not null,              -- 'gpx_upload' | 'gpx_url' | 'utmb_auto'
  distance_m  integer,                    -- distance brute du GPX (avant scaling)
  created_at  timestamptz not null default now()
);

alter table race_tracks enable row level security;

-- Accès réservé au propriétaire de la course (miroir des policies race_waypoints / 025).
create policy "race_tracks_select_own" on race_tracks for select
  using (exists (select 1 from races r where r.id = race_tracks.race_id and r.athlete_id = auth.uid()));
create policy "race_tracks_modify_own" on race_tracks for all
  using (exists (select 1 from races r where r.id = race_tracks.race_id and r.athlete_id = auth.uid()))
  with check (exists (select 1 from races r where r.id = race_tracks.race_id and r.athlete_id = auth.uid()));
```

(Si `web/supabase/migrations/025_race_waypoints.sql` nomme ses policies autrement, aligne le style ; le contenu — accès via `races.athlete_id = auth.uid()` — doit rester identique.)

- [ ] **Step 4: Ajouter le type `RaceTrack`**

Dans `web/types/plan.ts`, après l'interface `RaceTableauMeta` :

```ts
export interface RaceTrack {
  raceId: string
  profile: { d: number[]; e: number[] }   // d = km (scalés), e = altitude m
  pointCount: number
  source: 'gpx_upload' | 'gpx_url' | 'utmb_auto'
  distanceM: number | null
  createdAt: string
}
```

- [ ] **Step 5: Implémenter `storage.ts`**

```ts
import 'server-only'
import { gzipSync, gunzipSync } from 'node:zlib'
import type { RaceTrack } from '@/types/plan'
import type { DenseProfile } from './resample'

export function encodeProfile(p: DenseProfile): string {
  return gzipSync(Buffer.from(JSON.stringify(p))).toString('base64')
}
export function decodeProfile(s: string): DenseProfile {
  return JSON.parse(gunzipSync(Buffer.from(s, 'base64')).toString('utf8')) as DenseProfile
}

export function rowToRaceTrack(row: any): RaceTrack {
  return {
    raceId: row.race_id,
    profile: decodeProfile(row.profile_gz),
    pointCount: row.point_count,
    source: row.source,
    distanceM: row.distance_m ?? null,
    createdAt: row.created_at,
  }
}

export async function upsertRaceTrack(
  supabase: any,
  raceId: string,
  args: { profile: DenseProfile; source: RaceTrack['source']; distanceM: number | null },
): Promise<void> {
  const { error } = await supabase.from('race_tracks').upsert({
    race_id: raceId,
    profile_gz: encodeProfile(args.profile),
    point_count: args.profile.d.length,
    source: args.source,
    distance_m: args.distanceM,
    created_at: new Date().toISOString(),
  }, { onConflict: 'race_id' })
  if (error) throw new Error(error.message)
}

export async function getRaceTrack(supabase: any, raceId: string): Promise<RaceTrack | null> {
  const { data } = await supabase.from('race_tracks').select('*').eq('race_id', raceId).maybeSingle()
  return data ? rowToRaceTrack(data) : null
}
```

- [ ] **Step 6: Lancer le test → succès**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/race-track/storage.test.ts`
Expected: PASS.

- [ ] **Step 7: Vérifier la compilation**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 8: Commit**

```bash
git add web/supabase/migrations/045_race_tracks.sql web/types/plan.ts web/lib/race-track/storage.ts web/__tests__/lib/race-track/storage.test.ts
git commit -m "feat(race-track): table race_tracks + type RaceTrack + stockage gzip (migration 045)"
```

---

### Task 3: Acquisition auto-UTMB (fail-soft)

Module server-only qui, depuis l'URL d'une course UTMB + la distance officielle, dérive la page `/race/tracks`, en extrait le bon lien GPX Cloudinary, et renvoie le texte GPX — `null` à la moindre incertitude.

**Structure réelle vérifiée** (page `{event}.utmb.world/race/tracks`) : liens `<a href>` vers `https://res.cloudinary.com/utmb-world/raw/upload/v.../{DIST}_{K|M}_{CODE}_{YEAR}_{hash}.gpx` (ex. `50_K_ETM_2025_...gpx`, `100_M_SDT_2025_...gpx`). La distance se lit dans le nom de fichier : `K` = kilomètres, `M` = miles.

**Files:**
- Create: `web/lib/race-track/utmb-tracks.ts`
- Test: `web/__tests__/lib/race-track/utmb-tracks.test.ts`

**Interfaces:**
- Produces:
  - `deriveTracksUrl(raceUrl: string): string | null`
  - `extractGpxCandidates(html: string): { url: string; km: number }[]`
  - `selectGpxUrl(html: string, officialKm: number): string | null`
  - `fetchGpxFromUrl(url: string): Promise<string | null>`
  - `fetchUtmbTrackGpx(raceUrl: string, officialKm: number): Promise<string | null>`
  Consommés par Task 4.

- [ ] **Step 1: Écrire les tests qui échouent**

`web/__tests__/lib/race-track/utmb-tracks.test.ts` :

```ts
import { deriveTracksUrl, extractGpxCandidates, selectGpxUrl } from '@/lib/race-track/utmb-tracks'

const HTML = `
<a href="https://res.cloudinary.com/utmb-world/raw/upload/v1760605599/mallorca/GPX%20TRACKS/X/100_M_SDT_2025_9207594015.gpx">SDT - 100M</a>
<a href="https://res.cloudinary.com/utmb-world/raw/upload/v1760537058/mallorca/GPX%20TRACKS/X/100_K_CPS_2025_7b5b1ae851.gpx">CPS - 100K</a>
<a href="https://res.cloudinary.com/utmb-world/raw/upload/v1760537057/mallorca/GPX%20TRACKS/X/50_K_ETM_2025_4a4b7cc285.gpx">ETM - 50K</a>
<a href="https://res.cloudinary.com/utmb-world/raw/upload/v1760537057/mallorca/GPX%20TRACKS/X/20_K_CDA_2025_9dc4d1c265.gpx">CDA - 20K</a>
`

describe('deriveTracksUrl', () => {
  it('dérive {event}.utmb.world/race/tracks depuis une URL de course UTMB', () => {
    expect(deriveTracksUrl('https://mallorca.utmb.world/en/races/100K'))
      .toBe('https://mallorca.utmb.world/race/tracks')
  })
  it('renvoie null hors UTMB', () => {
    expect(deriveTracksUrl('https://ut4m.livetrail.run/parcours.php?course=X')).toBeNull()
    expect(deriveTracksUrl('pas-une-url')).toBeNull()
  })
})

describe('extractGpxCandidates', () => {
  it('extrait 4 candidats avec leur distance en km (K direct, M en miles)', () => {
    const c = extractGpxCandidates(HTML)
    expect(c).toHaveLength(4)
    const byKm = Object.fromEntries(c.map((x) => [Math.round(x.km), x.url.split('/').pop()]))
    expect(byKm[50]).toContain('50_K_ETM')
    expect(byKm[100]).toContain('100_K_CPS')
    expect(byKm[20]).toContain('20_K_CDA')
    expect(byKm[161]).toContain('100_M_SDT') // 100 miles ≈ 160.9 km
  })
})

describe('selectGpxUrl', () => {
  it('choisit le candidat le plus proche de la distance officielle (50 km)', () => {
    expect(selectGpxUrl(HTML, 50)).toContain('50_K_ETM')
  })
  it('matche 100 miles pour une course de ~160 km', () => {
    expect(selectGpxUrl(HTML, 160)).toContain('100_M_SDT')
  })
  it('renvoie null si aucun candidat à moins de 15% (course de 5 km)', () => {
    expect(selectGpxUrl(HTML, 5)).toBeNull()
  })
  it('renvoie null si la page ne contient aucun GPX', () => {
    expect(selectGpxUrl('<html>rien</html>', 50)).toBeNull()
  })
})
```

- [ ] **Step 2: Lancer les tests → échec**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/race-track/utmb-tracks.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter `utmb-tracks.ts`**

```ts
import 'server-only'

const FETCH_TIMEOUT_MS = 10_000
const MAX_BYTES = 8_000_000

// {event}.utmb.world/.../races/{code} → {event}.utmb.world/race/tracks
export function deriveTracksUrl(raceUrl: string): string | null {
  try {
    const u = new URL(raceUrl)
    if (!u.hostname.endsWith('.utmb.world')) return null
    return `${u.origin}/race/tracks`
  } catch {
    return null
  }
}

// Extrait les liens GPX Cloudinary + leur distance (km) lue dans le nom de fichier
// ({DIST}_{K|M}_...). K = kilomètres, M = miles → km.
export function extractGpxCandidates(html: string): { url: string; km: number }[] {
  const urls = Array.from(
    html.matchAll(/https:\/\/res\.cloudinary\.com\/[^\s"'<>)]+?\.gpx/gi),
    (m) => m[0],
  )
  const seen = new Set<string>()
  const out: { url: string; km: number }[] = []
  for (const url of urls) {
    if (seen.has(url)) continue
    seen.add(url)
    const file = decodeURIComponent(url.split('/').pop() ?? '')
    const m = /(\d+)_([KM])_/i.exec(file)
    if (!m) continue
    const n = parseInt(m[1], 10)
    const km = m[2].toUpperCase() === 'M' ? n * 1.60934 : n
    out.push({ url, km })
  }
  return out
}

// Choisit le GPX dont la distance est la plus proche de l'officielle, à ≤ 15%.
export function selectGpxUrl(html: string, officialKm: number): string | null {
  const cands = extractGpxCandidates(html)
  if (cands.length === 0 || !(officialKm > 0)) return null
  let best: { url: string; km: number } | null = null
  let bestErr = Infinity
  for (const c of cands) {
    const err = Math.abs(c.km - officialKm) / officialKm
    if (err < bestErr) { bestErr = err; best = c }
  }
  return best && bestErr <= 0.15 ? best.url : null
}

export async function fetchGpxFromUrl(url: string): Promise<string | null> {
  try {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'TrailCockpitBot/1.0' } })
    clearTimeout(timer)
    if (!res.ok) return null
    const text = await res.text()
    return text.length > MAX_BYTES ? null : text
  } catch {
    return null
  }
}

// Orchestrateur fail-soft : URL course UTMB + distance → texte GPX, ou null.
export async function fetchUtmbTrackGpx(raceUrl: string, officialKm: number): Promise<string | null> {
  const tracksUrl = deriveTracksUrl(raceUrl)
  if (!tracksUrl) return null
  const html = await fetchGpxFromUrl(tracksUrl)
  if (!html) return null
  const gpxUrl = selectGpxUrl(html, officialKm)
  if (!gpxUrl) return null
  return fetchGpxFromUrl(gpxUrl)
}
```

- [ ] **Step 4: Lancer les tests → succès**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/race-track/utmb-tracks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/race-track/utmb-tracks.ts web/__tests__/lib/race-track/utmb-tracks.test.ts
git commit -m "feat(race-track): acquisition auto-UTMB fail-soft (scrape /race/tracks → GPX Cloudinary)"
```

---

### Task 4: Route API `track` + GET waypoints renvoie `track`

`POST /api/races/[id]/track` (3 variantes : gpxText / gpxUrl / utmbAuto), `DELETE`, et extension du GET waypoints.

**Files:**
- Create: `web/app/api/races/[id]/track/route.ts`
- Modify: `web/app/api/races/[id]/waypoints/route.ts` (GET renvoie aussi `track`)
- Test: `web/__tests__/app/api/races/track.test.ts`

**Interfaces:**
- Consumes: `parseGpxTrack`, `resampleProfile` (T1) ; `upsertRaceTrack`, `getRaceTrack` (T2) ; `fetchUtmbTrackGpx`, `fetchGpxFromUrl` (T3).
- Produces: `POST` renvoie `{ track: RaceTrack }` (200) | 204 (utmbAuto sans résultat) | 400/422 ; `DELETE` renvoie `{ ok: true }`. GET waypoints ajoute `track: RaceTrack | null`.

- [ ] **Step 1: Écrire le test qui échoue**

`web/__tests__/app/api/races/track.test.ts` :

```ts
/** @jest-environment node */
import { POST } from '@/app/api/races/[id]/track/route'

const mockGetUser = jest.fn()
const mockSingle = jest.fn()
const mockMaybeSingle = jest.fn()
const mockUpsert = jest.fn().mockResolvedValue({ error: null })

jest.mock('@/lib/database/supabase-server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === 'races') return {
        select: () => ({ eq: () => ({ eq: () => ({ single: mockSingle }) }) }),
      }
      if (table === 'race_tableau_meta') return {
        select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
      }
      // race_tracks
      return {
        upsert: mockUpsert,
        select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
      }
    },
  }),
}))

const makeReq = (body: any) =>
  ({ json: async () => body } as unknown as Request)

beforeEach(() => {
  jest.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  mockSingle.mockResolvedValue({ data: { id: 'r1', distance_km: 42 } })
})

const GPX = `<gpx><trk><trkseg>
  <trkpt lat="45.90" lon="6.86"><ele>1000</ele></trkpt>
  <trkpt lat="45.91" lon="6.87"><ele>1200</ele></trkpt>
</trkseg></trk></gpx>`

describe('POST /api/races/[id]/track', () => {
  it('gpxText valide → 200 + stocke la trace', async () => {
    // getRaceTrack relit la ligne : on renvoie une ligne encodée plausible
    mockMaybeSingle.mockResolvedValue({ data: {
      race_id: 'r1',
      profile_gz: require('@/lib/race-track/storage').encodeProfile({ d: [0, 42], e: [1000, 1200] }),
      point_count: 2, source: 'gpx_upload', distance_m: 1500, created_at: '2026-06-22T00:00:00Z',
    } })
    const res = await POST(makeReq({ gpxText: GPX }), { params: { id: 'r1' } })
    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    const body = await res.json()
    expect(body.track.source).toBe('gpx_upload')
  })

  it('utmbAuto sans source_url → 204, aucune écriture', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null }) // pas de meta
    const res = await POST(makeReq({ utmbAuto: true }), { params: { id: 'r1' } })
    expect(res.status).toBe(204)
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('body sans variante → 400', async () => {
    const res = await POST(makeReq({}), { params: { id: 'r1' } })
    expect(res.status).toBe(400)
  })

  it('non authentifié → 401', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeReq({ gpxText: GPX }), { params: { id: 'r1' } })
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Lancer le test → échec**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/app/api/races/track.test.ts`
Expected: FAIL — route `@/app/api/races/[id]/track/route` introuvable.

- [ ] **Step 3: Implémenter `track/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database/supabase-server'
import { parseGpxTrack } from '@/lib/race-track/parse-gpx-track'
import { resampleProfile } from '@/lib/race-track/resample'
import { upsertRaceTrack, getRaceTrack } from '@/lib/race-track/storage'
import { fetchUtmbTrackGpx, fetchGpxFromUrl } from '@/lib/race-track/utmb-tracks'
import type { RaceTrack } from '@/types/plan'

export const runtime = 'nodejs'

async function ownedRace(supabase: any, id: string, userId: string) {
  const { data } = await supabase
    .from('races').select('id, distance_km').eq('id', id).eq('athlete_id', userId).single()
  return data as { id: string; distance_km: number | string } | null
}

// POST body : { gpxText } | { gpxUrl } | { utmbAuto: true }
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const race = await ownedRace(supabase, params.id, user.id)
  if (!race) return NextResponse.json({ error: 'Course introuvable' }, { status: 404 })
  const officialKm = Number(race.distance_km) || 0

  const body = await request.json() as { gpxText?: string; gpxUrl?: string; utmbAuto?: boolean }

  let gpxText: string | null = null
  let source: RaceTrack['source']
  if (body.utmbAuto === true) {
    const { data: meta } = await supabase
      .from('race_tableau_meta').select('source_url').eq('race_id', params.id).maybeSingle()
    if (!meta?.source_url) return new NextResponse(null, { status: 204 })
    gpxText = await fetchUtmbTrackGpx(meta.source_url, officialKm)
    if (!gpxText) return new NextResponse(null, { status: 204 })
    source = 'utmb_auto'
  } else if (typeof body.gpxUrl === 'string' && body.gpxUrl.length > 0) {
    gpxText = await fetchGpxFromUrl(body.gpxUrl)
    if (!gpxText) return NextResponse.json({ error: 'Trace introuvable à cette URL.' }, { status: 422 })
    source = 'gpx_url'
  } else if (typeof body.gpxText === 'string' && body.gpxText.length > 0) {
    gpxText = body.gpxText
    source = 'gpx_upload'
  } else {
    return NextResponse.json({ error: 'Body invalide.' }, { status: 400 })
  }

  try {
    const { points, distanceM } = parseGpxTrack(gpxText)
    const profile = resampleProfile(points, officialKm > 0 ? officialKm : distanceM / 1000)
    await upsertRaceTrack(supabase, params.id, { profile, source, distanceM })
  } catch {
    return NextResponse.json({ error: 'GPX inexploitable.' }, { status: 422 })
  }
  const track = await getRaceTrack(supabase, params.id)
  return NextResponse.json({ track })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const race = await ownedRace(supabase, params.id, user.id)
  if (!race) return NextResponse.json({ error: 'Course introuvable' }, { status: 404 })
  await supabase.from('race_tracks').delete().eq('race_id', params.id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Étendre le GET waypoints**

Dans `web/app/api/races/[id]/waypoints/route.ts` :

Ajouter l'import en tête :
```ts
import { getRaceTrack } from '@/lib/race-track/storage'
```

Dans `GET`, juste avant le `return NextResponse.json({ waypoints, meta: ... })` final, charger la trace et l'inclure :
```ts
  const track = await getRaceTrack(supabase, params.id)
  const waypoints: RaceWaypoint[] = (data ?? []).map(rowToRaceWaypoint as any)
  return NextResponse.json({ waypoints, meta: metaRow ? rowToTableauMeta(metaRow) : null, track })
```
(Remplace le `return` existant ; la ligne `waypoints` existe déjà — ne la duplique pas, réutilise-la.)

- [ ] **Step 5: Lancer le test → succès**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/app/api/races/track.test.ts`
Expected: PASS (4 cas).

- [ ] **Step 6: tsc + commit**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx tsc --noEmit`
Expected: aucune erreur.

```bash
git add "web/app/api/races/[id]/track/route.ts" "web/app/api/races/[id]/waypoints/route.ts" web/__tests__/app/api/races/track.test.ts
git commit -m "feat(race-track): route POST/DELETE track + GET waypoints renvoie track"
```

---

### Task 5: `ElevationProfileChart` — mode dense

Étend le composant : si `denseProfile` fourni, trace la courbe réelle (`ComposedChart` : `Area` dense + `Scatter` des waypoints), axe en mètres, sans libellé « relatif », highlight croisé conservé. Sinon, escalier (Option A) inchangé.

**Files:**
- Modify: `web/components/plan/ElevationProfileChart.tsx`
- Test: `web/__tests__/components/plan/ElevationProfileChart.dense.test.tsx`

**Interfaces:**
- Consumes: `DenseProfile`-like `{ d: number[]; e: number[] }`.
- Produces:
  - `interpolateAlt(d: number[], e: number[], km: number): number | null`
  - `interface DenseMarker { km: number; alt: number; wpIndex: number; name: string }`
  - `buildMarkers(waypoints: { km: number; name: string }[], profile: { d: number[]; e: number[] }): DenseMarker[]`
  - Nouvelle prop `denseProfile?: { d: number[]; e: number[] }` sur `ElevationProfileChart`.

- [ ] **Step 1: Écrire les tests qui échouent**

`web/__tests__/components/plan/ElevationProfileChart.dense.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import {
  ElevationProfileChart, interpolateAlt, buildMarkers,
} from '@/components/plan/ElevationProfileChart'

class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
;(global as any).ResizeObserver = ResizeObserverStub

const wp = (over: Partial<{ km: number; name: string; altitude: number | null; dPlus: number | null; dMoins: number | null }>) => ({
  km: 0, name: 'P', altitude: null, dPlus: 0, dMoins: 0, ...over,
})

describe('interpolateAlt', () => {
  it('interpole linéairement entre deux points', () => {
    expect(interpolateAlt([0, 10], [1000, 2000], 5)).toBe(1500)
  })
  it('borne aux extrémités', () => {
    expect(interpolateAlt([0, 10], [1000, 2000], -1)).toBe(1000)
    expect(interpolateAlt([0, 10], [1000, 2000], 99)).toBe(2000)
  })
})

describe('buildMarkers', () => {
  it('place chaque waypoint sur la courbe à son km', () => {
    const markers = buildMarkers(
      [{ km: 0, name: 'Départ' }, { km: 5, name: 'Col' }],
      { d: [0, 10], e: [1000, 2000] },
    )
    expect(markers).toEqual([
      { km: 0, alt: 1000, wpIndex: 0, name: 'Départ' },
      { km: 5, alt: 1500, wpIndex: 1, name: 'Col' },
    ])
  })
})

describe('ElevationProfileChart — mode dense', () => {
  it('denseProfile fourni → pas de libellé « relatif », rend le graphe', () => {
    render(
      <ElevationProfileChart
        waypoints={[wp({ km: 0, name: 'Départ' }), wp({ km: 5, name: 'Col' })]}
        denseProfile={{ d: [0, 2.5, 5], e: [1000, 1400, 1200] }}
        hoveredIndex={null}
        onHoverIndex={() => {}}
      />,
    )
    expect(screen.queryByText('Altitude relative au départ')).not.toBeInTheDocument()
    expect(screen.queryByText('Profil indisponible')).not.toBeInTheDocument()
  })

  it('sans denseProfile : comportement Option A inchangé (escalier relatif)', () => {
    render(
      <ElevationProfileChart
        waypoints={[
          wp({ km: 0, name: 'Départ', altitude: null, dPlus: 0, dMoins: 0 }),
          wp({ km: 5, name: 'Col', altitude: null, dPlus: 300, dMoins: 50 }),
        ]}
        hoveredIndex={null}
        onHoverIndex={() => {}}
      />,
    )
    expect(screen.getByText('Altitude relative au départ')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Lancer le test → échec**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/components/plan/ElevationProfileChart.dense.test.tsx`
Expected: FAIL — `interpolateAlt`/`buildMarkers` non exportés et la prop `denseProfile` n'existe pas.

- [ ] **Step 3: Étendre le composant**

Dans `web/components/plan/ElevationProfileChart.tsx` :

Ajouter `ComposedChart` et `Scatter` à l'import recharts :
```ts
import {
  AreaChart, ComposedChart, Area, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'
```

Ajouter ces helpers exportés (après `exploitableCount`) :
```ts
export function interpolateAlt(d: number[], e: number[], km: number): number | null {
  if (d.length === 0) return null
  if (km <= d[0]) return e[0]
  if (km >= d[d.length - 1]) return e[e.length - 1]
  for (let i = 1; i < d.length; i++) {
    if (d[i] >= km) {
      const t = (km - d[i - 1]) / ((d[i] - d[i - 1]) || 1)
      return e[i - 1] + (e[i] - e[i - 1]) * t
    }
  }
  return e[e.length - 1]
}

export interface DenseMarker { km: number; alt: number; wpIndex: number; name: string }
export function buildMarkers(
  waypoints: { km: number; name: string }[],
  profile: { d: number[]; e: number[] },
): DenseMarker[] {
  return waypoints.map((w, i) => ({
    km: w.km, alt: interpolateAlt(profile.d, profile.e, w.km) ?? 0, wpIndex: i, name: w.name,
  }))
}
```

Étendre le type `Props` avec la prop optionnelle :
```ts
type Props = {
  waypoints: ProfileWaypoint[]
  denseProfile?: { d: number[]; e: number[] }
  hoveredIndex: number | null
  onHoverIndex: (i: number | null) => void
}
```

Dans la fonction `ElevationProfileChart`, insérer la branche dense **APRÈS** le `useMemo` existant (règle des hooks : `useMemo` doit toujours s'exécuter, donc la branche dense ne doit pas faire de `return` avant lui), et **avant** le `if (exploitableCount(points) < 2)` :
```ts
export function ElevationProfileChart({ waypoints, denseProfile, hoveredIndex, onHoverIndex }: Props) {
  const { mode, points } = useMemo(() => buildProfileData(waypoints), [waypoints])

  // Mode dense : si une trace est attachée (≥ 2 points), elle prime sur l'escalier.
  if (denseProfile && denseProfile.d.length >= 2) {
    const data = denseProfile.d.map((km, i) => ({ km, alt: denseProfile.e[i] }))
    const markers = buildMarkers(waypoints.map((w) => ({ km: w.km, name: w.name })), denseProfile)
    const renderMarker = (p: { cx?: number; cy?: number; payload?: DenseMarker }) => {
      if (p.cx == null || p.cy == null) return <g />
      const active = p.payload?.wpIndex === hoveredIndex
      return (
        <circle cx={p.cx} cy={p.cy} r={active ? 6 : 3.5}
          fill={active ? colors.chargeOrange : colors.seriesBlue} stroke="#fff" strokeWidth={active ? 2 : 1} />
      )
    }
    return (
      <div style={{ width: '100%', height: 180 }} onMouseLeave={() => onHoverIndex(null)}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="elevFillDense" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.seriesBlue} stopOpacity={0.35} />
                <stop offset="100%" stopColor={colors.seriesBlue} stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={colors.border} strokeDasharray="2 2" />
            <XAxis dataKey="km" type="number" domain={['dataMin', 'dataMax']}
              tickFormatter={(v: number) => `${fmtKm(v)}`}
              tick={{ fontSize: 10, fill: colors.subtleText }} />
            <YAxis width={42} tick={{ fontSize: 10, fill: colors.subtleText }} />
            <Tooltip
              contentStyle={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.border}`, fontSize: 12 }}
              labelStyle={{ color: colors.text }}
              labelFormatter={(v: number) => `km ${fmtKm(v)}`}
              formatter={(value: number) => [`${Math.round(value)} m`, 'Altitude']}
            />
            <Area dataKey="alt" type="linear" stroke={colors.seriesBlue} strokeWidth={2}
              fill="url(#elevFillDense)" dot={false} activeDot={false} />
            <Scatter data={markers} dataKey="alt" shape={renderMarker}
              onMouseEnter={(d: any) => onHoverIndex(d?.wpIndex ?? d?.payload?.wpIndex ?? null)}
              onMouseLeave={() => onHoverIndex(null)} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // ----- Mode escalier (Option A) : code existant INCHANGÉ à partir d'ici -----
  // (le `if (exploitableCount(points) < 2) { return <empty/> }` existant et tout
  //  le rendu escalier qui suit restent tels quels — ne PAS redéclarer `useMemo`,
  //  il est déjà appelé en première ligne ci-dessus.)
```

Concrètement : la seule modification du corps est (1) déplacer/garder le `const { mode, points } = useMemo(...)` en **première ligne**, puis (2) insérer le bloc `if (denseProfile && …) { … return … }` juste après. Tout le reste du composant (empty-state, escalier, caption relatif) est conservé à l'identique.

- [ ] **Step 4: Lancer les tests → succès**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/components/plan/ElevationProfileChart.dense.test.tsx __tests__/components/plan/ElevationProfileChart.test.tsx`
Expected: PASS (nouveaux tests dense + tous les tests Option A existants, non-régression).

- [ ] **Step 5: tsc + commit**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx tsc --noEmit`
Expected: aucune erreur.

```bash
git add web/components/plan/ElevationProfileChart.tsx web/__tests__/components/plan/ElevationProfileChart.dense.test.tsx
git commit -m "feat(plan): ElevationProfileChart mode dense (courbe réelle + ravitos superposés)"
```

---

### Task 6: Dialog d'ajout de trace + intégration page + trigger auto-UTMB

UI : bouton/menu sur la section Profil, dialog upload/URL, branchement du `denseProfile`, et déclenchement fire-and-forget de l'auto-UTMB après import.

**Files:**
- Create: `web/components/plan/AddTrackDialog.tsx`
- Modify: `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx`
- Test: `web/__tests__/components/plan/AddTrackDialog.test.tsx`

**Interfaces:**
- Consumes: route `POST/DELETE /api/races/[id]/track`, `RaceTrack` (T2), `ElevationProfileChart` `denseProfile` (T5).
- Produces: `AddTrackDialog` (modal upload `.gpx` / collage URL → POST track → `onSaved(track)`).

- [ ] **Step 1: Écrire le test qui échoue (dialog)**

`web/__tests__/components/plan/AddTrackDialog.test.tsx` :

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddTrackDialog } from '@/components/plan/AddTrackDialog'

describe('AddTrackDialog', () => {
  afterEach(() => jest.restoreAllMocks())

  it('collage d\'URL → POST { gpxUrl } puis onSaved(track)', async () => {
    const track = { raceId: 'r1', profile: { d: [0, 1], e: [10, 20] }, pointCount: 2, source: 'gpx_url', distanceM: 1000, createdAt: 'x' }
    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true, status: 200, json: async () => ({ track }),
    } as any)
    const onSaved = jest.fn()
    render(<AddTrackDialog raceId="r1" open onClose={() => {}} onSaved={onSaved} />)

    fireEvent.change(screen.getByPlaceholderText(/https/i), { target: { value: 'https://visugpx.com/x.gpx' } })
    fireEvent.click(screen.getByRole('button', { name: /importer/i }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(track))
    expect(fetchMock).toHaveBeenCalledWith('/api/races/r1/track', expect.objectContaining({ method: 'POST' }))
    const sentBody = JSON.parse((fetchMock.mock.calls[0][1] as any).body)
    expect(sentBody).toEqual({ gpxUrl: 'https://visugpx.com/x.gpx' })
  })
})
```

- [ ] **Step 2: Lancer le test → échec**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/components/plan/AddTrackDialog.test.tsx`
Expected: FAIL — module `@/components/plan/AddTrackDialog` introuvable.

- [ ] **Step 3: Implémenter `AddTrackDialog.tsx`**

```tsx
'use client'

import { useState } from 'react'
import type { RaceTrack } from '@/types/plan'

type Props = {
  raceId: string
  open: boolean
  onClose: () => void
  onSaved: (track: RaceTrack) => void
}

export function AddTrackDialog({ raceId, open, onClose, onSaved }: Props) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function send(body: { gpxText: string } | { gpxUrl: string }) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/races/${raceId}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? 'Échec de l\'import.')
        return
      }
      const { track } = await res.json()
      onSaved(track as RaceTrack)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const gpxText = await file.text()
    await send({ gpxText })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-[14px] bg-trail-card border border-trail-border p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-h2 font-semibold text-trail-text font-display">Ajouter une trace GPX</h3>
        <label className="block">
          <span className="text-caption text-trail-muted">Fichier .gpx</span>
          <input type="file" accept=".gpx,application/gpx+xml" disabled={busy}
            onChange={onFile}
            className="mt-1 block w-full text-body-sm text-trail-text" />
        </label>
        <div className="text-caption text-trail-muted text-center">ou</div>
        <div className="flex gap-2">
          <input type="url" inputMode="url" value={url} disabled={busy}
            onChange={(e) => setUrl(e.target.value)} placeholder="https://…/trace.gpx"
            className="flex-1 px-3 py-2 rounded-[10px] bg-trail-surface border border-trail-border text-trail-text text-body focus:outline-none focus:border-trail-primary" />
          <button type="button" disabled={busy || url.trim() === ''}
            onClick={() => send({ gpxUrl: url.trim() })}
            className="px-3 py-2 rounded-[10px] bg-trail-primary text-white text-caption font-semibold disabled:opacity-50">
            {busy ? '…' : 'Importer'}
          </button>
        </div>
        {error && <p className="text-caption text-trail-danger">{error}</p>}
        <button type="button" onClick={onClose} className="w-full text-caption text-trail-muted underline">Annuler</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Lancer le test → succès**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/components/plan/AddTrackDialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Brancher dans `CoursePageClient.tsx`**

Imports (après l'import de `ElevationProfileChart`) :
```ts
import { AddTrackDialog } from '@/components/plan/AddTrackDialog'
import type { RaceTrack } from '@/types/plan'
```

État (près des autres `useState`) :
```ts
  const [track, setTrack] = useState<RaceTrack | null>(null)
  const [trackDialogOpen, setTrackDialogOpen] = useState(false)
```

Dans `reload()`, après avoir lu `body.waypoints`, lire aussi la trace :
```ts
      setWaypoints(body.waypoints ?? [])
      setMeta(body.meta ?? null)
      setTrack(body.track ?? null)
```

Déclenchement **auto-UTMB fire-and-forget** : dans le `onSaved` du `<RaceImportSheet>` (là où l'import remplit les waypoints), après `setWaypoints(wps)`, lancer (sans await) la tentative + un reload différé pour récupérer la trace si trouvée :
```ts
        onSaved={(wps) => {
          setWaypoints(wps)
          setImportOpen(false)
          // Auto-UTMB : le serveur no-op (204) si la course n'est pas UTMB.
          void fetch(`/api/races/${raceId}/track`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ utmbAuto: true }),
          }).then((r) => { if (r.ok && r.status !== 204) void reload() })
        }}
```

Remplacer la Section « Profil de la course » par le rendu dense + actions :
```tsx
      <Section
        title="Profil de la course"
        action={
          waypoints.length > 0 ? (
            track ? (
              <button type="button" onClick={async () => {
                await fetch(`/api/races/${raceId}/track`, { method: 'DELETE' })
                setTrack(null)
              }} className="text-caption text-trail-muted underline">Retirer la trace</button>
            ) : (
              <button type="button" onClick={() => setTrackDialogOpen(true)}
                className="text-caption text-trail-primary font-semibold underline">Ajouter une trace GPX</button>
            )
          ) : undefined
        }
      >
        {waypoints.length > 0 ? (
          <ElevationProfileChart
            waypoints={waypoints.map(({ km, name, altitude, dPlus, dMoins }) => ({ km, name, altitude, dPlus, dMoins }))}
            denseProfile={track?.profile}
            hoveredIndex={hoveredWaypointIndex}
            onHoverIndex={setHoveredWaypointIndex}
          />
        ) : (
          <div className="h-[120px] rounded-[8px] bg-trail-surface border border-dashed border-trail-border flex items-center justify-center">
            <p className="text-caption text-trail-muted">Importe le tableau pour voir le profil.</p>
          </div>
        )}
      </Section>
```

Ajouter le dialog près des autres modals (avant la fermeture du composant) :
```tsx
      <AddTrackDialog
        raceId={raceId}
        open={trackDialogOpen}
        onClose={() => setTrackDialogOpen(false)}
        onSaved={(t) => setTrack(t)}
      />
```

(Le composant `Section` accepte déjà une prop `action: React.ReactNode` — cf. sa définition dans ce fichier.)

- [ ] **Step 6: tsc + suites plan + commit**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx tsc --noEmit && npx jest __tests__/components/plan/`
Expected: `tsc` clean ; suites `plan/` au vert (hors i18n pré-existant).

```bash
git add web/components/plan/AddTrackDialog.tsx "web/app/(main)/plan/courses/[id]/CoursePageClient.tsx" web/__tests__/components/plan/AddTrackDialog.test.tsx
git commit -m "feat(plan): dialog trace GPX + profil dense branché + auto-UTMB après import"
```

- [ ] **Step 7: Vérification visuelle (manuelle, Franck)**

Run: `cd c:/Users/Franc/app-run-mobile/web && npm run dev`
1. Course **UTMB** : ré-importer le tableau → vérifier qu'au bout de quelques secondes le profil passe en **courbe dense réelle** (auto-UTMB), avec les ravitos superposés et le highlight croisé.
2. N'importe quelle course : « Ajouter une trace GPX » → uploader un `.gpx` → courbe dense en mètres réels. « Retirer la trace » → retour à l'escalier.
3. Course LiveTrail sans trace : escalier **absolu** inchangé (non-régression A).

---

## Déploiement (après les 6 tasks)

1. **Appliquer la migration `045`** : coller `web/supabase/migrations/045_race_tracks.sql` dans le SQL Editor Supabase (rappel à Franck — non auto-appliquée).
2. `git push` (branche `feat/profil-course-dense`) → merge/PR → Vercel auto-deploy.
3. Vérifier sur trailcockpit.run : une course UTMB (profil dense auto) et une course avec GPX manuel.

## Notes de cadrage

- **`parseGpxTrack` ne garde pas lat/lon** (inutiles sans carte — YAGNI). Le spec mentionnait `TrackPoint={lat,lon,ele}` ; on simplifie en `{distM, ele}`. Si une carte est ajoutée un jour (hors périmètre B), re-parser le GPX.
- **Auto-UTMB déclenché sur *tout* import** (le serveur renvoie 204 si la course n'est pas UTMB) — simple et couvre les ré-imports, sans que le client ait à détecter la source.
- **D+/D- officiel jamais touché** ; le GPX n'alimente que la courbe.
- **Non-régression A** : `denseProfile` absent → branche escalier identique au livré 2026-06-21.
- **Risque auto-UTMB** : structure `/race/tracks` non contractuelle (vérifiée en réel le 2026-06-22 : liens Cloudinary `{DIST}_{K|M}_..._.gpx`). Fail-soft → si la page change, aucune casse, le manuel prend le relais.
