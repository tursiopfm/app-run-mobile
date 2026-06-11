# Auto-trouver l'URL de course + import — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Depuis les infos de la fiche de course (nom, date, distance, D+), trouver automatiquement l'URL UTMB/LiveTrail via recherche web OpenAI, valider en parsant + comparant distance/D+, faire confirmer le meilleur match, puis importer le tableau.

**Architecture:** Endpoint `POST /api/race-import/find` : recherche web OpenAI (`gpt-4o-search-preview`) → récolte d'URLs → parse des candidats via les parsers existants → classement par écart distance/D+ + similarité de nom (fonction pure). UI : nouvel onglet « Auto » dans `RaceImportSheet`, pré-rempli depuis la fiche, qui montre le meilleur match (+ repli liste) et recharge la preview existante à l'import. Aucune migration DB.

**Tech Stack:** Next.js 14 (route handler), TypeScript, Jest, SDK `openai` (déjà présent), parsers `lib/race-import/sources/*`, `RaceImportSheet` + `WaypointsTable`.

Spec : `docs/superpowers/specs/2026-06-11-auto-find-race-import-design.md`.

---

## Structure des fichiers

- **Créer** `web/lib/race-import/find-race.ts` — types (`RaceTarget`, `RaceCandidate`), fonctions pures (`normalizeTokens`, `nameSimilarity`, `harvestRaceUrls`, `rankRaceCandidates`) + I/O (`searchRaceUrls`, `resolveCandidates`, `findRaceCandidates`).
- **Créer** `web/__tests__/lib/race-import/find-race.test.ts` — tests des fonctions pures + de `resolveCandidates` (fetch mocké).
- **Créer** `web/app/api/race-import/find/route.ts` — endpoint POST.
- **Modifier** `web/components/plan/RaceImportSheet.tsx` — prop `race`, onglet « Auto », câblage find → preview.
- **Modifier** `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx` — passer `race={race}`.

**Conventions (Windows / ce repo) :** tests `cd web && npx jest <chemin>` (suites pertinentes seulement) ; typecheck `cd web && npx tsc --noEmit` ; lint `cd web && npx eslint <fichier>`. Working tree : modifs non liées présentes (config/deps) — ne stager QUE les fichiers de chaque tâche.

---

## Task 1 : `find-race.ts` — fonctions pures (normalisation, similarité, récolte, classement)

**Files:**
- Create: `web/lib/race-import/find-race.ts`
- Test: `web/__tests__/lib/race-import/find-race.test.ts`

- [ ] **Step 1 : écrire les tests qui échouent**

