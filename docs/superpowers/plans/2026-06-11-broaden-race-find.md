# Élargir la recherche auto de course — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire marcher la recherche auto pour les courses dont la recherche tombe sur une page d'événement LiveTrail (toutes les courses) et pour celles sur ni UTMB ni LiveTrail (fallback LLM générique).

**Architecture:** `livetrail.ts` apprend à lister TOUTES les courses d'un événement depuis le slug (`listLivetrailRaces`). `find-race.ts` restructure `resolveCandidates` : UTMB (1 candidat/URL), LiveTrail (N candidats = toutes les courses de l'événement), puis fallback générique LLM (`extractWaypoints` sur le HTML) UNIQUEMENT si aucune candidate confidente. Le prompt de recherche est élargi (timing + site officiel). Classement par distance/D+ inchangé. Aucune migration DB.

**Tech Stack:** Next.js 14, TypeScript, Jest, `fast-xml-parser`, SDK `openai`.

Spec : `docs/superpowers/specs/2026-06-11-broaden-race-find-design.md`.

---

## Structure des fichiers

- **Modifier** `web/lib/race-import/sources/livetrail.ts` — extraire `mapPointsBlock` + `parseXml` ; ajouter `fetchParcoursXmlBySlug` + `listLivetrailRaces` ; parser le bloc `<courses>`.
- **Modifier** `web/__tests__/lib/race-import/livetrail.test.ts` — tests `listLivetrailRaces`.
- **Modifier** `web/lib/race-import/find-race.ts` — `resolveCandidates` restructuré (utmb / livetrail-multi / dédup) + fallback générique + prompt élargi.
- **Modifier** `web/__tests__/lib/race-import/find-race.test.ts` — tests livetrail-multi + fallback.

**Conventions :** tests `cd web && npx jest <chemin>` ; typecheck `cd web && npx tsc --noEmit`. Piège TS2802 : pas de `for...of`/spread sur `Set`/`Map`/itérateur `matchAll` (utiliser `Array.from`/`.forEach`/index). Working tree : modifs non liées (config/deps) — ne stager QUE les fichiers de chaque tâche.

---

## Task 1 : `livetrail.ts` — lister toutes les courses d'un événement

**Files:**
- Modify: `web/lib/race-import/sources/livetrail.ts`
- Test: `web/__tests__/lib/race-import/livetrail.test.ts`

- [ ] **Step 1 : écrire les tests qui échouent**

Dans `livetrail.test.ts`, ajouter `listLivetrailRaces` à l'import depuis `@/lib/race-import/sources/livetrail`, puis ajouter ce bloc (le `FIXTURE_XML` existant a déjà 2 courses GdRaid+Raid et le bloc `<courses>`) :
```ts
describe('listLivetrailRaces()', () => {
  afterEach(() => jest.restoreAllMocks())

  it('renvoie TOUTES les courses de l\'événement avec leurs noms', async () => {
    mockFetchOnce(FIXTURE_XML)
    const races = await listLivetrailRaces('https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026')
    const names = races.map((r) => r.raceName)
    expect(names).toContain('Grand Raid')
    expect(names).toContain('Raid')
  })

  it('mappe les waypoints de chaque course (Grand Raid = 14 points)', async () => {
    mockFetchOnce(FIXTURE_XML)
    const races = await listLivetrailRaces('https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026')
    const gd = races.find((r) => r.raceName === 'Grand Raid')!
    expect(gd.data.waypoints).toHaveLength(14)
    expect(gd.data.waypoints[gd.data.waypoints.length - 1].km).toBe(177.17)
  })
})
```
(`mockFetchOnce` et `FIXTURE_XML` existent déjà dans ce fichier.)

- [ ] **Step 2 : lancer → échec attendu**

Run: `cd web && npx jest __tests__/lib/race-import/livetrail.test.ts`
Expected: FAIL (`listLivetrailRaces` non exportée).

- [ ] **Step 3 : refactor + `listLivetrailRaces`**

Dans `livetrail.ts` :

