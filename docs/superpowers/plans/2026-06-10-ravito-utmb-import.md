# Import auto des ravitaillements UTMB + 5 catégories — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplir automatiquement les ravitos (liquide, solide, chaud, base vie, assistance) du tableau de course à l'import d'un lien UTMB, et étendre le modèle de ravito de 3 à 5 catégories.

**Architecture:** Nouveau parser déterministe `sources/utmb.ts` (jumeau de `livetrail.ts`) qui lit le JSON `"points":[…]` embarqué dans la page UTMB, mappe chaque point vers un waypoint (km/D+/D−/barrière/nom + 5 ravitos), filtre aux points utiles, et passe par le `validateExtractedRaceData` existant. Extension du type `WaypointSupply` (+`hot`, +`assistance`) sans migration DB (colonne `text[]` sans contrainte). UI tableau : pastilles compactes auto-remplies + édition au tap. UI carte PDF : badges C/A.

**Tech Stack:** Next.js 14, TypeScript, Jest, Supabase (`text[]`), `WaypointsTable.tsx`, registre de parsers (`registerParser`/`findParserForUrl`).

Spec : `docs/superpowers/specs/2026-06-10-ravito-utmb-import-design.md`.

---

## Structure des fichiers

- **Modifier** `web/types/plan.ts` — type `WaypointSupply` 3 → 5 valeurs.
- **Créer** `web/lib/race-import/sources/utmb.ts` — parser UTMB (match, parse, mapping, filtrage, scanner JSON).
- **Créer** `web/__tests__/lib/race-import/utmb.test.ts` — tests du parser (fixture HTML inline).
- **Modifier** `web/app/api/race-import/route.ts` — import side-effect du parser.
- **Modifier** `web/components/plan/WaypointsTable.tsx` — cellule ravito : pastilles + éditeur au tap, 5 catégories.
- **Modifier** `web/app/(main)/plan/courses/[id]/print/page.tsx` — badges C/A + légende.
- **Modifier** `web/lib/plan/print-columns.ts` — largeur colonne `rav` si besoin.

**Conventions de commande (Windows / ce repo) :**
- Tests : `cd web` puis `npx jest <chemin>` (lancer SEULEMENT les suites pertinentes — ~50 tests i18n échouent en pré-existant, hors sujet).
- Typecheck : `cd web` puis `npx tsc --noEmit`.
- Lint : `cd web` puis `npx eslint <fichier>`.
- Vérif visuelle : Chrome headless `--screenshot` (PNG dans `%TEMP%`), méthode déjà utilisée sur ce projet.

---

## Task 1 : Étendre le modèle `WaypointSupply` (3 → 5)

**Files:**
- Modify: `web/types/plan.ts:205`

- [ ] **Step 1 : Modifier le type**

Remplacer la ligne 205 :

```ts
export type WaypointSupply = 'solid' | 'liquid' | 'base_vie'
```

par :

```ts
// Ordre canonique d'affichage : liquid, solid, hot, base_vie, assistance.
export type WaypointSupply = 'liquid' | 'solid' | 'hot' | 'base_vie' | 'assistance'
```

(On ajoute `'hot'` + `'assistance'`, on garde les 3 existantes → les `supplies` saisis à la main restent valides. Aucune migration DB : `race_waypoints.supplies` est `text[]` sans contrainte CHECK, cf. migration 035.)

- [ ] **Step 2 : Vérifier la compilation**

