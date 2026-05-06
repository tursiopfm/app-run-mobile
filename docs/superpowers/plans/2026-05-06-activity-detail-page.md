# Activity Detail Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une page `/activities/[id]` affichant la carte de la route, 6 métriques clés, et des onglets Splits / Zones FC.

**Architecture:** Server Component (`page.tsx`) qui lit la DB Supabase et fetch optionnellement les splits Strava on-demand, puis passe tout à un Client Component qui gère les onglets et la carte Leaflet (rendue via `next/dynamic` pour éviter le SSR).

**Tech Stack:** Next.js 14 App Router, React 18, Supabase, react-leaflet, @mapbox/polyline, TypeScript, Jest/ts-jest

---

## File Map

| Action | Fichier |
|--------|---------|
| Create | `web/lib/activities/detail.ts` — utilitaires purs : `splitColor`, `estimateHrZones`, formatters |
| Create | `web/__tests__/activities/detail.test.ts` — tests des utilitaires |
| Modify | `web/components/ui/ActivityCard.tsx` — ajouter prop `onClick` |
| Modify | `web/app/activities/ActivitiesClient.tsx` — wirer `onClick` → `router.push` |
| Create | `web/components/ui/ActivityMap.tsx` — carte Leaflet (dynamique, ssr:false) |
| Create | `web/components/ui/ActivitySplits.tsx` — onglet Splits |
| Create | `web/components/ui/ActivityHeartRateZones.tsx` — onglet Zones FC |
| Create | `web/app/activities/[id]/ActivityDetailClient.tsx` — Client Component principal |
| Create | `web/app/activities/[id]/page.tsx` — Server Component |

---

## Task 1 — Installer les dépendances

**Files:** `web/package.json` (modifié par npm)