a) Étendre le type `RawDoc` (remplacer le bloc `type RawDoc = {...}`) :
```ts
type RawCourse = { '@_id'?: string; '@_n'?: string }

type RawDoc = {
  d?: {
    courses?: { c?: RawCourse | RawCourse[] }
    points?: RawPoints | RawPoints[]
  }
}
```

b) Ajouter un helper `parseXml` + extraire `mapPointsBlock` (un bloc `<points>` →
ExtractedRaceData). Insérer AVANT `mapXmlToExtracted` :
```ts
function parseXml(xml: string): RawDoc {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
    trimValues: true,
  })
  return parser.parse(xml) as RawDoc
}

// Un bloc <points course="X"> → ExtractedRaceData (waypoints + validate).
function mapPointsBlock(block: RawPoints): ExtractedRaceData {
  const ptsRaw = block.pt
  if (!ptsRaw) {
    throw new LivetrailError('Aucun point de passage dans le bloc <points>')
  }
  const pts: RawPt[] = Array.isArray(ptsRaw) ? ptsRaw : [ptsRaw]

  const num = (v: string | number | undefined): number | null =>
    v !== undefined && v !== '' ? Number(v) : null

  // D- dérivé de l'altitude (le XML n'expose pas de D-).
  const departAltitude = num(pts[0]?.['@_a'])

  const waypoints = pts.map((p, idx) => {
    const rawCutoff = p['@_b']
    const cutoffRaw = rawCutoff && rawCutoff.length > 0 ? rawCutoff : null
    const km = p['@_km'] !== undefined ? Number(p['@_km']) : 0
    const dPlusRaw = p['@_d']
    const dPlus =
      dPlusRaw !== undefined && dPlusRaw !== ''
        ? parseInt(String(dPlusRaw), 10)
        : null
    const altitude = num(p['@_a'])
    const dMoins =
      dPlus !== null && altitude !== null && departAltitude !== null
        ? Math.max(0, Math.round(dPlus - (altitude - departAltitude)))
        : null
    const type: WaypointType = idx === 0 ? 'depart' : 'ravito'
    return {
      orderIndex: idx,
      name: (p['@_n'] ?? '').trim(),
      km,
      kmInter: null,
      dPlus,
      dMoins,
      cutoffRaw,
      cutoffKind: cutoffRaw === null ? null : ('clock_time' as const),
      type,
      supplies: [],
      targetOverrideSec: null,
    }
  })

  return validateExtractedRaceData({ raceName: null, editionYear: null, waypoints })
}
```

c) Réécrire `mapXmlToExtracted` pour réutiliser `parseXml` + `mapPointsBlock` :
```ts
function mapXmlToExtracted(xml: string, raceId: string): ExtractedRaceData {
  const doc = parseXml(xml)
  const pointsBlocks = doc?.d?.points
  if (!pointsBlocks) {
    throw new LivetrailError('XML sans bloc <points>')
  }
  const blocks = Array.isArray(pointsBlocks) ? pointsBlocks : [pointsBlocks]
  const block = blocks.find((b) => b['@_course'] === raceId)
  if (!block) {
    throw new LivetrailError(`Bloc <points course="${raceId}"> introuvable`)
  }
  return mapPointsBlock(block)
}
```