Run: `cd web && npx tsc --noEmit`
Expected: exit 0 (aucune erreur ; le code existant n'utilise que `solid`/`liquid`/`base_vie`, toujours valides).

- [ ] **Step 3 : Commit**

```bash
git add web/types/plan.ts
git commit -m "feat(plan): WaypointSupply 3->5 (ajout hot + assistance)"
```

---

## Task 2 : Mapping ravito + `match()` du parser UTMB (logique pure)

**Files:**
- Create: `web/lib/race-import/sources/utmb.ts`
- Test: `web/__tests__/lib/race-import/utmb.test.ts`

- [ ] **Step 1 : Écrire les tests qui échouent (mapping + match)**

Créer `web/__tests__/lib/race-import/utmb.test.ts` :

```ts
import { utmbParser, mapUtmbSupplies, type UtmbPoint } from '@/lib/race-import/sources/utmb'

const pt = (over: Partial<UtmbPoint>): UtmbPoint => ({
  name: 'X', distance: 1000, gainElevation: 0, lossElevation: 0,
  supplies: 'none', isAssistance: false, hasBag: false, cutoff: '', ...over,
})

describe('mapUtmbSupplies', () => {
  it('none + aucun flag → []', () => {
    expect(mapUtmbSupplies(pt({ supplies: 'none' }))).toEqual([])
  })
  it('drink → liquide', () => {
    expect(mapUtmbSupplies(pt({ supplies: 'drink' }))).toEqual(['liquid'])
  })
  it('food → liquide + solide', () => {
    expect(mapUtmbSupplies(pt({ supplies: 'food' }))).toEqual(['liquid', 'solid'])
  })
  it('hotFood → liquide + solide + chaud', () => {
    expect(mapUtmbSupplies(pt({ supplies: 'hotFood' }))).toEqual(['liquid', 'solid', 'hot'])
  })
  it('hotFood + bag + assistance → les 5 dans l\'ordre canonique', () => {
    expect(mapUtmbSupplies(pt({ supplies: 'hotFood', hasBag: true, isAssistance: true })))
      .toEqual(['liquid', 'solid', 'hot', 'base_vie', 'assistance'])
  })
  it('none + assistance seule → [assistance]', () => {
    expect(mapUtmbSupplies(pt({ supplies: 'none', isAssistance: true }))).toEqual(['assistance'])
  })
  it('food + bag → liquide + solide + base vie', () => {
    expect(mapUtmbSupplies(pt({ supplies: 'food', hasBag: true })))
      .toEqual(['liquid', 'solid', 'base_vie'])
  })
})

describe('utmbParser.match()', () => {
  it('matche une page course UTMB (sous-domaine + /races/)', () => {
    expect(utmbParser.match('https://saint-jacques.utmb.world/fr/races/100M')).toBe(true)
  })
  it('rejette la home UTMB (pas de /races/)', () => {
    expect(utmbParser.match('https://saint-jacques.utmb.world/fr')).toBe(false)
  })
  it('rejette livetrail', () => {
    expect(utmbParser.match('https://tsj.livetrail.run/parcours.php?course=Ultra')).toBe(false)
  })
  it('rejette une URL invalide', () => {
    expect(utmbParser.match('pas-une-url')).toBe(false)
  })
})
```

- [ ] **Step 2 : Lancer → échec attendu**

Run: `cd web && npx jest __tests__/lib/race-import/utmb.test.ts`
Expected: FAIL (`Cannot find module '@/lib/race-import/sources/utmb'`).

- [ ] **Step 3 : Créer `utmb.ts` (types + mapping + match)**

Créer `web/lib/race-import/sources/utmb.ts` :

```ts
// Parser UTMB World Series : la page course ({slug}.utmb.world/.../races/{code})
// embarque un JSON "points":[…] dans son HTML serveur. On le lit directement
// (déterministe, 0 LLM). Dépendance : noms de champs UTMB (supplies, isAssistance,
// hasBag, distance, gainElevation, lossElevation, name, cutoff). Si UTMB change sa
// structure → le parser lève → la route retombe sur le fallback LLM.
import 'server-only'
import type { ExtractedRaceData, WaypointSupply, WaypointType } from '@/types/plan'
import { validateExtractedRaceData } from '../schema'
import { type RaceParser, registerParser } from './index'

const FETCH_TIMEOUT_MS = 10_000
const MAX_BYTES = 4_000_000

export class UtmbError extends Error {}

// Champs du JSON embarqué qu'on lit (la page en contient bien d'autres).
export interface UtmbPoint {
  name: string
  distance: number                 // mètres
  gainElevation: number | null     // D+ cumulé
  lossElevation: number | null     // D- cumulé
  supplies: 'none' | 'drink' | 'food' | 'hotFood' | string  // hiérarchique
  isAssistance: boolean
  hasBag: boolean                  // sac d'allègement → base de vie
  cutoff: string | null            // ex "sam. 07:20" ou ""
}

// supplies UTMB (drink ⊂ food ⊂ hotFood) + flags → nos 5 catégories, ordre canonique.
export function mapUtmbSupplies(p: UtmbPoint): WaypointSupply[] {
  const out: WaypointSupply[] = []
  const s = p.supplies
  if (s === 'drink' || s === 'food' || s === 'hotFood') out.push('liquid')
  if (s === 'food' || s === 'hotFood') out.push('solid')
  if (s === 'hotFood') out.push('hot')
  if (p.hasBag) out.push('base_vie')
  if (p.isAssistance) out.push('assistance')
  return out
}

export const utmbParser: RaceParser = {
  id: 'utmb',
  match(url: string): boolean {
    try {
      const u = new URL(url)
      return u.hostname.endsWith('.utmb.world') && u.pathname.includes('/races/')
    } catch {
      return false
    }
  },
  async parse(): Promise<ExtractedRaceData> {
    throw new UtmbError('not implemented') // complété en Task 4
  },
}

// (registerParser ajouté en Task 4, une fois parse() réel.)
```

- [ ] **Step 4 : Lancer → succès**

Run: `cd web && npx jest __tests__/lib/race-import/utmb.test.ts`
Expected: PASS (les blocs `mapUtmbSupplies` et `match` passent ; `parse` pas encore testé).

- [ ] **Step 5 : Commit**

```bash
git add web/lib/race-import/sources/utmb.ts web/__tests__/lib/race-import/utmb.test.ts
git commit -m "feat(race-import): mapping ravitos UTMB + match() (parser squelette)"
```

---

## Task 3 : Extraction du JSON `points` (scanner conscient des chaînes)

**Files:**
- Modify: `web/lib/race-import/sources/utmb.ts`
- Test: `web/__tests__/lib/race-import/utmb.test.ts`

- [ ] **Step 1 : Ajouter les tests d'extraction (échec attendu)**

Ajouter dans `utmb.test.ts` (et compléter l'import en tête) :

```ts
import { utmbParser, mapUtmbSupplies, extractPointsJson, UtmbError, type UtmbPoint }
  from '@/lib/race-import/sources/utmb'

const FIXTURE_HTML = `<!doctype html><html><body><script type="application/json">
{"props":{"race":{"name":"Ultra","points":[
{"name":"Saugues","distance":0,"gainElevation":0,"lossElevation":0,"supplies":"none","isAssistance":false,"hasBag":false,"cutoff":""},
{"name":"Saint Julien des Chazes","distance":17890,"gainElevation":396,"lossElevation":760,"supplies":"drink","isAssistance":false,"hasBag":false,"cutoff":""},
{"name":"Sommet de la Durande","distance":28500,"gainElevation":900,"lossElevation":800,"supplies":"none","isAssistance":false,"hasBag":false,"cutoff":""},
{"name":"Saint Jean Lachalm","distance":72400,"gainElevation":3242,"lossElevation":2900,"supplies":"hotFood","isAssistance":true,"hasBag":true,"cutoff":"sam. 11:20"},
{"name":"Pont de la Roche [deviation]","distance":125900,"gainElevation":4966,"lossElevation":5100,"supplies":"none","isAssistance":false,"hasBag":false,"cutoff":"sam. 23:20"},
{"name":"Le Puy en Velay","distance":138400,"gainElevation":5267,"lossElevation":5550,"supplies":"food","isAssistance":false,"hasBag":true,"cutoff":"dim. 02:15"}
]}},"after":[1,2,3]}
</script></body></html>`

describe('extractPointsJson', () => {
  it('extrait les 6 points bruts du HTML', () => {
    const pts = extractPointsJson(FIXTURE_HTML)
    expect(pts).toHaveLength(6)
    expect(pts[0].name).toBe('Saugues')
    expect(pts[5].name).toBe('Le Puy en Velay')
  })
  it('ne s\'arrête pas sur un ] présent dans une chaîne (scanner conscient des strings)', () => {
    const pts = extractPointsJson(FIXTURE_HTML)
    expect(pts[4].name).toBe('Pont de la Roche [deviation]')
  })
  it('lève UtmbError si le bloc "points" est absent', () => {
    expect(() => extractPointsJson('<html>rien</html>')).toThrow(UtmbError)
  })
})
```

- [ ] **Step 2 : Lancer → échec attendu**

Run: `cd web && npx jest __tests__/lib/race-import/utmb.test.ts`
Expected: FAIL (`extractPointsJson` non exportée).

- [ ] **Step 3 : Implémenter `extractPointsJson`**

Dans `utmb.ts`, ajouter (au-dessus de `utmbParser`) :

```ts
// Isole le tableau JSON "points":[…] du HTML. Scanner d'appariement de crochets
// CONSCIENT DES CHAÎNES : ignore [ ] { } à l'intérieur des strings JSON (sinon un
// nom de point contenant un crochet couperait l'extraction).
export function extractPointsJson(html: string): UtmbPoint[] {
  const marker = '"points":['
  const at = html.indexOf(marker)
  if (at === -1) throw new UtmbError('Bloc "points" introuvable dans la page')
  const start = at + marker.length - 1 // index du '['
  let depth = 0
  let inStr = false
  let esc = false
  let end = -1
  for (let i = start; i < html.length; i++) {
    const c = html[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) { end = i + 1; break }
    }
  }
  if (end === -1) throw new UtmbError('Tableau "points" non terminé')
  let arr: unknown
  try {
    arr = JSON.parse(html.slice(start, end))
  } catch {
    throw new UtmbError('Tableau "points" non parsable')
  }
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new UtmbError('Aucun point de passage')
  }
  return arr as UtmbPoint[]
}
```

- [ ] **Step 4 : Lancer → succès**

Run: `cd web && npx jest __tests__/lib/race-import/utmb.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add web/lib/race-import/sources/utmb.ts web/__tests__/lib/race-import/utmb.test.ts
git commit -m "feat(race-import): extraction JSON points UTMB (scanner conscient des strings)"
```

---

## Task 4 : `parse()` complet — mapping + filtrage + validate + register

**Files:**
- Modify: `web/lib/race-import/sources/utmb.ts`
- Test: `web/__tests__/lib/race-import/utmb.test.ts`

- [ ] **Step 1 : Ajouter les tests de `parse()` (échec attendu)**

Ajouter dans `utmb.test.ts` :

```ts
function mockFetchOnce(html: string) {
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, text: async () => html } as any)
}

describe('utmbParser.parse()', () => {
  afterEach(() => jest.restoreAllMocks())

  it('filtre aux points utiles : 6 → 5 (le landmark sans service/barrière est retiré)', async () => {
    mockFetchOnce(FIXTURE_HTML)
    const out = await utmbParser.parse('https://saint-jacques.utmb.world/fr/races/100M')
    expect(out.waypoints).toHaveLength(5)
    expect(out.waypoints.find((w) => w.name === 'Sommet de la Durande')).toBeUndefined()
  })

  it('force depart/arrivee aux extrémités', async () => {
    mockFetchOnce(FIXTURE_HTML)
    const out = await utmbParser.parse('https://saint-jacques.utmb.world/fr/races/100M')
    expect(out.waypoints[0].name).toBe('Saugues')
    expect(out.waypoints[0].type).toBe('depart')
    expect(out.waypoints[4].name).toBe('Le Puy en Velay')
    expect(out.waypoints[4].type).toBe('arrivee')
  })

  it('mappe km / D+ / D- / barrière + les 5 ravitos (St Jean Lachalm)', async () => {
    mockFetchOnce(FIXTURE_HTML)
    const out = await utmbParser.parse('https://saint-jacques.utmb.world/fr/races/100M')
    const w = out.waypoints.find((x) => x.name === 'Saint Jean Lachalm')!
    expect(w.km).toBe(72.4)
    expect(w.dPlus).toBe(3242)
    expect(w.dMoins).toBe(2900)
    expect(w.cutoffRaw).toBe('sam. 11:20')
    expect(w.cutoffKind).toBe('clock_time')
    expect(w.supplies).toEqual(['liquid', 'solid', 'hot', 'base_vie', 'assistance'])
    expect(w.type).toBe('ravito')
  })

  it('point barrière sans ravito (Pont de la Roche) : gardé, supplies vide, type pointage', async () => {
    mockFetchOnce(FIXTURE_HTML)
    const out = await utmbParser.parse('https://saint-jacques.utmb.world/fr/races/100M')
    const w = out.waypoints.find((x) => x.name.startsWith('Pont de la Roche'))!
    expect(w.supplies).toEqual([])
    expect(w.type).toBe('pointage')
    expect(w.cutoffRaw).toBe('sam. 23:20')
  })

  it('départ sans barrière → cutoffRaw/cutoffKind null', async () => {
    mockFetchOnce(FIXTURE_HTML)
    const out = await utmbParser.parse('https://saint-jacques.utmb.world/fr/races/100M')
    expect(out.waypoints[0].cutoffRaw).toBeNull()
    expect(out.waypoints[0].cutoffKind).toBeNull()
  })

  it('lève (→ fallback LLM côté route) si HTTP non-ok', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 404 } as any)
    await expect(
      utmbParser.parse('https://saint-jacques.utmb.world/fr/races/100M'),
    ).rejects.toThrow(UtmbError)
  })
})

it('enregistre le parser dans le registre', () => {
  // import du module = effet de bord registerParser ; findParser doit le retrouver.
  const { findParserForUrl } = require('@/lib/race-import/sources')
  expect(findParserForUrl('https://saint-jacques.utmb.world/fr/races/100M')?.id).toBe('utmb')
})
```

- [ ] **Step 2 : Lancer → échec attendu**

Run: `cd web && npx jest __tests__/lib/race-import/utmb.test.ts`
Expected: FAIL (`parse` lève `not implemented` ; pas de `registerParser`).

- [ ] **Step 3 : Implémenter `mapUtmbPoint`, `isUsefulPoint`, `fetchHtml`, `parse()`, register**

Dans `utmb.ts` : ajouter les helpers (au-dessus de `utmbParser`), remplacer le corps de `parse`, et appeler `registerParser` à la fin du fichier.

```ts
// Point UTMB → waypoint (sans id/raceId). type pointage si aucun ravito.
export function mapUtmbPoint(p: UtmbPoint, idx: number) {
  const supplies = mapUtmbSupplies(p)
  const cutoffRaw = p.cutoff && p.cutoff.length > 0 ? p.cutoff : null
  const type: WaypointType = supplies.length > 0 ? 'ravito' : 'pointage'
  return {
    orderIndex: idx,
    name: p.name.trim(),
    km: p.distance / 1000,
    kmInter: null,
    dPlus: p.gainElevation,
    dMoins: p.lossElevation,
    cutoffRaw,
    cutoffKind: cutoffRaw === null ? null : ('clock_time' as const),
    type,
    supplies,
    targetOverrideSec: null,
  }
}

// Garde un point s'il est utile : extrémités, ou ravito / assistance / barrière.
export function isUsefulPoint(p: UtmbPoint, idx: number, total: number): boolean {
  if (idx === 0 || idx === total - 1) return true
  if (p.supplies && p.supplies !== 'none') return true
  if (p.isAssistance) return true
  if (p.cutoff && p.cutoff.length > 0) return true
  return false
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'TrailCockpitBot/1.0' },
    })
    if (!res.ok) throw new UtmbError(`HTTP ${res.status} sur ${url}`)
    const text = await res.text()
    if (text.length > MAX_BYTES) throw new UtmbError('Page > 4 Mo')
    return text
  } finally {
    clearTimeout(timer)
  }
}
```

Remplacer le `parse` du `utmbParser` par :

```ts
  async parse(url: string): Promise<ExtractedRaceData> {
    const html = await fetchHtml(url)
    const points = extractPointsJson(html)
    const total = points.length
    const waypoints = points
      .filter((p, i) => isUsefulPoint(p, i, total))
      .map((p, i) => mapUtmbPoint(p, i))
    // validate : trie par km, force depart/arrivee, réindexe order_index.
    return validateExtractedRaceData({ raceName: null, editionYear: null, waypoints })
  },
```

Et à la TOUTE FIN du fichier :

```ts
registerParser(utmbParser)
```

- [ ] **Step 4 : Lancer → succès**

Run: `cd web && npx jest __tests__/lib/race-import/utmb.test.ts`
Expected: PASS (tous les blocs).

- [ ] **Step 5 : Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6 : Commit**

```bash
git add web/lib/race-import/sources/utmb.ts web/__tests__/lib/race-import/utmb.test.ts
git commit -m "feat(race-import): parse() UTMB complet (mapping + filtrage + register)"
```

---

## Task 5 : Brancher le parser dans la route d'import

**Files:**
- Modify: `web/app/api/race-import/route.ts:7`

- [ ] **Step 1 : Ajouter l'import side-effect**

Sous la ligne 7 (`import '@/lib/race-import/sources/livetrail'`), ajouter :

```ts
import '@/lib/race-import/sources/utmb'        // side-effect: registerParser
```

(Le routage existe déjà : `findParserForUrl(body.url)` l. 62 → `parser.parse(url)` ; en cas d'échec du parser, fallback LLM l. 73-84. Rien d'autre à changer.)

- [ ] **Step 2 : Vérifier compilation + suites parser**

Run: `cd web && npx tsc --noEmit`
Expected: exit 0.

Run: `cd web && npx jest __tests__/lib/race-import/`
Expected: PASS (utmb + livetrail + sources + schema ; le bloc « enregistre le parser » de Task 4 confirme le câblage).

- [ ] **Step 3 : Commit**

```bash
git add web/app/api/race-import/route.ts
git commit -m "feat(race-import): cable le parser UTMB dans la route d'import"
```

---

## Task 6 : Tableau Plan — pastilles 5 catégories + édition au tap

**Files:**
- Modify: `web/components/plan/WaypointsTable.tsx`

Contexte : la cellule Ravito rend aujourd'hui 3 boutons-toggles à icônes (`SUPPLIES` + `Icon`). On passe à un **affichage compact en pastilles lettrées colorées** (auto-rempli) + **éditeur au tap** (popover de 5 toggles). Les icônes `sol`/`liq` de la map `ICONS` deviennent orphelines (on les retire) ; `base`/`flag`/`go` restent utilisées par `lead.icon`.

- [ ] **Step 1 : Ajouter l'état d'édition + le catalogue + un helper pur**

Dans `WaypointsTable.tsx` :

a) Importer `useState` (la ligne 8 importe déjà `useCallback, useMemo`) :

```ts
import { useCallback, useMemo, useState } from 'react'
```

b) Remplacer la constante `SUPPLIES` (lignes 45-49) par le catalogue 5 catégories + helper pur :