- [ ] **Step 1 : Installer depuis le répertoire web/**

```bash
cd web
npm install react-leaflet leaflet @mapbox/polyline
npm install --save-dev @types/leaflet
```

- [ ] **Step 2 : Vérifier l'installation**

```bash
node -e "require('react-leaflet'); require('leaflet'); require('@mapbox/polyline'); console.log('OK')"
```

Attendu : `OK`

- [ ] **Step 3 : Commit**

```bash
cd web
git add package.json package-lock.json
git commit -m "chore: add react-leaflet, leaflet, @mapbox/polyline"
```

---

## Task 2 — Utilitaires purs + tests (TDD)

**Files:**
- Create: `web/lib/activities/detail.ts`
- Create: `web/__tests__/activities/detail.test.ts`

Ces fonctions n'ont aucune dépendance externe — elles sont testables en isolation.

### Types Strava à connaître

Le `raw_payload` Strava contient (après fetch détail) :
```typescript
// splits_metric[i] (chaque élément = 1 km)
{
  split: number            // numéro du split (1-based)
  distance: number         // mètres (≈ 1000 pour les splits métriques)
  elapsed_time: number     // secondes (temps écoulé incluant pauses)
  moving_time: number      // secondes (temps en mouvement)
  elevation_difference: number  // mètres (positif = montée)
  average_speed: number    // m/s
  pace_zone: number        // zone Strava (1-5, peut être 0 si non calculé)
}
```

- [ ] **Step 1 : Écrire les tests**

Créer `web/__tests__/activities/detail.test.ts` :

```typescript
import {
  splitColor,
  estimateHrZones,
  fmtPaceSec,
  fmtDurationSec,
  splitPaceSec,
} from '@/lib/activities/detail'

// ── fmtPaceSec ────────────────────────────────────────────────────────────────
describe('fmtPaceSec', () => {
  it('formats pace seconds as mm:ss', () => {
    expect(fmtPaceSec(648)).toBe('10:48')   // 10 min 48 sec
    expect(fmtPaceSec(570)).toBe('9:30')
    expect(fmtPaceSec(60)).toBe('1:00')
  })
  it('returns — for null or 0', () => {
    expect(fmtPaceSec(null)).toBe('—')
    expect(fmtPaceSec(0)).toBe('—')
  })
})

// ── fmtDurationSec ────────────────────────────────────────────────────────────
describe('fmtDurationSec', () => {
  it('formats seconds as Xh YYmin', () => {
    expect(fmtDurationSec(7362)).toBe('2h02')   // 2h 2min 42s → display 2h02
    expect(fmtDurationSec(5400)).toBe('1h30')
    expect(fmtDurationSec(600)).toBe('10min')
  })
  it('returns — for null or 0', () => {
    expect(fmtDurationSec(null)).toBe('—')
    expect(fmtDurationSec(0)).toBe('—')
  })
})

// ── splitPaceSec ──────────────────────────────────────────────────────────────
describe('splitPaceSec', () => {
  it('computes pace in sec/km from a strava split', () => {
    // moving_time=570sec, distance=1000m → 9:30/km
    expect(splitPaceSec({ moving_time: 570, distance: 1000 })).toBe(570)
    // moving_time=648sec, distance=1000m → 10:48/km
    expect(splitPaceSec({ moving_time: 648, distance: 1000 })).toBe(648)
  })
  it('handles partial last split', () => {
    // 500m in 300sec → 600 sec/km
    expect(splitPaceSec({ moving_time: 300, distance: 500 })).toBe(600)
  })
  it('returns null if distance is 0', () => {
    expect(splitPaceSec({ moving_time: 0, distance: 0 })).toBeNull()
  })
})

// ── splitColor ────────────────────────────────────────────────────────────────
describe('splitColor', () => {
  // avgPace = 648 sec/km (10:48/km)
  const avg = 648
  it('returns green for splits ≤ -10% faster', () => {
    expect(splitColor(580, avg)).toBe('#4caf50')   // 580/648 = -10.5%
  })
  it('returns light green for splits -10% to 0%', () => {
    expect(splitColor(610, avg)).toBe('#8bc34a')   // 610/648 = -5.9%
  })
  it('returns yellow for splits 0% to +10%', () => {
    expect(splitColor(680, avg)).toBe('#ffb300')   // 680/648 = +4.9%
  })
  it('returns orange for splits +10% to +20%', () => {
    expect(splitColor(745, avg)).toBe('#ff7043')   // 745/648 = +15%
  })
  it('returns red for splits > +20%', () => {
    expect(splitColor(800, avg)).toBe('#e8651a')   // 800/648 = +23.5%
  })
  it('returns muted for null avg', () => {
    expect(splitColor(600, 0)).toBe('#8892a4')
  })
})

// ── estimateHrZones ───────────────────────────────────────────────────────────
describe('estimateHrZones', () => {
  it('returns 5 zones whose durations sum to movingTimeSec', () => {
    const zones = estimateHrZones(148, 185, 7362)
    const total = zones.reduce((s, z) => s + z.durationSec, 0)
    expect(total).toBe(7362)
    expect(zones).toHaveLength(5)
  })
  it('assigns most time to zone containing avg_hr', () => {
    // avg 148, max 185 → avg% = 0.80 → falls in Z4 (80-90%)
    const zones = estimateHrZones(148, 185, 7362)
    const z4 = zones.find(z => z.label === 'Z4 Seuil')!
    const maxZone = zones.reduce((a, b) => a.durationSec > b.durationSec ? a : b)
    expect(maxZone.label).toBe(z4.label)
  })
  it('labels and colors are correct', () => {
    const zones = estimateHrZones(120, 185, 3600)
    expect(zones[0].label).toBe('Z1 Récup')
    expect(zones[0].color).toBe('#42a5f5')
    expect(zones[4].label).toBe('Z5 VO2max')
    expect(zones[4].color).toBe('#e8651a')
  })
})
```

- [ ] **Step 2 : Lancer les tests — vérifier qu'ils échouent**

```bash
cd web && npm test -- --testPathPattern="detail.test" --no-coverage 2>&1 | tail -5
```

Attendu : erreurs `Cannot find module '@/lib/activities/detail'`

- [ ] **Step 3 : Implémenter `web/lib/activities/detail.ts`**

```typescript
// ── Types ─────────────────────────────────────────────────────────────────────

export type StravaSplit = {
  split: number
  distance: number
  elapsed_time: number
  moving_time: number
  elevation_difference: number
  average_speed: number
  pace_zone: number
}

export type HrZone = {
  label: string
  color: string
  minPct: number
  maxPct: number
  durationSec: number
}

// ── Formatters ────────────────────────────────────────────────────────────────

export function fmtPaceSec(sec: number | null): string {
  if (!sec) return '—'
  const mins = Math.floor(sec / 60)
  const secs = Math.round(sec % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export function fmtDurationSec(sec: number | null): string {
  if (!sec) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`
  return `${m}min`
}

// ── Split utilities ───────────────────────────────────────────────────────────

export function splitPaceSec(
  split: Pick<StravaSplit, 'moving_time' | 'distance'>
): number | null {
  if (!split.distance) return null
  return Math.round((split.moving_time / split.distance) * 1000)
}

export function splitColor(splitPace: number, avgPace: number): string {
  if (!avgPace) return '#8892a4'
  const ratio = (splitPace - avgPace) / avgPace
  if (ratio <= -0.10) return '#4caf50'
  if (ratio <= 0)     return '#8bc34a'
  if (ratio <= 0.10)  return '#ffb300'
  if (ratio <= 0.20)  return '#ff7043'
  return '#e8651a'
}

// ── Heart rate zones ──────────────────────────────────────────────────────────

const ZONE_DEFS = [
  { label: 'Z1 Récup',   color: '#42a5f5', minPct: 0,    maxPct: 0.60, center: 0.30 },
  { label: 'Z2 Aérobie', color: '#66bb6a', minPct: 0.60, maxPct: 0.70, center: 0.65 },
  { label: 'Z3 Tempo',   color: '#ffb300', minPct: 0.70, maxPct: 0.80, center: 0.75 },
  { label: 'Z4 Seuil',   color: '#ff7043', minPct: 0.80, maxPct: 0.90, center: 0.85 },
  { label: 'Z5 VO2max',  color: '#e8651a', minPct: 0.90, maxPct: 1.00, center: 0.95 },
]

export function estimateHrZones(
  avgHr: number,
  maxHr: number,
  movingTimeSec: number
): HrZone[] {
  const avgPct = avgHr / maxHr
  const sigma = 0.08

  const rawWeights = ZONE_DEFS.map(z =>
    Math.exp(-0.5 * ((avgPct - z.center) / sigma) ** 2)
  )
  const total = rawWeights.reduce((s, w) => s + w, 0)

  // Distribute time proportionally, ensuring integers sum exactly to movingTimeSec
  let remaining = movingTimeSec
  const durations = rawWeights.map((w, i) => {
    if (i === rawWeights.length - 1) return remaining
    const d = Math.round((w / total) * movingTimeSec)
    remaining -= d
    return d
  })

  return ZONE_DEFS.map((z, i) => ({
    label:       z.label,
    color:       z.color,
    minPct:      z.minPct,
    maxPct:      z.maxPct,
    durationSec: durations[i],
  }))
}
```

- [ ] **Step 4 : Lancer les tests — vérifier qu'ils passent**

```bash
cd web && npm test -- --testPathPattern="detail.test" --no-coverage 2>&1 | tail -10
```

Attendu : `Tests: X passed`

- [ ] **Step 5 : Commit**

```bash
cd web
git add lib/activities/detail.ts __tests__/activities/detail.test.ts
git commit -m "feat(detail): utilitaires splitColor, estimateHrZones, formatters"
```

---

## Task 3 — Rendre ActivityCard cliquable

**Files:**
- Modify: `web/components/ui/ActivityCard.tsx`
- Modify: `web/app/activities/ActivitiesClient.tsx`

- [ ] **Step 1 : Ajouter prop `onClick` à ActivityCard**

Dans `web/components/ui/ActivityCard.tsx`, modifier la signature et le JSX :

```typescript
// Changer la signature du composant (ligne ~128)
export function ActivityCard({
  activity: a,
  onEdit,
  onClick,
}: {
  activity: ActivityRow
  onEdit?: (a: ActivityRow) => void
  onClick?: () => void
}) {
```

Envelopper le `<div>` racine (ligne ~150) pour le rendre cliquable :

```typescript
  return (
    <div
      className="rounded-[12px] bg-trail-card border border-trail-border p-[10px]"
      style={onClick ? { cursor: 'pointer' } : undefined}
      onClick={onClick}
    >
```

Le bouton ⋮ doit stopper la propagation pour ne pas déclencher `onClick` :

```typescript
            <button
              onClick={(e) => { e.stopPropagation(); if (onEdit) onEdit(a) }}
              aria-label="Modifier l'activité"
              // ... reste inchangé
            >
```

- [ ] **Step 2 : Wirer dans ActivitiesClient**

Dans `web/app/activities/ActivitiesClient.tsx`, ajouter le router en haut du fichier :

```typescript
import { useRouter } from 'next/navigation'
```

Dans le corps du composant `ActivitiesClient`, ajouter :

```typescript
const router = useRouter()
```

Trouver les deux endroits où `<ActivityCard>` est rendu (lignes ~333 et ~630) et ajouter `onClick` :

```typescript
// Ligne ~333 (panel recherche — résultats live)
<ActivityCard
  key={a.id}
  activity={a}
  onClick={() => router.push(`/activities/${a.id}`)}
/>

// Ligne ~630 (liste principale)
<ActivityCard
  key={a.id}
  activity={a}
  onEdit={setEditingActivity}
  onClick={() => router.push(`/activities/${a.id}`)}
/>
```

- [ ] **Step 3 : Vérifier que le build TypeScript passe**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Attendu : aucune erreur

- [ ] **Step 4 : Lancer la suite de tests complète**

```bash
cd web && npm test --no-coverage 2>&1 | tail -10
```

Attendu : tous les tests passent

- [ ] **Step 5 : Commit**

```bash
cd web
git add components/ui/ActivityCard.tsx app/activities/ActivitiesClient.tsx
git commit -m "feat(activities): ActivityCard cliquable → /activities/[id]"
```

---

## Task 4 — Composant Carte (`ActivityMap`)

**Files:**
- Create: `web/components/ui/ActivityMap.tsx`

Leaflet est une lib browser-only — elle doit être importée uniquement côté client. Le composant utilise `react-leaflet` et est conçu pour être wrappé avec `next/dynamic({ ssr: false })` dans le parent.

- [ ] **Step 1 : Créer `web/components/ui/ActivityMap.tsx`**

```typescript
'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'
import polylineLib from '@mapbox/polyline'
import 'leaflet/dist/leaflet.css'

type LatLng = [number, number]

function FitBounds({ positions }: { positions: LatLng[] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(positions, { padding: [20, 20] })
    }
  }, [map, positions])
  return null
}

export function ActivityMap({ encodedPolyline }: { encodedPolyline: string }) {
  const positions: LatLng[] = polylineLib
    .decode(encodedPolyline)
    .map(([lat, lng]) => [lat, lng])

  const start = positions[0]
  const end   = positions[positions.length - 1]

  return (
    <MapContainer
      center={start ?? [46.5, 2.5]}
      zoom={13}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
      <Polyline
        positions={positions}
        pathOptions={{ color: '#e8651a', weight: 3, opacity: 0.9 }}
      />
      {start && (
        <Polyline
          positions={[start]}
          pathOptions={{ color: '#4caf50', weight: 8, opacity: 0.9 }}
        />
      )}
      {end && (
        <Polyline
          positions={[end]}
          pathOptions={{ color: '#e8651a', weight: 8, opacity: 0.9 }}
        />
      )}
      <FitBounds positions={positions} />
    </MapContainer>
  )
}

export function ActivityMapPlaceholder() {
  return (
    <div
      style={{
        width: '100%', height: '100%',
        background: '#141824',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <span style={{ color: '#4a5568', fontSize: '13px' }}>Carte non disponible</span>
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Attendu : aucune erreur

- [ ] **Step 3 : Commit**

```bash
cd web
git add components/ui/ActivityMap.tsx
git commit -m "feat(detail): composant ActivityMap Leaflet dark"
```

---

## Task 5 — Composant Splits (`ActivitySplits`)

**Files:**
- Create: `web/components/ui/ActivitySplits.tsx`

- [ ] **Step 1 : Créer `web/components/ui/ActivitySplits.tsx`**

```typescript
import { colors } from '@/lib/design/colors'
import {
  splitPaceSec,
  splitColor,
  fmtPaceSec,
  type StravaSplit,
} from '@/lib/activities/detail'

function avgPaceSecFromSplits(splits: StravaSplit[]): number {
  const totalMoving = splits.reduce((s, sp) => s + sp.moving_time, 0)
  const totalDist   = splits.reduce((s, sp) => s + sp.distance, 0)
  if (!totalDist) return 0
  return Math.round((totalMoving / totalDist) * 1000)
}

export function ActivitySplits({ splits }: { splits: StravaSplit[] }) {
  const avg = avgPaceSecFromSplits(splits)
  const bestPace = Math.min(...splits.map(s => splitPaceSec(s) ?? Infinity))

  return (
    <div style={{ padding: '12px 0 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: colors.subtleText }}>
          {splits.length} segments
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#4caf50' }}>
          ★ Meilleur {fmtPaceSec(bestPace)}
        </span>
      </div>

      {/* Split rows */}
      {splits.map((sp) => {
        const pace  = splitPaceSec(sp)
        const color = pace ? splitColor(pace, avg) : '#8892a4'
        const barPct = pace && avg
          ? Math.min(100, Math.round((pace / (avg * 1.25)) * 100))
          : 50
        const elevSign = sp.elevation_difference > 0 ? '↑' : '↓'
        const elevAbs  = Math.abs(Math.round(sp.elevation_difference))

        return (
          <div
            key={sp.split}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 0',
              borderBottom: `1px solid ${colors.cardBg}`,
            }}
          >
            {/* Km number */}
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 700, color: colors.subtleText,
              flexShrink: 0,
            }}>
              {sp.split}
            </div>

            {/* Bar */}
            <div style={{ flex: 1, height: 5, background: colors.surface, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${barPct}%`, height: '100%', background: color, borderRadius: 3 }} />
            </div>

            {/* Pace */}
            <span style={{ fontSize: 11, fontWeight: 800, width: 34, textAlign: 'right', color }}>
              {fmtPaceSec(pace)}
            </span>

            {/* Elevation */}
            <span style={{
              fontSize: 9, width: 36, textAlign: 'right',
              color: sp.elevation_difference > 5
                ? '#ffb300'
                : sp.elevation_difference < -5
                  ? '#4db6f0'
                  : colors.subtleText,
            }}>
              {elevAbs > 0 ? `${elevSign} ${elevAbs}m` : '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Attendu : aucune erreur

- [ ] **Step 3 : Commit**

```bash
cd web
git add components/ui/ActivitySplits.tsx
git commit -m "feat(detail): composant ActivitySplits barre colorée par allure"
```

---

## Task 6 — Composant Zones FC (`ActivityHeartRateZones`)

**Files:**
- Create: `web/components/ui/ActivityHeartRateZones.tsx`

- [ ] **Step 1 : Créer `web/components/ui/ActivityHeartRateZones.tsx`**

```typescript
import { colors } from '@/lib/design/colors'
import { estimateHrZones } from '@/lib/activities/detail'

function fmtMin(sec: number): string {
  const m = Math.round(sec / 60)
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const r = m % 60
    return `${h}h${String(r).padStart(2, '0')}`
  }
  return `${m}min`
}

export function ActivityHeartRateZones({
  avgHr,
  maxHr,
  movingTimeSec,
}: {
  avgHr: number
  maxHr: number
  movingTimeSec: number
}) {
  const zones = estimateHrZones(avgHr, maxHr, movingTimeSec)
  const maxDuration = Math.max(...zones.map(z => z.durationSec))

  return (
    <div style={{ padding: '12px 0 24px' }}>
      <p style={{
        fontSize: 9, fontWeight: 700, color: colors.subtleText,
        textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 12,
      }}>
        Fréquence cardiaque · {fmtMin(movingTimeSec)}
      </p>

      {zones.map(z => (
        <div key={z.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: z.color, width: 58 }}>
            {z.label}
          </span>
          <div style={{ flex: 1, height: 8, background: colors.surface, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.round((z.durationSec / maxDuration) * 100)}%`,
              height: '100%',
              background: z.color,
              borderRadius: 4,
            }} />
          </div>
          <span style={{ fontSize: 9, color: colors.subtleText, width: 32, textAlign: 'right' }}>
            {fmtMin(z.durationSec)}
          </span>
        </div>
      ))}

      {/* Summary */}
      <div style={{
        marginTop: 14, padding: '10px 12px',
        background: colors.cardBg,
        border: `1px solid ${colors.border}`,
        borderRadius: 9,
        display: 'flex', justifyContent: 'space-around',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#ff7043' }}>{avgHr}</div>
          <div style={{ fontSize: 8, color: colors.subtleText, marginTop: 2 }}>FC Moy. bpm</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#e8651a' }}>{maxHr}</div>
          <div style={{ fontSize: 8, color: colors.subtleText, marginTop: 2 }}>FC Max bpm</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Attendu : aucune erreur

- [ ] **Step 3 : Commit**

```bash
cd web
git add components/ui/ActivityHeartRateZones.tsx
git commit -m "feat(detail): composant ActivityHeartRateZones 5 zones estimées"
```

---

## Task 7 — Client Component principal (`ActivityDetailClient`)

**Files:**
- Create: `web/app/activities/[id]/ActivityDetailClient.tsx`

Ce composant reçoit toutes les données du Server Component, gère l'état des onglets, la carte dynamique, et le modal d'édition.

- [ ] **Step 1 : Créer le répertoire**

```bash
mkdir -p "web/app/activities/[id]"
```

- [ ] **Step 2 : Créer `web/app/activities/[id]/ActivityDetailClient.tsx`**

```typescript
'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { colors } from '@/lib/design/colors'
import { sportLabel } from '@/lib/design/labels'
import { guessIntensity } from '@/lib/activities/intensity'
import { fmtPaceSec, fmtDurationSec, type StravaSplit } from '@/lib/activities/detail'
import { ActivitySplits } from '@/components/ui/ActivitySplits'
import { ActivityHeartRateZones } from '@/components/ui/ActivityHeartRateZones'
import { EditActivityModal } from '@/components/ui/EditActivityModal'
import type { ActivityRow } from '@/components/ui/ActivityCard'

// Leaflet must not render server-side
const ActivityMap     = dynamic(
  () => import('@/components/ui/ActivityMap').then(m => m.ActivityMap),
  { ssr: false, loading: () => <MapFallback /> }
)
const ActivityMapPlaceholder = dynamic(
  () => import('@/components/ui/ActivityMap').then(m => m.ActivityMapPlaceholder),
  { ssr: false }
)

function MapFallback() {
  return <div style={{ width: '100%', height: '100%', background: '#141824' }} />
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActivityDetail = ActivityRow & {
  provider: string
  provider_activity_id: string
  duration_sec: number | null
  calories: number | null
  avg_hr: number | null
  max_hr: number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const INTENSITY_EMOJI: Record<string, string> = {
  footing: '🦶', sortie_longue: '🐢', cotes: '⛰️', vma: '🔥',
  seuil: '🎯', runtaf: '🏃‍♂️🏢', velotaf: '🚴🏻🏢', course: '🏁', autre: '❓',
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
  return `${d.toLocaleDateString('fr-FR', opts)} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function StatTile({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div style={{
      background: '#181c29', border: `1px solid ${colors.border}`,
      borderRadius: 10, padding: '9px 10px 8px',
    }}>
      <div style={{ fontSize: 8, color: colors.subtleText, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {unit && <div style={{ fontSize: 8, color: colors.subtleText }}>{unit}</div>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type Tab = 'splits' | 'zones'

export default function ActivityDetailClient({
  activity,
  polyline,
  splits,
}: {
  activity: ActivityDetail
  polyline: string | null
  splits: StravaSplit[] | null
}) {
  const router = useRouter()
  const [tab, setTab]         = useState<Tab>('splits')
  const [editing, setEditing] = useState(false)

  const sport     = activity.manual_sport_type     ?? activity.sport_type
  const dist      = activity.manual_distance_m     ?? activity.distance_m
  const moving    = activity.manual_moving_time_sec ?? activity.moving_time_sec
  const elev      = activity.manual_elevation_gain_m ?? activity.elevation_gain_m
  const intensity = (activity.manual_intensity as string | null) ?? guessIntensity(activity.name, activity.ces, sport)

  const km       = dist   ? (dist / 1000).toFixed(1)      : '—'
  const dPlus    = elev   ? Math.round(elev).toString()    : '—'
  const effort   = activity.ces ? Math.round(activity.ces).toString() : '—'

  // Pace: only for running sports
  const isRun = sport === 'Run' || sport === 'TrailRun'
  const isRide = sport === 'Ride' || sport === 'GravelRide' || sport === 'VirtualRide'

  let paceLabel = 'Allure'; let paceValue = '—'; let paceUnit = '/km'
  if (isRun && dist && moving) {
    paceValue = fmtPaceSec(Math.round((moving / dist) * 1000))
  } else if (isRide && dist && moving) {
    paceLabel = 'Vitesse'
    paceValue = ((dist / 1000) / (moving / 3600)).toFixed(1)
    paceUnit  = 'km/h'
  }

  const showSplitsTab = splits !== null && splits.length > 0
  const showZonesTab  = activity.avg_hr !== null && activity.max_hr !== null && moving !== null

  return (
    <>
      {/* MAP */}
      <div style={{ position: 'relative', width: '100%', height: 230, flexShrink: 0 }}>
        {polyline
          ? <ActivityMap encodedPolyline={polyline} />
          : <ActivityMapPlaceholder />
        }

        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
          background: 'linear-gradient(to bottom, transparent, #0f1219)',
          pointerEvents: 'none',
        }} />

        {/* Back button */}
        <button
          onClick={() => router.back()}
          aria-label="Retour"
          style={{
            position: 'absolute', top: 16, left: 16, zIndex: 50,
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#e8eaf0', fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ←
        </button>

        {/* Edit button */}
        <button
          onClick={() => setEditing(true)}
          aria-label="Modifier"
          style={{
            position: 'absolute', top: 16, right: 16, zIndex: 50,
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(232,101,26,0.22)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(232,101,26,0.4)',
            fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✏️
        </button>
      </div>

      {/* CONTENT */}
      <div style={{ padding: '0 14px', background: '#0f1219', marginTop: -10 }}>

        {/* Activity header */}
        <div style={{ padding: '12px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                background: 'rgba(232,101,26,0.18)', border: '1px solid rgba(232,101,26,0.4)',
                color: colors.chargeOrange, fontSize: 9, fontWeight: 700,
                padding: '2px 8px', borderRadius: 20,
              }}>
                {sportLabel[sport] ?? sport}
              </span>
              <span style={{ fontSize: 13 }}>{INTENSITY_EMOJI[intensity] ?? '❓'}</span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 3,
              background: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.28)',
              padding: '3px 9px', borderRadius: 20,
              fontSize: 10, fontWeight: 800, color: '#ffc107',
            }}>
              ⚡ Effort {effort}
            </div>
          </div>
          <p style={{ fontSize: 17, fontWeight: 800, color: '#f0f2f8', marginBottom: 3 }}>
            {activity.name}
          </p>
          <p style={{ fontSize: 10, color: colors.subtleText }}>
            {fmtDate(activity.start_time)}
          </p>
        </div>

        {/* Stats grid — always visible */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: 6, marginBottom: 16,
        }}>
          <StatTile label="Distance"    value={km}                           unit="km"     color={colors.chargeOrange} />
          <StatTile label="D+"          value={dPlus}                        unit="m"      color="#4db6f0" />
          <StatTile label="Durée"       value={fmtDurationSec(moving)}       unit=""       color="#4caf50" />
          <StatTile label={paceLabel}   value={paceValue}                    unit={paceUnit} color={colors.text} />
          <StatTile label="Calories"    value={activity.calories ? activity.calories.toString() : '—'} unit="kcal" color="#ff7043" />
          <StatTile label="Tps écoulé"  value={fmtDurationSec(activity.duration_sec)} unit="" color="#4caf50" />
        </div>

        {/* Tabs */}
        {(showSplitsTab || showZonesTab) && (
          <>
            <div style={{
              display: 'flex', borderBottom: `1px solid ${colors.border}`,
              margin: '0 -14px', padding: '0 14px',
              position: 'sticky', top: 0, background: '#0f1219', zIndex: 30,
            }}>
              {showSplitsTab && (
                <button
                  onClick={() => setTab('splits')}
                  style={{
                    flex: 1, padding: '9px 0',
                    fontSize: 10, fontWeight: 700,
                    color: tab === 'splits' ? colors.chargeOrange : colors.subtleText,
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: tab === 'splits' ? `2px solid ${colors.chargeOrange}` : '2px solid transparent',
                    textTransform: 'uppercase', letterSpacing: '.9px',
                  }}
                >
                  Splits
                </button>
              )}
              {showZonesTab && (
                <button
                  onClick={() => setTab('zones')}
                  style={{
                    flex: 1, padding: '9px 0',
                    fontSize: 10, fontWeight: 700,
                    color: tab === 'zones' ? colors.chargeOrange : colors.subtleText,
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: tab === 'zones' ? `2px solid ${colors.chargeOrange}` : '2px solid transparent',
                    textTransform: 'uppercase', letterSpacing: '.9px',
                  }}
                >
                  Zones FC
                </button>
              )}
            </div>

            {/* Tab panels */}
            {tab === 'splits' && showSplitsTab && (
              <ActivitySplits splits={splits!} />
            )}
            {tab === 'zones' && showZonesTab && (
              <ActivityHeartRateZones
                avgHr={activity.avg_hr!}
                maxHr={activity.max_hr!}
                movingTimeSec={moving!}
              />
            )}
          </>
        )}

      </div>

      {/* Edit modal */}
      {editing && (
        <EditActivityModal
          activity={activity as ActivityRow}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); router.refresh() }}
          onDeleted={() => router.push('/activities')}
        />
      )}
    </>
  )
}
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Attendu : aucune erreur

- [ ] **Step 4 : Commit**

```bash
cd web
git add "app/activities/[id]/ActivityDetailClient.tsx"
git commit -m "feat(detail): ActivityDetailClient carte + stats + onglets"
```

---

## Task 8 — Server Component (`page.tsx`)

**Files:**
- Create: `web/app/activities/[id]/page.tsx`

- [ ] **Step 1 : Vérifier la signature de `EditActivityModal.onSaved`**

```bash
grep -n "onSaved\|onClose" web/components/ui/EditActivityModal.tsx | head -10
```

Adapter la prop `onSaved` dans `ActivityDetailClient` si le nom diffère (ex. `onSave`).

- [ ] **Step 2 : Créer `web/app/activities/[id]/page.tsx`**

```typescript
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/database/supabase-server'
import { getValidStravaToken } from '@/lib/providers/strava/token'
import { fetchStravaActivity } from '@/lib/providers/strava/api'
import ActivityDetailClient, { type ActivityDetail } from './ActivityDetailClient'
import type { StravaSplit } from '@/lib/activities/detail'

type RawPayload = {
  map?: { summary_polyline?: string }
  splits_metric?: StravaSplit[]
}

export default async function ActivityDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: row } = await supabase
    .from('activities')
    .select(`
      id, provider, provider_activity_id,
      sport_type, name, start_time,
      distance_m, elevation_gain_m, moving_time_sec, duration_sec,
      calories, avg_hr, max_hr, ces,
      manual_sport_type, manual_intensity,
      manual_distance_m, manual_moving_time_sec, manual_elevation_gain_m,
      raw_payload
    `)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!row) notFound()

  const payload = (row.raw_payload ?? {}) as RawPayload
  const polyline = payload.map?.summary_polyline ?? null

  // Fetch splits on-demand if missing (Strava only)
  let splits: StravaSplit[] | null = payload.splits_metric ?? null

  if (!splits && row.provider === 'strava' && row.provider_activity_id) {
    try {
      const token  = await getValidStravaToken(user.id)
      const detail = await fetchStravaActivity(token, Number(row.provider_activity_id)) as RawPayload
      splits = detail.splits_metric ?? null
      if (splits) {
        await supabase
          .from('activities')
          .update({ raw_payload: { ...payload, splits_metric: splits } })
          .eq('id', row.id)
      }
    } catch {
      // Non-blocking — splits tab won't show
    }
  }

  const activity = row as unknown as ActivityDetail

  return (
    <div style={{ minHeight: '100dvh', background: '#0f1219', overflowY: 'auto' }}>
      <ActivityDetailClient
        activity={activity}
        polyline={polyline}
        splits={splits}
      />
    </div>
  )
}
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Attendu : aucune erreur

- [ ] **Step 4 : Lancer la suite de tests complète**

```bash
cd web && npm test --no-coverage 2>&1 | tail -15
```

Attendu : tous les tests passent

- [ ] **Step 5 : Commit final**

```bash
cd web
git add "app/activities/[id]/page.tsx"
git commit -m "feat(detail): page /activities/[id] server component avec fetch splits Strava"
```

---

## Task 9 — Vérification manuelle dans le navigateur

- [ ] **Step 1 : Lancer le serveur de dev**

```bash
cd web && npm run dev
```

- [ ] **Step 2 : Naviguer vers la liste d'activités**

Ouvrir `http://localhost:3000/activities` — vérifier que les cards sont cliquables (curseur pointeur).

- [ ] **Step 3 : Cliquer sur une activité**

Vérifier :
- ✓ Navigation vers `/activities/[id]`
- ✓ Carte sombre s'affiche avec la route en orange
- ✓ Boutons ← et ✏️ visibles en overlay
- ✓ 6 tuiles de stats affichées
- ✓ Onglet Splits visible (si activité Strava)
- ✓ Barres de splits colorées (vert → rouge selon allure)
- ✓ Onglet Zones FC visible (si avg_hr + max_hr présents)
- ✓ Bouton ← → retour à la liste

- [ ] **Step 4 : Tester le bouton ✏️**

Cliquer ✏️ → le modal d'édition s'ouvre. Modifier un champ → sauvegarder. Vérifier que les stats se mettent à jour.

- [ ] **Step 5 : Tester une activité sans polyline**

Si une activité n'a pas de `summary_polyline` dans `raw_payload`, vérifier que le placeholder "Carte non disponible" s'affiche sans erreur.