d) Ajouter le fetch par slug (sans raceId) APRÈS `fetchParcoursXml` :
```ts
// Fetch toutes les courses d'un événement (slug) — parcours.php renvoie tous les
// blocs quel que soit le param. Vérifié : sans param = avec param = tous les blocs.
async function fetchParcoursXmlBySlug(slug: string): Promise<string> {
  const runUrl = `https://${slug}.livetrail.run/parcours.php`
  try {
    return await fetchXml(runUrl)
  } catch {
    return await fetchXml(`https://${slug}.livetrail.net/parcours.php`)
  }
}
```

e) Ajouter `listLivetrailRaces` exportée APRÈS `mapXmlToExtracted` (avant
`livetrailParser`) :
```ts
// Depuis n'importe quelle URL LiveTrail (même page événement) : renvoie TOUTES les
// courses de l'événement avec leur nom (depuis <courses><c n>). Le classement par
// distance/D+ (côté find-race) choisit la bonne.
export async function listLivetrailRaces(
  url: string,
): Promise<Array<{ raceName: string | null; data: ExtractedRaceData }>> {
  let slug: string
  try {
    slug = new URL(url).hostname.split('.')[0]
  } catch {
    throw new LivetrailError(`URL invalide : ${url}`)
  }
  if (!slug) throw new LivetrailError(`Slug introuvable : ${url}`)

  const xml = await fetchParcoursXmlBySlug(slug)
  const doc = parseXml(xml)

  const coursesRaw = doc?.d?.courses?.c
  const courses: RawCourse[] = coursesRaw
    ? (Array.isArray(coursesRaw) ? coursesRaw : [coursesRaw])
    : []
  const nameById = new Map<string, string>()
  for (const c of courses) {
    if (c['@_id']) nameById.set(c['@_id'], (c['@_n'] ?? '').trim())
  }

  const pointsBlocks = doc?.d?.points
  if (!pointsBlocks) throw new LivetrailError('XML sans bloc <points>')
  const blocks = Array.isArray(pointsBlocks) ? pointsBlocks : [pointsBlocks]

  const out: Array<{ raceName: string | null; data: ExtractedRaceData }> = []
  for (const block of blocks) {
    try {
      const data = mapPointsBlock(block)
      const id = block['@_course']
      out.push({ raceName: (id ? nameById.get(id) : undefined) ?? null, data })
    } catch {
      // bloc invalide (course sans points exploitables) → on l'ignore
    }
  }
  return out
}
```

- [ ] **Step 4 : lancer → succès**

Run: `cd web && npx jest __tests__/lib/race-import/livetrail.test.ts`
Expected: PASS (tests existants + `listLivetrailRaces`). NB : la valeur `km` du dernier point GdRaid dans `FIXTURE_XML` est `177.17` (vérifier la fixture ; ajuster l'assertion si la fixture diffère).

- [ ] **Step 5 : typecheck + commit**

Run: `cd web && npx tsc --noEmit` (expect exit 0).
```bash
git add web/lib/race-import/sources/livetrail.ts web/__tests__/lib/race-import/livetrail.test.ts
git commit -m "feat(race-import): listLivetrailRaces (toutes les courses d'un evenement depuis le slug)"
```

---

## Task 2 : `find-race.ts` — résolution restructurée (UTMB + LiveTrail multi-courses)

**Files:**
- Modify: `web/lib/race-import/find-race.ts`
- Test: `web/__tests__/lib/race-import/find-race.test.ts`

- [ ] **Step 1 : test livetrail-événement (échec attendu)**

Dans `find-race.test.ts`, ajouter une fixture XML livetrail multi-courses + un mock fetch, et un test. Ajouter au bloc `describe('resolveCandidates', ...)` (ou à côté) :
```ts
const LIVETRAIL_XML = `<d>
  <courses><c id="GdRaid" n="Grand Raid"/><c id="Raid" n="Raid" sel="1"/></courses>
  <points course="GdRaid">
    <pt n="Départ" km="0" d="0" a="10" b="" />
    <pt n="Arrivée" km="177" d="1430" a="10" b="28-13:00" />
  </points>
  <points course="Raid">
    <pt n="Départ" km="0" d="0" a="5" b="" />
    <pt n="Arrivée" km="100" d="780" a="3" b="26-09:15" />
  </points>
</d>`

function mockFetchLivetrail() {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    const h = new URL(url).hostname
    if (h.endsWith('.livetrail.run') || h.endsWith('.livetrail.net')) {
      return Promise.resolve({ ok: true, text: async () => LIVETRAIL_XML } as any)
    }
    return Promise.resolve({ ok: false, status: 404 } as any)
  })
}