```ts
const SUPPLY_CAT: { val: WaypointSupply; letter: string; label: string; cls: string }[] = [
  { val: 'liquid',     letter: 'L',  label: 'Liquide',    cls: 'liq'  },
  { val: 'solid',      letter: 'S',  label: 'Solide',     cls: 'sol'  },
  { val: 'hot',        letter: 'C',  label: 'Chaud',      cls: 'hot'  },
  { val: 'base_vie',   letter: 'BV', label: 'Base vie',   cls: 'base' },
  { val: 'assistance', letter: 'A',  label: 'Assistance', cls: 'ass'  },
]

// Catégories actives d'un waypoint, dans l'ordre canonique.
export const activeSupplies = (supplies: WaypointSupply[]) =>
  SUPPLY_CAT.filter((c) => supplies.includes(c.val))
```

c) Retirer de la map `ICONS` (lignes 27-33) les entrées `sol` et `liq` (devenues orphelines ; garder `base`, `flag`, `go`).

d) Dans le composant, après le `update` (vers la ligne 79), ajouter l'état :

```ts
const [editRow, setEditRow] = useState<number | null>(null)
```

- [ ] **Step 2 : Remplacer la cellule Ravito (JSX)**

Remplacer le bloc `{/* Ravito */} <div className="rav-set"> … </div>` (lignes 212-223) par :

