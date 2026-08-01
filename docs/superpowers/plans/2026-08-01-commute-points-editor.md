# Éditeur des points Home/Office (carte + adresse) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** L'utilisateur peut corriger les points GPS Home/Office d'un trajet TAF existant via un éditeur plein écran : recherche d'adresse (BAN) + marqueurs déplaçables sur carte Leaflet.

**Architecture:** Trois unités isolées : (1) `web/lib/geo/ban-geocode.ts`, parsing pur + fetch BAN ; (2) extension du `PATCH /api/commute-routes/[id]` (4 champs optionnels validés, colonnes déjà en base) ; (3) `web/components/settings/CommutePointsEditor.tsx`, overlay portal chargé en `next/dynamic` `ssr: false`, branché sur `CommuteRoutesSection`. Spec : `docs/superpowers/specs/2026-08-01-commute-points-editor-design.md`.

**Tech Stack:** Next.js 14 / TypeScript / Tailwind (tokens `--trail-*`), react-leaflet 4 + leaflet 1.9 (déjà en dépendances), Jest.

## Global Constraints

- Branche de travail : `feat/commute-points-editor` (depuis `master`). **Gate bloquant avant chaque commit** : `[ "$(git rev-parse --abbrev-ref HEAD)" = "feat/commute-points-editor" ]` sinon ABORT.
- Les subagents n'exécutent **JAMAIS** de commande git — le contrôleur commite.
- Jamais de `git push` sans demande explicite de Franck.
- Jest/npm : toujours `cd /c/Users/Franc/app-run-mobile/web` d'abord (cwd Bash non fiable) ; git : `git -C /c/Users/Franc/app-run-mobile`.
- `npm run build` local non autoritatif sur Windows : vérifier via `npx tsc --noEmit` + `npm run lint`. Ne lancer que les suites Jest pertinentes (~50 tests i18n échouent en pré-existant).
- **Aucune migration Supabase** (colonnes `home_lat/home_lng/office_lat/office_lng` existantes), aucun fichier SW touché.
- UI en français ; **aucune couleur en dur** sur l'UI thémée — tokens `--trail-*` uniquement (exception admise : l'ombre portée du divIcon emoji, dessiné SUR la carte, hors thème).
- Overlays plein écran : **toujours** `createPortal(document.body)` (règle projet Mode Mission v2).
- Leaflet exige le DOM : le composant carte est importé via `next/dynamic` avec `ssr: false`, jamais en import statique depuis un fichier rendu côté serveur.
- BAN : GeoJSON `coordinates` en ordre **[lng, lat]** — toute conversion vers `{lat, lng}` doit inverser.

---

### Task 1: Lib géocodage BAN — `parseBanResponse` (TDD)

**Files:**
- Create: `web/lib/geo/ban-geocode.ts`
- Test: `web/__tests__/lib/geo/ban-geocode.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces (Task 3 en dépend) :
  - `export type AddressHit = { label: string; lat: number; lng: number }`
  - `export function parseBanResponse(json: unknown): AddressHit[]` (pure)
  - `export async function searchAddress(q: string): Promise<AddressHit[]>` (fetch client, erreurs → `[]`)

- [ ] **Step 0: Créer la branche (contrôleur)**

```bash
git -C /c/Users/Franc/app-run-mobile checkout -b feat/commute-points-editor master
```

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `web/__tests__/lib/geo/ban-geocode.test.ts` :

```ts
import { parseBanResponse } from '@/lib/geo/ban-geocode'