Créer `web/__tests__/lib/race-import/find-race.test.ts` :
```ts
import {
  normalizeTokens, nameSimilarity, harvestRaceUrls, rankRaceCandidates,
  type RaceTarget,
} from '@/lib/race-import/find-race'

describe('normalizeTokens', () => {
  it('minuscule, sans accents/ponctuation, en tokens', () => {
    expect(normalizeTokens('Ultra du Saint-Jacques !')).toEqual(['ultra', 'du', 'saint', 'jacques'])
  })
})

describe('nameSimilarity', () => {
  it('proche → score élevé', () => {
    expect(nameSimilarity('Ultra du Saint-Jacques', 'Ultra Saint Jacques')).toBeGreaterThan(0.5)
  })
  it('différent → score bas', () => {
    expect(nameSimilarity('Ultra du Saint-Jacques', 'Marathon de Paris')).toBeLessThan(0.2)
  })
  it('chaîne vide → 0', () => {
    expect(nameSimilarity('X', '')).toBe(0)
  })
})

describe('harvestRaceUrls', () => {
  it('déduplique, ignore les URLs invalides, garde l\'ordre', () => {
    const out = harvestRaceUrls([
      'https://a.utmb.world/fr/races/100M',
      'pas-une-url',
      'https://a.utmb.world/fr/races/100M#x',   // doublon (fragment ignoré)
      'https://tsj.livetrail.run/parcours.php?course=Ultra',
    ])
    expect(out).toEqual([
      'https://a.utmb.world/fr/races/100M',
      'https://tsj.livetrail.run/parcours.php?course=Ultra',
    ])
  })
})

describe('rankRaceCandidates', () => {
  const target: RaceTarget = { name: 'Ultra Saint-Jacques', date: '2026-06-12', distance: 139, elevation: 6000 }
  const base = { url: '', parserId: 'utmb', nbPoints: 10, waypoints: [] as any }

  it('choisit la bonne variante par distance (100M vs 100K)', () => {
    const out = rankRaceCandidates(target, [
      { ...base, url: 'k', raceName: 'Grand Trail Saint-Jacques', totalKm: 86, totalDplus: 3200 },
      { ...base, url: 'm', raceName: 'Ultra du Saint-Jacques', totalKm: 138.6, totalDplus: 5900 },
    ])
    expect(out[0].url).toBe('m')
    expect(out[0].confident).toBe(true)
    expect(out.find((c) => c.url === 'k')!.confident).toBe(false)
  })

  it('D+ manquant → pénalité → non confident', () => {
    const out = rankRaceCandidates(target, [
      { ...base, url: 'm', raceName: 'Ultra du Saint-Jacques', totalKm: 138.6, totalDplus: null },
    ])
    expect(out[0].confident).toBe(false)
  })
})
```

- [ ] **Step 2 : lancer → échec attendu**

Run: `cd web && npx jest __tests__/lib/race-import/find-race.test.ts`
Expected: FAIL (`Cannot find module '@/lib/race-import/find-race'`).

- [ ] **Step 3 : créer `find-race.ts` (types + fonctions pures)**

Créer `web/lib/race-import/find-race.ts` :
```ts
// Recherche + résolution de l'URL d'une course depuis les infos de la fiche.
// Fiabilité : on ne fait pas confiance à l'URL "devinée" — on parse chaque
// candidat (parsers existants) et on compare distance/D+ aux valeurs saisies.
import type { ExtractedRaceData } from '@/types/plan'

export interface RaceTarget {
  name: string
  date: string          // ISO YYYY-MM-DD
  distance: number      // km
  elevation: number     // m D+
}

// Candidat AVANT scoring (sortie du parsing).
export interface ParsedCandidate {
  url: string
  parserId: string
  raceName: string | null
  totalKm: number
  totalDplus: number | null
  nbPoints: number
  waypoints: ExtractedRaceData['waypoints']
}

// Candidat APRÈS scoring (renvoyé à l'UI).
export interface RaceCandidate extends ParsedCandidate {
  confident: boolean
}

const TOL_KM = 0.12   // 12 % d'écart de distance toléré
const TOL_D = 0.20    // 20 % d'écart de D+ toléré

// "Ultra du Saint-Jacques !" → ['ultra','du','saint','jacques']
export function normalizeTokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // retire les accents
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

// Similarité de noms (Jaccard sur tokens) ∈ [0,1].
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeTokens(a))
  const tb = new Set(normalizeTokens(b))
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / new Set([...ta, ...tb]).size
}

// Dédup + validation syntaxique des URLs (fragment ignoré pour le dédoublonnage).
export function harvestRaceUrls(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of urls) {
    try { new URL(raw) } catch { continue }
    const key = raw.split('#')[0]
    if (seen.has(key)) continue
    seen.add(key)
    out.push(raw)
  }
  return out
}

// Classe les candidats : écart distance + écart D+ − bonus de nom (plus bas = mieux).
export function rankRaceCandidates(target: RaceTarget, parsed: ParsedCandidate[]): RaceCandidate[] {
  const scored = parsed.map((c) => {
    const errKm = Math.abs(c.totalKm - target.distance) / Math.max(target.distance, 1)
    const errD = target.elevation > 0 && c.totalDplus != null
      ? Math.abs(c.totalDplus - target.elevation) / target.elevation
      : 0.5
    const nameSim = nameSimilarity(target.name, c.raceName ?? '')
    const score = errKm + errD - 0.3 * nameSim
    const confident = errKm <= TOL_KM && errD <= TOL_D
    return { c, score, confident }
  })
  scored.sort((a, b) => a.score - b.score)
  return scored.map(({ c, confident }) => ({ ...c, confident }))
}
```