```tsx
{/* Ravito : pastilles auto-remplies + édition au tap */}
<div className="c-rav">
  <button type="button" className="rav-cell" disabled={readOnly}
    aria-label="Modifier les ravitos"
    onClick={() => setEditRow(editRow === i ? null : i)}>
    {activeSupplies(w.supplies).length === 0
      ? <span className="rav-empty">{readOnly ? '–' : '+'}</span>
      : activeSupplies(w.supplies).map((c) => (
          <span key={c.val} className={`chip ${c.cls}`}>{c.letter}</span>
        ))}
  </button>
  {editRow === i && !readOnly && (
    <>
      <div className="rav-backdrop" onClick={() => setEditRow(null)} />
      <div className="rav-pop" role="menu">
        {SUPPLY_CAT.map((c) => {
          const on = w.supplies.includes(c.val)
          return (
            <button key={c.val} type="button" className={`rav-opt${on ? ' on' : ''}`}
              onClick={() => toggleSupply(i, c.val)}>
              <span className={`chip ${c.cls}`}>{c.letter}</span>{c.label}
            </button>
          )
        })}
      </div>
    </>
  )}
</div>
```

- [ ] **Step 3 : Remplacer les styles ravito (CSS)**

Dans le bloc `<style>`, remplacer les règles `.rav-set` / `.rv` / `.rv.on...` (lignes 134-140) par :

