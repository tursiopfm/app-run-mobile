# Éditeur unifié d'un trajet TAF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toute l'édition d'un trajet domicile-travail (titres, tolérance géo, points Home/Office) tient dans une seule page plein écran, ouverte par un petit bouton « Modifier » sur la carte du trajet.

**Architecture:** Une seule tâche cohérente : `CommutePointsEditor.tsx` est renommé `CommuteRouteEditor.tsx` et gagne les champs titres + tolérance (un seul PATCH portant les 7 champs), tandis que `CommuteRoutesSection.tsx` perd son bloc d'édition inline et ses deux liens au profit d'un bouton contour. Le découper en deux tâches laisserait un état intermédiaire non compilable (le parent référence le composant renommé). Spec : `docs/superpowers/specs/2026-08-02-commute-route-editor-unified-design.md`.

**Tech Stack:** Next.js 14 / TypeScript / Tailwind (tokens `--trail-*`), react-leaflet 4 + leaflet 1.9, lucide-react.

## Global Constraints

- Branche de travail : `feat/commute-route-editor-unified` (depuis `master`). **Gate bloquant avant chaque commit** : `[ "$(git rev-parse --abbrev-ref HEAD)" = "feat/commute-route-editor-unified" ]` sinon ABORT.
- Les subagents n'exécutent **JAMAIS** de commande git — le contrôleur commite.
- Jamais de `git push` sans demande explicite de Franck.
- Jest/npm : toujours `cd /c/Users/Franc/app-run-mobile/web` d'abord ; git : `git -C /c/Users/Franc/app-run-mobile`. Ne lancer que les suites nommées (échecs i18n pré-existants).
- Vérif via `npx tsc --noEmit` + `npm run lint` (build local non autoritatif sur Windows) ; seuls les NOUVEAUX warnings de lint comptent.
- **Aucun changement d'API, de DB ou de migration** : le PATCH accepte déjà `outboundTitle`, `returnTitle`, `geoTolM`, `homeLat/homeLng/officeLat/officeLng`.
- Overlay plein écran : **toujours** `createPortal(document.body)` ; composant chargé par `next/dynamic` `ssr: false` (Leaflet exige le DOM).
- Icônes Leaflet : garder `ICONS` au niveau module (identité stable — une icône recréée au render déclenche `setIcon()` et tue un drag en cours).
- UI en français ; tokens `--trail-*`, aucune couleur en dur (exceptions existantes conservées : ombre du divIcon, `text-red-400` des messages d'erreur, cohérent avec le fichier).
- Inchangés : `AddRouteForm`, `web/lib/geo/ban-geocode.ts`, `web/lib/activities/commute.ts`, les routes API.

---

### Task 1: Éditeur unifié + bouton « Modifier »

**Files:**
- Create: `web/components/settings/CommuteRouteEditor.tsx` (contenu ci-dessous)
- Delete: `web/components/settings/CommutePointsEditor.tsx`
- Modify: `web/components/settings/CommuteRoutesSection.tsx` (imports, `handlePointsSaved`, rendu de `RouteCard`, `RouteCard` lui-même)
- Modify: `docs/superpowers/specs/2026-08-02-commute-route-editor-unified-design.md` (bandeau Status)

**Interfaces:**
- Consumes: `searchAddress(q: string): Promise<AddressHit[] | null>` et `type AddressHit = { label: string; lat: number; lng: number }` de `@/lib/geo/ban-geocode` (inchangés) ; `PATCH /api/commute-routes/[id]` (inchangé).
- Produces: depuis `web/components/settings/CommuteRouteEditor.tsx` —
  `export function CommuteRouteEditor(props)`,
  `export type CommuteRoutePatch = { outboundTitle: string; returnTitle: string; geoTolM: number; homeLat: number; homeLng: number; officeLat: number; officeLng: number }`,
  `export type CommuteRouteEditorRoute = { id: string; label: string; outboundTitle: string; returnTitle: string; geoTolM: number; homeLat: number | null; homeLng: number | null; officeLat: number | null; officeLng: number | null }`.

- [ ] **Step 0: Créer la branche (contrôleur)**

```bash
git -C /c/Users/Franc/app-run-mobile checkout -b feat/commute-route-editor-unified master
```

- [ ] **Step 1: Créer `web/components/settings/CommuteRouteEditor.tsx`**

```tsx
'use client'

// Éditeur plein écran d'un trajet domicile-travail : titres, tolérance géo et
// points Home/Office en une seule page.
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

export type CommutePatch = {
  outboundTitle: string
  returnTitle: string
  geoTolM: number
  homeLat: number
  homeLng: number
  officeLat: number
  officeLng: number
}

export type CommuteRouteEditorRoute = {
  id: string
  label: string
  outboundTitle: string
  returnTitle: string
  geoTolM: number
  homeLat: number | null
  homeLng: number | null
  officeLat: number | null
  officeLng: number | null
}

const OSM_URL = 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png'
// Repli si un trajet hérité n'a pas de points (impossible via l'UI actuelle).
const FALLBACK_HOME: LatLng = [45.9, 6.1]
const FALLBACK_OFFICE: LatLng = [45.91, 6.13]

const CHIP_LABEL = `${new Date().getFullYear()}#N`

const POINT_META: Record<PointKey, { emoji: string; label: string }> = {
  home: { emoji: '🏠', label: 'Home' },
  office: { emoji: '🏢', label: 'Office' },
}

// divIcon emoji : évite les icônes par défaut de Leaflet (assets cassés en
// bundler). L'ombre portée est dessinée sur la carte, hors thème → valeur fixe.
// ⚠️ Icônes créées UNE seule fois (identité stable) : une icône recréée au
// render déclenche marker.setIcon(), qui réinitialise l'interaction Leaflet et
// tue un drag en cours.
function emojiIcon(emoji: string) {
  return L.divIcon({
    className: '',
    html: `<div style="font-size:28px;line-height:1;transform:translate(-50%,-50%);filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))">${emoji}</div>`,
    iconSize: [0, 0],
  })
}

const ICONS: Record<PointKey, L.DivIcon> = {
  home: emojiIcon(POINT_META.home.emoji),
  office: emojiIcon(POINT_META.office.emoji),
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-trail-muted mb-[4px]">
      {children}
    </p>
  )
}