- [ ] **Step 4 : lancer → succès**

Run: `cd web && npx jest __tests__/lib/race-import/find-race.test.ts`
Expected: PASS (les 4 describes).

- [ ] **Step 5 : commit**

```bash
git add web/lib/race-import/find-race.ts web/__tests__/lib/race-import/find-race.test.ts
git commit -m "feat(race-import): find-race helpers purs (normalisation, similarite, recolte, classement)"
```

---

## Task 2 : `find-race.ts` — recherche OpenAI + résolution des candidats

**Files:**
- Modify: `web/lib/race-import/find-race.ts`
- Modify: `web/__tests__/lib/race-import/find-race.test.ts`

- [ ] **Step 1 : ajouter le test de `resolveCandidates` (échec attendu)**

Dans `find-race.test.ts`, compléter l'import en tête puis ajouter le bloc (fetch mocké, parsers réels) :
```ts
import {
  normalizeTokens, nameSimilarity, harvestRaceUrls, rankRaceCandidates,
  resolveCandidates, type RaceTarget,
} from '@/lib/race-import/find-race'
import '@/lib/race-import/sources/utmb'        // enregistre le parser utmb
import '@/lib/race-import/sources/livetrail'   // enregistre le parser livetrail

// HTML UTMB minimal (JSON "points" embarqué) — dernier point Le Puy 138.4 km / 5267 D+.
const UTMB_HTML = `<html><body><script type="application/json">
{"race":{"name":"Ultra du Saint-Jacques","points":[
{"name":"Saugues","distance":0,"gainElevation":0,"lossElevation":0,"supplies":"none","isAssistance":false,"hasBag":false,"cutoff":""},
{"name":"Saint Jean Lachalm","distance":72400,"gainElevation":3242,"lossElevation":2900,"supplies":"hotFood","isAssistance":true,"hasBag":true,"cutoff":"sam. 11:20"},
{"name":"Le Puy en Velay","distance":138400,"gainElevation":5267,"lossElevation":5550,"supplies":"food","isAssistance":false,"hasBag":true,"cutoff":"dim. 02:15"}
]}}
</script></body></html>`

function mockFetchUtmb() {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (new URL(url).hostname.endsWith('.utmb.world')) {
      return Promise.resolve({ ok: true, text: async () => UTMB_HTML } as any)
    }
    return Promise.resolve({ ok: false, status: 404 } as any)
  })
}

describe('resolveCandidates', () => {
  afterEach(() => jest.restoreAllMocks())
  const target: RaceTarget = { name: 'Ultra Saint-Jacques', date: '2026-06-12', distance: 138, elevation: 5300 }

  it('parse les URLs UTMB, ignore les non-parsables, déduplique fr/en, classe', async () => {
    mockFetchUtmb()
    const out = await resolveCandidates(target, [
      'https://saint-jacques.utmb.world/fr/races/100M',
      'https://www.exemple.com/blog',                       // pas de parser → ignoré
      'https://saint-jacques.utmb.world/en/races/100M',     // même course → dédupliquée
    ])
    expect(out).toHaveLength(1)
    expect(out[0].parserId).toBe('utmb')
    expect(out[0].totalKm).toBe(138.4)
    expect(out[0].totalDplus).toBe(5267)
    expect(out[0].confident).toBe(true)
    expect(out[0].waypoints.length).toBeGreaterThan(0)
  })

  it('aucune URL parsable → []', async () => {
    mockFetchUtmb()
    const out = await resolveCandidates(target, ['https://www.exemple.com/x'])
    expect(out).toEqual([])
  })
})
```