```css
.wtbl .c-rav{position:relative;display:flex;justify-content:center;}
.wtbl .rav-cell{display:flex;flex-wrap:wrap;gap:2px;justify-content:center;align-items:center;background:none;border:0;padding:2px;min-height:22px;cursor:pointer;}
.wtbl .rav-cell:disabled{cursor:default;}
.wtbl .rav-empty{color:var(--faint);font-size:12px;font-weight:600;}
.wtbl .chip{font-family:var(--d);font-weight:700;font-size:8.5px;min-width:13px;height:13px;padding:0 2px;display:inline-flex;align-items:center;justify-content:center;border-radius:4px;color:#fff;line-height:1;}
.wtbl .chip.liq{background:var(--blue);} .wtbl .chip.sol{background:var(--yellow);}
.wtbl .chip.hot{background:var(--red);} .wtbl .chip.base{background:var(--green);}
.wtbl .chip.ass{background:#7C5CFC;}
.wtbl .rav-backdrop{position:fixed;inset:0;z-index:40;}
.wtbl .rav-pop{position:absolute;top:100%;right:0;z-index:41;margin-top:2px;background:var(--trail-surface);border:1px solid var(--trail-border);border-radius:10px;padding:4px;display:flex;flex-direction:column;gap:2px;min-width:128px;box-shadow:0 8px 24px rgba(0,0,0,.3);}
.wtbl .rav-opt{display:flex;align-items:center;gap:7px;background:none;border:0;color:var(--text);font-family:var(--d);font-size:11px;font-weight:600;padding:5px 6px;border-radius:7px;cursor:pointer;text-align:left;opacity:.45;}
.wtbl .rav-opt.on{opacity:1;background:rgba(127,127,127,.12);}
```