describe('resolveCandidates — LiveTrail événement', () => {
  afterEach(() => jest.restoreAllMocks())

  it('depuis une page événement, liste toutes les courses et choisit par distance/D+', async () => {
    mockFetchLivetrail()
    const target = { name: 'Ultra Marin', date: '2026-06-26', distance: 177, elevation: 1430 }
    const out = await resolveCandidates(target, [
      'https://ultramarin-breizhchrono.v3.livetrail.net/fr/2026',  // page événement
    ])
    expect(out.length).toBeGreaterThanOrEqual(2)
    expect(out[0].raceName).toBe('Grand Raid')
    expect(out[0].totalKm).toBe(177)
    expect(out[0].confident).toBe(true)
    expect(out.find((c) => c.raceName === 'Raid')!.confident).toBe(false)
  })
})
```

- [ ] **Step 2 : lancer → échec attendu**

Run: `cd web && npx jest __tests__/lib/race-import/find-race.test.ts`
Expected: FAIL (resolveCandidates actuel filtre par parser puis `parseCandidate` → 0 candidat sur une URL événement sans raceId, OU 1 candidat erroné).

- [ ] **Step 3 : restructurer `resolveCandidates`**

Dans `find-race.ts` :

a) Ajouter l'import (à côté de `import { findParserForUrl } from './sources'`) :
```ts
import { listLivetrailRaces } from './sources/livetrail'
```

b) Ajouter un helper de dédup (au-dessus de `resolveCandidates`) :
```ts
function dedupCandidates(list: ParsedCandidate[]): ParsedCandidate[] {
  const seen = new Set<string>()
  return list.filter((c) => {
    const k = `${c.parserId}|${c.totalKm}|${c.totalDplus}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
```

c) Remplacer le corps de `resolveCandidates` par (sans fallback générique pour
l'instant — ajouté en Task 3) :
```ts
export async function resolveCandidates(target: RaceTarget, rawUrls: string[]): Promise<RaceCandidate[]> {
  const urls = harvestRaceUrls(rawUrls)
  const utmbUrls = urls.filter((u) => findParserForUrl(u)?.id === 'utmb').slice(0, MAX_PARSE)
  const livetrailUrls = urls.filter((u) => findParserForUrl(u)?.id === 'livetrail')

  const parsed: ParsedCandidate[] = []

  // UTMB : 1 candidat par URL.
  const utmbParsed = (await Promise.all(utmbUrls.map(parseCandidate)))
    .filter((c): c is ParsedCandidate => c != null)
  parsed.push(...utmbParsed)

  // LiveTrail : toutes les courses de l'événement (dédup par slug → 1 fetch/événement).
  const slugsSeen = new Set<string>()
  for (const u of livetrailUrls) {
    let slug: string
    try { slug = new URL(u).hostname.split('.')[0] } catch { continue }
    if (slugsSeen.has(slug)) continue
    slugsSeen.add(slug)
    try {
      const races = await listLivetrailRaces(u)
      for (const r of races) {
        const wps = r.data.waypoints
        if (wps.length === 0) continue
        const last = wps[wps.length - 1]
        parsed.push({
          url: u, parserId: 'livetrail', raceName: r.raceName,
          totalKm: last.km, totalDplus: last.dPlus, nbPoints: wps.length, waypoints: wps,
        })
      }
    } catch { /* événement livetrail injoignable → ignoré */ }
  }

  return rankRaceCandidates(target, dedupCandidates(parsed))
}
```
(Le `seen`/dédup inline qui existait dans l'ancien `resolveCandidates` est remplacé
par `dedupCandidates`.)

- [ ] **Step 4 : lancer → succès**

Run: `cd web && npx jest __tests__/lib/race-import/find-race.test.ts`
Expected: PASS (le test livetrail-événement + les tests existants UTMB ; le test
existant `resolveCandidates` UTMB doit toujours passer car les URLs utmb suivent le
même chemin).

- [ ] **Step 5 : typecheck + commit**

Run: `cd web && npx tsc --noEmit` (expect exit 0).
```bash
git add web/lib/race-import/find-race.ts web/__tests__/lib/race-import/find-race.test.ts
git commit -m "feat(race-import): resoudre les pages evenement LiveTrail (toutes courses + classement)"
```

---

## Task 3 : `find-race.ts` — fallback générique LLM

**Files:**
- Modify: `web/lib/race-import/find-race.ts`
- Test: `web/__tests__/lib/race-import/find-race.test.ts`

- [ ] **Step 1 : tests du fallback (échec attendu)**

En HAUT de `find-race.test.ts` (avant les imports applicatifs), ajouter les mocks de
modules, et un bloc de test :
```ts
jest.mock('@/lib/race-import/fetch-url', () => ({
  fetchRaceHtml: jest.fn(async () => '<html>roadbook</html>'),
}))
jest.mock('@/lib/race-import/extract', () => ({
  extractWaypoints: jest.fn(),
}))
```
Puis (après les imports), récupérer le mock typé et le bloc :
```ts
import { extractWaypoints } from '@/lib/race-import/extract'
const mockExtract = extractWaypoints as jest.Mock

describe('resolveCandidates — fallback générique', () => {
  afterEach(() => { jest.restoreAllMocks(); mockExtract.mockReset() })

  it('extrait au LLM une URL « autre » quand aucun candidat parsable confident', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 } as any)
    mockExtract.mockResolvedValue({
      raceName: 'Ultra Marin', editionYear: null,
      waypoints: [
        { orderIndex: 0, name: 'Départ', km: 0, kmInter: null, dPlus: 0, dMoins: 0, cutoffRaw: null, cutoffKind: null, type: 'depart', supplies: [], targetOverrideSec: null },
        { orderIndex: 1, name: 'Arrivée', km: 177, kmInter: null, dPlus: 1430, dMoins: 1430, cutoffRaw: null, cutoffKind: null, type: 'arrivee', supplies: [], targetOverrideSec: null },
      ],
    })
    const target = { name: 'Ultra Marin', date: '2026-06-26', distance: 177, elevation: 1430 }
    const out = await resolveCandidates(target, ['https://www.ultra-marin.fr/grand-raid'])
    expect(mockExtract).toHaveBeenCalledTimes(1)
    expect(out).toHaveLength(1)
    expect(out[0].parserId).toBe('generic')
    expect(out[0].totalKm).toBe(177)
    expect(out[0].confident).toBe(true)
  })

  it('NE déclenche PAS le LLM si un candidat parsable confident existe', async () => {
    mockFetchUtmb()  // helper existant : renvoie le HTML UTMB pour les hôtes utmb
    mockExtract.mockResolvedValue({ raceName: null, editionYear: null, waypoints: [] })
    const target = { name: 'X', date: '2026-06-12', distance: 138, elevation: 5300 }
    const out = await resolveCandidates(target, [
      'https://saint-jacques.utmb.world/fr/races/100M',
      'https://www.exemple.com/autre',
    ])
    expect(out[0].confident).toBe(true)
    expect(mockExtract).not.toHaveBeenCalled()
  })
})
```
(Note : `mockFetchUtmb` mocke `global.fetch` ; le fallback utilise `fetchRaceHtml`
qui est MOCKÉ au niveau module, donc indépendant de `global.fetch`.)

- [ ] **Step 2 : lancer → échec attendu**

Run: `cd web && npx jest __tests__/lib/race-import/find-race.test.ts`
Expected: FAIL (`parserId 'generic'` jamais produit ; `mockExtract` jamais appelé).

- [ ] **Step 3 : ajouter le fallback générique**

Dans `find-race.ts` :

a) Ajouter les imports (avec les autres I/O imports) :
```ts
import { fetchRaceHtml } from './fetch-url'
import { extractWaypoints } from './extract'
```

b) Ajouter la constante et le helper (au-dessus de `resolveCandidates`) :
```ts
const MAX_GENERIC = 2

// Extraction LLM générique d'URLs non-parsables (site officiel / roadbook).
async function extractGenericCandidates(urls: string[]): Promise<ParsedCandidate[]> {
  const results = await Promise.all(urls.map(async (url): Promise<ParsedCandidate | null> => {
    try {
      const html = await fetchRaceHtml(url)
      const data = await extractWaypoints({ html })
      const wps = data.waypoints
      if (wps.length === 0) return null
      const last = wps[wps.length - 1]
      return {
        url, parserId: 'generic', raceName: data.raceName,
        totalKm: last.km, totalDplus: last.dPlus, nbPoints: wps.length, waypoints: wps,
      }
    } catch {
      return null
    }
  }))
  return results.filter((c): c is ParsedCandidate => c != null)
}
```

c) Modifier la fin de `resolveCandidates` : remplacer
```ts
  return rankRaceCandidates(target, dedupCandidates(parsed))
```
par
```ts
  let ranked = rankRaceCandidates(target, dedupCandidates(parsed))

  // Fallback générique : seulement si aucune candidate confidente via UTMB/LiveTrail.
  if (ranked.length === 0 || !ranked[0].confident) {
    const otherUrls = urls.filter((u) => findParserForUrl(u) == null).slice(0, MAX_GENERIC)
    if (otherUrls.length > 0) {
      const generic = await extractGenericCandidates(otherUrls)
      if (generic.length > 0) {
        ranked = rankRaceCandidates(target, dedupCandidates([...parsed, ...generic]))
      }
    }
  }
  return ranked
```