- [ ] **Step 2 : lancer → échec attendu**

Run: `cd web && npx jest __tests__/lib/race-import/find-race.test.ts`
Expected: FAIL (`resolveCandidates` non exportée).

- [ ] **Step 3 : ajouter l'I/O à `find-race.ts`**

En tête de `find-race.ts`, ajouter (après la 1re ligne de commentaire) :
```ts
import 'server-only'
import OpenAI from 'openai'
import { findParserForUrl } from './sources'
```
(garder l'`import type { ExtractedRaceData }` existant.)

À la FIN de `find-race.ts`, ajouter :
```ts
const MAX_PARSE = 5

// Recherche web OpenAI → liste d'URLs candidates (citations + filet regex).
// Note : web_search_options / annotations ne sont pas toujours typés selon la
// version du SDK → cast `any` localisés.
export async function searchRaceUrls(target: RaceTarget): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY absente côté serveur')
  const year = target.date.slice(0, 4)
  const client = new OpenAI({ apiKey })
  const prompt =
    `Trouve la ou les page(s) officielle(s) LiveTrail (livetrail.net / livetrail.run) ` +
    `ou UTMB (utmb.world) du parcours de la course de trail « ${target.name} » ` +
    `(édition ${year}, environ ${target.distance} km et ${target.elevation} m de D+). ` +
    `Donne les URLs directes de la page "parcours / race" de cette course.`
  const res = await client.chat.completions.create({
    model: 'gpt-4o-search-preview',
    web_search_options: {},
    messages: [{ role: 'user', content: prompt }],
  } as any)
  const msg: any = res.choices[0]?.message
  const urls: string[] = []
  for (const a of msg?.annotations ?? []) {
    if (a?.type === 'url_citation' && a.url_citation?.url) urls.push(a.url_citation.url)
  }
  const content: string = msg?.content ?? ''
  for (const m of content.matchAll(/https?:\/\/[^\s)\]"'<>]+/g)) urls.push(m[0])
  return urls
}

// Parse un candidat via le parser enregistré (null si pas de parser / échec).
async function parseCandidate(url: string): Promise<ParsedCandidate | null> {
  const parser = findParserForUrl(url)
  if (!parser) return null
  try {
    const data = await parser.parse(url)
    const wps = data.waypoints
    if (wps.length === 0) return null
    const last = wps[wps.length - 1]
    return {
      url,
      parserId: parser.id,
      raceName: data.raceName,
      totalKm: last.km,
      totalDplus: last.dPlus,
      nbPoints: wps.length,
      waypoints: wps,
    }
  } catch {
    return null
  }
}

// URLs → candidats parsés (filtrés/parsés/dédupliqués) → classés.
export async function resolveCandidates(target: RaceTarget, rawUrls: string[]): Promise<RaceCandidate[]> {
  const urls = harvestRaceUrls(rawUrls)
    .filter((u) => findParserForUrl(u) != null)
    .slice(0, MAX_PARSE)
  const parsed = (await Promise.all(urls.map(parseCandidate)))
    .filter((c): c is ParsedCandidate => c != null)
  // dédup d'une même course atteinte par 2 URLs (ex. fr/en)
  const seen = new Set<string>()
  const uniq = parsed.filter((c) => {
    const k = `${c.parserId}|${c.totalKm}|${c.totalDplus}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return rankRaceCandidates(target, uniq)
}