(`--blue`, `--yellow`, `--green`, `--red` sont déjà définis dans `.wtbl` lignes 111-113.)

- [ ] **Step 4 : Mettre à jour la mini-légende**

Remplacer le contenu de `.legend-mini` (lignes 147-149) par :

```tsx
<div className="legend-mini">
  <b>+x,x</b> sous la distance = inter calculé · <b>BH</b> = barrière · ravitos :
  L liquide · S solide · C chaud · BV base vie · A assistance
</div>
```

- [ ] **Step 5 : Typecheck + lint**

Run: `cd web && npx tsc --noEmit`
Expected: exit 0 (le `toggleSupply(i, c.val)` reste typé ; `SUPPLIES`/icônes orphelines supprimées).

Run: `cd web && npx eslint "components/plan/WaypointsTable.tsx"`
Expected: exit 0.

- [ ] **Step 6 : Vérification visuelle headless à 360px**

Créer un mock HTML reprenant `.wtbl` (grille + nouvelles règles ravito) avec une ligne dont `supplies` = les 5 catégories et le popover ouvert, puis :

```bash
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
"$CHROME" --headless --disable-gpu --hide-scrollbars --screenshot="$TEMP/_rav.png" \
  --window-size=360,640 --force-device-scale-factor=3 "file:///C:/Users/Franc/AppData/Local/Temp/_rav.html"
```