- [ ] **Step 4 : lancer → succès**

Run: `cd web && npx jest __tests__/lib/race-import/find-race.test.ts`
Expected: PASS (tous les blocs, dont le fallback déclenché / non-déclenché).

- [ ] **Step 5 : typecheck + suite import + commit**

Run: `cd web && npx tsc --noEmit` (expect exit 0).
Run: `cd web && npx jest __tests__/lib/race-import` (expect toutes les suites PASS).
```bash
git add web/lib/race-import/find-race.ts web/__tests__/lib/race-import/find-race.test.ts
git commit -m "feat(race-import): fallback generique LLM si aucun candidat UTMB/LiveTrail confident"
```

---

## Task 4 : `searchRaceUrls` — prompt élargi

**Files:**
- Modify: `web/lib/race-import/find-race.ts`

- [ ] **Step 1 : élargir le prompt**

Dans `searchRaceUrls`, remplacer la construction du `prompt` par :
```ts
  const prompt =
    `Trouve les pages web de la course de trail « ${target.name} » ` +
    `(édition ${year}, environ ${target.distance} km et ${target.elevation} m de D+). ` +
    `Donne en priorité : (1) sa page de chronométrage LiveTrail ` +
    `(livetrail.net / livetrail.run) ou UTMB (utmb.world), ET (2) son site officiel ` +
    `ou sa page de résultats. Liste toutes les URLs directes pertinentes.`
```