// Cadre la carte sur les 2 points à l'ouverture (une seule fois) et corrige la
// taille après le montage dans le portal (Leaflet mesure avant le layout).
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

export function CommuteRouteEditor({
  route, onClose, onSaved,
}: {
  route: CommuteRouteEditorRoute
  onClose: () => void
  onSaved: (patch: CommutePatch) => void
}) {
  const [outboundTitle, setOutboundTitle] = useState(route.outboundTitle)
  const [returnTitle, setReturnTitle] = useState(route.returnTitle)
  const [geoTolM, setGeoTolM] = useState(route.geoTolM)

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
  const [searchError, setSearchError] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  // Recherche BAN avec debounce (min 3 caractères).
  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setHits([])
      setSearching(false)
      setSearchError(false)
      return
    }
    let cancelled = false
    setSearching(true)
    setSearchError(false)
    const t = setTimeout(async () => {
      const res = await searchAddress(q)
      if (cancelled) return
      setHits(res ?? [])
      setSearchError(res == null)
      setSearching(false)
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
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
    setSearchError(false)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(false)
    try {
      const patch: CommutePatch = {
        outboundTitle,
        returnTitle,
        geoTolM,
        homeLat: home[0], homeLng: home[1],
        officeLat: office[0], officeLng: office[1],
      }
      const res = await fetch(`/api/commute-routes/${route.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('patch')
      onSaved(patch)
      onClose()
    } catch {
      setSaveError(true)
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-trail-bg flex flex-col">
      {/* En-tête */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-trail-border flex-shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-body font-bold text-trail-text truncate">Modifier le trajet</p>
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

      {/* Corps scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-[12px] space-y-[14px]">
        {/* Titres */}
        <div>
          <FieldLabel>Titre aller</FieldLabel>
          <div className="flex items-stretch gap-[6px]">
            <div
              className="flex items-center px-[10px] rounded-[8px] bg-trail-surface border border-trail-border text-caption font-bold tracking-wide text-trail-muted whitespace-nowrap select-none"
              title="Numéro auto-incrémenté par jour"
            >
              {CHIP_LABEL}
            </div>
            <input
              type="text"
              value={outboundTitle}
              onChange={e => setOutboundTitle(e.target.value)}
              className="flex-1 min-w-0 rounded-[8px] bg-trail-surface border border-trail-border px-2 py-[6px] text-body text-trail-text outline-none focus:border-trail-primary"
            />
          </div>
        </div>

        <div>
          <FieldLabel>Titre retour</FieldLabel>
          <div className="flex items-stretch gap-[6px]">
            <div
              className="flex items-center px-[10px] rounded-[8px] bg-trail-surface border border-trail-border text-caption font-bold tracking-wide text-trail-muted whitespace-nowrap select-none"
              title="Numéro auto-incrémenté par jour"
            >
              {CHIP_LABEL}
            </div>
            <input
              type="text"
              value={returnTitle}
              onChange={e => setReturnTitle(e.target.value)}
              className="flex-1 min-w-0 rounded-[8px] bg-trail-surface border border-trail-border px-2 py-[6px] text-body text-trail-text outline-none focus:border-trail-primary"
            />
          </div>
        </div>

        {/* Tolérance géo */}
        <div>
          <FieldLabel>Tol. géo m</FieldLabel>
          <input
            type="number"
            value={Number.isFinite(geoTolM) ? geoTolM : ''}
            onChange={e => setGeoTolM(Number(e.target.value))}
            className="w-full rounded-[8px] bg-trail-surface border border-trail-border px-2 py-[6px] text-body text-trail-text outline-none focus:border-trail-primary"
          />
          <p className="text-[10px] text-trail-muted/80 mt-[4px] leading-[14px]">
            Rayon autour de chaque point : une activité compte comme trajet si elle part
            d&apos;un point et arrive à l&apos;autre dans ce rayon.
          </p>
        </div>

        {/* Sélecteur du point actif */}
        <div className="flex gap-[8px]">
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
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Adresse du point ${POINT_META[active].label}…`}
            className="w-full rounded-[10px] bg-trail-surface border border-trail-border px-3 py-[8px] text-body text-trail-text outline-none focus:border-trail-primary"
          />
          {(hits.length > 0 || searching || searchError) && (
            <div className="absolute left-0 right-0 top-full z-[1100] rounded-[10px] bg-trail-card border border-trail-border shadow-xl overflow-hidden">
              {searching && (
                <p className="px-3 py-[8px] text-caption text-trail-muted">Recherche…</p>
              )}
              {searchError && !searching && (
                <p className="px-3 py-[8px] text-caption text-trail-muted">Recherche d&apos;adresse indisponible. Place le point directement sur la carte.</p>
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

        {/* Carte — hauteur fixe dans une page scrollable */}
        <div className="h-[45vh] rounded-[12px] overflow-hidden border border-trail-border">
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
              icon={ICONS.home}
              eventHandlers={{
                click: () => setActive('home'),
                dragend: e => {
                  const p = (e.target as L.Marker).getLatLng()
                  setActive('home')
                  setHome([p.lat, p.lng])
                },
              }}
            />
            <Marker
              position={office}
              draggable
              icon={ICONS.office}
              eventHandlers={{
                click: () => setActive('office'),
                dragend: e => {
                  const p = (e.target as L.Marker).getLatLng()
                  setActive('office')
                  setOffice([p.lat, p.lng])
                },
              }}
            />
            <ClickToPlace onPlace={pos => setPoint(active, pos)} />
            <FitOnce points={[home, office]} />
            <FlyTo target={focus} />
          </MapContainer>
        </div>

        <p className="text-[10px] text-trail-muted leading-[14px]">
          Tape sur la carte ou glisse un marqueur pour ajuster le point actif.
        </p>
      </div>

      {/* Pied collant : rappel + actions */}
      <div className="sticky bottom-0 flex-shrink-0 px-4 py-3 border-t border-trail-border bg-trail-bg space-y-[8px]">
        <p className="text-[10px] text-trail-muted leading-[14px]">
          Après modification, relance « Appliquer à l&apos;historique » pour re-détecter les
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

- [ ] **Step 2: Supprimer l'ancien fichier**

Supprimer `web/components/settings/CommutePointsEditor.tsx` (son contenu est
intégralement repris et enrichi par `CommuteRouteEditor.tsx`).

- [ ] **Step 3: Adapter `CommuteRoutesSection.tsx` — imports et handler**

1. Remplacer le bloc d'import dynamique en tête de fichier :

```tsx
import dynamic from 'next/dynamic'
import type { CommutePoints } from './CommutePointsEditor'

const CommutePointsEditor = dynamic(
  () => import('./CommutePointsEditor').then(m => m.CommutePointsEditor),
  { ssr: false },
)
```

par :

```tsx
import dynamic from 'next/dynamic'
import type { CommutePatch } from './CommuteRouteEditor'

const CommuteRouteEditor = dynamic(
  () => import('./CommuteRouteEditor').then(m => m.CommuteRouteEditor),
  { ssr: false },
)
```

2. Remplacer le handler :

```tsx
  function handlePointsSaved(id: string, points: CommutePoints) {
    setRoutes(prev => prev.map(r => (r.id === id ? { ...r, ...points } : r)))
  }
```

par :

```tsx
  function handleSaved(id: string, patch: CommutePatch) {
    setRoutes(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }
```

3. Dans le rendu de la liste, remplacer :

```tsx
              onPointsSaved={points => handlePointsSaved(route.id, points)}
```

par :

```tsx
              onSaved={patch => handleSaved(route.id, patch)}
```

Les props `key`, `route`, `onDelete`, `onPatch` restent inchangées.

- [ ] **Step 4: Réécrire `RouteCard`**

Remplacer intégralement la fonction `RouteCard` (de `function RouteCard({` à sa
`}` fermante, juste avant le commentaire `// ── Formulaire d'ajout d'un trajet ──`)
par :

```tsx
function RouteCard({
  route, onDelete, onPatch, onSaved,
}: {
  route: CommuteRoute
  onDelete: () => void
  onPatch: (patch: Partial<CommuteRoute>) => void
  onSaved: (patch: CommutePatch) => void
}) {
  const Icon = sportIcon(route.sportType)
  const [editorOpen, setEditorOpen] = useState(false)

  return (
    <div className="rounded-[12px] bg-trail-card border border-trail-border p-[12px] space-y-[10px]">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-[10px] bg-trail-surface border border-trail-border flex items-center justify-center flex-shrink-0">
          <Icon size={15} className="text-trail-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-body font-bold text-trail-text truncate">{route.label}</p>
          <p className="text-micro text-trail-muted">{route.sportType}</p>
        </div>
        <button
          type="button"
          onClick={() => onPatch({ active: !route.active })}
          className={`flex items-center gap-[5px] px-[8px] py-[5px] rounded-full border text-[10px] font-semibold tracking-wide transition-colors ${
            route.active
              ? 'bg-trail-primary/15 border-trail-primary text-trail-primary'
              : 'bg-trail-surface border-trail-border text-trail-muted hover:text-trail-text'
          }`}
        >
          {route.active && <Check size={11} />}
          {route.active ? 'Actif' : 'Inactif'}
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Supprimer le trajet"
          className="w-7 h-7 rounded-[8px] border border-red-500/25 text-red-400 flex items-center justify-center hover:bg-red-500/10 transition-colors flex-shrink-0"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Aperçu des titres */}
      <div className="grid grid-cols-1 gap-[4px] text-caption">
        <div className="rounded-[8px] bg-trail-surface px-2 py-[6px]">
          <p className="text-[10px] uppercase tracking-wider text-trail-muted">Aller</p>
          <p className="text-body-sm text-trail-text truncate">{PREVIEW_PREFIX}{route.outboundTitle}</p>
        </div>
        <div className="rounded-[8px] bg-trail-surface px-2 py-[6px]">
          <p className="text-[10px] uppercase tracking-wider text-trail-muted">Retour</p>
          <p className="text-body-sm text-trail-text truncate">{PREVIEW_PREFIX}{route.returnTitle}</p>
        </div>
      </div>

      {/* Bouton d'édition */}
      <button
        type="button"
        onClick={() => setEditorOpen(true)}
        className="flex items-center gap-[5px] px-[10px] py-[5px] rounded-[10px] border border-trail-primary text-trail-primary text-micro font-semibold hover:bg-trail-primary/10 transition-colors"
      >
        <Pencil size={12} />
        Modifier
      </button>

      {editorOpen && (
        <CommuteRouteEditor
          route={{
            id: route.id,
            label: route.label,
            outboundTitle: route.outboundTitle,
            returnTitle: route.returnTitle,
            geoTolM: route.geoTolM,
            homeLat: route.homeLat,
            homeLng: route.homeLng,
            officeLat: route.officeLat,
            officeLng: route.officeLng,
          }}
          onClose={() => setEditorOpen(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Ajuster les imports d'icônes**

Dans le bloc `import { … } from 'lucide-react'` en tête de
`CommuteRoutesSection.tsx` : ajouter `Pencil`. Les composants `TextInput` et
`NumberInput` ne sont plus utilisés que par `AddRouteForm` (`TextInput` oui,
`NumberInput` pour « Tol. géo m » des options avancées) — **ne rien supprimer
d'autre** ; si `tsc`/lint signale un import ou un helper devenu inutilisé à
cause de cette tâche, le retirer alors seulement.

- [ ] **Step 6: Vérifier**

```bash
cd /c/Users/Franc/app-run-mobile/web && npx tsc --noEmit
cd /c/Users/Franc/app-run-mobile/web && npm run lint
cd /c/Users/Franc/app-run-mobile/web && npx jest __tests__/activities/commute.test.ts __tests__/lib/geo/ban-geocode.test.ts __tests__/app/api/commute-routes/patch-points.test.ts
```

Attendu : tsc silencieux (aucune référence résiduelle à `CommutePointsEditor` /
`CommutePoints`), lint sans NOUVEAU warning, 3 suites vertes (51 tests).

- [ ] **Step 7: Bandeau Status sur la spec**

Dans `docs/superpowers/specs/2026-08-02-commute-route-editor-unified-design.md`,
remplacer la ligne :

```markdown
**Statut** : Spec validée, en attente d'implémentation
```

par :

```markdown
> **Status: Implémenté** · 2026-08-02 · Code: `web/components/settings/CommuteRouteEditor.tsx`, `web/components/settings/CommuteRoutesSection.tsx`
```

- [ ] **Step 8: Commit (contrôleur uniquement)**

```bash
[ "$(git -C /c/Users/Franc/app-run-mobile rev-parse --abbrev-ref HEAD)" = "feat/commute-route-editor-unified" ] \
  && git -C /c/Users/Franc/app-run-mobile add -A web/components/settings docs/superpowers/specs/2026-08-02-commute-route-editor-unified-design.md docs/superpowers/plans/2026-08-02-commute-route-editor-unified.md \
  && git -C /c/Users/Franc/app-run-mobile commit -m "feat(settings): éditeur unifié du trajet (titres + tolérance + points) derrière un bouton Modifier" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" \
  || echo "ABORT: mauvaise branche"
```

---

## Après exécution

- Merge/push : **uniquement sur demande explicite de Franck**. Utiliser superpowers:finishing-a-development-branch.
- Vérif manuelle Franck après déploiement (la carte n'est pas testable en jsdom) : le bouton « Modifier » ouvre une page unique ; modifier un titre, la tolérance et un point puis Enregistrer persiste les trois (rouvrir l'éditeur le confirme) ; Annuler n'écrit rien ; scroll de la page fluide avec la carte à hauteur fixe ; rendu correct dans les deux thèmes et sur téléphone (~390 px).