// Orchestrateur complet : recherche → résolution.
export async function findRaceCandidates(target: RaceTarget): Promise<RaceCandidate[]> {
  const rawUrls = await searchRaceUrls(target)
  return resolveCandidates(target, rawUrls)
}
```

- [ ] **Step 4 : lancer → succès**

Run: `cd web && npx jest __tests__/lib/race-import/find-race.test.ts`
Expected: PASS (pures + `resolveCandidates`). `searchRaceUrls`/`findRaceCandidates` (OpenAI) ne sont pas unit-testés (wrapper I/O fin, vérifié à l'exécution).

- [ ] **Step 5 : typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: exit 0. (Si `web_search_options` casse malgré le cast `as any`, vérifier la version du SDK `openai` — le cast doit suffire.)

- [ ] **Step 6 : commit**

```bash
git add web/lib/race-import/find-race.ts web/__tests__/lib/race-import/find-race.test.ts
git commit -m "feat(race-import): recherche OpenAI + resolution/validation des candidats course"
```

---

## Task 3 : endpoint `POST /api/race-import/find`

**Files:**
- Create: `web/app/api/race-import/find/route.ts`

- [ ] **Step 1 : créer la route**

Créer `web/app/api/race-import/find/route.ts` :
```ts
import { NextResponse } from 'next/server'
import { findRaceCandidates, type RaceTarget } from '@/lib/race-import/find-race'
import '@/lib/race-import/sources/utmb'        // side-effect: registerParser
import '@/lib/race-import/sources/livetrail'   // side-effect: registerParser

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<RaceTarget>
    if (!body.name || !body.date || body.distance == null || body.elevation == null) {
      throw new Error('Champs requis : name, date, distance, elevation')
    }
    const candidates = await findRaceCandidates({
      name: body.name,
      date: body.date,
      distance: body.distance,
      elevation: body.elevation,
    })
    return NextResponse.json({ candidates })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 })
  }
}
```

- [ ] **Step 2 : vérifier compile + suites import**

Run: `cd web && npx tsc --noEmit` (expect exit 0).
Run: `cd web && npx jest __tests__/lib/race-import/` (expect PASS : find-race + utmb + livetrail + sources + schema + extract).

- [ ] **Step 3 : commit**

```bash
git add "web/app/api/race-import/find/route.ts"
git commit -m "feat(race-import): endpoint POST /api/race-import/find"
```

---

## Task 4 : UI — onglet « Auto » dans `RaceImportSheet` + prop `race`

**Files:**
- Modify: `web/components/plan/RaceImportSheet.tsx`
- Modify: `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx`

Contexte : `RaceImportSheet` a aujourd'hui les onglets `url/pdf/image/text`, un bouton « Extraire » commun, puis une preview (`status==='preview'`) avec `WaypointsTable` + save. On ajoute un onglet `auto` (par défaut) pré-rempli depuis la fiche, qui appelle `/api/race-import/find` et, à l'import d'un candidat, peuple `draft` puis bascule en `preview` (chemin existant inchangé).

- [ ] **Step 1 : prop `race`, type d'onglet, états, reset**

Dans `RaceImportSheet.tsx` :

a) Ajouter l'import de type (les imports de type depuis un module `server-only` sont effacés à la compilation → sûr côté client) :
```ts
import type { RaceCandidate } from '@/lib/race-import/find-race'
```
b) `Tab` : ajouter `'auto'` :
```ts
type Tab = 'auto' | 'url' | 'pdf' | 'image' | 'text'
```
c) `Props` : ajouter `race` :
```ts
type Props = {
  raceId: string
  race: { name: string; date: string; distance: number; elevation: number }
  open: boolean
  onClose: () => void
  onSaved: (waypoints: RaceWaypoint[]) => void
}
```
et la signature : `export function RaceImportSheet({ raceId, race, open, onClose, onSaved }: Props) {`
d) Ajouter les états (à côté des autres `useState`) :
```ts
const [candidates, setCandidates] = useState<RaceCandidate[]>([])
const [finding, setFinding] = useState(false)
const [showAll, setShowAll] = useState(false)
const [findError, setFindError] = useState<string | null>(null)
```
e) Dans l'effet de reset à l'ouverture, remplacer `setTab('url')` par `setTab('auto')` et ajouter le reset des nouveaux états :
```ts
setTab('auto'); setStatus('idle'); setError(null)
setUrl(''); setText(''); setPdfFile(null); setImageFile(null); setDraft([])
setCandidates([]); setFinding(false); setShowAll(false); setFindError(null)
```

- [ ] **Step 2 : fonctions find + import candidat**

Ajouter dans le composant (à côté de `extract`/`save`) :
```ts
async function findRace() {
  setFinding(true); setFindError(null); setShowAll(false)
  try {
    const res = await fetch('/api/race-import/find', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: race.name, date: race.date, distance: race.distance, elevation: race.elevation,
      }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body.error || 'Erreur recherche')
    if (!body.candidates || body.candidates.length === 0) {
      throw new Error('Course introuvable automatiquement — utilise URL / PDF / Image.')
    }
    setCandidates(body.candidates as RaceCandidate[])
  } catch (err) {
    setFindError((err as Error).message)
  } finally {
    setFinding(false)
  }
}