- [ ] **Step 2 : typecheck**

Run: `cd web && npx tsc --noEmit` (expect exit 0).

- [ ] **Step 3 : commit**

```bash
git add web/lib/race-import/find-race.ts
git commit -m "feat(race-import): prompt de recherche elargi (timing + site officiel)"
```

---

## Vérification de fin

- [ ] `cd web && npx tsc --noEmit` → exit 0.
- [ ] `cd web && npx jest __tests__/lib/race-import` → PASS.
- [ ] Vérif manuelle (après déploiement) : créer/ouvrir l'Ultra Marin (177 km / 1430 D+) → onglet Auto → « Trouver ma course » → la carte sort « Grand Raid — 177 km » (pas le Raid 100 km) → Importer. Tester aussi une course non-UTMB/LiveTrail (fallback générique).

## Notes de drift / hors-périmètre

- `parcours.php` par slug sans param : vérifié sur Ultra Marin. Si une instance refuse,
  passer `?course=all` (le serveur renvoie tous les blocs — vérifié `?course=zzz`).
- Fallback générique = fiabilité LLM variable (borné à 2 pages, déclenché en dernier
  recours). Aucune migration DB.
- **Sécurité** : le fallback générique fait `fetchRaceHtml(url)` sur des URLs non
  allowlistées (issues de la recherche). C'est la **même surface SSRF que l'onglet
  « URL » manuel existant** (qui fetch déjà l'URL collée par l'utilisateur via
  `fetchRaceHtml`), désormais derrière le garde d'auth de `/find`. Pas de nouvelle
  classe d'exposition ; si on durcit un jour `fetchRaceHtml` (blocage IP privées),
  les deux chemins en bénéficient.
- `livetrailParser.parse(url)` (import manuel d'une URL de course précise) inchangé.