Vérifier (lecture du PNG) : pastilles `L S C BV A` lisibles et colorées dans la cellule (54px, repli sur 2 lignes OK), popover des 5 toggles lisible, colonne POINT toujours lisible. Ajuster tailles si besoin.

- [ ] **Step 7 : Commit**

```bash
git add web/components/plan/WaypointsTable.tsx
git commit -m "feat(plan): ravito 5 categories (pastilles + edition au tap) dans le tableau"
```

---

## Task 7 : Carte PDF — badges C/A + légende

**Files:**
- Modify: `web/app/(main)/plan/courses/[id]/print/page.tsx`
- Modify: `web/lib/plan/print-columns.ts` (si la colonne est trop étroite)

- [ ] **Step 1 : Badges Ravito dans l'ordre canonique + 2 nouveaux**

Remplacer le `case 'rav'` (lignes 83-89 de `print/page.tsx`) par :

```tsx
      case 'rav':    return (
        <span className="rav">
          {w.supplies.includes('liquid') && <span className="rb">L</span>}
          {w.supplies.includes('solid') && <span className="rb">S</span>}
          {w.supplies.includes('hot') && <span className="rb">C</span>}
          {w.supplies.includes('base_vie') && <span className="rb bv">BV</span>}
          {w.supplies.includes('assistance') && <span className="rb">A</span>}
        </span>
      )
```