describe('parseBanResponse', () => {
  it('cas nominal : label + inversion [lng, lat] → { lat, lng }', () => {
    const json = {
      features: [
        {
          properties: { label: '10 Rue de la Paix 75002 Paris' },
          geometry: { type: 'Point', coordinates: [2.3316, 48.8698] },
        },
      ],
    }
    expect(parseBanResponse(json)).toEqual([
      { label: '10 Rue de la Paix 75002 Paris', lat: 48.8698, lng: 2.3316 },
    ])
  })

  it('feature sans geometry ou sans label → ignorée, les valides restent', () => {
    const json = {
      features: [
        { properties: { label: 'Sans geometry' } },
        { geometry: { coordinates: [6.1296, 45.8992] } },
        {
          properties: { label: 'Annecy' },
          geometry: { coordinates: [6.1296, 45.8992] },
        },
      ],
    }
    expect(parseBanResponse(json)).toEqual([
      { label: 'Annecy', lat: 45.8992, lng: 6.1296 },
    ])
  })

  it('coordinates non numériques ou trop courtes → ignorée', () => {
    const json = {
      features: [
        { properties: { label: 'X' }, geometry: { coordinates: ['a', 'b'] } },
        { properties: { label: 'Y' }, geometry: { coordinates: [6.1] } },
      ],
    }
    expect(parseBanResponse(json)).toEqual([])
  })

  it('json non conforme (null, objet vide, features non-tableau) → []', () => {
    expect(parseBanResponse(null)).toEqual([])
    expect(parseBanResponse({})).toEqual([])
    expect(parseBanResponse({ features: 'nope' })).toEqual([])
  })
})
```

- [ ] **Step 2: Vérifier qu'ils échouent**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/geo/ban-geocode.test.ts`
Attendu : FAIL — `Cannot find module '@/lib/geo/ban-geocode'`.

- [ ] **Step 3: Implémenter**

Créer `web/lib/geo/ban-geocode.ts` :

```ts
// Géocodage d'adresses via la Base Adresse Nationale (BAN) — gratuit, sans clé,
// CORS ouvert, appelé côté client (comme le reverse-geocode BigDataCloud du
// rapport matinal). Si la BAN migre (data.geopf.fr/geocodage), seule cette
// constante change.

export type AddressHit = { label: string; lat: number; lng: number }

const BAN_SEARCH_URL = 'https://api-adresse.data.gouv.fr/search/'

/** Parse une réponse GeoJSON BAN. ⚠️ `coordinates` est en ordre [lng, lat]. */
export function parseBanResponse(json: unknown): AddressHit[] {
  const features = (json as { features?: unknown } | null)?.features
  if (!Array.isArray(features)) return []
  const hits: AddressHit[] = []
  for (const f of features) {
    const feature = f as {
      properties?: { label?: unknown }
      geometry?: { coordinates?: unknown }
    }
    const label = feature?.properties?.label
    const coords = feature?.geometry?.coordinates
    if (typeof label !== 'string' || !Array.isArray(coords) || coords.length < 2) continue
    const lng = coords[0]
    const lat = coords[1]
    if (typeof lat !== 'number' || typeof lng !== 'number') continue
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    hits.push({ label, lat, lng })
  }
  return hits
}

/** Recherche d'adresse. Réponse non-ok ou erreur réseau → []. */
export async function searchAddress(q: string): Promise<AddressHit[]> {
  try {
    const res = await fetch(`${BAN_SEARCH_URL}?q=${encodeURIComponent(q)}&limit=5`)
    if (!res.ok) return []
    return parseBanResponse(await res.json())
  } catch {
    return []
  }
}
```

- [ ] **Step 4: Vérifier que la suite passe**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/geo/ban-geocode.test.ts`
Attendu : PASS (4/4).

- [ ] **Step 5: Commit (contrôleur uniquement)**

```bash
[ "$(git -C /c/Users/Franc/app-run-mobile rev-parse --abbrev-ref HEAD)" = "feat/commute-points-editor" ] \
  && git -C /c/Users/Franc/app-run-mobile add web/lib/geo/ban-geocode.ts web/__tests__/lib/geo/ban-geocode.test.ts \
  && git -C /c/Users/Franc/app-run-mobile commit -m "feat(geo): parsing + recherche d'adresses BAN" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" \
  || echo "ABORT: mauvaise branche"
