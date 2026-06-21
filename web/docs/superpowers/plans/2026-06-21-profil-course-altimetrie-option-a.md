# Profil altimétrique course — Option A — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le placeholder « Profil dénivelé — bientôt » de la page course par un profil altimétrique interactif tracé depuis les waypoints, avec colonne « Alt » dans le tableau et highlight croisé graphe ↔ tableau.

**Architecture:** On persiste l'altitude par waypoint (colonne `altitude` sur `race_waypoints`), déjà lue par le parser LiveTrail et aujourd'hui jetée. Un helper pur `resolveAltitudes` choisit, par course, l'altitude **absolue** (si le départ a une altitude stockée — cas LiveTrail) ou **relative** reconstruite via `d+ − d−` (UTMB / LLM / historique). Le graphe Recharts et la colonne « Alt » consomment ce même helper. Un état `hoveredWaypointIndex` remonté dans `CoursePageClient` synchronise le survol entre graphe et tableau.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Recharts 2.12, Supabase (Postgres), Jest + @testing-library/react.

## Global Constraints

- **Langue UI : français.** Tout texte affiché est en français (comme `WaypointsTable`/`CoursePageClient`, qui n'utilisent PAS i18n — ne pas introduire `useT`/`I18nProvider` dans les nouveaux composants du plan).
- **Migrations Supabase NON auto-appliquées :** la migration `044` doit être collée manuellement dans le SQL Editor Supabase **AVANT** le déploiement du code (sinon toute écriture de waypoint échoue). Le rappeler à Franck.
- **Déploiement : `git push` GitHub → Vercel auto-deploy.** Jamais `vercel --prod` CLI.
- **Tests ciblés :** lancer uniquement les suites touchées (`npx jest <fichier>`) — ~50 tests i18n échouent en pré-existant, non liés.
- **cwd :** lancer jest/npm depuis `web/` (`cd c:/Users/Franc/app-run-mobile/web`), git depuis la racine.
- **Style :** éditions chirurgicales, suivre les patterns existants. Ne pas toucher au modèle CES/charge, à `hash.ts`, ni au JSON Schema LLM (`RACE_EXTRACTION_JSON_SCHEMA` — on ne demande PAS l'altitude au LLM).

---

### Task 1: Persistance de l'altitude (bout en bout)

Ajoute la colonne `altitude` et la fait circuler import → DB → lecture. Le champ
`RaceWaypoint.altitude` étant requis, **tous** les constructeurs de waypoint doivent le fournir
dans le même changement pour garder la compilation verte.

**Files:**
- Create: `web/supabase/migrations/044_waypoint_altitude.sql`
- Modify: `web/types/plan.ts` (interface `RaceWaypoint`, ~ligne 209-223)
- Modify: `web/lib/race-import/sources/livetrail.ts` (`mapPointsBlock`, ~ligne 162-189)
- Modify: `web/lib/race-import/sources/utmb.ts` (`mapUtmbPoint`, ~ligne 81-98)
- Modify: `web/lib/race-import/schema.ts` (`rawToExtractedRaceData` ~85-98 ; `DbRow` ~157-171 ; `rowToRaceWaypoint` ~188-204)
- Modify: `web/app/api/races/[id]/waypoints/route.ts` (row builder, ~ligne 68-76)
- Modify: `web/app/api/races/[id]/tableau-recheck/route.ts` (`toRow`, ~ligne 8-12)
- Test: `web/__tests__/lib/race-import/livetrail.test.ts`
- Test: `web/__tests__/lib/race-import/utmb.test.ts`
- Test: `web/__tests__/lib/race-import/schema.test.ts`

**Interfaces:**
- Produces: `RaceWaypoint.altitude: number | null` (mètres absolus, `null` si la source ne le donne pas). Consommé par Task 2, 3, 4.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `web/__tests__/lib/race-import/livetrail.test.ts`, ajouter à la fin du bloc `describe('livetrailParser.parse()', ...)` (avant sa `})` fermante, ~ligne 216) :

```ts
  it("persiste l'altitude absolue (@_a) de chaque waypoint", async () => {
    mockFetchOnce(FIXTURE_XML)
    const out = await livetrailParser.parse(
      'https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026/races/GdRaid',
    )
    expect(out.waypoints[0].altitude).toBe(3)   // Port de Vannes, a="3"
    expect(out.waypoints[1].altitude).toBe(2)   // Séné Barrarac'h, a="2"
    expect(out.waypoints[13].altitude).toBe(3)  // Arrivée, a="3"
  })
```

Dans `web/__tests__/lib/race-import/utmb.test.ts`, ajouter dans le bloc `describe('utmbParser.parse()', ...)` (avant sa `})`, ~ligne 134) :

```ts
  it("altitude = null (UTMB n'expose pas d'altitude absolue par point)", async () => {
    mockFetchOnce(FIXTURE_HTML)
    const out = await utmbParser.parse('https://saint-jacques.utmb.world/fr/races/100M')
    expect(out.waypoints[0].altitude).toBeNull()
    expect(out.waypoints.every((w) => w.altitude === null)).toBe(true)
  })
```

Dans `web/__tests__/lib/race-import/schema.test.ts`, ajouter ces deux tests (à la fin du fichier, avant l'éventuelle fermeture finale) :

```ts
describe('altitude (champ ajouté)', () => {
  it('rowToRaceWaypoint expose altitude (présente)', () => {
    const wp = rowToRaceWaypoint({
      id: 'w1', race_id: 'r1', order_index: 1, name: 'Col',
      km: 10, km_inter: null, d_plus: 600, d_moins: 100,
      cutoff_raw: null, cutoff_kind: null, type: 'ravito', altitude: 1850,
    } as any)
    expect(wp.altitude).toBe(1850)
  })

  it('rowToRaceWaypoint : altitude absente → null', () => {
    const wp = rowToRaceWaypoint({
      id: 'w2', race_id: 'r1', order_index: 0, name: 'Départ',
      km: 0, km_inter: null, d_plus: 0, d_moins: 0,
      cutoff_raw: null, cutoff_kind: null, type: 'depart',
    } as any)
    expect(wp.altitude).toBeNull()
  })

  it('rawToExtractedRaceData : altitude null (on ne demande pas l\'altitude au LLM)', () => {
    const out = rawToExtractedRaceData({
      race_name: 'X', edition_year: null, edition_date: null, date_explicit: false,
      waypoints: [{
        order_index: 0, name: 'Départ', km: 0, km_inter: null, d_plus: 0, d_moins: 0,
        cutoff_raw: null, cutoff_kind: 'unknown', type: 'depart',
      }],
    })
    expect(out.waypoints[0].altitude).toBeNull()
  })
})
```

Vérifier que `rowToRaceWaypoint` et `rawToExtractedRaceData` sont bien importés en tête de `schema.test.ts` ; sinon les ajouter à l'import existant depuis `@/lib/race-import/schema`.

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/race-import/livetrail.test.ts __tests__/lib/race-import/utmb.test.ts __tests__/lib/race-import/schema.test.ts`
Expected: FAIL — `altitude` est `undefined` (livetrail/utmb) et la propriété n'existe pas sur le type retourné (schema). Erreurs TypeScript possibles « Property 'altitude' does not exist ».

- [ ] **Step 3: Créer la migration**

`web/supabase/migrations/044_waypoint_altitude.sql` :

```sql
-- 044 : altitude absolue (m) par waypoint. NULL si la source ne la fournit pas
-- (UTMB, imports LLM, historique). Le profil retombe alors sur le relatif (d+ − d−).
alter table race_waypoints
  add column if not exists altitude integer;

comment on column race_waypoints.altitude is
  'Altitude absolue en mètres au point ; NULL si inconnue (mode relatif d+−d−).';
```

- [ ] **Step 4: Ajouter le champ au type**

Dans `web/types/plan.ts`, interface `RaceWaypoint`, ajouter la ligne `altitude` juste après `dMoins` :

```ts
  dPlus: number | null    // CUMULÉ depuis le départ
  dMoins: number | null   // CUMULÉ depuis le départ
  altitude: number | null // altitude absolue (m) au point ; NULL si inconnue
```

- [ ] **Step 5: Renseigner l'altitude dans les constructeurs**

`web/lib/race-import/sources/livetrail.ts`, dans le `return` de `mapPointsBlock` (l'objet waypoint, ~ligne 177-189), ajouter `altitude` (la variable `altitude` existe déjà ligne ~171) après `dMoins` :

```ts
      dPlus,
      dMoins,
      altitude,
      cutoffRaw,
```

`web/lib/race-import/sources/utmb.ts`, dans le `return` de `mapUtmbPoint` (~ligne 85-97), ajouter après `dMoins` :

```ts
    dPlus: p.gainElevation,
    dMoins: p.lossElevation,
    altitude: null,
    cutoffRaw,
```

`web/lib/race-import/schema.ts`, dans `rawToExtractedRaceData` (le `.map`, ~ligne 85-98), ajouter après `dMoins` :

```ts
      dPlus: w.d_plus,
      dMoins: w.d_moins,
      altitude: null,
      cutoffRaw: w.cutoff_raw,
```

- [ ] **Step 6: Mapper DB → TS**

`web/lib/race-import/schema.ts`, type `DbRow` (~ligne 157-171), ajouter après `d_moins` :

```ts
  d_plus: number | null
  d_moins: number | null
  altitude?: number | null
```

Et dans `rowToRaceWaypoint` (~ligne 188-204), ajouter après `dMoins` :

```ts
    dPlus: row.d_plus,
    dMoins: row.d_moins,
    altitude: row.altitude ?? null,
    cutoffRaw: row.cutoff_raw,
```

- [ ] **Step 7: Écrire l'altitude en base (2 routes)**

`web/app/api/races/[id]/waypoints/route.ts`, dans le `rows = (body.waypoints ?? []).map((w) => ({ ... }))` (~ligne 68-76), ajouter après `d_moins` :

```ts
    d_plus: w.dPlus,
    d_moins: w.dMoins,
    altitude: w.altitude,
    cutoff_raw: w.cutoffRaw,
```

`web/app/api/races/[id]/tableau-recheck/route.ts`, dans `toRow` (~ligne 8-12), ajouter après `d_moins: w.dMoins,` :

```ts
  d_plus: w.dPlus, d_moins: w.dMoins, altitude: w.altitude, cutoff_raw: w.cutoffRaw,
```

- [ ] **Step 8: Lancer les tests pour vérifier le succès**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/race-import/livetrail.test.ts __tests__/lib/race-import/utmb.test.ts __tests__/lib/race-import/schema.test.ts`
Expected: PASS (toutes les suites, y compris les tests pré-existants de ces fichiers).

- [ ] **Step 9: Vérifier la compilation TypeScript**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx tsc --noEmit`
Expected: aucune erreur. Si `tsc` signale un objet waypoint sans `altitude` ailleurs (constructeur oublié), l'ajouter avec `altitude: null` et relancer.

- [ ] **Step 10: Commit**

```bash
git add web/supabase/migrations/044_waypoint_altitude.sql web/types/plan.ts web/lib/race-import/sources/livetrail.ts web/lib/race-import/sources/utmb.ts web/lib/race-import/schema.ts "web/app/api/races/[id]/waypoints/route.ts" "web/app/api/races/[id]/tableau-recheck/route.ts" web/__tests__/lib/race-import/livetrail.test.ts web/__tests__/lib/race-import/utmb.test.ts web/__tests__/lib/race-import/schema.test.ts
git commit -m "feat(plan): persiste l'altitude par waypoint (migration 044)"
```

---

### Task 2: Helpers `resolveAltitudes` + `formatAltitudeCell`

Fonctions pures, source de vérité pour le graphe et la colonne « Alt ».

**Files:**
- Modify: `web/lib/plan/waypoint-view.ts` (ajout en fin de fichier)
- Test: `web/__tests__/lib/plan/waypoint-view.test.ts` (ajout)

**Interfaces:**
- Consumes: rien (pur).
- Produces:
  - `interface AltitudeInput { altitude: number | null; dPlus: number | null; dMoins: number | null }`
  - `interface ResolvedAltitudes { mode: 'absolute' | 'relative'; values: Array<number | null> }`
  - `resolveAltitudes(wps: AltitudeInput[]): ResolvedAltitudes`
  - `formatAltitudeCell(value: number | null, mode: 'absolute' | 'relative'): string`
  Consommés par Task 3 (graphe) et Task 4 (tableau).

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `web/__tests__/lib/plan/waypoint-view.test.ts`, ajouter l'import en tête (fusionner avec l'import existant depuis `@/lib/plan/waypoint-view`) :

```ts
import { resolveAltitudes, formatAltitudeCell } from '@/lib/plan/waypoint-view'
```

Puis ajouter à la fin du fichier :

```ts
describe('resolveAltitudes', () => {
  it('départ avec altitude → mode absolu (valeurs absolues)', () => {
    const out = resolveAltitudes([
      { altitude: 1000, dPlus: 0, dMoins: 0 },
      { altitude: 1200, dPlus: 300, dMoins: 100 },
    ])
    expect(out.mode).toBe('absolute')
    expect(out.values).toEqual([1000, 1200])
  })

  it('mode absolu : point sans altitude reconstruit via départ + (d+ − d−)', () => {
    const out = resolveAltitudes([
      { altitude: 1000, dPlus: 0, dMoins: 0 },
      { altitude: null, dPlus: 500, dMoins: 100 }, // 1000 + 500 − 100 = 1400
    ])
    expect(out.mode).toBe('absolute')
    expect(out.values).toEqual([1000, 1400])
  })

  it('départ sans altitude → mode relatif (d+ − d−)', () => {
    const out = resolveAltitudes([
      { altitude: null, dPlus: 0, dMoins: 0 },
      { altitude: null, dPlus: 500, dMoins: 100 },
      { altitude: null, dPlus: 800, dMoins: 900 }, // descend sous le départ → −100
    ])
    expect(out.mode).toBe('relative')
    expect(out.values).toEqual([0, 400, -100])
  })

  it('d+ ou d− manquant → value null', () => {
    const out = resolveAltitudes([
      { altitude: null, dPlus: null, dMoins: 0 },
    ])
    expect(out.values).toEqual([null])
  })

  it('liste vide → mode relatif, values vide', () => {
    expect(resolveAltitudes([])).toEqual({ mode: 'relative', values: [] })
  })
})

describe('formatAltitudeCell', () => {
  it('absolu → mètres arrondis sans signe', () => {
    expect(formatAltitudeCell(1850.4, 'absolute')).toBe('1850')
  })
  it('relatif positif → préfixe +', () => {
    expect(formatAltitudeCell(1240, 'relative')).toBe('+1240')
  })
  it('relatif négatif → préfixe −', () => {
    expect(formatAltitudeCell(-30, 'relative')).toBe('-30')
  })
  it('null → tiret', () => {
    expect(formatAltitudeCell(null, 'absolute')).toBe('—')
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/plan/waypoint-view.test.ts`
Expected: FAIL — `resolveAltitudes`/`formatAltitudeCell` non exportés (erreur d'import / `is not a function`).

- [ ] **Step 3: Implémenter les helpers**

Ajouter à la fin de `web/lib/plan/waypoint-view.ts` :

```ts
// === Altitude résolue (profil + colonne « Alt ») ===========================
// Si le DÉPART a une altitude stockée → mode absolu pour toute la course
// (points sans altitude reconstruits via départ + (d+ − d−), car
// d+ − d− = altitude − altitudeDépart). Sinon → mode relatif (d+ − d−).
export interface AltitudeInput {
  altitude: number | null
  dPlus: number | null
  dMoins: number | null
}
export interface ResolvedAltitudes {
  mode: 'absolute' | 'relative'
  values: Array<number | null>
}

export function resolveAltitudes(wps: AltitudeInput[]): ResolvedAltitudes {
  if (wps.length === 0) return { mode: 'relative', values: [] }
  const departAlt = wps[0].altitude
  if (departAlt != null) {
    return {
      mode: 'absolute',
      values: wps.map((w) =>
        w.altitude != null
          ? w.altitude
          : w.dPlus != null && w.dMoins != null
            ? departAlt + w.dPlus - w.dMoins
            : null,
      ),
    }
  }
  return {
    mode: 'relative',
    values: wps.map((w) =>
      w.dPlus != null && w.dMoins != null ? w.dPlus - w.dMoins : null,
    ),
  }
}

// Format pour la colonne « Alt » du tableau.
export function formatAltitudeCell(
  value: number | null,
  mode: 'absolute' | 'relative',
): string {
  if (value == null) return '—'
  const r = Math.round(value)
  if (mode === 'relative') return r >= 0 ? `+${r}` : String(r)
  return String(r)
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/plan/waypoint-view.test.ts`
Expected: PASS (nouveaux tests + tests pré-existants du fichier).

- [ ] **Step 5: Commit**

```bash
git add web/lib/plan/waypoint-view.ts web/__tests__/lib/plan/waypoint-view.test.ts
git commit -m "feat(plan): helpers resolveAltitudes + formatAltitudeCell"
```

---

### Task 3: Composant `ElevationProfileChart`

Graphe Recharts en aire, plus une fonction pure `buildProfileData` testable. Index des points
alignés 1:1 avec le tableau (les points sans altitude gardent `alt: null` → trou dans l'aire,
mais l'index reste celui du waypoint pour le highlight croisé).

**Files:**
- Create: `web/components/plan/ElevationProfileChart.tsx`
- Test: `web/__tests__/components/plan/ElevationProfileChart.test.tsx`

**Interfaces:**
- Consumes: `resolveAltitudes` (Task 2).
- Produces:
  - `interface ProfileWaypoint { km: number; name: string; altitude: number | null; dPlus: number | null; dMoins: number | null }`
  - `interface ProfilePoint { km: number; alt: number | null; name: string }`
  - `buildProfileData(wps: ProfileWaypoint[]): { mode: 'absolute' | 'relative'; points: ProfilePoint[] }`
  - `exploitableCount(points: ProfilePoint[]): number`
  - Composant `ElevationProfileChart({ waypoints, hoveredIndex, onHoverIndex })` où
    `waypoints: ProfileWaypoint[]`, `hoveredIndex: number | null`,
    `onHoverIndex: (i: number | null) => void`. Consommé par Task 4.

- [ ] **Step 1: Écrire les tests qui échouent**

`web/__tests__/components/plan/ElevationProfileChart.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import {
  ElevationProfileChart, buildProfileData, exploitableCount,
} from '@/components/plan/ElevationProfileChart'

const wp = (over: Partial<{ km: number; name: string; altitude: number | null; dPlus: number | null; dMoins: number | null }>) => ({
  km: 0, name: 'P', altitude: null, dPlus: 0, dMoins: 0, ...over,
})

describe('buildProfileData', () => {
  it('mode absolu : trace les altitudes absolues, longueur = nb waypoints', () => {
    const out = buildProfileData([
      wp({ km: 0, name: 'Départ', altitude: 1000, dPlus: 0, dMoins: 0 }),
      wp({ km: 10, name: 'Col', altitude: 1500, dPlus: 600, dMoins: 100 }),
    ])
    expect(out.mode).toBe('absolute')
    expect(out.points).toEqual([
      { km: 0, alt: 1000, name: 'Départ' },
      { km: 10, alt: 1500, name: 'Col' },
    ])
  })

  it('mode relatif : alt = d+ − d−', () => {
    const out = buildProfileData([
      wp({ km: 0, name: 'Départ', altitude: null, dPlus: 0, dMoins: 0 }),
      wp({ km: 5, name: 'R1', altitude: null, dPlus: 300, dMoins: 50 }),
    ])
    expect(out.mode).toBe('relative')
    expect(out.points[1]).toEqual({ km: 5, alt: 250, name: 'R1' })
  })
})

describe('exploitableCount', () => {
  it('compte les points avec alt non null', () => {
    expect(exploitableCount([
      { km: 0, alt: 100, name: 'a' },
      { km: 1, alt: null, name: 'b' },
      { km: 2, alt: 200, name: 'c' },
    ])).toBe(2)
  })
})

describe('ElevationProfileChart', () => {
  it('moins de 2 points exploitables → état vide', () => {
    render(
      <ElevationProfileChart
        waypoints={[wp({ km: 0, name: 'Départ', altitude: null, dPlus: null, dMoins: null })]}
        hoveredIndex={null}
        onHoverIndex={() => {}}
      />,
    )
    expect(screen.getByText('Profil indisponible')).toBeInTheDocument()
  })

  it('≥ 2 points exploitables → rend le graphe (pas l\'état vide)', () => {
    render(
      <ElevationProfileChart
        waypoints={[
          wp({ km: 0, name: 'Départ', altitude: 1000, dPlus: 0, dMoins: 0 }),
          wp({ km: 10, name: 'Col', altitude: 1500, dPlus: 600, dMoins: 100 }),
        ]}
        hoveredIndex={null}
        onHoverIndex={() => {}}
      />,
    )
    expect(screen.queryByText('Profil indisponible')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/components/plan/ElevationProfileChart.test.tsx`
Expected: FAIL — module `@/components/plan/ElevationProfileChart` introuvable.

- [ ] **Step 3: Implémenter le composant**

`web/components/plan/ElevationProfileChart.tsx` :

```tsx
'use client'

// Profil altimétrique d'une course (Option A) : aire Recharts tracée depuis les
// waypoints. Altitude absolue si la source la fournit (LiveTrail), sinon relative
// reconstruite (d+ − d−). Index des points alignés sur l'ordre des waypoints
// → highlight croisé avec WaypointsTable via hoveredIndex / onHoverIndex.
import { useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import { resolveAltitudes } from '@/lib/plan/waypoint-view'
import { colors } from '@/lib/design/colors'

export interface ProfileWaypoint {
  km: number
  name: string
  altitude: number | null
  dPlus: number | null
  dMoins: number | null
}
export interface ProfilePoint { km: number; alt: number | null; name: string }

export function buildProfileData(
  wps: ProfileWaypoint[],
): { mode: 'absolute' | 'relative'; points: ProfilePoint[] } {
  const { mode, values } = resolveAltitudes(
    wps.map((w) => ({ altitude: w.altitude, dPlus: w.dPlus, dMoins: w.dMoins })),
  )
  return { mode, points: wps.map((w, i) => ({ km: w.km, alt: values[i], name: w.name })) }
}

export function exploitableCount(points: ProfilePoint[]): number {
  return points.filter((p) => p.alt != null).length
}

const fmtKm = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1)).replace('.', ',')

type Props = {
  waypoints: ProfileWaypoint[]
  hoveredIndex: number | null
  onHoverIndex: (i: number | null) => void
}

export function ElevationProfileChart({ waypoints, hoveredIndex, onHoverIndex }: Props) {
  const { mode, points } = useMemo(() => buildProfileData(waypoints), [waypoints])

  if (exploitableCount(points) < 2) {
    return (
      <div className="h-[160px] rounded-[8px] bg-trail-surface border border-dashed border-trail-border flex items-center justify-center">
        <p className="text-caption text-trail-muted">Profil indisponible</p>
      </div>
    )
  }

  const yLabel = mode === 'relative' ? 'Altitude relative au départ (m)' : 'Altitude (m)'

  // Dot custom : visible uniquement sur l'index survolé (highlight venant du tableau).
  const renderDot = (p: { cx?: number; cy?: number; index?: number }) => {
    if (p.cx == null || p.cy == null || p.index !== hoveredIndex) return <g key={p.index} />
    return (
      <circle key={p.index} cx={p.cx} cy={p.cy} r={5}
        fill={colors.seriesBlue} stroke="#fff" strokeWidth={1.5} />
    )
  }

  return (
    <div style={{ width: '100%', height: 180 }}
      onMouseLeave={() => onHoverIndex(null)}>
      <ResponsiveContainer>
        <AreaChart
          data={points}
          margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
          onMouseMove={(s: { activeTooltipIndex?: number }) =>
            onHoverIndex(typeof s?.activeTooltipIndex === 'number' ? s.activeTooltipIndex : null)}
        >
          <defs>
            <linearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
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
            formatter={(value: number, _n, item: { payload?: ProfilePoint }) =>
              [`${Math.round(value)} m`, item?.payload?.name ?? yLabel]}
          />
          <Area dataKey="alt" type="linear" connectNulls
            stroke={colors.seriesBlue} strokeWidth={2}
            fill="url(#elevFill)" dot={renderDot} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/components/plan/ElevationProfileChart.test.tsx`
Expected: PASS. (Recharts peut émettre un warning de largeur 0 sous jsdom — sans incidence sur les assertions, qui portent sur l'état vide / non-vide et les fonctions pures.)

- [ ] **Step 5: Commit**

```bash
git add web/components/plan/ElevationProfileChart.tsx web/__tests__/components/plan/ElevationProfileChart.test.tsx
git commit -m "feat(plan): composant ElevationProfileChart (profil escalier)"
```

---

### Task 4: Colonne « Alt » + highlight croisé + intégration page

Ajoute la colonne « Alt » (lecture seule) au tableau, le survol bidirectionnel, et branche le
graphe dans la page course.

**Files:**
- Modify: `web/components/plan/WaypointsTable.tsx` (props, CSS grille, en-tête, cellule, survol)
- Modify: `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx` (état partagé, rendu graphe)
- Test: `web/__tests__/components/plan/WaypointsTable.altitude.test.tsx`

**Interfaces:**
- Consumes: `resolveAltitudes`, `formatAltitudeCell` (Task 2) ; `ElevationProfileChart` (Task 3).
- Produces : `WaypointsTable` accepte deux props optionnelles supplémentaires
  `hoveredIndex?: number | null` et `onHoverIndex?: (i: number | null) => void`.

- [ ] **Step 1: Écrire le test qui échoue (colonne Alt)**

`web/__tests__/components/plan/WaypointsTable.altitude.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import { WaypointsTable } from '@/components/plan/WaypointsTable'
import type { RaceWaypoint } from '@/types/plan'

type Draft = Omit<RaceWaypoint, 'id' | 'raceId'>
const wp = (over: Partial<Draft>): Draft => ({
  orderIndex: 0, name: 'P', km: 0, kmInter: null, dPlus: 0, dMoins: 0,
  altitude: null, cutoffRaw: null, cutoffKind: null, type: 'ravito',
  supplies: [], targetOverrideSec: null, ...over,
})

describe('WaypointsTable — colonne Alt', () => {
  it('affiche l\'en-tête Alt et l\'altitude absolue (mode absolu)', () => {
    render(
      <WaypointsTable
        waypoints={[
          wp({ orderIndex: 0, name: 'Départ', km: 0, altitude: 1000, dPlus: 0, dMoins: 0, type: 'depart' }),
          wp({ orderIndex: 1, name: 'Col', km: 10, altitude: 1850, dPlus: 900, dMoins: 50, type: 'arrivee' }),
        ]}
        onChange={() => {}}
        readOnly
      />,
    )
    expect(screen.getByText('Alt')).toBeInTheDocument()
    expect(screen.getByText('1850')).toBeInTheDocument()
  })

  it('mode relatif (départ sans altitude) → valeur signée', () => {
    render(
      <WaypointsTable
        waypoints={[
          wp({ orderIndex: 0, name: 'Départ', km: 0, altitude: null, dPlus: 0, dMoins: 0, type: 'depart' }),
          wp({ orderIndex: 1, name: 'Col', km: 10, altitude: null, dPlus: 900, dMoins: 50, type: 'arrivee' }),
        ]}
        onChange={() => {}}
        readOnly
      />,
    )
    expect(screen.getByText('+850')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/components/plan/WaypointsTable.altitude.test.tsx`
Expected: FAIL — « Alt »/« 1850 » absents ; et erreur TS sur `altitude` requis dans le fixture si Task 1 non faite (elle l'est).

- [ ] **Step 3: Props + imports + altitude résolue dans `WaypointsTable`**

Dans `web/components/plan/WaypointsTable.tsx`, étendre l'import depuis `waypoint-view` (~ligne 11-13) :

```ts
import {
  deriveSegment, formatElapsedShort, parseElapsedShort, formatMargin,
  resolveAltitudes, formatAltitudeCell,
} from '@/lib/plan/waypoint-view'
```

Ajouter au type `Props` (~ligne 18-32), avant la `}` fermante :

```ts
  // Highlight croisé avec le profil altimétrique (optionnel).
  hoveredIndex?: number | null
  onHoverIndex?: (i: number | null) => void
```

Ajouter aux paramètres déstructurés de la fonction (~ligne 96-99) :

```ts
export function WaypointsTable({
  waypoints, onChange, readOnly, editLines = false, onEditLinesChange,
  startTime, targetDurationMin, pacingFade, onStartTimeChange,
  hoveredIndex, onHoverIndex,
}: Props) {
```

Juste après le `useMemo` `segInputs` (~ligne 134-137), ajouter l'altitude résolue :

```ts
  const alt = useMemo(
    () => resolveAltitudes(
      waypoints.map((w) => ({ altitude: w.altitude, dPlus: w.dPlus, dMoins: w.dMoins })),
    ),
    [waypoints],
  )
```

- [ ] **Step 4: Grille CSS + en-tête + cellule + survol**

Dans le bloc `<style>`, la règle `.wtbl .gA{...}` (~ligne 205) : insérer une colonne `32px` pour Alt (entre D- et BH) et resserrer le `column-gap` à `3px` pour préserver la largeur du nom sur mobile :

```css
        .wtbl .gA{display:grid;grid-template-columns:minmax(0,1fr) 40px 32px 32px 32px 34px 54px 48px;column-gap:3px;align-items:center;}
```

Ajouter la règle de surbrillance de ligne (n'importe où dans le `<style>`, ex. après `.wtbl .gA.row{...}` ~ligne 209) :

```css
        .wtbl .gA.row.hl{background:rgba(127,127,127,.10);border-radius:6px;}
```

En-tête (~ligne 257-261) : insérer `<span className="r">Alt</span>` après le `D-` :

```tsx
        <div className="gA head">
          <span>Point</span><span className="r">Dist</span><span className="r">D+</span>
          <span className="r">D-</span><span className="r">Alt</span>
          <span className="r">BH</span><span className="c">Ravito</span><span className="c">Obj</span>
        </div>
```

Survol de ligne : sur le `<div className="row-wrap" key=...>` (~ligne 281), ajouter les handlers ; et sur le `<div className="gA row">` interne (~ligne 286), ajouter la classe `hl` conditionnelle :

```tsx
          <div className="row-wrap" key={`${w.orderIndex}-${i}`}
            onMouseEnter={() => onHoverIndex?.(i)}
            onMouseLeave={() => onHoverIndex?.(null)}>
            {editLines && !readOnly && (
              <button type="button" className="del" aria-label="Supprimer la ligne"
                onClick={() => removeRow(i)}>×</button>
            )}
            <div className={`gA row${hoveredIndex === i ? ' hl' : ''}`}>
```

Cellule « Alt » : l'insérer juste après la cellule D- (le bloc `{/* D- : cumul + segment ... */}`, qui se termine à `</div>` ~ligne 326), avant le bloc `{/* Barrière ... */}` :

```tsx
            {/* Alt : altitude résolue (lecture seule ; absolue ou relative selon la source) */}
            <div className="num">
              <span className="big muted">{formatAltitudeCell(alt.values[i], alt.mode)}</span>
            </div>
```

- [ ] **Step 5: Lancer le test pour vérifier le succès**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx jest __tests__/components/plan/WaypointsTable.altitude.test.tsx __tests__/components/plan/WaypointsTable.undo.test.tsx`
Expected: PASS (nouveau test + non-régression du test undo existant).

- [ ] **Step 6: Brancher le graphe + l'état partagé dans `CoursePageClient`**

Dans `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx` :

Import (après la ligne 8, l'import de `WaypointsTable`) :

```ts
import { ElevationProfileChart } from '@/components/plan/ElevationProfileChart'
```

État (après `const [editField, ...]` ~ligne 52) :

```ts
  const [hoveredWaypointIndex, setHoveredWaypointIndex] = useState<number | null>(null)
```

Passer le survol au tableau : dans le `<WaypointsTable ... />` (~ligne 281-290), ajouter avant la `/>` :

```tsx
              editLines={editLines}
              onEditLinesChange={setEditLines}
              hoveredIndex={hoveredWaypointIndex}
              onHoverIndex={setHoveredWaypointIndex}
            />
```

Remplacer la Section « Profil de la course » (~ligne 295-299) en entier par :

```tsx
      <Section title="Profil de la course">
        {waypoints.length > 0 ? (
          <ElevationProfileChart
            waypoints={waypoints.map(({ km, name, altitude, dPlus, dMoins }) => ({ km, name, altitude, dPlus, dMoins }))}
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

- [ ] **Step 7: Vérifier compilation + suites touchées**

Run: `cd c:/Users/Franc/app-run-mobile/web && npx tsc --noEmit && npx jest __tests__/components/plan/`
Expected: `tsc` sans erreur ; suites `plan/` au vert (hors échecs i18n pré-existants éventuels non liés).

- [ ] **Step 8: Vérification visuelle (manuelle, Franck)**

Run: `cd c:/Users/Franc/app-run-mobile/web && npm run dev`
Ouvrir une course **LiveTrail** (profil en mètres absolus) et une course **UTMB/LLM** (axe « relatif au départ »). Vérifier : la courbe s'affiche, le tooltip donne le nom + l'altitude, le survol d'un point surligne la ligne du tableau (et inversement sur desktop), la colonne « Alt » affiche les bonnes valeurs et le nom reste lisible sur mobile (~360px).

- [ ] **Step 9: Commit**

```bash
git add web/components/plan/WaypointsTable.tsx "web/app/(main)/plan/courses/[id]/CoursePageClient.tsx" web/__tests__/components/plan/WaypointsTable.altitude.test.tsx
git commit -m "feat(plan): colonne Alt + profil altimétrique branché sur la page course"
```

---

## Déploiement (après les 4 tasks)

1. **Appliquer la migration `044`** : coller `web/supabase/migrations/044_waypoint_altitude.sql` dans le SQL Editor Supabase (rappel à Franck — non auto-appliquée).
2. `git push` (branche `feat/profil-course-altimetrie`) → ouvrir/mettre à jour la PR, ou merger sur `master` → Vercel auto-deploy.
3. Vérifier sur trailcockpit.run qu'une course existante (mode relatif) et un nouvel import LiveTrail (mode absolu) affichent bien le profil.

## Notes de cadrage

- **Mobile :** la 8ᵉ colonne resserre la grille ; `column-gap` passe à 3px et le nom (`-webkit-line-clamp:2`) se replie sur 2 lignes si besoin — pas de scroll X (la 1ʳᵉ colonne est `minmax(0,1fr)`). Ajustable visuellement à l'étape 8.4.
- **Highlight croisé :** dépend du survol souris → no-op au tactile (dégradation propre, acceptable).
- **`hash.ts` non touché :** `hashWaypoints` whiteliste ses champs (pas d'altitude) → aucun faux diff de fraîcheur.
- **Option B (profil dense GPX) :** hors périmètre, spec séparée ultérieure.
```