- [ ] **Step 2 : Compléter la légende**

Dans le bloc `.legend` (lignes 220-227), après la ligne `liquide` et avant `base vie`, et à la fin, ajouter `C` et `A` :

```tsx
            <span className="k"><span className="rb">S</span>solide</span>
            <span className="k"><span className="rb">L</span>liquide</span>
            <span className="k"><span className="rb">C</span>chaud</span>
            <span className="k"><span className="rb bv">BV</span>base vie</span>
            <span className="k"><span className="rb">A</span>assistance</span>
```

(Remplacer les 3 `<span className="k">` ravito existants par ces 5.)

- [ ] **Step 3 : Vérifier la largeur de la colonne Ravito (headless print)**

Rendre la carte print (méthode `_printcard.html` déjà utilisée) avec un point portant les 5 ravitos `L S C BV A` et vérifier que les 5 badges tiennent dans la colonne `rav` sans rognage. Si rogné, augmenter le poids `rav` dans `web/lib/plan/print-columns.ts:24` de `1.5` à `1.9` :

```ts
  rav:    { key: 'rav',    label: 'Ravito',            th: 'Ravito',   weight: 1.9,  align: 'c' },
```

puis re-vérifier le rendu.

- [ ] **Step 4 : Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5 : Commit**

```bash
git add "web/app/(main)/plan/courses/[id]/print/page.tsx" web/lib/plan/print-columns.ts
git commit -m "feat(plan-pdf): badges ravito chaud (C) + assistance (A) + legende"
```

---

## Vérification de fin (avant de finir la branche)

- [ ] `cd web && npx tsc --noEmit` → exit 0.
- [ ] `cd web && npx jest __tests__/lib/race-import/` → PASS.
- [ ] `cd web && npx jest __tests__/lib/plan/` (suites tableau, si présentes) → PASS.
- [ ] Vérif manuelle (déploiement Vercel + Ctrl+Shift+R) : coller le lien UTMB Ultra → les 5 ravitos pré-remplis dans le tableau ; export PDF → badges C/A présents.

---

## Notes de drift / hors-périmètre

- `base_vie ← hasBag` est une heuristique (sac d'allègement). Si un cas réel diverge, ajuster `mapUtmbSupplies`.
- Si UTMB modifie ses noms de champs JSON, `parse()` lève → fallback LLM automatique (waypoints sans ravito). Réparation isolée dans `utmb.ts`.
- Ravito auto pour courses **non-UTMB** (LLM sur roadbook/capture + matching) : hors périmètre, futur.