```

---

### Task 2: PATCH des points Home/Office (TDD, mock Supabase)

**Files:**
- Modify: `web/app/api/commute-routes/[id]/route.ts:5-38`
- Test: `web/__tests__/app/api/commute-routes/patch-points.test.ts`

**Interfaces:**
- Consumes: rien de Task 1.
- Produces (Task 3 en dépend) : `PATCH /api/commute-routes/[id]` accepte en plus
  `{ homeLat?: number; homeLng?: number; officeLat?: number; officeLng?: number }` ;
  paire complète exigée par point, bornes lat ∈ [-90, 90], lng ∈ [-180, 180],
  sinon 400 `{ error: 'Point GPS invalide ou incomplet' }`. Réponse inchangée
  (`{ route }` camelCase).

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `web/__tests__/app/api/commute-routes/patch-points.test.ts` (pattern du
projet : `@jest-environment node`, mock de `supabase-server`, capture du payload
`.update()` — voir `__tests__/app/api/races/track.test.ts`) :

```ts
/** @jest-environment node */
import { PATCH } from '@/app/api/commute-routes/[id]/route'

const mockGetUser = jest.fn()
const mockSingle = jest.fn()
const mockUpdate = jest.fn()

jest.mock('@/lib/database/supabase-server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      update: (payload: Record<string, unknown>) => {
        mockUpdate(payload)
        return {
          eq: () => ({ eq: () => ({ select: () => ({ single: mockSingle }) }) }),
        }
      },
    }),
  }),
}))

const ROW = {
  id: 'r1', user_id: 'u1', sport_type: 'Run', label: 'Runtaf',
  ref_distance_m: 9500, distance_tol_pct: 12,
  home_lat: 45.9, home_lng: 6.1, office_lat: 45.92, office_lng: 6.15,
  geo_tol_m: 250, outbound_title: 'A', return_title: 'B',
  hour_split: 14, active: true,
}

const makeReq = (body: unknown) => ({ json: async () => body } as unknown as Request)
const ctx = { params: Promise.resolve({ id: 'r1' }) }

beforeEach(() => {
  jest.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  mockSingle.mockResolvedValue({ data: ROW, error: null })
})