function importCandidate(c: RaceCandidate) {
  setDraft(c.waypoints)
  setStatus('preview')
}
```

- [ ] **Step 3 : onglet dans la barre + bloc « Auto » + masquer « Extraire » sur Auto**

Dans le JSX `status !== 'preview'` :

a) Barre d'onglets — remplacer le tableau par :
```tsx
{(['auto', 'url', 'pdf', 'image', 'text'] as const).map((t) => (
```

b) AVANT le bloc `{tab === 'url' && (...)}`, insérer le bloc Auto :
```tsx
{tab === 'auto' && (
  <div className="space-y-3">
    <div className="text-caption text-trail-muted">
      Recherche d&apos;après ta fiche : <b className="text-trail-text">{race.name}</b>
      {' · '}{race.distance} km · {race.elevation} D+ · {race.date.slice(0, 4)}
    </div>
    {candidates.length === 0 ? (
      <button type="button" onClick={findRace} disabled={finding}
        className="w-full py-2 rounded bg-trail-primary text-white text-body-sm font-semibold disabled:opacity-50">
        {finding ? 'Recherche…' : 'Trouver ma course'}
      </button>
    ) : (
      <div className="space-y-2">
        {(showAll ? candidates : candidates.slice(0, 1)).map((c) => (
          <div key={c.url} className="rounded-[10px] border border-trail-border p-3 space-y-2">
            <div className="font-display font-semibold text-body-sm">{c.raceName ?? race.name}</div>
            <div className="text-caption text-trail-muted">
              {c.totalKm.toFixed(1)} km · {c.totalDplus ?? '—'} D+ · {c.nbPoints} pts{' '}
              <span style={{ color: c.confident ? '#16A34A' : '#B45309', fontWeight: 600 }}>
                {c.confident ? '✓ correspond à tes chiffres' : 'à vérifier'}
              </span>
            </div>
            <button type="button" onClick={() => importCandidate(c)}
              className="w-full py-1.5 rounded bg-trail-primary text-white text-caption font-semibold">
              Importer
            </button>
          </div>
        ))}
        {!showAll && candidates.length > 1 && (
          <button type="button" onClick={() => setShowAll(true)}
            className="text-caption text-trail-primary underline">
            Voir les autres résultats ({candidates.length - 1})
          </button>
        )}
        <button type="button" onClick={() => { setCandidates([]); setShowAll(false) }}
          className="block text-caption text-trail-muted underline">
          Relancer une recherche
        </button>
      </div>
    )}
    {findError && <div className="text-caption text-trail-danger">{findError}</div>}
  </div>
)}
```

c) Le bouton « Extraire » — l'envelopper pour qu'il ne s'affiche PAS sur l'onglet Auto. Remplacer le `<button ... onClick={extract} ...>` par :
```tsx
{tab !== 'auto' && (
  <button
    type="button"
    onClick={extract}
    disabled={status === 'extracting'}
    className="w-full py-2 rounded bg-trail-primary text-white text-body-sm font-semibold disabled:opacity-50"
  >
    {status === 'extracting' ? 'Extraction…' : 'Extraire'}
  </button>
)}
```

- [ ] **Step 4 : passer `race` au composant (caller)**

Dans `web/app/(main)/plan/courses/[id]/CoursePageClient.tsx`, le `<RaceImportSheet ...>` (vers la ligne 217) : ajouter la prop `race`. `race` est déjà dans le scope (passé à `RaceEditorModal`). Modifier :
```tsx
<RaceImportSheet
  raceId={race.id}
  race={{ name: race.name, date: race.date, distance: race.distance, elevation: race.elevation }}
  open={importOpen}
  onClose={() => setImportOpen(false)}
  onSaved={(wps) => { setWaypoints(wps); setImportOpen(false) }}
/>
```

- [ ] **Step 5 : typecheck + lint**

Run: `cd web && npx tsc --noEmit` (expect exit 0 ; l'`import type { RaceCandidate }` depuis un module `server-only` est effacé → pas d'erreur côté client).
Run: `cd web && npx eslint "components/plan/RaceImportSheet.tsx" "app/(main)/plan/courses/[id]/CoursePageClient.tsx"` (expect exit 0).

- [ ] **Step 6 : vérification visuelle headless**

Construire un mock HTML reprenant le bloc « Auto » (récap fiche + carte meilleur match `confident` + lien « voir les autres résultats » + un 2e candidat `non confident`) avec le thème sombre de l'app (vars `--trail-*` plausibles, `bg-trail-card`, `border-trail-border`). Rendre :
```bash
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"; [ -f "$CHROME" ] || CHROME="/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
"$CHROME" --headless --disable-gpu --hide-scrollbars --screenshot="$TEMP/_auto.png" --window-size=420,560 --force-device-scale-factor=2 "file:///C:/Users/Franc/AppData/Local/Temp/_auto.html"
```
Lire `$TEMP/_auto.png` : récap fiche lisible, carte meilleur match avec badge vert « ✓ correspond à tes chiffres », bouton Importer, lien « Voir les autres résultats », 2e candidat avec badge orange « à vérifier ». Mock jetable (dans `$TEMP`, pas dans le repo).

- [ ] **Step 7 : commit**

```bash
git add web/components/plan/RaceImportSheet.tsx "web/app/(main)/plan/courses/[id]/CoursePageClient.tsx"
git commit -m "feat(plan): onglet Auto (trouver+importer la course depuis la fiche)"
```

---

## Vérification de fin (avant de finir la branche)

- [ ] `cd web && npx tsc --noEmit` → exit 0.
- [ ] `cd web && npx jest __tests__/lib/race-import/` → PASS.
- [ ] Vérif manuelle (après déploiement) : ouvrir une course UTMB connue (ex. Ultra Saint-Jacques) → onglet Auto → « Trouver ma course » → carte du bon match (km/D+ qui collent) → Importer → preview pré-remplie → Sauvegarder. Vérifier le repli (course inexistante → message + onglets manuels).

---

## Notes de drift / hors-périmètre

- **Dispo du modèle `gpt-4o-search-preview`** : à confirmer à l'exécution (clé/SDK). Alternative : Responses API outil `web_search`. La récolte d'URLs (annotations + regex) est robuste au format de réponse.
- Courses **non** UTMB/LiveTrail : pas de parser → `candidates: []` → repli manuel (hors périmètre).
- Déclenchement **automatique** à l'ouverture de la fiche : hors périmètre (bouton explicite, coût maîtrisé).
- Si la fonction serverless time-out (recherche + plusieurs parses), envisager `export const maxDuration = 60` sur la route `find` (non ajouté par défaut pour rester aligné sur `race-import/route.ts`).
