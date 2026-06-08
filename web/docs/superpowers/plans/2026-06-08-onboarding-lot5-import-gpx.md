# Onboarding fonctionnel — Lot 5 (Import manuel GPX) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps en `- [ ]`.

**Goal:** Permettre l'import manuel d'une activité via fichier **.gpx** (v1 ; FIT en fast-follow), avec calcul CES correct (zones FC), depuis une carte Réglages conforme au pattern Strava + une bannière dashboard.

**Architecture (réutilise tout l'existant) :**
```
.gpx (multipart) → parseGpx(xml) → ParsedGpx → gpxToNormalized(userId, parsed, sportType)
  → NormalizedActivity(provider 'gpx', providerActivityId = hash stable)
  → importActivities([act], profilCES)   // calcule CES + upsert activities + activity_metrics
```
`importActivities` (`lib/sync/import-activities.ts`) et `NormalizedActivity` (`lib/providers/strava/mapper.ts`) sont réutilisés tels quels. Le profil CES est fetché comme dans `app/api/strava/sync/route.ts` : `.select('max_hr, resting_hr, threshold_hr, aerobic_threshold_hr, ftp_watts, threshold_pace_run_sec_per_km, threshold_pace_trail_sec_per_km')`.

**Décisions (validées Franck) :** v1 = **GPX seul** (parsing via `fast-xml-parser`, déjà en dépendance) ; **sélecteur de sport à l'upload**. FIT = fast-follow (hors périmètre).

**Tech Stack :** Next 14 App Router (route handler `req.formData()`), TypeScript, `fast-xml-parser`, Jest. Node 20.

**Branche / worktree :** `feat/onboarding-lot5-import` dans le worktree `.claude/worktrees/onboarding-lot5-import` (base origin/master `23bf3692`, isolé). Contrôleur fait tous les commits ; vérifier `git rev-parse --abbrev-ref HEAD == feat/onboarding-lot5-import` avant chaque commit ; subagents = aucun git. Jest/tsc depuis `cd /c/Users/Franc/app-run-mobile/.claude/worktrees/onboarding-lot5-import/web &&`.

**Conformité Strava (Q1 « je prends la conformité ») :** la carte « Import manuel » reprend la structure visuelle de `StravaSection` (tuile icône + titre + ligne d'état + bouton d'action), rendue dans la même `SectionCard` « Compte & sync », sous `<StravaSection/>`.

---

### Task 1: Parser GPX pur `parseGpx`

**Files:** Create `web/lib/import/parse-gpx.ts` · Test `web/__tests__/lib/import/parse-gpx.test.ts`

Type de sortie :
```ts
export type ParsedGpx = {
  startTime: string         // ISO du 1er point
  durationSec: number       // elapsed = last.time - first.time
  movingTimeSec: number     // somme des dt entre points consécutifs où dt <= 10s ET distance > 0.3 m
  distanceM: number         // somme haversine des points consécutifs
  elevationGainM: number    // somme des deltas d'altitude positifs
  avgHr: number | null      // moyenne arrondie des échantillons hr présents (null si aucun)
  maxHr: number | null      // max des hr (null si aucun)
  sportTypeHint: string | null  // <trk><type> si présent, sinon null
  pointCount: number
}
```

- [ ] **Step 1: Test (TDD)** — `__tests__/lib/import/parse-gpx.test.ts` avec un petit GPX inline (3-4 trackpoints, ele + hr via `gpxtpx:hr`) :
```ts
import { parseGpx } from '@/lib/import/parse-gpx'

const SAMPLE = `<?xml version="1.0"?>
<gpx xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
 <trk><type>running</type><trkseg>
  <trkpt lat="45.0000" lon="6.0000"><ele>1000</ele><time>2026-05-01T08:00:00Z</time>
   <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>140</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
  <trkpt lat="45.0010" lon="6.0000"><ele>1010</ele><time>2026-05-01T08:00:30Z</time>
   <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>150</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
  <trkpt lat="45.0020" lon="6.0000"><ele>1005</ele><time>2026-05-01T08:01:00Z</time>
   <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>160</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
 </trkseg></trk>
</gpx>`

describe('parseGpx', () => {
  it('extrait les métriques de base', () => {
    const r = parseGpx(SAMPLE)
    expect(r.startTime).toBe('2026-05-01T08:00:00Z')
    expect(r.durationSec).toBe(60)
    expect(r.pointCount).toBe(3)
    expect(r.elevationGainM).toBe(10)        // +10 puis -5 → 10
    expect(r.avgHr).toBe(150)                // (140+150+160)/3
    expect(r.maxHr).toBe(160)
    expect(r.sportTypeHint).toBe('running')
    expect(r.distanceM).toBeGreaterThan(200) // ~222m par tranche de 0.001° lat
  })
  it('gère un GPX sans hr ni ele', () => {
    const r = parseGpx(`<gpx><trk><trkseg>
      <trkpt lat="45.0" lon="6.0"><time>2026-05-01T08:00:00Z</time></trkpt>
      <trkpt lat="45.001" lon="6.0"><time>2026-05-01T08:00:30Z</time></trkpt>
    </trkseg></trk></gpx>`)
    expect(r.avgHr).toBeNull(); expect(r.maxHr).toBeNull(); expect(r.elevationGainM).toBe(0)
    expect(r.pointCount).toBe(2)
  })
  it('lève une erreur claire si aucun trackpoint', () => {
    expect(() => parseGpx('<gpx></gpx>')).toThrow(/aucun point/i)
  })
}
)
```

- [ ] **Step 2: Lancer → échec.**

- [ ] **Step 3: Implémenter** avec `fast-xml-parser` :
```ts
import { XMLParser } from 'fast-xml-parser'

export type ParsedGpx = { /* …comme ci-dessus… */ }

const R = 6_371_000 // rayon Terre (m)
function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat), dLon = toRad(bLon - aLon)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function parseGpx(xml: string): ParsedGpx {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true })
  const doc = parser.parse(xml)
  const trk = doc?.gpx?.trk
  const trkArr = Array.isArray(trk) ? trk : trk ? [trk] : []
  type Pt = { lat: number; lon: number; ele: number | null; time: string | null; hr: number | null }
  const points: Pt[] = []
  let sportTypeHint: string | null = null
  for (const t of trkArr) {
    if (sportTypeHint == null && typeof t?.type === 'string') sportTypeHint = t.type
    const segs = Array.isArray(t?.trkseg) ? t.trkseg : t?.trkseg ? [t.trkseg] : []
    for (const seg of segs) {
      const pts = Array.isArray(seg?.trkpt) ? seg.trkpt : seg?.trkpt ? [seg.trkpt] : []
      for (const p of pts) {
        const lat = Number(p?.['@_lat']); const lon = Number(p?.['@_lon'])
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
        const ele = p?.ele != null ? Number(p.ele) : null
        const time = typeof p?.time === 'string' ? p.time : null
        // hr via extensions.TrackPointExtension.hr (removeNSPrefix retire gpxtpx:)
        const ext = p?.extensions?.TrackPointExtension ?? p?.extensions
        const hrRaw = ext?.hr
        const hr = hrRaw != null && Number.isFinite(Number(hrRaw)) ? Number(hrRaw) : null
        points.push({ lat, lon, ele: Number.isFinite(ele as number) ? (ele as number) : null, time, hr })
      }
    }
  }
  if (points.length === 0) throw new Error('GPX invalide : aucun point de trace trouvé.')

  let distanceM = 0, elevationGainM = 0, movingTimeSec = 0
  const hrs: number[] = []
  for (let i = 0; i < points.length; i++) {
    if (points[i].hr != null) hrs.push(points[i].hr as number)
    if (i === 0) continue
    const prev = points[i - 1], cur = points[i]
    const d = haversine(prev.lat, prev.lon, cur.lat, cur.lon)
    distanceM += d
    if (prev.ele != null && cur.ele != null) { const up = cur.ele - prev.ele; if (up > 0) elevationGainM += up }
    if (prev.time && cur.time) {
      const dt = (new Date(cur.time).getTime() - new Date(prev.time).getTime()) / 1000
      if (dt > 0 && dt <= 10 && d > 0.3) movingTimeSec += dt
    }
  }
  const times = points.map(p => p.time).filter((t): t is string => !!t)
  const startTime = times[0] ?? new Date().toISOString()
  const durationSec = times.length >= 2
    ? Math.round((new Date(times[times.length - 1]).getTime() - new Date(times[0]).getTime()) / 1000)
    : 0
  const avgHr = hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null
  const maxHr = hrs.length ? Math.max(...hrs) : null
  return {
    startTime, durationSec,
    movingTimeSec: Math.round(movingTimeSec) || durationSec,
    distanceM: Math.round(distanceM),
    elevationGainM: Math.round(elevationGainM),
    avgHr, maxHr, sportTypeHint, pointCount: points.length,
  }
}
```
> Note : `Math.max(...hrs)` est OK ici (tableau `number[]`, pas un MapIterator — cf. lesson 2026-05-29 qui ne concerne que les itérateurs Map/Set).

- [ ] **Step 4: Lancer → succès.**

- [ ] **Step 5: Commit** — `feat(import): parser GPX pur parseGpx (Lot 5)`

---

### Task 2: `gpxToNormalized` (provider 'gpx' + hash dédup) + provider type

**Files:** Modify `web/lib/providers/strava/mapper.ts` (ajouter `'gpx'` au type `Provider`) · Create `web/lib/import/gpx-to-normalized.ts` · Test `web/__tests__/lib/import/gpx-to-normalized.test.ts`

- [ ] **Step 1:** Dans `mapper.ts`, étendre l'union : `export type Provider = 'strava' | 'garmin' | 'polar' | 'suunto' | 'coros' | 'fit_file' | 'gpx'`.

- [ ] **Step 2: Test (TDD)** :
```ts
import { gpxToNormalized } from '@/lib/import/gpx-to-normalized'
import type { ParsedGpx } from '@/lib/import/parse-gpx'

const parsed: ParsedGpx = {
  startTime: '2026-05-01T08:00:00Z', durationSec: 3600, movingTimeSec: 3500,
  distanceM: 10000, elevationGainM: 300, avgHr: 150, maxHr: 175,
  sportTypeHint: 'running', pointCount: 500,
}
describe('gpxToNormalized', () => {
  it('construit une NormalizedActivity provider=gpx avec id déterministe', () => {
    const a = gpxToNormalized('user-1', parsed, 'Run', 'sortie.gpx')
    expect(a.provider).toBe('gpx')
    expect(a.sportType).toBe('Run')
    expect(a.distanceM).toBe(10000)
    expect(a.avgHr).toBe(150)
    expect(a.providerActivityId).toMatch(/^gpx_[0-9a-f]{16}$/)
    // déterministe : même contenu → même id
    expect(gpxToNormalized('user-1', parsed, 'Run', 'autre.gpx').providerActivityId).toBe(a.providerActivityId)
  })
  it('nom par défaut dérivé du fichier si fourni', () => {
    expect(gpxToNormalized('u', parsed, 'Run', 'Trail du matin.gpx').name).toMatch(/trail du matin/i)
  })
}
)
```

- [ ] **Step 3: Implémenter** :
```ts
import { createHash } from 'crypto'
import type { NormalizedActivity } from '@/lib/providers/strava/mapper'
import type { ParsedGpx } from '@/lib/import/parse-gpx'

export function gpxToNormalized(
  userId: string,
  p: ParsedGpx,
  sportType: string,
  fileName?: string,
): NormalizedActivity {
  // Id déterministe (dédup ré-upload) : indépendant du nom de fichier et du sport.
  const hash = createHash('sha1')
    .update(`${p.startTime}|${p.distanceM}|${p.durationSec}`)
    .digest('hex').slice(0, 16)
  const baseName = fileName?.replace(/\.gpx$/i, '').trim()
  const name = baseName && baseName.length > 0 ? baseName : 'Activité importée'
  return {
    userId,
    provider: 'gpx',
    providerActivityId: `gpx_${hash}`,
    sportType,
    name,
    startTime: p.startTime,
    durationSec: p.durationSec,
    movingTimeSec: p.movingTimeSec,
    distanceM: p.distanceM,
    elevationGainM: p.elevationGainM,
    avgHr: p.avgHr,
    maxHr: p.maxHr,
    avgPower: null,
    calories: null,
    externalTrainingLoad: null,
    rawPayload: { source: 'gpx', fileName: fileName ?? null, parsed: p },
  }
}
```

- [ ] **Step 4: Lancer → succès. Step 5: Commit** — `feat(import): gpxToNormalized + provider 'gpx' (Lot 5)`

---

### Task 3: Route `POST /api/activities/import-file`

**Files:** Create `web/app/api/activities/import-file/route.ts`

- [ ] **Step 1: Implémenter** (auth, multipart, parse, profil, import) :
```ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/database/get-user'
import { createClient } from '@/lib/database/supabase-server'
import { parseGpx } from '@/lib/import/parse-gpx'
import { gpxToNormalized } from '@/lib/import/gpx-to-normalized'
import { importActivities } from '@/lib/sync/import-activities'
import type { UserProfileForCes } from '@/lib/analytics/types'

// Sport types acceptés depuis le sélecteur d'upload (valeurs Strava-style).
const ALLOWED_SPORTS = new Set(['Run', 'TrailRun', 'Ride', 'Swim', 'Walk', 'Hike'])

export async function POST(req: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: 'Requête invalide' }, { status: 400 }) }
  const file = form.get('file')
  const sport = String(form.get('sport') ?? '')
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  if (!ALLOWED_SPORTS.has(sport)) return NextResponse.json({ error: 'Sport invalide' }, { status: 400 })
  if (file.size > 5_000_000) return NextResponse.json({ error: 'Fichier trop volumineux (max 5 Mo)' }, { status: 400 })

  const fileName = (form.get('fileName') as string | null) ?? (file as File).name ?? undefined
  const xml = await file.text()

  let normalized
  try {
    const parsed = parseGpx(xml)
    normalized = gpxToNormalized(user.id, parsed, sport, fileName)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'GPX illisible' }, { status: 422 })
  }

  const supabase = await createClient()
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('max_hr, resting_hr, threshold_hr, aerobic_threshold_hr, ftp_watts, threshold_pace_run_sec_per_km, threshold_pace_trail_sec_per_km')
    .eq('id', user.id)
    .maybeSingle()
  const profile: UserProfileForCes = profileRow ?? {}

  try {
    const { saved } = await importActivities([normalized], profile)
    return NextResponse.json({ saved })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Import échoué' }, { status: 500 })
  }
}
```
> `importActivities` utilise `createServiceClient()` en interne pour l'écriture (déjà le cas pour Strava). L'auth de l'utilisateur est validée ci-dessus ; on ne passe que SON `userId` dans la NormalizedActivity.

- [ ] **Step 2: tsc** → OK. **Step 3: Commit** — `feat(import): route POST /api/activities/import-file (GPX) (Lot 5)`

---

### Task 4: Section Réglages « Import manuel » (conforme Strava) + câblage

**Files:** Create `web/components/settings/ManualImportSection.tsx` · Modify `web/app/(main)/settings/page.tsx`

- [ ] **Step 1: Composant** (`'use client'`) mirroir de `StravaSection` (lire ce fichier pour le style) :
  - Tuile icône (lucide `Upload`, fond neutre `bg-trail-surface`/teinte), titre « Import manuel », sous-texte « Importe un fichier .gpx (Garmin, Komoot, Strava…) ».
  - Un `<select>` sport (options : Course=`Run`, Trail=`TrailRun`, Vélo=`Ride`, Natation=`Swim`, Marche=`Walk`, Randonnée=`Hike`), défaut `Run`.
  - Un `<input type="file" accept=".gpx" />` (caché) déclenché par un bouton « Importer un fichier » au style du bouton Strava (`bg-trail-card border`).
  - À la sélection du fichier : `const fd = new FormData(); fd.append('file', file); fd.append('sport', sport); fd.append('fileName', file.name); fetch('/api/activities/import-file', { method:'POST', body: fd })`. Gérer `loading`, puis afficher le résultat : succès → « Activité importée ✓ » + `router.refresh()` ; erreur → message (`json.error`). Reset l'input après coup.
  - États accessibles (label sur le select, `aria-busy` sur le bouton pendant l'upload).
  - Conteneur : `rounded-[10px] bg-trail-surface px-3 py-[10px] space-y-[10px]` (identique à StravaSection).

- [ ] **Step 2: Câblage** dans `settings/page.tsx` : importer `ManualImportSection` et le rendre dans la `SectionCard` « Compte & sync », **juste après** `<StravaSection .../>`. (Pas de prop serveur nécessaire.)

- [ ] **Step 3: tsc + lint** → OK. **Step 4: Commit** — `feat(settings): carte « Import manuel » GPX conforme Strava (Lot 5)`

---

### Task 5: Bannière dashboard « Ajoute ta première activité »

**Files:** Create `web/components/cockpit/FirstActivityBanner.tsx` · Modify `web/app/(main)/dashboard/page.tsx`

- [ ] **Step 1:** La page dashboard connaît déjà `weekActivities` mais pas le total. Ajouter un count : `const { count: activityCount } = await supabase.from('activities').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('deleted_at', null)`. (Requête légère head-only, ajoutée au Promise.all ou séparée.)
- [ ] **Step 2:** Composant `FirstActivityBanner` (client) : carte d'invite « Ajoute ta première activité » + bouton « Importer un fichier .gpx » qui renvoie vers `/settings` (ancre section) ou ouvre l'import. v1 : lien `next/link` vers `/settings`.
- [ ] **Step 3:** Dans `dashboard/page.tsx`, rendre `<FirstActivityBanner />` au-dessus de `<DashboardGrid/>` **uniquement si `activityCount === 0`**.
- [ ] **Step 4: tsc** → OK. **Step 5: Commit** — `feat(cockpit): bannière première activité quand 0 activité (Lot 5)`

---

### Task 6: Suivi + vérif + push/Vercel/merge

- [ ] Cocher le **Lot 5** dans `tasks/onboarding-fonctionnel-suivi.md` (FIT noté comme fast-follow restant).
- [ ] Suites pertinentes : `npx jest __tests__/lib/import/` → vertes ; `npx tsc --noEmit` ; lint des fichiers touchés.
- [ ] Push `feat/onboarding-lot5-import` → build Vercel preview vert → merge master (fetch + ff, sinon rebase comme Lot 3). Cleanup branche + worktree.

---

## Self-review (couverture)
- Parser GPX (distance/D+/temps/FC/sport) : Task 1. ✓
- NormalizedActivity provider 'gpx' + dédup hash : Task 2. ✓
- Route upload multipart + CES via profil (zones FC) : Task 3. ✓
- Carte Réglages conforme Strava + sélecteur sport : Task 4. ✓
- Bannière 0 activité : Task 5. ✓
- **Hors périmètre v1** : FIT (fast-follow), dédup cross-provider avec Strava (accepté), édition post-import du sport (déjà possible via les champs manual_* existants).

## Drift notes
- v1 GPX seul ; FIT reporté. Provider `'gpx'` ajouté à l'union (≠ `'fit_file'` réservé au futur parsing FIT).