describe('PATCH /api/commute-routes/[id] — points Home/Office', () => {
  it('4 valeurs valides → update home_lat/home_lng/office_lat/office_lng', async () => {
    const res = await PATCH(
      makeReq({ homeLat: 45.9, homeLng: 6.1, officeLat: 45.92, officeLng: 6.15 }),
      ctx,
    )
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({
      home_lat: 45.9, home_lng: 6.1, office_lat: 45.92, office_lng: 6.15,
    })
  })

  it('une seule paire complète (Office) → acceptée, Home intouché', async () => {
    const res = await PATCH(makeReq({ officeLat: 45.92, officeLng: 6.15 }), ctx)
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({ office_lat: 45.92, office_lng: 6.15 })
  })

  it('lat hors bornes (91) → 400, aucune écriture', async () => {
    const res = await PATCH(
      makeReq({ homeLat: 91, homeLng: 6.1, officeLat: 45.92, officeLng: 6.15 }),
      ctx,
    )
    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('lng hors bornes (-181) → 400, aucune écriture', async () => {
    const res = await PATCH(
      makeReq({ homeLat: 45.9, homeLng: -181, officeLat: 45.92, officeLng: 6.15 }),
      ctx,
    )
    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('paire incomplète (homeLat sans homeLng) → 400, aucune écriture', async () => {
    const res = await PATCH(makeReq({ homeLat: 45.9 }), ctx)
    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('comportement existant intact : label seul → update label', async () => {
    const res = await PATCH(makeReq({ label: 'Vélotaf' }), ctx)
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({ label: 'Vélotaf' })
  })
})
```

- [ ] **Step 2: Vérifier qu'ils échouent**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/app/api/commute-routes/patch-points.test.ts`
Attendu : FAIL sur les **2 cas valides** (« 4 valeurs valides » et « une seule
paire complète ») — le PATCH actuel ignore ces champs, l'update est vide → 400
« Aucun champ à mettre à jour » au lieu de 200. Les tests 400 (hors bornes,
paire incomplète) passent déjà **par coïncidence** (champs ignorés → update
vide → 400) : c'est attendu, l'implémentation leur donnera le bon chemin de
rejet. « label seul » passe déjà. Si les 2 cas valides ne FAIL pas, s'arrêter
et investiguer.

- [ ] **Step 3: Implémenter**

Dans `web/app/api/commute-routes/[id]/route.ts` :

1. Étendre `PatchBody` (lignes 5-13) :

```ts
type PatchBody = {
  label?: string
  outboundTitle?: string
  returnTitle?: string
  distanceTolPct?: number
  geoTolM?: number
  hourSplit?: number
  active?: boolean
  homeLat?: number
  homeLng?: number
  officeLat?: number
  officeLng?: number
}
```

2. Ajouter sous le type (avant `export async function PATCH`) :

```ts
function isLat(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90
}
function isLng(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180
}
```

3. Dans `PATCH`, après la ligne `if (body.active != null) update.active = body.active`
   et avant le check `Object.keys(update).length === 0`, insérer :

```ts
  // Points Home/Office : paire complète exigée, bornes lat/lng validées.
  for (const [latVal, lngVal, latCol, lngCol] of [
    [body.homeLat, body.homeLng, 'home_lat', 'home_lng'],
    [body.officeLat, body.officeLng, 'office_lat', 'office_lng'],
  ] as const) {
    if (latVal == null && lngVal == null) continue
    if (!isLat(latVal) || !isLng(lngVal)) {
      return NextResponse.json({ error: 'Point GPS invalide ou incomplet' }, { status: 400 })
    }
    update[latCol] = latVal
    update[lngCol] = lngVal
  }
```

- [ ] **Step 4: Vérifier que la suite passe**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/app/api/commute-routes/patch-points.test.ts`
Attendu : PASS (6/6).

- [ ] **Step 5: tsc**

Run: `cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit`
Attendu : silencieux.

- [ ] **Step 6: Commit (contrôleur uniquement)**

```bash
[ "$(git -C /c/Users/Franc/app-run-mobile rev-parse --abbrev-ref HEAD)" = "feat/commute-points-editor" ] \
  && git -C /c/Users/Franc/app-run-mobile add "web/app/api/commute-routes/[id]/route.ts" web/__tests__/app/api/commute-routes/patch-points.test.ts \
  && git -C /c/Users/Franc/app-run-mobile commit -m "feat(commute): PATCH des points Home/Office avec validation" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" \
  || echo "ABORT: mauvaise branche"
```

---

### Task 3: Composant `CommutePointsEditor` + intégration

**Files:**
- Create: `web/components/settings/CommutePointsEditor.tsx`
- Modify: `web/components/settings/CommuteRoutesSection.tsx` (imports en tête ; `CommuteRoutesSection` : nouveau handler ; `RouteCard` : bouton + rendu de l'éditeur)
- Modify: `docs/superpowers/specs/2026-08-01-commute-points-editor-design.md` (bandeau Status)

**Interfaces:**
- Consumes: `searchAddress(q: string): Promise<AddressHit[]>` et
  `type AddressHit = { label: string; lat: number; lng: number }` de
  `@/lib/geo/ban-geocode` (Task 1) ; le PATCH étendu de Task 2.
- Produces: `export function CommutePointsEditor(props)` et
  `export type CommutePoints = { homeLat: number; homeLng: number; officeLat: number; officeLng: number }`
  depuis `web/components/settings/CommutePointsEditor.tsx`.

- [ ] **Step 1: Créer le composant**

Créer `web/components/settings/CommutePointsEditor.tsx` :

```tsx
'use client'

// Éditeur plein écran des points Home/Office d'un trajet domicile-travail.
// Chargé via next/dynamic ssr:false (Leaflet exige le DOM).

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { X } from 'lucide-react'
import { searchAddress, type AddressHit } from '@/lib/geo/ban-geocode'

type LatLng = [number, number]
type PointKey = 'home' | 'office'

export type CommutePoints = {
  homeLat: number
  homeLng: number
  officeLat: number
  officeLng: number
}

export type CommutePointsEditorRoute = {
  id: string
  label: string
  homeLat: number | null
  homeLng: number | null
  officeLat: number | null
  officeLng: number | null
}

const OSM_URL = 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png'
// Repli si un trajet hérité n'a pas de points (impossible via l'UI actuelle).
const FALLBACK_HOME: LatLng = [45.9, 6.1]
const FALLBACK_OFFICE: LatLng = [45.91, 6.13]

const POINT_META: Record<PointKey, { emoji: string; label: string }> = {
  home: { emoji: '🏠', label: 'Home' },
  office: { emoji: '🏢', label: 'Office' },
}

// divIcon emoji : évite les icônes par défaut de Leaflet (assets cassés en
// bundler). L'ombre portée est dessinée sur la carte, hors thème → valeur fixe.
function emojiIcon(emoji: string, active: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="font-size:28px;line-height:1;transform:translate(-50%,-50%);filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));opacity:${active ? 1 : 0.7}">${emoji}</div>`,
    iconSize: [0, 0],
  })
}

// Cadre la carte sur les 2 points à l'ouverture (une seule fois) et corrige la
// taille après le montage dans le portal (Leaflet mesure avant le layout flex).
function FitOnce({ points }: { points: LatLng[] }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize()
      if (!done.current) {
        done.current = true
        map.fitBounds(points, { padding: [40, 40], maxZoom: 16 })
      }
    }, 120)
    return () => clearTimeout(t)
  }, [map, points])
  return null
}

function ClickToPlace({ onPlace }: { onPlace: (pos: LatLng) => void }) {
  useMapEvents({ click: e => onPlace([e.latlng.lat, e.latlng.lng]) })
  return null
}

function FlyTo({ target }: { target: LatLng | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.setView(target, Math.max(map.getZoom(), 15))
  }, [map, target])
  return null
}

export function CommutePointsEditor({
  route, onClose, onSaved,
}: {
  route: CommutePointsEditorRoute
  onClose: () => void
  onSaved: (points: CommutePoints) => void
}) {
  const [home, setHome] = useState<LatLng>(
    route.homeLat != null && route.homeLng != null
      ? [route.homeLat, route.homeLng] : FALLBACK_HOME,
  )
  const [office, setOffice] = useState<LatLng>(
    route.officeLat != null && route.officeLng != null
      ? [route.officeLat, route.officeLng] : FALLBACK_OFFICE,
  )
  const [active, setActive] = useState<PointKey>('home')
  const [focus, setFocus] = useState<LatLng | null>(null)

  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<AddressHit[]>([])
  const [searching, setSearching] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  // Recherche BAN avec debounce (min 3 caractères).
  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setHits([])
      setSearching(false)
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      const res = await searchAddress(q)
      setHits(res)
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const setPoint = (key: PointKey, pos: LatLng) => {
    if (key === 'home') setHome(pos)
    else setOffice(pos)
  }

  function pickHit(hit: AddressHit) {
    setPoint(active, [hit.lat, hit.lng])
    setFocus([hit.lat, hit.lng])
    setQuery('')
    setHits([])
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(false)
    try {
      const points: CommutePoints = {
        homeLat: home[0], homeLng: home[1],
        officeLat: office[0], officeLng: office[1],
      }
      const res = await fetch(`/api/commute-routes/${route.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(points),
      })
      if (!res.ok) throw new Error('patch')
      onSaved(points)
      onClose()
    } catch {
      setSaveError(true)
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-trail-bg flex flex-col">
      {/* En-tête */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-trail-border">
        <div className="flex-1 min-w-0">
          <p className="text-body font-bold text-trail-text truncate">Points du trajet</p>
          <p className="text-micro text-trail-muted truncate">{route.label}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="w-8 h-8 rounded-[10px] border border-trail-border text-trail-muted flex items-center justify-center hover:text-trail-text transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Sélecteur du point actif */}
      <div className="flex gap-[8px] px-4 py-[10px]">
        {(['home', 'office'] as PointKey[]).map(key => (
          <button
            key={key}
            type="button"
            onClick={() => setActive(key)}
            className={`flex-1 px-3 py-[7px] rounded-full border text-caption font-semibold transition-colors ${
              active === key
                ? 'bg-trail-primary/15 border-trail-primary text-trail-primary'
                : 'bg-trail-surface border-trail-border text-trail-muted'
            }`}
          >
            {POINT_META[key].emoji} {POINT_META[key].label}
          </button>
        ))}
      </div>

      {/* Recherche d'adresse */}
      <div className="relative px-4 pb-[10px]">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Adresse du point ${POINT_META[active].label}…`}
          className="w-full rounded-[10px] bg-trail-surface border border-trail-border px-3 py-[8px] text-body text-trail-text outline-none focus:border-trail-primary"
        />
        {(hits.length > 0 || searching) && (
          <div className="absolute left-4 right-4 top-full z-[1100] rounded-[10px] bg-trail-card border border-trail-border shadow-xl overflow-hidden">
            {searching && (
              <p className="px-3 py-[8px] text-caption text-trail-muted">Recherche…</p>
            )}
            {hits.map(hit => (
              <button
                key={`${hit.lat},${hit.lng}`}
                type="button"
                onClick={() => pickHit(hit)}
                className="block w-full text-left px-3 py-[8px] text-caption text-trail-text hover:bg-trail-surface transition-colors"
              >
                {hit.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Carte */}
      <div className="flex-1 min-h-0">
        <MapContainer
          center={home}
          zoom={13}
          style={{ width: '100%', height: '100%' }}
          attributionControl={false}
        >
          <TileLayer url={OSM_URL} />
          <Marker
            position={home}
            draggable
            icon={emojiIcon('🏠', active === 'home')}
            eventHandlers={{
              dragstart: () => setActive('home'),
              dragend: e => {
                const p = (e.target as L.Marker).getLatLng()
                setHome([p.lat, p.lng])
              },
            }}
          />
          <Marker
            position={office}
            draggable
            icon={emojiIcon('🏢', active === 'office')}
            eventHandlers={{
              dragstart: () => setActive('office'),
              dragend: e => {
                const p = (e.target as L.Marker).getLatLng()
                setOffice([p.lat, p.lng])
              },
            }}
          />
          <ClickToPlace onPlace={pos => setPoint(active, pos)} />
          <FitOnce points={[home, office]} />
          <FlyTo target={focus} />
        </MapContainer>
      </div>

      {/* Pied : rappel + actions */}
      <div className="px-4 py-3 border-t border-trail-border space-y-[8px]">
        <p className="text-[10px] text-trail-muted leading-[14px]">
          Tape sur la carte ou glisse un marqueur pour ajuster le point actif. Après
          modification, relance « Appliquer à l&apos;historique » pour re-détecter les
          trajets avec les nouveaux points.
        </p>
        {saveError && (
          <p className="text-caption text-red-400">L&apos;enregistrement a échoué. Réessaie.</p>
        )}
        <div className="flex gap-[8px]">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-[10px] py-[9px] text-body-sm font-bold text-trail-primary bg-trail-primary/15 border border-trail-primary hover:bg-trail-primary/25 transition-colors disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-[10px] py-[9px] text-body-sm font-semibold text-trail-muted bg-trail-surface border border-trail-border hover:text-trail-text transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 2: Intégrer dans `CommuteRoutesSection.tsx`**

1. En tête de fichier (après les imports existants) :

```tsx
import dynamic from 'next/dynamic'
import type { CommutePoints } from './CommutePointsEditor'

const CommutePointsEditor = dynamic(
  () => import('./CommutePointsEditor').then(m => m.CommutePointsEditor),
  { ssr: false },
)
```

2. Dans `CommuteRoutesSection`, à côté de `handlePatch`, ajouter (mise à jour
   locale seulement — le PATCH est fait par l'éditeur) :

```tsx
  function handlePointsSaved(id: string, points: CommutePoints) {
    setRoutes(prev => prev.map(r => (r.id === id ? { ...r, ...points } : r)))
  }
```

3. Passer le callback à `RouteCard` (rendu de la liste) :

```tsx
            <RouteCard
              key={route.id}
              route={route}
              onDelete={() => handleDelete(route.id)}
              onPatch={patch => handlePatch(route.id, patch)}
              onPointsSaved={points => handlePointsSaved(route.id, points)}
            />
```

4. Dans `RouteCard` : signature et état :

```tsx
function RouteCard({
  route, onDelete, onPatch, onPointsSaved,
}: {
  route: CommuteRoute
  onDelete: () => void
  onPatch: (patch: Partial<CommuteRoute>) => void
  onPointsSaved: (points: CommutePoints) => void
}) {
  const Icon = sportIcon(route.sportType)
  const [editing, setEditing] = useState(false)
  const [pointsOpen, setPointsOpen] = useState(false)
```

5. Remplacer le bloc « Toggle édition » existant :

```tsx
      {/* Toggle édition */}
      {!editing && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-micro text-trail-primary font-semibold underline underline-offset-2"
        >
          Modifier les titres &amp; tolérances
        </button>
      )}
```

par :

```tsx
      {/* Toggles édition */}
      {!editing && (
        <div className="flex flex-col items-start gap-[6px]">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-micro text-trail-primary font-semibold underline underline-offset-2"
          >
            Modifier les titres &amp; tolérances
          </button>
          <button
            type="button"
            onClick={() => setPointsOpen(true)}
            className="text-micro text-trail-primary font-semibold underline underline-offset-2"
          >
            Modifier les points Home / Office
          </button>
        </div>
      )}
```

6. Juste avant la `</div>` fermante du `return` de `RouteCard`, ajouter :

```tsx
      {pointsOpen && (
        <CommutePointsEditor
          route={{
            id: route.id,
            label: route.label,
            homeLat: route.homeLat,
            homeLng: route.homeLng,
            officeLat: route.officeLat,
            officeLng: route.officeLng,
          }}
          onClose={() => setPointsOpen(false)}
          onSaved={onPointsSaved}
        />
      )}
```

- [ ] **Step 3: Vérifier**

```bash
cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit
cd /c/Users/Franc/app-run-mobile/web && npm run lint
cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/lib/geo/ban-geocode.test.ts __tests__/app/api/commute-routes/patch-points.test.ts __tests__/activities/commute.test.ts
```

Attendu : tsc silencieux, lint sans NOUVEAU warning, 3 suites vertes.

- [ ] **Step 4: Bandeau Status sur la spec**

Dans `docs/superpowers/specs/2026-08-01-commute-points-editor-design.md`,
remplacer la ligne :

```markdown
**Statut** : Spec validée (approche 1 — overlay plein écran), en attente d'implémentation
```

par :

```markdown
> **Status: Implémenté** · 2026-08-01 · Code: `web/components/settings/CommutePointsEditor.tsx`, `web/lib/geo/ban-geocode.ts`, `web/app/api/commute-routes/[id]/route.ts`
```

- [ ] **Step 5: Commit (contrôleur uniquement)**

```bash
[ "$(git -C /c/Users/Franc/app-run-mobile rev-parse --abbrev-ref HEAD)" = "feat/commute-points-editor" ] \
  && git -C /c/Users/Franc/app-run-mobile add web/components/settings/CommutePointsEditor.tsx web/components/settings/CommuteRoutesSection.tsx docs/superpowers/specs/2026-08-01-commute-points-editor-design.md docs/superpowers/plans/2026-08-01-commute-points-editor.md \
  && git -C /c/Users/Franc/app-run-mobile commit -m "feat(settings): éditeur carte des points Home/Office d'un trajet" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" \
  || echo "ABORT: mauvaise branche"
```

---

## Après exécution

- Merge/push : **uniquement sur demande explicite de Franck** (push master = déploiement Vercel). Utiliser superpowers:finishing-a-development-branch.
- Vérif manuelle par Franck (la carte n'est pas testable en jsdom) : ouvrir Réglages > Trajets > « Modifier les points Home / Office », chercher une adresse, glisser un marqueur, taper la carte, Enregistrer, puis relancer « Appliquer à l'historique » et vérifier la détection d'un vrai TAF. Tester dans les DEUX thèmes (sombre + clair) et sur téléphone (~390 px).
